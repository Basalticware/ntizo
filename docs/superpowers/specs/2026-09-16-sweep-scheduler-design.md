# Sweep scheduler — Design

**Status:** approach approved in brainstorming, 2026-09-16 (option 1 of 3). Awaiting the owner's
review of this document before a plan is written.

**Deadline:** in production on QA before **2026-09-24** and on prod before **2026-09-27**. Those are
the days each Neon free project runs out of compute at today's rate (see "Why").

## What this is

The API runs every sweep from a Cloudflare cron that fires every minute (`* * * * *` in the dev, qa
and prod envs of `apps/backend/api/wrangler.jsonc`). Each run sends four SELECTs to Postgres, even
when nothing is due. This design replaces "look every minute" with "wake up when something is due":
a Durable Object holds the earliest due time as an alarm, the alarm runs the same four sweeps, and
the cron drops to an hourly safety net.

The sweeps themselves do not change. What changes is **when** they run.

## Why

Neon's free plan suspends a compute only after 5 idle minutes and gives each project 100 CU-hours a
month. A query every minute means the compute never suspends, which costs 0.25 CU × 24 h = 6 CU-hours
a day. Measured on 2026-09-16 through the Neon API, org "Não Tem":

| Project | CU-hours used | Active hours | Reaches 100 |
|---|---|---|---|
| `ntizo` (old dev) | 105.4 | 373.6, i.e. every hour since Sep 1 | already exceeded; dev moved to `ntizo-dev` |
| `ntizo-qa` | 46.5 | 164.3, i.e. every hour since it went live | ~Sep 24 |
| `ntizo-pro` | 31.3 | 124.8 | ~Sep 27 |

A new free project buys about 16 days. Spacing the cron was rejected by the owner as not the right
fix. A paid plan would pay for a compute that sits awake doing nothing.

## What exists

Read from `origin/dev` at `abde0123`.

- **`apps/backend/api/src/scheduled.ts`** runs four sweeps in order, each in its own try/catch:
  1. `communication.internal.notifyUnread`
  2. `booking.internal.sweepDue`
  3. `booking.internal.chargeAccepted`
  4. `quote.internal.sweepDue`

  It opens the infra store scope itself and closes the DB with `closeDbBehindDeferredWork`.
- **Every deadline is a timestamp written when something happens.** None of them needs polling to be
  discovered:

  | Sweep | Due when | Written by |
  |---|---|---|
  | notify unread | `notify_due_at <= now`, unread, not notified; `notify_due_at = created_at + 120s` | `SendMessage`, `ReplyToSupportRequest`, `OpenSupportRequest` |
  | booking deadlines | `status IN DEADLINE_BEARING AND expires_at <= now` (30 min draft, 120 min provider, 15 min payment, `endsAt`, +7 d, +3 d) | create, submit, accept, create-from-quote, markPaid, keepOpen, markDone, the sweep itself |
  | booking charge | `PENDING_PAYMENT`, `charge_attempts < 3`, never attempted or last attempt ≥ 5 min ago, `expires_at > now + 180s` | accept, create-from-quote, `ChargeBookingCommand` (from the sweep, or from "Pagar" through `DeferredBookingCharge`) |
  | quote | `status IN (REQUESTED, PROPOSED) AND expires_at <= now` (48 h respond, 72 h validity) | request, propose, mark-proposal-stale |

- **Each predicate already has a partial index:** `idx_message_notify_due`, `booking_sweep_idx`,
  `booking_charge_idx`, `quote_sweep_idx`.
- **Overlapping runs are not safe for every sweep.** Verified while implementing:
  - The quote sweep and four of the five booking arms change the row's status through a compare-and-swap, so a second run finds nothing to do.
  - The booking sweep's first `CONFIRMED` firing ("ask the provider") keeps the status, so an overlapping run can ask twice, or close the booking at once instead of a week later.
  - `notifyUnread` reads with a plain SELECT and marks rows without a guard, so an overlap can send a notice twice.
  - Hence decision 4: the sweeps run only in the scheduler's alarm.
- **Wiring and bindings:**
  - `configMiddleware` opens the per-request infra scope and closes the DB behind deferred work.
  - `infraStore.getDbConnection()` is non-null only when the request actually opened a connection.
  - The Worker has no KV, Durable Object, Queue or Workflow binding; only R2.
  - `DelayedJobsPort.scheduleBookingDeadline` exists, called from three booking commands, with a no-op
    adapter.

## Decisions taken, and why

1. **A Durable Object alarm, not per-writer hooks.** A singleton Durable Object `SweepScheduler` keeps
   one alarm, set to the earliest due time known. When it fires it runs the four sweeps, asks
   Postgres for the next earliest due time, and sets the alarm again. SQLite-backed Durable Objects are
   on the Workers Free plan (100,000 requests/day, alarms count as requests), and an alarm handler gets
   15 minutes of wall time, the same as a cron.
2. **Refresh after requests, not at each write site.** Fourteen commands across three contexts create or
   move a deadline, and more will come. Teaching each one to notify the scheduler means one missed
   call is one deadline that silently waits for the safety net. Instead, **after any POST request that
   opened a database connection**, the API recomputes the next due time from Postgres and hands it to
   the scheduler, in `waitUntil`, after the response.
   - The database is already awake for that request, so the recompute costs no extra compute.
   - Every present and future writer is covered without touching it.
   - The cost is four indexed MIN queries and one Durable Object call per POST that touched the DB.
3. **Earlier replaces later; later never replaces earlier.** `wakeAt(t)` sets the alarm only if none
   is set or `t` is earlier. An alarm that fires early does no harm: the handler recomputes and sets
   the next one. A missing early alarm is the only real failure, so the rule never pushes an alarm
   later.
4. **The sweeps run only in the scheduler's alarm; the cron stays, hourly, as a safety net.** A Durable Object runs one alarm handler at a time, so sweep runs never overlap, which two of the sweeps need (see "What exists"). `0 * * * *` in every env recomputes the next due time and tells the scheduler. It covers:
   - a scheduler never told, e.g. right after the first deploy or after a failed refresh;
   - a deadline written outside a POST request.

   The cron runs the sweeps itself only when it cannot tell the scheduler: no binding, the recompute failed, or the wake was refused. There a missed deadline is worse than a rare overlap. It wakes the database 24 times a day, about 5 minutes each: 0.25 CU × 2 h ≈ 15 CU-hours a month, against 180 today.
5. **The recompute mirrors each sweep's own predicate**, as a `nextDueAt()` beside each sweep, in the
   same repository, so the two cannot drift apart unnoticed. For the charge sweep, a booking never
   attempted is due now, and one attempted is due at `last_charge_attempt_at + 5 min`.
6. **A floor under the next alarm.** When the recompute returns a time at or before now (something is
   due but its sweep failed or hit its limit), the alarm is set to now + 30 s. That prevents a hot loop
   while still draining a backlog within seconds. When the same earliest due time is still overdue
   after consecutive runs, the gap doubles up to 15 minutes, so a row whose sweep keeps failing cannot
   keep the database awake. The one bounded exception is a charge "due now" on a stage whose payment
   processor is not configured, which lasts only until that booking's payment window closes.
7. **`DelayedJobsPort` is left alone.** It is a no-op today and this design does not need it. Removing
   it is a separate clean-up.

## Components

### `SweepScheduler` Durable Object — `apps/backend/api/src/sweep-scheduler/`

- Singleton addressed by `env.SWEEP_SCHEDULER.idFromName("sweeps")`, SQLite storage backend. It stores
  its alarm and, under the key `overdue`, the overdue record `{ dueAt, gapMs }`: the earliest due time
  still due after the last run and the gap it was given, which is what the backoff in decision 6 reads.
- `wakeAt(at: number): Promise<void>` (RPC):
  1. `current = await storage.getAlarm()`
  2. `target = max(at, Date.now())`
  3. if `current === null || target < current`, then `setAlarm(target)`
- `alarm(): Promise<void>`: opens the same infra scope `scheduled.ts` opens, then runs
  `handleAlarm`:
  1. reads the alarm the platform reports for this run (`fired`);
  2. runs `runSweeps()`. A throw is logged and never stops the rescheduling;
  3. `next = await computeNextDueAt()`, then chooses a target:
     - **`next` is null:** forget the overdue record and set no alarm;
     - **still overdue (`next <= now`):** if the same due time was overdue after the previous run, double the gap (30 s up to 15 min), otherwise use 30 s; remember it under `overdue`; the target is `now + gap`;
     - **in the future:** forget the overdue record; the target is `max(next, now + 30 s)`;
  4. sets the target only if no alarm is set, the set alarm is the one that fired, or the target is
     earlier, so an earlier alarm a request set mid-run is kept;
  5. awaits the deferred work the sweeps started, then closes the DB.

  If the recompute itself throws (for example, the database is unreachable), the target is
  now + 15 min under the same rule, and the error is logged.

### `runSweeps()` — extracted from `scheduled.ts`

The four sweep calls and their per-sweep try/catch move unchanged into one function, shared by
`scheduled()` and `SweepScheduler.alarm()`. `scheduled()` becomes: open scope → refresh → `runSweeps()` only if the refresh could not tell the scheduler → close DB.

### `nextDueAt()` per context, composed in the API

| Context | Use case | Query |
|---|---|---|
| communication | `internal.nextNoticeDueAt` | `MIN(notify_due_at)` where `notify_due_at IS NOT NULL AND read_at IS NULL AND notified_at IS NULL` |
| booking | `internal.nextDeadlineAt` | `MIN(expires_at)` where `status IN DEADLINE_BEARING AND expires_at IS NOT NULL` |
| booking | `internal.nextChargeDueAt` | `MIN(CASE WHEN last_charge_attempt_at IS NULL THEN now() ELSE last_charge_attempt_at + 5 min END)` over the charge predicate minus its time conditions, plus `expires_at > now() + 180s` |
| quote | `internal.nextDueAt` | `MIN(expires_at)` where `status IN (REQUESTED, PROPOSED) AND expires_at IS NOT NULL` |

- `computeNextDueAt()` in `apps/backend/api/src/sweep-scheduler/next-due.ts` returns the smallest
  non-null value, or null.
- Each repository method sits next to the sweep query it mirrors and reuses the same constants
  (`DEADLINE_BEARING_STATUSES`, `BOOKING_CHARGE_ATTEMPT_LIMIT`, `BOOKING_CHARGE_RETRY_MINUTES`,
  `BOOKING_CHARGE_MIN_WINDOW_MS`).

### Refresh — `refreshSweepSchedule(env)`

- **What it returns:** `true` when the scheduler now knows the next due time, or nothing is due; `false` when there is no binding, the recompute threw, or the wake threw or was refused.
- **What it does:**
  1. `next = await computeNextDueAt()`
  2. if non-null, `await env.SWEEP_SCHEDULER.get(id).wakeAt(next)`
  3. errors are logged with `console.error("[sweep-scheduler] refresh failed", …)` and never rethrown.
- **Where it is called:**
  - in `configMiddleware`'s `finally`, before `closeDbBehindDeferredWork`, when
    `c.req.method === "POST"` and `infraStore.getDbConnection()` is non-null, through
    `infraStore.waitUntil` so the DB close stays behind it;
  - at the end of `scheduled()`.

### Configuration

- `wrangler.jsonc`:
  - `durable_objects.bindings: [{ name: "SWEEP_SCHEDULER", class_name: "SweepScheduler" }]`, repeated
    in dev, qa and prod because bindings are not inherited;
  - one migration `{ tag: "v1-sweep-scheduler", new_sqlite_classes: ["SweepScheduler"] }`;
  - `triggers.crons` becomes `["0 * * * *"]` in dev, qa and prod;
  - `SWEEP_SCHEDULER_ENABLED: "true"` in the `vars` of dev, qa and prod, and absent from the top-level
    `vars`. The scheduler is used only when it is exactly `"true"`. A local `wrangler dev` has the
    binding too, and its `.dev.vars` point at the shared dev database, so without the flag it would run
    a second scheduler against dev's data. It is also the kill switch (see "Rollout, verification and
    rollback").
- `src/index.ts` exports `SweepScheduler` beside `fetch` and `scheduled`.
- `AppBindings` gains `SWEEP_SCHEDULER?: DurableObjectNamespace<SweepScheduler>`, optional so tests
  and local tooling without it keep working. The refresh is a no-op when the binding is absent.

## Data flow, by example

- **A message is sent (10:00:00).**
  1. The mutation commits `notify_due_at = 10:02:00`.
  2. The response returns, and the refresh computes 10:02:00 and calls `wakeAt`.
  3. The alarm fires at 10:02:00, and the notify sweep emails the recipient if the message is still
     unread.
  4. The recompute finds nothing else, so no alarm is set.
  5. Postgres suspends at ~10:07.
- **A provider accepts a booking.**
  1. The mutation commits `PENDING_PAYMENT`, never attempted.
  2. The refresh computes "now", and the alarm fires within seconds.
  3. The charge sweep sends the M-Pesa prompt. This is faster than today's up-to-60 s.
  4. If the charge fails, the recompute gives `last_attempt + 5 min`, and the alarm is set there.
- **Nothing happens for a day.** No alarm is set, the cron wakes Postgres once an hour, and each
  run finds nothing.

## Error handling

- **Refresh fails** (Durable Object error, DB error): logged; the response is unaffected; the next refresh or the hourly cron repairs it. If the hourly cron's own refresh fails, it runs the sweeps itself, so a deadline is at most 1 hour late.
- **A sweep throws inside the alarm:** it is caught per sweep, exactly as today, and the others still
  run. The recompute in `finally` still sets the next alarm; the floor stops a hot loop.
- **The alarm handler itself throws** (should not, given the above): Cloudflare retries up to 6 times
  with exponential backoff from 2 s.
- **The Neon compute cannot start** (limit reached): the recompute fails and the alarm backs off to
  15 min. The hourly cron keeps trying. No tight retry loop wakes anything.

## Business rules preserved

- Time-sensitive deadlines are not later than today, and the charge and short windows get earlier:
  - message notice at 2 min (today "at most three minutes, usually two");
  - draft hold 30 min, provider response 120 min, payment window 15 min;
  - M-Pesa prompt within seconds of acceptance.
- Every sweep's claim and idempotency guarantees are untouched.

## Explicitly out of scope

- Removing the cron entirely.
- Cloudflare Queues or Workflows.
- Per-writer scheduling calls.
- Deleting `DelayedJobsPort`.
- An isolate-level memo to skip redundant `wakeAt` calls; add it only if Durable Object requests ever
  approach the free limit.
- Upgrading any Neon plan.

## Testing

- **Unit, `SweepScheduler`** (fake storage with `getAlarm`/`setAlarm`):
  - an earlier `wakeAt` replaces a later alarm;
  - a later one is ignored;
  - a past time is clamped to now;
  - the alarm runs the sweeps, then sets the next due time;
  - a next time in the past becomes now + 30 s;
  - null sets no alarm;
  - a throwing sweep still reschedules;
  - a throwing recompute sets now + 15 min.
- **Real DB** (existing `DEV_DB_URL` test pattern), one test per `nextDueAt`:
  - for each sweep, a row its sweep query would pick up yields a next due time ≤ now;
  - a row it would not pick up yields that row's future time or null;
  - the charge rules: never attempted → now; attempted → +5 min; attempts exhausted or window closing
    → excluded.
- **Middleware:**
  - refresh runs for a POST that opened a DB connection;
  - it does not run for a GET, or for a POST that never touched the DB;
  - a failing refresh does not change the response.
- **`wrangler-cron-trigger.test.ts`:** replace "runs at least once a minute" with:
  - every env declares the hourly safety cron;
  - every env declares the `SWEEP_SCHEDULER` binding;
  - the migration lists `SweepScheduler`.

  The old assertion's reason (the 2-minute notice window) moves to the scheduler tests.
- **`scheduled.test.ts`:** still runs all four sweeps in order and survives throws, and now also
  refreshes.
- **Local end to end** with the e2e harness (wrangler dev runs Durable Objects and alarms locally):
  1. send a message;
  2. observe the notify email printed about 2 minutes later with no minute cron;
  3. observe no sweep queries while idle.

## Rollout, verification and rollback

Deploys are **forward-only**. The first deploy on each stage applies the Durable Object migration `v1-sweep-scheduler`. Cloudflare refuses `wrangler rollback` across a Durable Object migration, and removing the class would need a delete migration. So there is no rollback by reverting.

- **The first deploy per stage must be `wrangler deploy`** (`bun run deploy:<stage>` in `apps/backend/api`), not `wrangler versions upload`, which does not apply migrations.
- **Right after each deploy,** make one POST that touches the database (any GraphQL call), so the scheduler learns the next due time at once instead of at the next hourly run.
- **Kill switch, if the scheduler misbehaves:** set `SWEEP_SCHEDULER_ENABLED` to `"false"` in that stage's `vars`, set its cron back to `* * * * *`, and `wrangler deploy`. The refresh then finds no scheduler, and the cron runs the sweeps every minute exactly as before. The class and its migration stay in place, harmless.

Verification per stage:

1. Merge to `dev`, deploy the API to dev. Watch the Neon endpoint: `last_active` stops advancing between requests, and the endpoint reaches `idle` within ~5 minutes of the last request or hourly run.
2. On dev, send a message between two test accounts. The notification is recorded about 2 minutes later.
3. Deploy to QA before Sep 24, then to prod before Sep 27, with the same idle check.
4. A week later, check Neon consumption: daily CU-hours on an idle stage should fall from ~6 to under 1.

## Phasing

One PR. The pieces are small, and only useful together.
