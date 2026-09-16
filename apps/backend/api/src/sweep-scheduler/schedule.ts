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

/** What the scheduler remembers between runs about a due time that did not clear. */
export interface OverdueRecord {
  dueAt: number;
  gapMs: number;
}

/** Where that memory lives — Durable Object storage in production, a fake in tests. */
export interface OverdueMemory {
  read(): Promise<OverdueRecord | null>;
  write(record: OverdueRecord | null): Promise<void>;
}

/** The longest a stuck row can push the next run out. */
export const MAX_STUCK_GAP_MS = 15 * 60_000;

/** Storage key for the overdue record. */
export const OVERDUE_KEY = "overdue";

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
 *
 * An alarm already due — about to fire, or firing right now and still
 * reported — is set to now rather than left alone. If it is the one running,
 * the work this request just made due would otherwise wait for whatever that
 * run schedules next; setting it costs at most one extra run.
 */
export async function wakeAt(storage: AlarmStorage, at: number, now: number): Promise<void> {
  const target = Math.max(at, now);
  const current = await storage.getAlarm();
  if (current === null || target < current) {
    await storage.setAlarm(target);
  } else if (current <= now) {
    await storage.setAlarm(now);
  }
}

export interface AlarmDeps {
  storage: AlarmStorage;
  memory: OverdueMemory;
  runSweeps: () => Promise<void>;
  nextDueAt: () => Promise<Date | null>;
  now: () => number;
}

/**
 * Sets the alarm after a run, unless a request set an earlier one meanwhile.
 *
 * `fired` is what the platform reported for the alarm before the run started:
 * its own time, or null. A current value equal to it is that alarm, and is
 * replaced. A different value was set by a request during the run, and is kept
 * when it is earlier.
 */
async function scheduleAfterRun(storage: AlarmStorage, fired: number | null, target: number): Promise<void> {
  const current = await storage.getAlarm();
  if (current === null || current === fired || target < current) await storage.setAlarm(target);
}

/**
 * One alarm: run everything due, then decide when to wake next.
 *
 * The next time is floored to `now + MIN_ALARM_GAP_MS`. Something still due
 * after a run means its sweep failed or hit its limit, and trying again
 * instantly would spin.
 *
 * **A due time that stays due backs off.** When the earliest due time after a
 * run is the same one that was still due after the previous run, the gap
 * doubles, up to `MAX_STUCK_GAP_MS`; any other earliest time starts over at
 * the floor. Keyed on that time being unchanged because it tells the two
 * cases apart: a backlog that is draining clears its earliest rows, so its
 * earliest time moves run by run and it keeps the 30-second pace; a row whose
 * sweep keeps failing stays first, and without the backoff it would poll
 * every 30 seconds for ever and keep the database from ever suspending.
 *
 * One bounded case does not back off: a booking accepted while the payment
 * processor is not configured is never attempted, so its charge is "due now"
 * on every run and its due time moves with the clock. That lasts only until
 * its payment window closes (at most about 12 minutes), when the deadline
 * sweep cancels it.
 */
export async function handleAlarm(deps: AlarmDeps): Promise<void> {
  const fired = await deps.storage.getAlarm();

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
    await scheduleAfterRun(deps.storage, fired, deps.now() + RECOMPUTE_FAILURE_RETRY_MS);
    return;
  }
  if (!next) {
    await deps.memory.write(null);
    return;
  }

  const now = deps.now();
  let target: number;
  if (next.getTime() <= now) {
    const previous = await deps.memory.read();
    const gapMs =
      previous && previous.dueAt === next.getTime()
        ? Math.min(previous.gapMs * 2, MAX_STUCK_GAP_MS)
        : MIN_ALARM_GAP_MS;
    if (gapMs > MIN_ALARM_GAP_MS) {
      console.error("[sweep-scheduler] a due row is still due after a run; backing off", {
        dueAt: next.toISOString(),
        gapMs,
      });
    }
    await deps.memory.write({ dueAt: next.getTime(), gapMs });
    target = now + gapMs;
  } else {
    await deps.memory.write(null);
    target = Math.max(next.getTime(), now + MIN_ALARM_GAP_MS);
  }
  await scheduleAfterRun(deps.storage, fired, target);
}

/**
 * Only a POST can have written a deadline, and only one that opened a
 * connection can have written anything. The check costs nothing; the refresh
 * it guards costs four indexed queries and one Durable Object call.
 */
export function shouldRefreshAfterRequest(method: string, usedDatabase: boolean): boolean {
  return method === "POST" && usedDatabase;
}
