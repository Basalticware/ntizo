/**
 * The sweep scheduler's rules, with no Cloudflare in them.
 *
 * `SweepScheduler` (sweep-scheduler.do.ts) is a thin shell over these; it
 * cannot itself be imported into bun's test runner without dragging a
 * platform in, and the rules are the part worth testing.
 */

/** The two calls the rules need from `DurableObjectState.storage`. */
export interface AlarmStorage {
  getAlarm(): Promise<number | null>;
  setAlarm(scheduledTime: number): Promise<void>;
}

/** The soonest a run may be followed by another — the floor under a past due time. */
export const MIN_ALARM_GAP_MS = 30_000;

/** How long to wait before trying again when the next due time cannot be read. */
export const RECOMPUTE_FAILURE_RETRY_MS = 15 * 60_000;

/** The one scheduler per environment, addressed by name. */
export const SWEEP_SCHEDULER_NAME = "sweeps";

/** Where a refresh posts `{ at }`. The host is never resolved; a stub routes by object. */
export const WAKE_URL = "https://sweep-scheduler/wake";

/**
 * Earlier replaces later; later never replaces earlier.
 *
 * An alarm that fires early costs one run that finds nothing and reschedules.
 * An alarm pushed late is a deadline missed until the hourly cron, so this
 * never does that.
 */
export async function wakeAt(storage: AlarmStorage, at: number, now: number): Promise<void> {
  const target = Math.max(at, now);
  const current = await storage.getAlarm();
  if (current === null || target < current) await storage.setAlarm(target);
}

export interface AlarmDeps {
  storage: AlarmStorage;
  runSweeps: () => Promise<void>;
  nextDueAt: () => Promise<Date | null>;
  now: () => number;
}

/**
 * One alarm: run everything due, then decide when to wake next.
 *
 * The next time is floored to `now + MIN_ALARM_GAP_MS`: something still due
 * after a run means its sweep failed or hit its limit, and trying again
 * instantly would spin. An alarm a request set *during* the run is kept when it
 * is earlier. The one that just fired is replaced whatever the platform
 * reports for it, because a reported time at or before now is that alarm.
 */
export async function handleAlarm(deps: AlarmDeps): Promise<void> {
  try {
    await deps.runSweeps();
  } catch (error) {
    // runSweeps catches per sweep; this is the backstop, so a scheduling
    // decision is still made.
    console.error("[sweep-scheduler] the sweeps threw", error);
  }

  let next: Date | null;
  try {
    next = await deps.nextDueAt();
  } catch (error) {
    console.error("[sweep-scheduler] could not work out when the sweeps next have work", error);
    await deps.storage.setAlarm(deps.now() + RECOMPUTE_FAILURE_RETRY_MS);
    return;
  }
  if (!next) return;

  const now = deps.now();
  const target = Math.max(next.getTime(), now + MIN_ALARM_GAP_MS);
  const current = await deps.storage.getAlarm();
  if (current === null || current <= now || target < current) await deps.storage.setAlarm(target);
}

/**
 * Only a POST can have written a deadline, and only one that opened a
 * connection can have written anything. The check costs nothing; the refresh
 * it guards costs four indexed queries and one Durable Object call.
 */
export function shouldRefreshAfterRequest(method: string, usedDatabase: boolean): boolean {
  return method === "POST" && usedDatabase;
}
