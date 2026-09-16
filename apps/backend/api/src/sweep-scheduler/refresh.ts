import type { DurableObjectNamespace } from "@cloudflare/workers-types";
import { computeNextDueAt } from "./next-due";
import { SWEEP_SCHEDULER_NAME, WAKE_URL } from "./schedule";

/**
 * Tells the scheduler when the sweeps next have work.
 *
 * Called after every POST that touched the database (see configMiddleware)
 * and at the end of the hourly cron. The database is already awake for both,
 * which is the point: the question costs no compute of its own. Every present
 * and future write of a deadline is covered without any of them knowing this
 * exists.
 *
 * Never rejects. It runs in `waitUntil` after a response has gone, and a
 * failed refresh only means the hourly cron catches that deadline instead.
 */
export async function refreshSweepSchedule(
  namespace: DurableObjectNamespace | undefined,
  nextDueAt: () => Promise<Date | null> = computeNextDueAt,
): Promise<void> {
  if (!namespace) return;
  try {
    const next = await nextDueAt();
    if (!next) return;
    const stub = namespace.get(namespace.idFromName(SWEEP_SCHEDULER_NAME));
    const response = await stub.fetch(WAKE_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ at: next.getTime() }),
    });
    if (!response.ok) console.error("[sweep-scheduler] wake refused", response.status);
  } catch (error) {
    console.error("[sweep-scheduler] refresh failed", error);
  }
}
