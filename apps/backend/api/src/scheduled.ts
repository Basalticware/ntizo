import { infraStore } from "@ntizo/backend/shared/infra";
import { closeDbBehindDeferredWork } from "@ntizo/backend/shared/infra/database";
import { toInfraEnv } from "./infra-env";
import { runSweeps } from "./sweep-scheduler/sweeps";
import { refreshSweepSchedule } from "./sweep-scheduler/refresh";
import type { AppBindings } from "./types";

// Re-exported: scheduled.test.ts and anyone reading the cron still find them here.
export {
  SWEEP_LIMIT,
  BOOKING_SWEEP_LIMIT,
  BOOKING_CHARGE_LIMIT,
  QUOTE_SWEEP_LIMIT,
} from "./sweep-scheduler/sweeps";

/**
 * The worker that wakes up to check for unread messages.
 *
 * Nothing calls `NotifyUnreadInternalCommand` unless something schedules it —
 * this is that something. Without it, every message is composed, stored, and
 * nobody is ever told: `notifyDueAt` sits in the table forever and the sweep
 * that would turn it into a bell-plus-email notification never runs.
 *
 * **A `scheduled` handler is not an HTTP request.** `configMiddleware`
 * establishes the request-scoped `infraStore` AsyncLocalStorage context for
 * every fetch. A cron invocation has no request for that middleware to wrap,
 * so this function builds the same context by hand (`infraStore.runAsync`
 * below) — the only other place in this codebase that does. Deep inside
 * the sweep, `DeferredNotificationDelivery.execute()` calls
 * `infraStore.waitUntil(...)` and template rendering reads
 * `infraStore.getEnv()` for `APP_URL`; both throw ("not initialized... Ensure
 * configMiddleware wraps the request") outside that scope. Worse, the raise
 * and `markNotified` happen *before* the deferred email delivery is awaited,
 * so an unwrapped call would still mark every message notified while its
 * email throws inside `DeferredNotificationDelivery`'s own `.catch` and
 * vanishes — permanent, silent email loss with every test green. Hence the
 * context built below, before anything that reads it runs.
 *
 * The per-request `{ max: 1 }` postgres pool this scope opens has the same
 * problem `configMiddleware` solves for a request: the sweep defers email
 * delivery past its own return, and Cloudflare does not order `waitUntil`
 * tasks against each other, so the close must be chained *behind* the
 * deferred work rather than scheduled beside it. Shares
 * `closeDbBehindDeferredWork` with `configMiddleware` rather than
 * hand-copying that chain a second time — see that function's own doc
 * comment for the full argument.
 *
 * **The booking sweep runs in this same scope, not a second one of
 * its own.** A booking's `expires_at` — whichever of the five windows
 * stamped it — is the same shape of question against the same clock as a
 * message's `notifyDueAt`, and this
 * function already builds the one context a cron invocation needs — a
 * second `infraStore.runAsync` would mean a second `{ max: 1 }` connection
 * and a second close racing this one. Unlike the notification sweep,
 * `SweepDueBookingsInternalCommand` defers nothing past its own `await`:
 * each booking's transaction commits and its outbox dispatch runs
 * synchronously inside `SweepBookingCommand.execute`, so it needs nothing
 * from `infraStore.waitUntil` — it only needs the DB context this scope
 * already set up.
 *
 * **So does the charge sweep, which is the third question this handler
 * asks.** The first two are about clocks — is a message still unread, has a
 * booking's deadline passed. The third is about money: which accepted
 * bookings still owe a charge (`ChargeAcceptedBookingsInternalCommand`). It
 * needs the same DB context and, like the booking sweep, nothing from
 * `waitUntil`; unlike either of the others it also needs the M-Pesa
 * credentials carried into the env below, and it is the only one of the three
 * whose runtime is measured in minutes rather than milliseconds — see
 * `BOOKING_CHARGE_LIMIT`.
 */
export async function scheduled(
  controller: ScheduledController,
  env: AppBindings,
  ctx: ExecutionContext,
): Promise<void> {
  await infraStore.runAsync(toInfraEnv(env), async () => {
    infraStore.setHyperdrive(
      (env as unknown as { HYPERDRIVE?: { connectionString: string } }).HYPERDRIVE,
    );
    // No accept-language / timezone to carry: those come off a request header
    // and a cron invocation has no request. Registered before the sweeps run,
    // so deferred work started inside one can hand the platform its promise.
    infraStore.setWaitUntil(ctx.waitUntil.bind(ctx));

    try {
      await runSweeps();
      // The hourly cron is the scheduler's safety net: it re-tells the alarm
      // about anything a failed refresh or a first deploy left it not knowing.
      await refreshSweepSchedule(env.SWEEP_SCHEDULER);
    } finally {
      // Workers run nothing after this function returns unless scheduled —
      // and the deferred work scheduled above still needs this run's
      // `{ max: 1 }` postgres pool. See `closeDbBehindDeferredWork`.
      closeDbBehindDeferredWork((promise) => ctx.waitUntil(promise));
    }
  });
}
