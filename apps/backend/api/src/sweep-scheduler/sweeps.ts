import { bootstrapNotification } from "@ntizo/backend/modules/ntizo/bounded-contexts/notification";
import { bootstrapCommunication } from "@ntizo/backend/modules/ntizo/bounded-contexts/communication";
import {
  bootstrapBooking,
  type OpenDisputeThreadPort,
} from "@ntizo/backend/modules/ntizo/bounded-contexts/booking";
import {
  bootstrapQuote,
  type BookingOpenerPort,
  type StartThreadPort,
} from "@ntizo/backend/modules/ntizo/bounded-contexts/quote";
import { AttachmentStorageAdapter } from "../attachment-storage.adapter";
import { disputeThreadOver } from "../dispute-thread.adapter";
import { bookingOpenerOver } from "../booking-opener.adapter";
import { startThreadOver } from "../start-thread.adapter";

/**
 * How many due messages one sweep may claim.
 *
 * The sweeps run as soon as a notice falls due (see `handleAlarm` in
 * schedule.ts) against a two-minute notify window, so under any plausible
 * load one wave clears the queue before the next wave starts. This is a
 * generous ceiling against a runaway backlog, not a throttle a normal run is
 * expected to hit.
 */
export const SWEEP_LIMIT = 200;

/**
 * How many due bookings one sweep may claim.
 *
 * The sweeps run as soon as a deadline falls due (see `handleAlarm` in
 * schedule.ts) against three administrator-configured windows, not one: the
 * checkout hold a `DRAFT` stands on, the response window an
 * `AWAITING_PROVIDER` gives the provider, and the payment window a
 * `PENDING_PAYMENT` gives the customer — all
 * `platform_settings` columns, all read through `PlatformSettingsReaderPort`
 * in the booking bounded context, the shortest of them measured in minutes.
 * Under any plausible load whatever went stale since the last run across all
 * three is a small fraction of this ceiling, and one wave clears it before
 * the next wave starts. Shorter windows only shrink the possible backlog
 * further, so 200 stays a generous ceiling against a runaway backlog either
 * way — not a throttle a normal run is expected to hit — kept as its own
 * constant, not a reuse of `SWEEP_LIMIT` above, because the two sweeps are
 * budgeting against different windows on different tables and have no reason
 * to share a number just because it currently matches.
 */
export const BOOKING_SWEEP_LIMIT = 200;

/**
 * How many accepted bookings one wave may charge.
 *
 * **Two orders of magnitude below the two limits above, and the arithmetic is
 * the reason.** Those sweeps do database work: two hundred rows is two
 * hundred short transactions and a wave finishes in well under a second. A
 * charge is an M-Pesa C2B, which *blocks* — it pushes a prompt to a handset
 * and does not answer until the customer accepts, refuses, or about sixty
 * seconds pass (measured: `INS-9 Request timeout` at 62s against the live
 * sandbox). They cannot be run in parallel either: this scope's Postgres pool
 * is `{ max: 1 }`, so concurrent charges would interleave transactions on one
 * connection. So a wave costs roughly `limit × 60s`, and five is what fits
 * comfortably inside a scheduled invocation's wall-clock budget with room for
 * the two sweeps that ran before it.
 *
 * A backlog is not lost, only spread: the scheduler runs again 30 seconds
 * after a run that left bookings due (see `handleAlarm` in schedule.ts), and
 * `ChargeAcceptedBookingsInternalCommand`'s own cooldown means the next
 * wave picks up different bookings rather than re-prompting these. Runs do
 * not overlap, so a wave of five unanswered prompts (five to ten minutes)
 * holds the next back until it ends: roughly thirty to fifty bookings an
 * hour at worst, more when customers answer, against a payment window
 * measured in minutes — the number to revisit first if that is ever not
 * enough.
 */
export const BOOKING_CHARGE_LIMIT = 5;

/**
 * How many due quotes one sweep may claim.
 *
 * The same budget as the booking sweep and for the same arithmetic: this is
 * database work, two hundred rows is two hundred short transactions, and the
 * clocks it watches are measured in hours rather than minutes, so whatever
 * goes stale in any one minute is a small fraction of the ceiling.
 */
export const QUOTE_SWEEP_LIMIT = 200;

/**
 * The dispute-thread port `bootstrapBooking` requires, for a caller that will
 * never open a dispute.
 *
 * The sweeps reach `internal.sweepDue` and `internal.chargeAccepted`, and
 * `computeNextDueAt` reaches `internal.nextDueAt`, and nothing else; none of
 * those can dispute anything — but a bootstrap that constructs every use
 * case constructs `DisputeBookingCommand` too, so it needs the real port and
 * not a stub. Same situation as the
 * `AttachmentStorageAdapter` this file already hands `bootstrapCommunication`
 * for a sweep that never touches an attachment.
 *
 * The communication graph behind it is built **inside `execute`**, so a run
 * that never disputes never builds it — which is every run. Constructing it
 * eagerly would also mean reaching for a binding declared in another `try`
 * block, tying the two sweeps' failure modes back together; see the comments
 * at each call site for why that was undone.
 *
 * **Do not read this as a working example.** "Never called" is not the same
 * claim as "would work if it were", and this one would not: the
 * `AttachmentStorageAdapter` above is constructed outside
 * `runWithAttachmentsBucket`, which is what binds the request's
 * `ATTACHMENTS_BUCKET` for it to find (see `graphql/private.ts`, where the
 * same adapter is wrapped per request). A dispute carrying attachments would
 * fail here. Nothing in the sweeps opens one, so nothing exercises that today —
 * but a future scheduled arm that genuinely needs to open a thread has to
 * establish the bucket scope first, not copy this function.
 */
export function disputeThreadForCron(): OpenDisputeThreadPort {
  return {
    execute: (input) =>
      disputeThreadOver(
        bootstrapCommunication({
          raiseNotification: bootstrapNotification().useCases.internal.raiseNotification,
          attachmentStorage: new AttachmentStorageAdapter(),
        }).useCases.openSupportRequest,
      ).execute(input),
  };
}

/**
 * The booking-opener and thread ports the quote bootstrap requires, for a
 * caller that will never accept or request anything.
 *
 * The sweep reaches `internal.sweepDue` and `computeNextDueAt` reaches
 * `internal.nextDueAt`, and nothing else, but a bootstrap that
 * constructs every use case constructs the acceptance too. Same situation as
 * `disputeThreadForCron` above, and the same answer: build the real graph
 * lazily, inside `execute`, so a run that never accepts never builds it.
 */
export function bookingOpenerForCron(): BookingOpenerPort {
  return {
    async openFromQuote(input) {
      const booking = bootstrapBooking({
        raiseNotification: bootstrapNotification().useCases.internal.raiseNotification,
        openDisputeThread: disputeThreadForCron(),
      });
      return await bookingOpenerOver(booking.useCases.createBookingFromQuote).openFromQuote(input);
    },
  };
}

export function startThreadForCron(): StartThreadPort {
  return {
    async execute(input) {
      const communication = bootstrapCommunication({
        raiseNotification: bootstrapNotification().useCases.internal.raiseNotification,
        attachmentStorage: new AttachmentStorageAdapter(),
      });
      return await startThreadOver(communication.useCases.startThread).execute(input);
    },
  };
}

/**
 * The four sweeps, in their order, each in its own try — moved out of
 * `scheduled()` so the hourly cron and the sweep scheduler's alarm run the
 * exact same thing. Must run inside an `infraStore.runAsync` scope; the
 * caller owns that scope and the DB close behind it.
 */
export async function runSweeps(): Promise<void> {
  // Its own try, not shared with the booking sweep below (see that
  // block's own comment for why): a throw here — Communication down,
  // a DB error before `notifyUnread`'s own per-message try/catch even
  // starts — must not skip the booking sweep, an unrelated context with
  // its own permanent-slot-leak problem to prevent.
  try {
    const notification = bootstrapNotification();
    const communication = bootstrapCommunication({
      raiseNotification: notification.useCases.internal.raiseNotification,
      // Never actually called: the sweep only ever reaches
      // `useCases.internal.notifyUnread`, which `bootstrapCommunication`
      // wires independently of `sendMessage` — required here only
      // because `bootstrapCommunication` always constructs
      // `SendMessageCommand` too.
      attachmentStorage: new AttachmentStorageAdapter(),
    });

    const { notified, failed } = await communication.useCases.internal.notifyUnread.execute({
      limit: SWEEP_LIMIT,
    });

    if (failed > 0) {
      // console.error, not the logger: getRequestScopedLogger() throws
      // when no scope is set and a cron invocation sets none — same
      // reason notify-unread.internal.command.ts does this itself.
      console.error(
        `[scheduled] notify-unread sweep: ${notified} notified, ${failed} failed`,
      );
    }
  } catch (error) {
    console.error("[scheduled] notify-unread sweep threw", error);
  }

  // Its own try too: this sweep must run — and must be judged on its
  // own outcome — whether or not the one above threw. Before Task 5 of
  // the booking-seams repair plan, both sweeps shared one `try` with
  // notification first, so anything Communication threw skipped
  // the booking sweep entirely, reinstating the permanent slot leak that
  // sweep exists to prevent, from a context that has nothing to do
  // with bookings.
  try {
    // Its own `bootstrapNotification()` rather than the one inside the
    // block above: reaching across the two `try` blocks for a binding
    // declared in one of them would tie their failure modes back
    // together, which is exactly what splitting them undid. Both are
    // cheap object graphs over the same request-scoped `getDb()`.
    const booking = bootstrapBooking({
      raiseNotification: bootstrapNotification().useCases.internal.raiseNotification,
      // Never called from here — see `disputeThreadForCron`.
      openDisputeThread: disputeThreadForCron(),
    });
    const { swept, failed: bookingFailed } = await booking.useCases.internal.sweepDue.execute({
      limit: BOOKING_SWEEP_LIMIT,
    });

    if (bookingFailed > 0) {
      // Same reasoning as the notify-unread log above: no request scope
      // exists for getRequestScopedLogger() to read. "swept", not
      // "expired": of the five clocks only two end in `EXPIRED`, one
      // ends in `CANCELLED`, one in `COMPLETED`, and one only asks the
      // provider a question — and this line cannot tell them apart, see
      // `SweepDueBookingsInternalCommand.execute`.
      console.error(
        `[scheduled] booking sweep: ${swept} swept, ${bookingFailed} failed`,
      );
    }
  } catch (error) {
    console.error("[scheduled] booking sweep threw", error);
  }

  // The sweeps' third question, and its own `try` for the same reason
  // the second one has one: it must run whether or not either sweep
  // above threw, and it must be judged on its own outcome. It is also
  // the only one of the three that spends real time — see
  // `BOOKING_CHARGE_LIMIT` — so it goes last, after the two cheap
  // questions have already been answered. Ordering it after the
  // deadline sweep is not only about cost: that sweep cancels bookings
  // whose payment window has closed, and running it first means this
  // one never pushes a prompt at a booking that was about to be
  // cancelled anyway. (The two queries are disjoint on `expires_at`
  // regardless — see `findAwaitingCharge` — so the ordering is a
  // second line of defence, not the only one.)
  //
  // A fresh `bootstrapBooking()` rather than reusing the one above:
  // both are cheap object graphs over the same request-scoped `getDb()`,
  // and reaching across the two `try` blocks for a binding declared
  // inside one of them would tie their failure modes back together,
  // which is exactly what splitting them undid.
  try {
    const booking = bootstrapBooking({
      raiseNotification: bootstrapNotification().useCases.internal.raiseNotification,
      // Never called from here either — see `disputeThreadForCron`.
      openDisputeThread: disputeThreadForCron(),
    });
    const { attempted, failed: chargeFailed } =
      await booking.useCases.internal.chargeAccepted.execute({
        limit: BOOKING_CHARGE_LIMIT,
      });

    if (chargeFailed > 0) {
      // Same reasoning as the two logs above: no request scope exists
      // for getRequestScopedLogger() to read. "attempted", not
      // "charged": most attempts that do not become money are the
      // ordinary case (a customer who never answers), and only a throw
      // counts as failed here — see that command's own doc comment.
      console.error(
        `[scheduled] booking charge sweep: ${attempted} attempted, ${chargeFailed} failed`,
      );
    }
  } catch (error) {
    console.error("[scheduled] booking charge sweep threw", error);
  }

  // The sweeps' fourth question, and its own `try` for the same reason
  // the others have one: it must run whether or not any sweep above
  // threw, and it must be judged on its own outcome. Like the two
  // booking sweeps, it needs the same DB context and nothing from
  // `waitUntil` — a due quote just expires, it does not open anything.
  try {
    const quote = bootstrapQuote({
      raiseNotification: bootstrapNotification().useCases.internal.raiseNotification,
      openBooking: bookingOpenerForCron(),
      startThread: startThreadForCron(),
      attachmentStorage: new AttachmentStorageAdapter(),
    });
    const { swept, failed: quoteFailed } = await quote.useCases.internal.sweepDue.execute({
      limit: QUOTE_SWEEP_LIMIT,
    });

    if (quoteFailed > 0) {
      console.error(`[scheduled] quote sweep: ${swept} swept, ${quoteFailed} failed`);
    }
  } catch (error) {
    console.error("[scheduled] quote sweep threw", error);
  }
}
