# Sweep Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the four existing sweeps when something is due, not every minute. Neon's compute can then suspend, and dev, QA and prod stop exhausting 100 CU-hours a month.

**Architecture:**
- **The alarm.** A singleton Durable Object `SweepScheduler` keeps one alarm at the earliest due time. When it fires it runs the unchanged sweeps, recomputes the next due time from Postgres, and sets the alarm again.
- **Refresh.** The API recomputes the next due time after every POST request that opened a DB connection, and at the end of each run.
- **Safety net.** The Cloudflare cron drops from every minute to hourly.

**Tech Stack:**
- Cloudflare Workers with a Durable Object on the SQLite backend, in the legacy class style with no `cloudflare:workers` import. A local spike on 2026-09-16 confirmed this class style works with `new_sqlite_classes` and alarms.
- Hono, drizzle-orm over postgres.js (Neon).
- `bun test` in both `packages/backend` and `apps/backend/api`.

**Spec:** `docs/superpowers/specs/2026-09-16-sweep-scheduler-design.md`

## Global Constraints

- **Deadlines:** in production on QA before **2026-09-24** and on prod before **2026-09-27**.
- **The sweeps do not change:** `notifyUnread`, booking `sweepDue`, booking `chargeAccepted`, quote `sweepDue` keep their queries, limits, order and per-sweep try/catch.
- **Refresh scope:** refresh runs only for `POST` requests that opened a DB connection. It runs in `waitUntil`, never throws, and does nothing when `SWEEP_SCHEDULER` is absent.
- **`wakeAt` rule:** an earlier time replaces the alarm; a later one never does.
- **After an alarm run:** the next alarm is `max(next, now + 30_000 ms)`. When the recompute throws, it is `now + 15 * 60_000 ms`.
- **Cron:** `0 * * * *` in dev, qa and prod.
- **Binding:** named `SWEEP_SCHEDULER`, class `SweepScheduler`, migration tag `v1-sweep-scheduler` with `new_sqlite_classes`.
- **Shared predicates:** each "next due" query shares its predicate function with the sweep query it mirrors. No second hand-written copy of a WHERE clause.
- **No `cloudflare:workers` import.** The API test suite imports `src/index.ts` under bun, which cannot resolve that module.
- **Git hygiene:**
  - work in `.claude/worktrees/sweep-scheduler` on branch `feat/sweep-scheduler`;
  - stage files by name, never `git add -A`;
  - commits end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- **Code style:** match the codebase's comment density. Doc comments explain *why*.

---

### Task 1: Communication — when is the next notice due?

**Files:**
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/communication/infrastructure/repositories/drizzle/message.repository.ts` (the `claimDueForNotice` WHERE, ~line 170)
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/communication/app/ports/outbound/notice-schedule.reader.port.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/communication/infrastructure/repositories/drizzle/notice-schedule.reader.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/communication/app/use-cases/next-notice-due-at.internal.query.ts`
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/communication/bootstrap/index.ts` (the `internal:` block, ~line 116)
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/communication/index.ts` (beside `NotifyUnreadInternalCommand`, line 41)
- Test: `packages/backend/src/modules/ntizo/bounded-contexts/communication/__tests__/repositories.test.ts` (append a describe)

**Interfaces:**
- Produces: `awaitingNotice()`, a drizzle SQL predicate exported from `message.repository.ts`.
- Produces: `interface NoticeScheduleReaderPort { earliestNoticeDueAt(): Promise<Date | null> }`.
- Produces: `class DrizzleNoticeScheduleReader implements NoticeScheduleReaderPort`.
- Produces: `class NextNoticeDueAtInternalQuery { execute(): Promise<Date | null> }`, exposed as `bootstrapCommunication(...).useCases.internal.nextNoticeDueAt`.

- [ ] **Step 0: Give the worktree its env files** (git-ignored, so absent in a fresh worktree)

```bash
M=/Users/saliffaustino/Desktop/Salif/Projects/Ntizo/ntizo-workspace
W=$M/.claude/worktrees/sweep-scheduler
cp $M/packages/backend/.env $W/packages/backend/.env
cp $M/apps/backend/api/.env $W/apps/backend/api/.env
cp $M/apps/backend/api/.dev.vars $W/apps/backend/api/.dev.vars
cd $W && bun install
```

- [ ] **Step 1: Write the failing test.** Append to `repositories.test.ts`, and add `import { DrizzleNoticeScheduleReader } from "../infrastructure/repositories/drizzle/notice-schedule.reader";` to its imports.

```ts
describe("DrizzleNoticeScheduleReader", () => {
  test("answers with the earliest message still owed a notice, ignoring read and notified ones", async () => {
    const providerId = await makeProvider(ownerId, "notice-schedule");
    const opened = await __runWithTransactionContextForTests(db, () =>
      threads.openOrFind(customerId, providerId, new Date("2026-08-12T00:00:00.000Z")),
    );

    // Dated long ago so no real row in the shared database is older: the
    // earliest answer can then only be ours — unless the reader wrongly counts
    // the two even older rows it must ignore.
    const owed = new Date("2001-02-03T04:05:06.000Z");
    const readLongAgo = new Date("2000-01-01T00:00:00.000Z");
    const notifiedLongAgo = new Date("2000-01-02T00:00:00.000Z");
    await db.insert(message).values([
      { threadId: opened.id, senderUserId: customerId, senderSide: "customer", body: "owed", notifyDueAt: owed },
      { threadId: opened.id, senderUserId: customerId, senderSide: "customer", body: "read", notifyDueAt: readLongAgo, readAt: owed },
      { threadId: opened.id, senderUserId: customerId, senderSide: "customer", body: "notified", notifyDueAt: notifiedLongAgo, notifiedAt: owed },
    ]);

    const earliest = await __runWithTransactionContextForTests(db, () =>
      new DrizzleNoticeScheduleReader().earliestNoticeDueAt(),
    );

    expect(earliest).toBeInstanceOf(Date);
    expect(earliest!.getTime()).toBeLessThanOrEqual(owed.getTime());
    expect(earliest!.getTime()).toBeGreaterThan(notifiedLongAgo.getTime());
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd packages/backend && bun test src/modules/ntizo/bounded-contexts/communication/__tests__/repositories.test.ts -t "DrizzleNoticeScheduleReader"`
Expected: FAIL. The module `notice-schedule.reader` cannot be found.

- [ ] **Step 3: Extract the predicate in `message.repository.ts`.** Add it above the class:

```ts
/**
 * A message still owed a notice: it has a due time, nobody has read it, and
 * no notice went out. `claimDueForNotice` adds "and that time has come";
 * `DrizzleNoticeScheduleReader` asks when the earliest one comes. One
 * predicate for both, so the scheduler can never wait for a message the sweep
 * would not take, nor miss one it would.
 */
export function awaitingNotice() {
  return and(isNotNull(message.notifyDueAt), isNull(message.readAt), isNull(message.notifiedAt));
}
```

Then replace the `.where(and(isNotNull(message.notifyDueAt), lte(message.notifyDueAt, now), isNull(message.readAt), isNull(message.notifiedAt)))` inside `claimDueForNotice` with:

```ts
      .where(and(awaitingNotice(), lte(message.notifyDueAt, now)))
```

- [ ] **Step 4: Create the port** `notice-schedule.reader.port.ts`

```ts
/**
 * When the notify-unread sweep next has something to do.
 *
 * `null` means no message is owed a notice at all, not "none yet": the
 * scheduler sets no alarm for this context until a new message arrives.
 */
export interface NoticeScheduleReaderPort {
  earliestNoticeDueAt(): Promise<Date | null>;
}
```

- [ ] **Step 5: Create the adapter** `notice-schedule.reader.ts`

```ts
import { min } from "drizzle-orm";
import { getDb } from "../../../../../../better-auth/infrastructure/client/drizzle";
import { message } from "../../../../../shared/infrastructure/database/communication/schemas";
import type { NoticeScheduleReaderPort } from "../../../app/ports/outbound/notice-schedule.reader.port";
import { awaitingNotice } from "./message.repository";

/** One indexed MIN over `idx_message_notify_due`'s own predicate. */
export class DrizzleNoticeScheduleReader implements NoticeScheduleReaderPort {
  async earliestNoticeDueAt(): Promise<Date | null> {
    const [row] = await getDb()
      .select({ at: min(message.notifyDueAt) })
      .from(message)
      .where(awaitingNotice());
    return row?.at ? new Date(row.at) : null;
  }
}
```

- [ ] **Step 6: Create the use case** `next-notice-due-at.internal.query.ts`

```ts
import type { NoticeScheduleReaderPort } from "../ports/outbound/notice-schedule.reader.port";

/**
 * The communication context's answer to "when should the sweeps next run?".
 *
 * Internal, like `NotifyUnreadInternalCommand` beside it: no GraphQL field
 * reaches it. The API's sweep scheduler asks it after every request that
 * touched the database and after every sweep run.
 */
export class NextNoticeDueAtInternalQuery {
  constructor(private readonly reader: NoticeScheduleReaderPort) {}

  execute(): Promise<Date | null> {
    return this.reader.earliestNoticeDueAt();
  }
}
```

- [ ] **Step 7: Wire and export.** In `bootstrap/index.ts`, add the two imports, then extend the `internal` block:

```ts
import { NextNoticeDueAtInternalQuery } from "../app/use-cases/next-notice-due-at.internal.query";
import { DrizzleNoticeScheduleReader } from "../infrastructure/repositories/drizzle/notice-schedule.reader";
```

```ts
      internal: {
        // The delayed notice a cron sweeps — nobody asks for this, something
        // schedules it. See scheduled.ts.
        notifyUnread: new NotifyUnreadInternalCommand(messageRepository, deps.raiseNotification, adminUserReader),
        // When that sweep next has work — what the API's sweep scheduler sets
        // its alarm from. See apps/backend/api/src/sweep-scheduler.
        nextNoticeDueAt: new NextNoticeDueAtInternalQuery(new DrizzleNoticeScheduleReader()),
      },
```

In `communication/index.ts`, next to line 41:

```ts
export { NextNoticeDueAtInternalQuery } from "./app/use-cases/next-notice-due-at.internal.query";
```

- [ ] **Step 8: Run the new test and the existing notice tests**

Run: `cd packages/backend && bun test src/modules/ntizo/bounded-contexts/communication/__tests__/repositories.test.ts -t "DrizzleNoticeScheduleReader|claimDueForNotice"`
Expected: PASS, including the unchanged `claimDueForNotice / markNotified` tests.

Run: `cd packages/backend && bun run typecheck`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add packages/backend/src/modules/ntizo/bounded-contexts/communication/infrastructure/repositories/drizzle/message.repository.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/communication/app/ports/outbound/notice-schedule.reader.port.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/communication/infrastructure/repositories/drizzle/notice-schedule.reader.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/communication/app/use-cases/next-notice-due-at.internal.query.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/communication/bootstrap/index.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/communication/index.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/communication/__tests__/repositories.test.ts
git commit -m "feat(communication): say when the next unread-message notice is due

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Booking — when is the next deadline or charge due?

**Files:**
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/booking/infrastructure/repositories/drizzle/booking.repository.ts` (`findDueForSweep` ~line 480, `findAwaitingCharge` ~line 513)
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/booking/app/ports/outbound/booking-schedule.reader.port.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/booking/infrastructure/repositories/drizzle/booking-schedule.reader.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/booking/app/use-cases/next-booking-due-at.internal.query.ts`
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/booking/bootstrap/index.ts` (the `internal:` block, ~line 328)
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/booking/index.ts` (beside line 22)
- Test (unit): `packages/backend/src/modules/ntizo/bounded-contexts/booking/__tests__/next-booking-due-at.internal.query.test.ts`
- Test (real DB): `packages/backend/src/modules/ntizo/shared/infrastructure/database/__tests__/booking-sweep.test.ts` and `booking-charge-sweep.test.ts` (append tests)

**Interfaces:**
- Produces: `deadlineBearing()` and `chargeable(criteria: { deadlineAfter: Date; maxAttempts: number })`, exported from `booking.repository.ts`.
- Produces:
  ```ts
  interface ChargeScheduleCriteria { now: Date; deadlineAfter: Date; maxAttempts: number; retryAfterMinutes: number }
  interface BookingScheduleReaderPort {
    earliestDeadline(): Promise<Date | null>;
    earliestChargeDue(criteria: ChargeScheduleCriteria): Promise<Date | null>;
  }
  ```
- Produces: `class NextBookingDueAtInternalQuery { execute(): Promise<Date | null> }`, exposed as `bootstrapBooking(...).useCases.internal.nextDueAt`.

- [ ] **Step 1: Write the failing unit test** `next-booking-due-at.internal.query.test.ts`

```ts
import { describe, expect, it } from "bun:test";
import type {
  BookingScheduleReaderPort,
  ChargeScheduleCriteria,
} from "../app/ports/outbound/booking-schedule.reader.port";
import { NextBookingDueAtInternalQuery } from "../app/use-cases/next-booking-due-at.internal.query";
import {
  BOOKING_CHARGE_ATTEMPT_LIMIT,
  BOOKING_CHARGE_RETRY_MINUTES,
} from "../app/use-cases/charge-accepted-bookings.internal.command";
import { BOOKING_CHARGE_MIN_WINDOW_MS } from "../app/use-cases/charge-booking.command";

class FakeReader implements BookingScheduleReaderPort {
  criteria: ChargeScheduleCriteria | null = null;
  constructor(
    private readonly deadline: Date | null,
    private readonly charge: Date | null,
  ) {}
  async earliestDeadline() {
    return this.deadline;
  }
  async earliestChargeDue(criteria: ChargeScheduleCriteria) {
    this.criteria = criteria;
    return this.charge;
  }
}

const NOW = new Date("2026-09-16T12:00:00.000Z");

describe("NextBookingDueAtInternalQuery", () => {
  it("answers with the earlier of the two clocks", async () => {
    const deadline = new Date("2026-09-16T12:30:00.000Z");
    const charge = new Date("2026-09-16T12:05:00.000Z");
    expect(await new NextBookingDueAtInternalQuery(new FakeReader(deadline, charge), () => NOW).execute()).toEqual(charge);
    expect(await new NextBookingDueAtInternalQuery(new FakeReader(charge, deadline), () => NOW).execute()).toEqual(charge);
  });

  it("answers with whichever clock exists when only one does, and null when neither does", async () => {
    const at = new Date("2026-09-16T13:00:00.000Z");
    expect(await new NextBookingDueAtInternalQuery(new FakeReader(at, null), () => NOW).execute()).toEqual(at);
    expect(await new NextBookingDueAtInternalQuery(new FakeReader(null, at), () => NOW).execute()).toEqual(at);
    expect(await new NextBookingDueAtInternalQuery(new FakeReader(null, null), () => NOW).execute()).toBeNull();
  });

  it("asks about charges with the charge sweep's own bounds, so the two can never disagree", async () => {
    const reader = new FakeReader(null, null);
    await new NextBookingDueAtInternalQuery(reader, () => NOW).execute();
    expect(reader.criteria).toEqual({
      now: NOW,
      deadlineAfter: new Date(NOW.getTime() + BOOKING_CHARGE_MIN_WINDOW_MS),
      maxAttempts: BOOKING_CHARGE_ATTEMPT_LIMIT,
      retryAfterMinutes: BOOKING_CHARGE_RETRY_MINUTES,
    });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd packages/backend && bun test src/modules/ntizo/bounded-contexts/booking/__tests__/next-booking-due-at.internal.query.test.ts`
Expected: FAIL. The modules cannot be found.

- [ ] **Step 3: Extract the predicates in `booking.repository.ts`.** Add them above the class (`and`, `eq`, `gt`, `inArray`, `isNotNull`, `lt` are already imported):

```ts
/**
 * A booking whose status carries a clock that is running, whenever that clock
 * ends. `findDueForSweep` adds "and it has ended";
 * `DrizzleBookingScheduleReader` asks when the earliest one ends. Shared so the
 * two cannot drift apart.
 */
export function deadlineBearing() {
  return and(inArray(booking.status, [...DEADLINE_BEARING_STATUSES]), isNotNull(booking.expiresAt));
}

/**
 * A booking the charge sweep may still ask for money, whenever its next try is
 * allowed. `findAwaitingCharge` adds "and its cooldown has passed";
 * `DrizzleBookingScheduleReader` works out when that happens. Shared for the
 * same reason as `deadlineBearing`.
 */
export function chargeable(criteria: { deadlineAfter: Date; maxAttempts: number }) {
  return and(
    eq(booking.status, BookingStatus.PendingPayment),
    lt(booking.chargeAttempts, criteria.maxAttempts),
    isNotNull(booking.expiresAt),
    gt(booking.expiresAt, criteria.deadlineAfter),
  );
}
```

In `findDueForSweep`, replace the `.where(and(inArray(...), isNotNull(...), lte(booking.expiresAt, now)))` with:

```ts
      .where(and(deadlineBearing(), lte(booking.expiresAt, now)))
```

In `findAwaitingCharge`, replace the whole `.where(and(...))` with:

```ts
      .where(
        and(
          chargeable(criteria),
          or(
            isNull(booking.lastChargeAttemptAt),
            lte(booking.lastChargeAttemptAt, criteria.notAttemptedSince),
          ),
        ),
      )
```

- [ ] **Step 4: Create the port** `booking-schedule.reader.port.ts`

```ts
/**
 * The charge sweep's bounds, plus the two things only a schedule needs:
 * what "now" is (a booking never charged is due now) and how long the
 * cooldown after a failed attempt lasts.
 */
export interface ChargeScheduleCriteria {
  now: Date;
  deadlineAfter: Date;
  maxAttempts: number;
  retryAfterMinutes: number;
}

/** When the two booking sweeps next have something to do; null when nothing is waiting. */
export interface BookingScheduleReaderPort {
  earliestDeadline(): Promise<Date | null>;
  earliestChargeDue(criteria: ChargeScheduleCriteria): Promise<Date | null>;
}
```

- [ ] **Step 5: Create the adapter** `booking-schedule.reader.ts`

```ts
import { min, sql } from "drizzle-orm";
import { getDb } from "../../../../../../better-auth/infrastructure/client/drizzle";
import { booking } from "../../../../../shared/infrastructure/database/booking/schemas";
import type {
  BookingScheduleReaderPort,
  ChargeScheduleCriteria,
} from "../../../app/ports/outbound/booking-schedule.reader.port";
import { chargeable, deadlineBearing } from "./booking.repository";

export class DrizzleBookingScheduleReader implements BookingScheduleReaderPort {
  /** One indexed MIN over `booking_sweep_idx`'s predicate. */
  async earliestDeadline(): Promise<Date | null> {
    const [row] = await getDb()
      .select({ at: min(booking.expiresAt) })
      .from(booking)
      .where(deadlineBearing());
    return row?.at ? new Date(row.at) : null;
  }

  /**
   * A booking never attempted is due `now`; one attempted before is due when
   * its cooldown ends. A due time already in the past is still the right
   * answer: the scheduler floors it to "shortly", it does not skip it.
   */
  async earliestChargeDue(criteria: ChargeScheduleCriteria): Promise<Date | null> {
    const [row] = await getDb()
      .select({
        at: sql<string | Date | null>`min(coalesce(${booking.lastChargeAttemptAt} + make_interval(mins => ${criteria.retryAfterMinutes}::int), ${criteria.now.toISOString()}::timestamptz))`,
      })
      .from(booking)
      .where(chargeable(criteria));
    return row?.at ? new Date(row.at) : null;
  }
}
```

- [ ] **Step 6: Create the use case** `next-booking-due-at.internal.query.ts`

```ts
import type { BookingScheduleReaderPort } from "../ports/outbound/booking-schedule.reader.port";
import {
  BOOKING_CHARGE_ATTEMPT_LIMIT,
  BOOKING_CHARGE_RETRY_MINUTES,
} from "./charge-accepted-bookings.internal.command";
import { BOOKING_CHARGE_MIN_WINDOW_MS } from "./charge-booking.command";

/**
 * The booking context's answer to "when should the sweeps next run?": the
 * earlier of the next deadline and the next charge attempt.
 *
 * The charge bounds are the charge sweep's own constants, read from the same
 * modules `ChargeAcceptedBookingsInternalCommand` reads, so a change to the
 * cooldown or the attempt limit moves both at once.
 */
export class NextBookingDueAtInternalQuery {
  constructor(
    private readonly reader: BookingScheduleReaderPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<Date | null> {
    const now = this.now();
    const deadline = await this.reader.earliestDeadline();
    const charge = await this.reader.earliestChargeDue({
      now,
      deadlineAfter: new Date(now.getTime() + BOOKING_CHARGE_MIN_WINDOW_MS),
      maxAttempts: BOOKING_CHARGE_ATTEMPT_LIMIT,
      retryAfterMinutes: BOOKING_CHARGE_RETRY_MINUTES,
    });
    if (!deadline) return charge;
    if (!charge) return deadline;
    return deadline.getTime() <= charge.getTime() ? deadline : charge;
  }
}
```

- [ ] **Step 7: Run the unit test**

Run: `cd packages/backend && bun test src/modules/ntizo/bounded-contexts/booking/__tests__/next-booking-due-at.internal.query.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 8: Add the real-DB tests.**

In `booking-sweep.test.ts`, add `import { DrizzleBookingScheduleReader } from "../../../../bounded-contexts/booking/infrastructure/repositories/drizzle/booking-schedule.reader";` and `import { BookingStatus } from "../booking/enums";` if not already imported. Then add inside the `describe("SweepDueBookingsInternalCommand", ...)` block:

```ts
  test("the schedule reader answers with the earliest running clock and ignores a finished booking", async () => {
    await withBookings(async (track) => {
      // Long ago, so nothing real in the shared database is older: the
      // earliest answer can only be ours, unless the reader wrongly counts the
      // even older booking that has already expired.
      const running = new Date("2001-02-03T04:05:06.000Z");
      const finishedLongAgo = new Date("2000-01-01T00:00:00.000Z");
      track(
        await repo.insert(
          draftBooking(bookingInput({ startsAt: new Date("2026-12-01T09:00:00.000Z"), expiresAt: running })),
          1,
        ),
      );
      const finished = track(
        await repo.insert(
          draftBooking(bookingInput({ startsAt: new Date("2026-12-02T09:00:00.000Z"), expiresAt: finishedLongAgo })),
          1,
        ),
      );
      await db.update(booking).set({ status: BookingStatus.Expired }).where(eq(booking.id, finished.id as string));

      const earliest = await new DrizzleBookingScheduleReader().earliestDeadline();

      expect(earliest).toBeInstanceOf(Date);
      expect(earliest!.getTime()).toBeLessThanOrEqual(running.getTime());
      expect(earliest!.getTime()).toBeGreaterThan(finishedLongAgo.getTime());
    });
  });
```

In `booking-charge-sweep.test.ts`, add `import { DrizzleBookingScheduleReader } from "../../../../bounded-contexts/booking/infrastructure/repositories/drizzle/booking-schedule.reader";`. Then add inside `describe("findAwaitingCharge, through the sweep", ...)`:

```ts
  test("the schedule reader dates a retry at the end of its cooldown and ignores a booking out of attempts", async () => {
    await withBookings(async (track) => {
      const retrying = track(
        await repo.insert(
          pendingBooking(
            bookingInput({
              startsAt: new Date("2027-07-01T14:00:00.000Z"),
              expiresAt: new Date("2027-07-01T12:15:00.000Z"),
            }),
          ),
          1,
        ),
      );
      const exhausted = track(
        await repo.insert(
          pendingBooking(
            bookingInput({
              startsAt: new Date("2027-07-02T14:00:00.000Z"),
              expiresAt: new Date("2027-07-02T12:15:00.000Z"),
            }),
          ),
          1,
        ),
      );
      await setChargeState(retrying.id as string, {
        chargeAttempts: 1,
        lastChargeAttemptAt: new Date("2001-02-03T04:00:00.000Z"),
      });
      await setChargeState(exhausted.id as string, {
        chargeAttempts: BOOKING_CHARGE_ATTEMPT_LIMIT,
        lastChargeAttemptAt: new Date("2000-01-01T00:00:00.000Z"),
      });

      // A "now" later than any never-attempted booking's answer could beat,
      // and a deadline floor both fixtures clear.
      const earliest = await new DrizzleBookingScheduleReader().earliestChargeDue({
        now: new Date("2030-01-01T00:00:00.000Z"),
        deadlineAfter: new Date("2027-01-01T00:00:00.000Z"),
        maxAttempts: BOOKING_CHARGE_ATTEMPT_LIMIT,
        retryAfterMinutes: BOOKING_CHARGE_RETRY_MINUTES,
      });

      const cooldownEnds = new Date("2001-02-03T04:05:00.000Z");
      expect(earliest).toBeInstanceOf(Date);
      expect(earliest!.getTime()).toBeLessThanOrEqual(cooldownEnds.getTime());
      expect(earliest!.getTime()).toBeGreaterThan(new Date("2000-01-01T00:05:00.000Z").getTime());
    });
  });
```

- [ ] **Step 9: Run the real-DB tests. They must pass, and so must the existing sweep tests.**

Run: `cd packages/backend && bun test src/modules/ntizo/shared/infrastructure/database/__tests__/booking-sweep.test.ts src/modules/ntizo/shared/infrastructure/database/__tests__/booking-charge-sweep.test.ts`
Expected: PASS. The existing tests confirm the extracted predicates changed nothing.

- [ ] **Step 10: Wire and export.** In `booking/bootstrap/index.ts`, import both classes, then add to the `internal` block after `chargeAccepted`:

```ts
import { NextBookingDueAtInternalQuery } from "../app/use-cases/next-booking-due-at.internal.query";
import { DrizzleBookingScheduleReader } from "../infrastructure/repositories/drizzle/booking-schedule.reader";
```

```ts
        // When either sweep above next has work — what the API's sweep
        // scheduler sets its alarm from. See apps/backend/api/src/sweep-scheduler.
        nextDueAt: new NextBookingDueAtInternalQuery(new DrizzleBookingScheduleReader()),
```

In `booking/index.ts`, beside line 22:

```ts
export { NextBookingDueAtInternalQuery } from "./app/use-cases/next-booking-due-at.internal.query";
```

- [ ] **Step 11: Typecheck**

Run: `cd packages/backend && bun run typecheck`
Expected: exit 0.

- [ ] **Step 12: Commit**

```bash
git add packages/backend/src/modules/ntizo/bounded-contexts/booking/infrastructure/repositories/drizzle/booking.repository.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/booking/app/ports/outbound/booking-schedule.reader.port.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/booking/infrastructure/repositories/drizzle/booking-schedule.reader.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/booking/app/use-cases/next-booking-due-at.internal.query.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/booking/bootstrap/index.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/booking/index.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/booking/__tests__/next-booking-due-at.internal.query.test.ts \
  packages/backend/src/modules/ntizo/shared/infrastructure/database/__tests__/booking-sweep.test.ts \
  packages/backend/src/modules/ntizo/shared/infrastructure/database/__tests__/booking-charge-sweep.test.ts
git commit -m "feat(booking): say when the next deadline or charge attempt is due

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Quote — when is the next quote deadline?

**Files:**
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/quote/infrastructure/repositories/drizzle/quote.repository.ts` (`findDueForSweep`, ~line 218)
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/quote/app/ports/outbound/quote-schedule.reader.port.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/quote/infrastructure/repositories/drizzle/quote-schedule.reader.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/quote/app/use-cases/next-quote-due-at.internal.query.ts`
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/quote/bootstrap/index.ts` (the `internal:` block, line 156)
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/quote/index.ts` (beside line 22)
- Test: `packages/backend/src/modules/ntizo/shared/infrastructure/database/__tests__/quote-repository.test.ts` (a test right after "findDueForSweep returns only open quotes past their clock")

**Interfaces:**
- Produces: `openWithDeadline()`, a predicate exported from `quote.repository.ts`.
- Produces: `interface QuoteScheduleReaderPort { earliestDeadline(): Promise<Date | null> }`.
- Produces: `class NextQuoteDueAtInternalQuery { execute(): Promise<Date | null> }`, exposed as `bootstrapQuote(...).useCases.internal.nextDueAt`.

- [ ] **Step 1: Write the failing test.** Add `import { DrizzleQuoteScheduleReader } from "../../../../bounded-contexts/quote/infrastructure/repositories/drizzle/quote-schedule.reader";`, then insert right after the `findDueForSweep` test:

```ts
  test("the schedule reader answers with the earliest open quote's deadline", async () => {
    // `quoteIds[1]` is the open, already-overdue quote the test above created.
    // Pushing its deadline long into the past keeps it the earliest in a
    // shared database, and does not change what it is: open and due.
    const deadline = new Date("2001-02-03T04:05:06.000Z");
    await db.update(quote).set({ expiresAt: deadline }).where(eq(quote.id, quoteIds[1]!));

    const earliest = await run(() => new DrizzleQuoteScheduleReader().earliestDeadline());

    expect(earliest).toBeInstanceOf(Date);
    expect(earliest!.getTime()).toBeLessThanOrEqual(deadline.getTime());
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd packages/backend && bun test src/modules/ntizo/shared/infrastructure/database/__tests__/quote-repository.test.ts`
Expected: FAIL. The module `quote-schedule.reader` cannot be found.

- [ ] **Step 3: Extract the predicate in `quote.repository.ts`.** Add it above the class:

```ts
/**
 * A quote still open with a clock running, whenever it ends. Shared by
 * `findDueForSweep` ("and it has ended") and `DrizzleQuoteScheduleReader`
 * ("when does the earliest end") so the two cannot drift apart.
 */
export function openWithDeadline() {
  return and(inArray(quote.status, [...QUOTE_DEADLINE_BEARING_STATUSES]), isNotNull(quote.expiresAt));
}
```

Replace the `.where(and(inArray(...), isNotNull(...), lte(quote.expiresAt, now)))` in `findDueForSweep` with:

```ts
      .where(and(openWithDeadline(), lte(quote.expiresAt, now)))
```

- [ ] **Step 4: Create the port, the adapter and the use case**

`quote-schedule.reader.port.ts`:

```ts
/** When the quote sweep next has something to do; null when no open quote has a clock running. */
export interface QuoteScheduleReaderPort {
  earliestDeadline(): Promise<Date | null>;
}
```

`quote-schedule.reader.ts`:

```ts
import { min } from "drizzle-orm";
import { getDb } from "../../../../../../better-auth/infrastructure/client/drizzle";
import { quote } from "../../../../../shared/infrastructure/database/quote/schemas";
import type { QuoteScheduleReaderPort } from "../../../app/ports/outbound/quote-schedule.reader.port";
import { openWithDeadline } from "./quote.repository";

/** One indexed MIN over `quote_sweep_idx`'s predicate. */
export class DrizzleQuoteScheduleReader implements QuoteScheduleReaderPort {
  async earliestDeadline(): Promise<Date | null> {
    const [row] = await getDb()
      .select({ at: min(quote.expiresAt) })
      .from(quote)
      .where(openWithDeadline());
    return row?.at ? new Date(row.at) : null;
  }
}
```

Check the import path of `quote`: use the same schema import `quote.repository.ts` uses for its `quote` table, and adjust if it differs from `.../database/quote/schemas`.

`next-quote-due-at.internal.query.ts`:

```ts
import type { QuoteScheduleReaderPort } from "../ports/outbound/quote-schedule.reader.port";

/**
 * The quote context's answer to "when should the sweeps next run?". Internal,
 * like `SweepDueQuotesInternalCommand` beside it.
 */
export class NextQuoteDueAtInternalQuery {
  constructor(private readonly reader: QuoteScheduleReaderPort) {}

  execute(): Promise<Date | null> {
    return this.reader.earliestDeadline();
  }
}
```

- [ ] **Step 5: Wire and export.** In `quote/bootstrap/index.ts`:

```ts
import { NextQuoteDueAtInternalQuery } from "../app/use-cases/next-quote-due-at.internal.query";
import { DrizzleQuoteScheduleReader } from "../infrastructure/repositories/drizzle/quote-schedule.reader";
```

```ts
      internal: {
        sweepDue: new SweepDueQuotesInternalCommand(quoteRepository, sweepQuote),
        markProposalStale,
        // When `sweepDue` next has work — see apps/backend/api/src/sweep-scheduler.
        nextDueAt: new NextQuoteDueAtInternalQuery(new DrizzleQuoteScheduleReader()),
      },
```

In `quote/index.ts`:

```ts
export { NextQuoteDueAtInternalQuery } from "./app/use-cases/next-quote-due-at.internal.query";
```

- [ ] **Step 6: Run the tests and the typecheck**

Run: `cd packages/backend && bun test src/modules/ntizo/shared/infrastructure/database/__tests__/quote-repository.test.ts && bun run typecheck`
Expected: PASS, including the existing `findDueForSweep` test; typecheck exit 0.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/modules/ntizo/bounded-contexts/quote/infrastructure/repositories/drizzle/quote.repository.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/quote/app/ports/outbound/quote-schedule.reader.port.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/quote/infrastructure/repositories/drizzle/quote-schedule.reader.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/quote/app/use-cases/next-quote-due-at.internal.query.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/quote/bootstrap/index.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/quote/index.ts \
  packages/backend/src/modules/ntizo/shared/infrastructure/database/__tests__/quote-repository.test.ts
git commit -m "feat(quote): say when the next quote deadline is due

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: API — move the sweeps out of `scheduled.ts`, and compose "next due"

**Files:**
- Create: `apps/backend/api/src/infra-env.ts`
- Create: `apps/backend/api/src/sweep-scheduler/sweeps.ts`
- Create: `apps/backend/api/src/sweep-scheduler/next-due.ts`
- Modify: `apps/backend/api/src/scheduled.ts`
- Test: `apps/backend/api/src/sweep-scheduler/__tests__/next-due.test.ts`
- Regression: `apps/backend/api/src/__tests__/scheduled.test.ts` (unchanged, must stay green)

**Interfaces:**
- Consumes: `useCases.internal.nextNoticeDueAt` (Task 1), booking `useCases.internal.nextDueAt` (Task 2), quote `useCases.internal.nextDueAt` (Task 3).
- Produces: `toInfraEnv(env: AppBindings): InfraEnvBindings`.
- Produces: `runSweeps(): Promise<void>` — the four sweeps, which must run inside an infra-store scope.
- Produces: `SWEEP_LIMIT`, `BOOKING_SWEEP_LIMIT`, `BOOKING_CHARGE_LIMIT`, `QUOTE_SWEEP_LIMIT` (still re-exported from `scheduled.ts`).
- Produces: `disputeThreadForCron()`, `bookingOpenerForCron()`, `startThreadForCron()`.
- Produces: `earliestOf(...candidates: Array<Date | null>): Date | null`.
- Produces: `computeNextDueAt(): Promise<Date | null>` — must run inside an infra-store scope.

- [ ] **Step 1: Write the failing test** `src/sweep-scheduler/__tests__/next-due.test.ts`

```ts
import { describe, expect, it } from "bun:test";
import { earliestOf } from "../next-due";

describe("earliestOf", () => {
  it("picks the earliest date and skips the contexts with nothing due", () => {
    const a = new Date("2026-09-16T12:05:00.000Z");
    const b = new Date("2026-09-16T12:01:00.000Z");
    expect(earliestOf(a, null, b)).toEqual(b);
  });

  it("is null when no context has anything due", () => {
    expect(earliestOf(null, null, null)).toBeNull();
    expect(earliestOf()).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd apps/backend/api && bun test src/sweep-scheduler/__tests__/next-due.test.ts`
Expected: FAIL. The module `../next-due` cannot be found.

- [ ] **Step 3: Create `src/infra-env.ts`.** Move the object literal `scheduled.ts` passes as `infraStore.runAsync`'s first argument, with its comments, into this function:

```ts
import type { InfraEnvBindings } from "@ntizo/backend/shared/infra";
import type { Stage } from "@ntizo/backend/shared/infra/config";
import type { AppBindings } from "./types";

/**
 * The request-scoped env every entry point that is not an HTTP request opens:
 * the cron and the sweep scheduler's alarm. Moved out of `scheduled.ts`
 * unchanged, so the two cannot disagree about a fallback.
 */
export function toInfraEnv(env: AppBindings): InfraEnvBindings {
  return {
    STAGE: (env.STAGE as Stage) ?? "local",
    LOG_LEVEL: env.LOG_LEVEL ?? "info",
    DATABASE_URL: env.DATABASE_URL ?? "",
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET ?? "dev-secret-change-me",
    RESEND_API_KEY: env.RESEND_API_KEY ?? "",
    EMAIL_FROM: env.EMAIL_FROM ?? "Ntizo <noreply@ntizo.co.mz>",
    // Same fallback configMiddleware uses: a notification email carrying a
    // link to nowhere is worse than one that only works in dev.
    APP_URL: env.APP_URL ?? "http://localhost:3000",
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID ?? "",
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET ?? "",
    // No `?? ""` on these (moved verbatim from scheduled.ts): the adapter that
    // reads them distinguishes "absent" from "present".
    MPESA_API_KEY: env.MPESA_API_KEY,
    MPESA_PUBLIC_KEY: env.MPESA_PUBLIC_KEY,
    MPESA_ENVIRONMENT: env.MPESA_ENVIRONMENT,
    MPESA_ORIGIN: env.MPESA_ORIGIN,
    MPESA_SERVICE_PROVIDER_CODE: env.MPESA_SERVICE_PROVIDER_CODE,
    CONTACT_INBOX_EMAIL: env.CONTACT_INBOX_EMAIL,
  };
}
```

- [ ] **Step 4: Create `src/sweep-scheduler/sweeps.ts`.** This is a move, not a rewrite. Take the following from `scheduled.ts` with their doc comments exactly as they are:
  - the four `*_LIMIT` constants;
  - `disputeThreadForCron`, `bookingOpenerForCron`, `startThreadForCron`, now `export`ed;
  - the body of the four `try { ... } catch` sweep blocks.

  Put the blocks inside a new function. Update the relative adapter imports from `./` to `../`. The resulting skeleton:

```ts
import { bootstrapNotification } from "@ntizo/backend/modules/ntizo/bounded-contexts/notification";
import { bootstrapCommunication } from "@ntizo/backend/modules/ntizo/bounded-contexts/communication";
import { bootstrapBooking, type OpenDisputeThreadPort } from "@ntizo/backend/modules/ntizo/bounded-contexts/booking";
import {
  bootstrapQuote,
  type BookingOpenerPort,
  type StartThreadPort,
} from "@ntizo/backend/modules/ntizo/bounded-contexts/quote";
import { AttachmentStorageAdapter } from "../attachment-storage.adapter";
import { disputeThreadOver } from "../dispute-thread.adapter";
import { bookingOpenerOver } from "../booking-opener.adapter";
import { startThreadOver } from "../start-thread.adapter";

// ↓ the four constants, moved verbatim with their comments
export const SWEEP_LIMIT = 200;
export const BOOKING_SWEEP_LIMIT = 200;
export const BOOKING_CHARGE_LIMIT = 5;
export const QUOTE_SWEEP_LIMIT = 200;

// ↓ moved verbatim, now exported
export function disputeThreadForCron(): OpenDisputeThreadPort { /* unchanged body */ }
export function bookingOpenerForCron(): BookingOpenerPort { /* unchanged body */ }
export function startThreadForCron(): StartThreadPort { /* unchanged body */ }

/**
 * The four sweeps, in their order, each in its own try — moved out of
 * `scheduled()` so the hourly cron and the sweep scheduler's alarm run the
 * exact same thing. Must run inside an `infraStore.runAsync` scope; the
 * caller owns that scope and the DB close behind it.
 */
export async function runSweeps(): Promise<void> {
  // ↓ the four `try { ... } catch (error) { console.error(...) }` blocks from
  //   scheduled.ts, verbatim, including every comment inside them
}
```

The `/* unchanged body */` markers mean "the body currently in `scheduled.ts`", copied character for character. Nothing in them changes.

- [ ] **Step 5: Create `src/sweep-scheduler/next-due.ts`**

```ts
import { bootstrapNotification } from "@ntizo/backend/modules/ntizo/bounded-contexts/notification";
import { bootstrapCommunication } from "@ntizo/backend/modules/ntizo/bounded-contexts/communication";
import { bootstrapBooking } from "@ntizo/backend/modules/ntizo/bounded-contexts/booking";
import { bootstrapQuote } from "@ntizo/backend/modules/ntizo/bounded-contexts/quote";
import { AttachmentStorageAdapter } from "../attachment-storage.adapter";
import { bookingOpenerForCron, disputeThreadForCron, startThreadForCron } from "./sweeps";

/** The earliest of the dates given, ignoring contexts with nothing due; null when none has anything. */
export function earliestOf(...candidates: Array<Date | null>): Date | null {
  let earliest: Date | null = null;
  for (const candidate of candidates) {
    if (candidate && (!earliest || candidate.getTime() < earliest.getTime())) earliest = candidate;
  }
  return earliest;
}

/**
 * When any of the four sweeps next has work: the earliest of the three
 * contexts' own answers. Must run inside an `infraStore.runAsync` scope.
 *
 * Asked one context at a time, not with `Promise.all`: the scope's postgres
 * pool is `{ max: 1 }`, so parallel asks only queue behind each other.
 *
 * The bootstraps are the same cheap object graphs `runSweeps` builds, with the
 * same never-called dependencies; see the comments there.
 */
export async function computeNextDueAt(): Promise<Date | null> {
  const raiseNotification = bootstrapNotification().useCases.internal.raiseNotification;
  const communication = bootstrapCommunication({
    raiseNotification,
    attachmentStorage: new AttachmentStorageAdapter(),
  });
  const booking = bootstrapBooking({ raiseNotification, openDisputeThread: disputeThreadForCron() });
  const quote = bootstrapQuote({
    raiseNotification,
    openBooking: bookingOpenerForCron(),
    startThread: startThreadForCron(),
    attachmentStorage: new AttachmentStorageAdapter(),
  });

  const notice = await communication.useCases.internal.nextNoticeDueAt.execute();
  const bookingDue = await booking.useCases.internal.nextDueAt.execute();
  const quoteDue = await quote.useCases.internal.nextDueAt.execute();
  return earliestOf(notice, bookingDue, quoteDue);
}
```

- [ ] **Step 6: Slim `scheduled.ts` down.**
  - **Keep:** its big doc comment above `scheduled()`.
  - **Replace:** the imports, constants, helpers and body with the code below.
  - **Move:** the per-sweep comment history now lives in `sweeps.ts`.

```ts
import { infraStore } from "@ntizo/backend/shared/infra";
import { closeDbBehindDeferredWork } from "@ntizo/backend/shared/infra/database";
import { toInfraEnv } from "./infra-env";
import { runSweeps } from "./sweep-scheduler/sweeps";
import type { AppBindings } from "./types";

// Re-exported: scheduled.test.ts and anyone reading the cron still find them here.
export {
  SWEEP_LIMIT,
  BOOKING_SWEEP_LIMIT,
  BOOKING_CHARGE_LIMIT,
  QUOTE_SWEEP_LIMIT,
} from "./sweep-scheduler/sweeps";

/* …the existing doc comment above scheduled(), unchanged… */
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
    } finally {
      // Workers run nothing after this function returns unless scheduled —
      // and the deferred work scheduled above still needs this run's
      // `{ max: 1 }` postgres pool. See `closeDbBehindDeferredWork`.
      closeDbBehindDeferredWork((promise) => ctx.waitUntil(promise));
    }
  });
}
```

- [ ] **Step 7: Run the new test and the existing cron suite**

Run: `cd apps/backend/api && bun test src/sweep-scheduler/__tests__/next-due.test.ts src/__tests__/scheduled.test.ts src/__tests__/wait-until.test.ts`
Expected: PASS. `scheduled.test.ts` still proves the scope, the close ordering, the default-export wiring and that each sweep survives the others throwing, because its spies patch the same command prototypes `runSweeps` calls.

Run: `cd apps/backend/api && bun run typecheck`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/api/src/infra-env.ts apps/backend/api/src/sweep-scheduler/sweeps.ts \
  apps/backend/api/src/sweep-scheduler/next-due.ts apps/backend/api/src/sweep-scheduler/__tests__/next-due.test.ts \
  apps/backend/api/src/scheduled.ts
git commit -m "refactor(api): the sweeps and their next due time live beside the scheduler, not inside the cron

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: API — the scheduler's rules, as plain functions

**Files:**
- Create: `apps/backend/api/src/sweep-scheduler/schedule.ts`
- Test: `apps/backend/api/src/sweep-scheduler/__tests__/schedule.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface AlarmStorage { getAlarm(): Promise<number | null>; setAlarm(scheduledTime: number): Promise<void> }
  const MIN_ALARM_GAP_MS = 30_000;
  const RECOMPUTE_FAILURE_RETRY_MS = 900_000;
  const SWEEP_SCHEDULER_NAME = "sweeps";
  const WAKE_URL = "https://sweep-scheduler/wake";
  function wakeAt(storage: AlarmStorage, at: number, now: number): Promise<void>;
  function handleAlarm(deps: {
    storage: AlarmStorage;
    runSweeps: () => Promise<void>;
    nextDueAt: () => Promise<Date | null>;
    now: () => number;
  }): Promise<void>;
  function shouldRefreshAfterRequest(method: string, usedDatabase: boolean): boolean;
  ```

- [ ] **Step 1: Write the failing test** `src/sweep-scheduler/__tests__/schedule.test.ts`

```ts
import { describe, expect, it, spyOn } from "bun:test";
import {
  handleAlarm,
  MIN_ALARM_GAP_MS,
  RECOMPUTE_FAILURE_RETRY_MS,
  shouldRefreshAfterRequest,
  wakeAt,
  type AlarmStorage,
} from "../schedule";

class FakeStorage implements AlarmStorage {
  constructor(public alarm: number | null = null) {}
  sets: number[] = [];
  async getAlarm() {
    return this.alarm;
  }
  async setAlarm(at: number) {
    this.alarm = at;
    this.sets.push(at);
  }
}

const NOW = Date.parse("2026-09-16T12:00:00.000Z");

describe("wakeAt", () => {
  it("sets an alarm when there is none", async () => {
    const storage = new FakeStorage();
    await wakeAt(storage, NOW + 120_000, NOW);
    expect(storage.alarm).toBe(NOW + 120_000);
  });

  it("brings an alarm forward when the new time is earlier", async () => {
    const storage = new FakeStorage(NOW + 3_600_000);
    await wakeAt(storage, NOW + 120_000, NOW);
    expect(storage.alarm).toBe(NOW + 120_000);
  });

  it("never pushes an alarm later — a missed early alarm is the only real failure", async () => {
    const storage = new FakeStorage(NOW + 120_000);
    await wakeAt(storage, NOW + 3_600_000, NOW);
    expect(storage.alarm).toBe(NOW + 120_000);
    expect(storage.sets).toEqual([]);
  });

  it("wakes now for a time already past", async () => {
    const storage = new FakeStorage();
    await wakeAt(storage, NOW - 60_000, NOW);
    expect(storage.alarm).toBe(NOW);
  });
});

describe("handleAlarm", () => {
  it("runs the sweeps, then sets the alarm to the next due time", async () => {
    const storage = new FakeStorage();
    const order: string[] = [];
    await handleAlarm({
      storage,
      runSweeps: async () => void order.push("sweeps"),
      nextDueAt: async () => {
        order.push("next");
        return new Date(NOW + 600_000);
      },
      now: () => NOW,
    });
    expect(order).toEqual(["sweeps", "next"]);
    expect(storage.alarm).toBe(NOW + 600_000);
  });

  it("sets no alarm when nothing is due", async () => {
    const storage = new FakeStorage();
    await handleAlarm({ storage, runSweeps: async () => {}, nextDueAt: async () => null, now: () => NOW });
    expect(storage.sets).toEqual([]);
  });

  it("floors a next time already past, so a failing row cannot spin the alarm", async () => {
    const storage = new FakeStorage();
    await handleAlarm({
      storage,
      runSweeps: async () => {},
      nextDueAt: async () => new Date(NOW - 1),
      now: () => NOW,
    });
    expect(storage.alarm).toBe(NOW + MIN_ALARM_GAP_MS);
  });

  it("keeps an earlier alarm a request set while the sweeps were running", async () => {
    const storage = new FakeStorage();
    await handleAlarm({
      storage,
      runSweeps: async () => {
        await wakeAt(storage, NOW + 60_000, NOW);
      },
      nextDueAt: async () => new Date(NOW + 600_000),
      now: () => NOW,
    });
    expect(storage.alarm).toBe(NOW + 60_000);
  });

  it("replaces the alarm that just fired, even if the platform still reports it", async () => {
    const storage = new FakeStorage(NOW - 5);
    await handleAlarm({
      storage,
      runSweeps: async () => {},
      nextDueAt: async () => new Date(NOW + 600_000),
      now: () => NOW,
    });
    expect(storage.alarm).toBe(NOW + 600_000);
  });

  it("still reschedules when the sweeps throw", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => {});
    try {
      const storage = new FakeStorage();
      await handleAlarm({
        storage,
        runSweeps: async () => {
          throw new Error("boom");
        },
        nextDueAt: async () => new Date(NOW + 600_000),
        now: () => NOW,
      });
      expect(storage.alarm).toBe(NOW + 600_000);
    } finally {
      logged.mockRestore();
    }
  });

  it("backs off, rather than giving up, when the next due time cannot be worked out", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => {});
    try {
      const storage = new FakeStorage();
      await handleAlarm({
        storage,
        runSweeps: async () => {},
        nextDueAt: async () => {
          throw new Error("compute limit reached");
        },
        now: () => NOW,
      });
      expect(storage.alarm).toBe(NOW + RECOMPUTE_FAILURE_RETRY_MS);
      expect(logged).toHaveBeenCalled();
    } finally {
      logged.mockRestore();
    }
  });
});

describe("shouldRefreshAfterRequest", () => {
  it("refreshes after a POST that touched the database", () => {
    expect(shouldRefreshAfterRequest("POST", true)).toBe(true);
  });

  it("does not refresh after a read or a request that never opened a connection", () => {
    expect(shouldRefreshAfterRequest("GET", true)).toBe(false);
    expect(shouldRefreshAfterRequest("POST", false)).toBe(false);
    expect(shouldRefreshAfterRequest("OPTIONS", false)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd apps/backend/api && bun test src/sweep-scheduler/__tests__/schedule.test.ts`
Expected: FAIL. The module `../schedule` cannot be found.

- [ ] **Step 3: Implement `src/sweep-scheduler/schedule.ts`**

```ts
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
```

- [ ] **Step 4: Run the tests**

Run: `cd apps/backend/api && bun test src/sweep-scheduler/__tests__/schedule.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/api/src/sweep-scheduler/schedule.ts apps/backend/api/src/sweep-scheduler/__tests__/schedule.test.ts
git commit -m "feat(api): the sweep scheduler's rules — earlier wins, runs reschedule, failures back off

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: API — the `SweepScheduler` Durable Object and the refresh

**Files:**
- Create: `apps/backend/api/src/sweep-scheduler/sweep-scheduler.do.ts`
- Create: `apps/backend/api/src/sweep-scheduler/refresh.ts`
- Modify: `apps/backend/api/src/types.ts`
- Modify: `apps/backend/api/src/index.ts`
- Test: `apps/backend/api/src/sweep-scheduler/__tests__/refresh.test.ts`
- Test: `apps/backend/api/src/sweep-scheduler/__tests__/sweep-scheduler.do.test.ts`

**Interfaces:**
- Consumes: `wakeAt`, `handleAlarm`, `WAKE_URL`, `SWEEP_SCHEDULER_NAME` (Task 5); `runSweeps`, `computeNextDueAt`, `toInfraEnv` (Task 4).
- Produces: `class SweepScheduler { constructor(state: DurableObjectState, env: AppBindings); fetch(request: Request): Promise<Response>; alarm(): Promise<void> }`.
- Produces: `refreshSweepSchedule(namespace: DurableObjectNamespace | undefined, nextDueAt?: () => Promise<Date | null>): Promise<void>`.
- Produces: `AppBindings.SWEEP_SCHEDULER?: DurableObjectNamespace`.

- [ ] **Step 1: Write the failing tests.**

`src/sweep-scheduler/__tests__/refresh.test.ts`:

```ts
import { describe, expect, it, spyOn } from "bun:test";
import type { DurableObjectNamespace } from "@cloudflare/workers-types";
import { refreshSweepSchedule } from "../refresh";
import { SWEEP_SCHEDULER_NAME, WAKE_URL } from "../schedule";

function fakeNamespace(status = 204) {
  const calls: { name: string; url: string; body: unknown }[] = [];
  const namespace = {
    idFromName: (name: string) => ({ name }),
    get: (id: { name: string }) => ({
      fetch: async (url: string, init: { body: string }) => {
        calls.push({ name: id.name, url, body: JSON.parse(init.body) });
        return new Response(null, { status });
      },
    }),
  } as unknown as DurableObjectNamespace;
  return { namespace, calls };
}

describe("refreshSweepSchedule", () => {
  it("tells the one scheduler when the sweeps next have work", async () => {
    const { namespace, calls } = fakeNamespace();
    const at = new Date("2026-09-16T12:02:00.000Z");
    await refreshSweepSchedule(namespace, async () => at);
    expect(calls).toEqual([{ name: SWEEP_SCHEDULER_NAME, url: WAKE_URL, body: { at: at.getTime() } }]);
  });

  it("says nothing when nothing is due", async () => {
    const { namespace, calls } = fakeNamespace();
    await refreshSweepSchedule(namespace, async () => null);
    expect(calls).toEqual([]);
  });

  it("does not even ask the database when there is no scheduler binding", async () => {
    let asked = false;
    await refreshSweepSchedule(undefined, async () => {
      asked = true;
      return new Date();
    });
    expect(asked).toBe(false);
  });

  it("logs and resolves, never rejects, when working out the time fails", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => {});
    try {
      const { namespace } = fakeNamespace();
      await expect(
        refreshSweepSchedule(namespace, async () => {
          throw new Error("db down");
        }),
      ).resolves.toBeUndefined();
      expect(logged.mock.calls[0]![0]).toBe("[sweep-scheduler] refresh failed");
    } finally {
      logged.mockRestore();
    }
  });

  it("logs a refused wake", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => {});
    try {
      const { namespace } = fakeNamespace(400);
      await refreshSweepSchedule(namespace, async () => new Date());
      expect(logged.mock.calls[0]![0]).toBe("[sweep-scheduler] wake refused");
    } finally {
      logged.mockRestore();
    }
  });
});
```

`src/sweep-scheduler/__tests__/sweep-scheduler.do.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import type { DurableObjectState } from "@cloudflare/workers-types";
import { SweepScheduler } from "../sweep-scheduler.do";
import { WAKE_URL } from "../schedule";
import type { AppBindings } from "../../types";

function build(alarm: number | null = null) {
  const storage = {
    alarm,
    async getAlarm() {
      return this.alarm;
    },
    async setAlarm(at: number) {
      this.alarm = at;
    },
  };
  const state = { storage, waitUntil() {} } as unknown as DurableObjectState;
  return { scheduler: new SweepScheduler(state, {} as AppBindings), storage };
}

const post = (body: string) => new Request(WAKE_URL, { method: "POST", body });

describe("SweepScheduler.fetch", () => {
  it("sets its alarm from a wake request", async () => {
    const { scheduler, storage } = build();
    const at = Date.now() + 120_000;
    const response = await scheduler.fetch(post(JSON.stringify({ at })));
    expect(response.status).toBe(204);
    expect(storage.alarm).toBe(at);
  });

  it("refuses a wake without a usable time", async () => {
    const { scheduler, storage } = build();
    expect((await scheduler.fetch(post("{}"))).status).toBe(400);
    expect((await scheduler.fetch(post("not json"))).status).toBe(400);
    expect(storage.alarm).toBeNull();
  });

  it("answers anything else with 404", async () => {
    const { scheduler } = build();
    expect((await scheduler.fetch(new Request(WAKE_URL))).status).toBe(404);
    expect((await scheduler.fetch(new Request("https://sweep-scheduler/other", { method: "POST" }))).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd apps/backend/api && bun test src/sweep-scheduler/__tests__/refresh.test.ts src/sweep-scheduler/__tests__/sweep-scheduler.do.test.ts`
Expected: FAIL. The modules cannot be found.

- [ ] **Step 3: Implement `src/sweep-scheduler/refresh.ts`**

```ts
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
```

- [ ] **Step 4: Implement `src/sweep-scheduler/sweep-scheduler.do.ts`**

```ts
import type { DurableObjectState } from "@cloudflare/workers-types";
import { infraStore } from "@ntizo/backend/shared/infra";
import { Db } from "@ntizo/backend/shared/infra/database";
import { toInfraEnv } from "../infra-env";
import type { AppBindings } from "../types";
import { computeNextDueAt } from "./next-due";
import { handleAlarm, WAKE_URL, wakeAt } from "./schedule";
import { runSweeps } from "./sweeps";

const WAKE_PATH = new URL(WAKE_URL).pathname;

/**
 * One alarm per environment, set to when the sweeps next have work.
 *
 * Replaces "look every minute": a per-minute cron kept Neon's compute awake
 * around the clock (6 CU-hours a day against 100 a month) to find nothing
 * most of the time. See docs/superpowers/specs/2026-09-16-sweep-scheduler-design.md.
 *
 * A legacy class — `fetch` plus `alarm`, no `extends DurableObject` — on
 * purpose. RPC would need `cloudflare:workers`, which bun's test runner cannot
 * resolve, and `src/index.ts` (which exports this class) is imported by the
 * test suite. The SQLite storage backend and alarms work the same either way;
 * a local spike confirmed it on 2026-09-16.
 */
export class SweepScheduler {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: AppBindings,
  ) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST" || new URL(request.url).pathname !== WAKE_PATH) {
      return new Response("Not found", { status: 404 });
    }
    const body = (await request.json().catch(() => null)) as { at?: unknown } | null;
    const at = body?.at;
    if (typeof at !== "number" || !Number.isFinite(at)) {
      return new Response("Bad request", { status: 400 });
    }
    await wakeAt(this.state.storage, at, Date.now());
    return new Response(null, { status: 204 });
  }

  /**
   * The same scope the cron opens, then the rules in `handleAlarm`. The
   * deferred work the sweeps start (notification emails) is awaited here
   * before the pool closes: unlike a cron's `ctx.waitUntil`, nothing keeps an
   * alarm's promises alive after this returns.
   */
  async alarm(): Promise<void> {
    await infraStore.runAsync(toInfraEnv(this.env), async () => {
      infraStore.setHyperdrive(
        (this.env as unknown as { HYPERDRIVE?: { connectionString: string } }).HYPERDRIVE,
      );
      infraStore.setWaitUntil((promise) => this.state.waitUntil(promise));
      try {
        await handleAlarm({
          storage: this.state.storage,
          runSweeps,
          nextDueAt: computeNextDueAt,
          now: () => Date.now(),
        });
      } finally {
        await infraStore.settleDeferredWork();
        await Db.closeDbConnection();
      }
    });
  }
}
```

- [ ] **Step 5: Add the binding type and the export.**

In `src/types.ts`, extend the import to `import type { DurableObjectNamespace, R2Bucket } from "@cloudflare/workers-types";`. Then add to `AppBindings`:

```ts
  /**
   * The sweep scheduler (src/sweep-scheduler). Optional so tests and tooling
   * without the binding keep working; the refresh does nothing without it and
   * the hourly cron still sweeps.
   */
  SWEEP_SCHEDULER?: DurableObjectNamespace;
```

In `src/index.ts`, add as the last line:

```ts
// Durable Object classes must be exported from the Worker's main module.
export { SweepScheduler } from "./sweep-scheduler/sweep-scheduler.do";
```

- [ ] **Step 6: Run the tests, the existing wiring test and the typecheck**

Run: `cd apps/backend/api && bun test src/sweep-scheduler src/__tests__/scheduled.test.ts && bun run typecheck`
Expected: PASS. `scheduled.test.ts` still imports `../index`, which now also exports the class, without a module-resolution error. Typecheck exit 0.

If the typecheck rejects `this.state.storage` as `AlarmStorage` because `setAlarm` takes `number | Date`, pass `{ getAlarm: () => this.state.storage.getAlarm(), setAlarm: (at) => this.state.storage.setAlarm(at) }` in both places instead.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/api/src/sweep-scheduler/sweep-scheduler.do.ts apps/backend/api/src/sweep-scheduler/refresh.ts \
  apps/backend/api/src/sweep-scheduler/__tests__/refresh.test.ts apps/backend/api/src/sweep-scheduler/__tests__/sweep-scheduler.do.test.ts \
  apps/backend/api/src/types.ts apps/backend/api/src/index.ts
git commit -m "feat(api): a Durable Object that wakes the sweeps when something is due

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: API — refresh after requests and after the cron

**Files:**
- Modify: `apps/backend/api/src/middlewares/config.middleware.ts` (the `finally`)
- Modify: `apps/backend/api/src/scheduled.ts` (the `try` around `runSweeps`)

**Interfaces:**
- Consumes: `shouldRefreshAfterRequest` (Task 5), `refreshSweepSchedule` (Task 6).

- [ ] **Step 1: Wire the middleware.** In `config.middleware.ts`, add the imports:

```ts
import { refreshSweepSchedule } from "../sweep-scheduler/refresh";
import { shouldRefreshAfterRequest } from "../sweep-scheduler/schedule";
```

Replace the `finally` block with:

```ts
      } finally {
        // After a write, tell the sweep scheduler when the sweeps next have
        // work. Handed to `infraStore.waitUntil` rather than awaited, so the
        // response is not held; registered before the close below, so the
        // close waits for it and the refresh's queries still have a pool.
        if (shouldRefreshAfterRequest(c.req.method, infraStore.getDbConnection() !== undefined)) {
          infraStore.waitUntil(refreshSweepSchedule(c.env.SWEEP_SCHEDULER));
        }
        closeDbBehindDeferredWork((promise) => c.executionCtx.waitUntil(promise));
      }
```

- [ ] **Step 2: Wire the cron.** In `scheduled.ts`, add `import { refreshSweepSchedule } from "./sweep-scheduler/refresh";` and change the `try`:

```ts
    try {
      await runSweeps();
      // The hourly cron is the scheduler's safety net: it re-tells the alarm
      // about anything a failed refresh or a first deploy left it not knowing.
      await refreshSweepSchedule(env.SWEEP_SCHEDULER);
    } finally {
```

- [ ] **Step 3: Run the API suite and the typecheck**

Run: `cd apps/backend/api && bun test src && bun run typecheck && bunx eslint src`
Expected:
- tests PASS, except `sweep.test.ts`, which already fails on dev when `DATABASE_URL` is missing — that is not new;
- typecheck exit 0;
- lint exit 0.

The request-path tests (for example `media-avatar.test.ts`) run without a `SWEEP_SCHEDULER` binding, so the refresh does nothing there.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/api/src/middlewares/config.middleware.ts apps/backend/api/src/scheduled.ts
git commit -m "feat(api): refresh the sweep schedule after writes and after the hourly cron

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Configuration — binding, migration, hourly cron

**Files:**
- Modify: `apps/backend/api/wrangler.jsonc`
- Modify: `apps/backend/api/src/__tests__/wrangler-cron-trigger.test.ts`

- [ ] **Step 1: Write the failing assertions.**
  - In `wrangler-cron-trigger.test.ts`, widen `WranglerConfig` and replace the "runs at least once a minute" test.
  - Keep `stripJsonComments` and the per-env "declares at least one cron" loop.

```ts
interface WranglerConfig {
  durable_objects?: { bindings?: { name: string; class_name: string }[] };
  migrations?: { tag: string; new_sqlite_classes?: string[] }[];
  env?: Record<
    string,
    {
      triggers?: { crons?: string[] };
      durable_objects?: { bindings?: { name: string; class_name: string }[] };
    }
  >;
}
```

```ts
  it("sweeps at least hourly in every environment — the safety net under the sweep scheduler", () => {
    // The 2-minute notice window no longer depends on the cron: the sweep
    // scheduler's alarm wakes the sweeps when something is due. A per-minute
    // cron kept Neon's compute awake around the clock and exhausted its free
    // allowance in about 16 days.
    for (const envName of ["dev", "qa", "prod"] as const) {
      const crons = config.env?.[envName]?.triggers?.crons ?? [];
      expect(crons).toContain("0 * * * *");
      expect(crons).not.toContain("* * * * *");
    }
  });
});

describe("wrangler.jsonc: the sweep scheduler", () => {
  const binding = { name: "SWEEP_SCHEDULER", class_name: "SweepScheduler" };

  // Durable Object bindings, like `triggers`, are not inherited from the top
  // level: an env without its own block has no scheduler, and its deadlines
  // would wait for the hourly cron.
  for (const envName of ["dev", "qa", "prod"] as const) {
    it(`binds SWEEP_SCHEDULER in env.${envName}`, () => {
      expect(config.env?.[envName]?.durable_objects?.bindings ?? []).toContainEqual(binding);
    });
  }

  it("binds it for local `wrangler dev` too", () => {
    expect(config.durable_objects?.bindings ?? []).toContainEqual(binding);
  });

  it("creates the class on the SQLite backend — the only one on the Workers Free plan", () => {
    const created = (config.migrations ?? []).flatMap((m) => m.new_sqlite_classes ?? []);
    expect(created).toContain("SweepScheduler");
  });
```

The `});` that closes the old describe moves to after the new hourly test, as shown.

- [ ] **Step 2: Run it and watch it fail**

Run: `cd apps/backend/api && bun test src/__tests__/wrangler-cron-trigger.test.ts`
Expected: FAIL on the hourly cron, the three env bindings, the local binding and the migration.

- [ ] **Step 3: Edit `wrangler.jsonc`.**

At the top level, after `"r2_buckets": [...]` and before `"env"`:

```jsonc
  // The sweep scheduler (src/sweep-scheduler): one alarm per environment, set
  // to when the sweeps next have work. SQLite backend because it is the only
  // one on the Workers Free plan.
  "durable_objects": {
    "bindings": [{ "name": "SWEEP_SCHEDULER", "class_name": "SweepScheduler" }]
  },
  "migrations": [{ "tag": "v1-sweep-scheduler", "new_sqlite_classes": ["SweepScheduler"] }],
```

In each of `env.dev`, `env.qa` and `env.prod`, replace the cron block and its comment with:

```jsonc
      // NOT inherited from the top level, same as `r2_buckets`: every named
      // env needs its own Durable Object binding.
      "durable_objects": {
        "bindings": [{ "name": "SWEEP_SCHEDULER", "class_name": "SweepScheduler" }]
      },
      // Hourly safety net under the sweep scheduler, which wakes the sweeps
      // when something is due. It was every minute, which kept Neon's compute
      // awake around the clock. NOT inherited either.
      "triggers": { "crons": ["0 * * * *"] }
```

- [ ] **Step 4: Run the test, then validate the config with wrangler without deploying**

Run: `cd apps/backend/api && bun test src/__tests__/wrangler-cron-trigger.test.ts`
Expected: PASS.

Run: `cd apps/backend/api && PATH=/Users/saliffaustino/.nvm/versions/node/v22.22.2/bin:$PATH npx wrangler deploy --dry-run --env dev --outdir /tmp/sweep-dry-run 2>&1 | tail -25`
Expected: no error, and the bindings list includes `env.SWEEP_SCHEDULER (SweepScheduler)` under Durable Objects. If wrangler complains that `migrations` must be declared per env, copy the same `migrations` array into each env block and re-run.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/api/wrangler.jsonc apps/backend/api/src/__tests__/wrangler-cron-trigger.test.ts
git commit -m "feat(api): bind the sweep scheduler in every environment and drop the cron to hourly

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Verification — overlap safety, full suites, and the alarm end to end

**Files:** none committed, unless Step 1 finds a gap. A scratch spec in `apps/e2e/tests/` is created and deleted.

- [ ] **Step 1: Confirm overlapping runs are safe for the booking and quote sweeps (spec: "the plan must confirm").**
  - Read `SweepBookingCommand` (`packages/backend/src/modules/ntizo/bounded-contexts/booking/app/use-cases/sweep-booking.command.ts`) and `SweepQuoteCommand` (`.../quote/app/use-cases/sweep-quote.command.ts`).
  - Confirm each writes through a compare-and-swap on the status it loaded: the repository `save` refuses when the status moved on, as `quote-repository.test.ts` "refuses when the status moved on" shows for quotes.
  - Confirm a second concurrent run therefore fails that row harmlessly instead of acting twice.
  - Record the finding with file:line references for the PR description.
  - If either sweep writes without such a guard, STOP and report to the owner before continuing: an alarm and the hourly cron can now overlap.

- [ ] **Step 2: Full suites, typecheck and lint in both workspaces**

```bash
cd packages/backend && bun test src scripts; bun run typecheck; bunx eslint src
cd ../../apps/backend/api && bun test src; bun run typecheck; bunx eslint src
cd ../../frontend/web && bun run typecheck
```

Expected:
- typecheck and lint clean;
- tests: no failure that is not already on `origin/dev`. Those known failures are the quote command tests that hard-code 2026-09-14 as the future, and any test that needs a DB env the worktree lacks.

List each failure and show it also fails on `origin/dev` before moving on.

- [ ] **Step 3: See an alarm fire with no cron, locally.**
  1. Start Docker and the e2e Postgres (`open -a Docker`, then `docker start ntizo-e2e-pg`).
  2. Create `apps/e2e/tests/zz-scratch-sweep-alarm.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { createVerifiedUser } from "../fixtures/auth";
import { sql } from "../fixtures/db";
import { fillSignInForm } from "../fixtures/ui";

// SCRATCH — delete after the run. wrangler dev never fires cron triggers on its
// own, so a notice sent here proves the sweep scheduler's alarm ran the sweep.
test.setTimeout(6 * 60_000);

test("an unread support message is swept about two minutes later, with no cron", async ({ page }) => {
  await createVerifiedUser("admin", { firstName: "Ada", lastName: "Admin" });
  const customer = await createVerifiedUser(undefined, { firstName: "Cora", lastName: "Customer" });
  await page.goto("/sign-in");
  await fillSignInForm(page, customer);
  await page.waitForURL("http://localhost:3000/");

  const opened = await page.request.post("http://localhost:8788/graphql", {
    headers: { "Content-Type": "application/json", "x-graphql-csrf": "1", Origin: "http://localhost:3000" },
    data: {
      query: `mutation($input: CommunicationOpenSupportRequestInput!) { communicationOpenSupportRequest(input: $input) { threadId } }`,
      variables: { input: { audience: "customer", subject: "Alarme", body: "Teste do alarme." } },
    },
  });
  const threadId = ((await opened.json()) as { data: { communicationOpenSupportRequest: { threadId: string } } })
    .data.communicationOpenSupportRequest.threadId;
  const sentAt = Date.now();

  await expect
    .poll(
      async () => {
        const [row] = await sql()<{ notified_at: Date | null }[]>`
          SELECT notified_at FROM ntizo_communication.message WHERE thread_id = ${threadId} ORDER BY created_at LIMIT 1`;
        return row?.notified_at ?? null;
      },
      { timeout: 5 * 60_000, intervals: [5_000] },
    )
    .not.toBeNull();
  console.log("SCRATCH notice swept after seconds:", Math.round((Date.now() - sentAt) / 1000));
});
```

  3. Run it:

```bash
cd apps/e2e && bun run e2e tests/zz-scratch-sweep-alarm.spec.ts --project=chromium
```

  **Expected:** PASS. The log shows "swept after" about 120–150 seconds.

  **If it fails:**
  - re-run with `DEBUG=pw:webserver` and look for `[sweep-scheduler]` lines in the `[api]` output;
  - fix the cause;
  - repeat from Step 2.

  4. Clean up:

```bash
rm apps/e2e/tests/zz-scratch-sweep-alarm.spec.ts
docker stop ntizo-e2e-pg
```

- [ ] **Step 4: The existing auth, notifications and help-center e2e specs still pass**

Run: `cd apps/e2e && bun run e2e tests/auth.spec.ts tests/notifications.spec.ts tests/help-center.spec.ts --project=chromium`
Expected: 8 passed.

---

### Task 10: Ship — PR, CI, merge, dev deploy and the idle check

- [ ] **Step 1: Bring in `origin/dev`, re-verify, push, open the PR.**
  1. Run `git fetch origin && git merge origin/dev`.
  2. If anything came in, re-run Task 9 Step 2.
  3. Run `git push -u origin feat/sweep-scheduler`.
  4. Open the PR with `gh pr create --base dev`. The body must cover:
     - **Why:** the Neon numbers from the spec.
     - **What changed.**
     - **The Task 9 Step 1 overlap finding.**
     - **Verification:** the suites, the local alarm run with its measured seconds, and the dry-run bindings.
     - **Deadlines:** QA before Sep 24, prod before Sep 27.

     End the body with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

- [ ] **Step 2: Wait for CI before merging.**
  - Watch with `gh run watch`.
  - Compare the E2E and Test failures with the known baseline on `dev`: E2E `landing`, `ssr`, `zones` and `customer-bookings`; Test `@ntizo/api#test` without `DATABASE_URL`.
  - Any new failure blocks the merge.
  - When the only failures are the known ones, run `gh pr merge <n> --merge`.

- [ ] **Step 3: Deploy the API to dev** from a clean checkout of the merge commit (the worktree after merge, or `git worktree add --detach`), with Node 22 on PATH:

```bash
cd apps/backend/api && PATH=/Users/saliffaustino/.nvm/versions/node/v22.22.2/bin:$PATH bun run deploy:dev
```

Expected output:
- the Durable Object `SWEEP_SCHEDULER (SweepScheduler)` among the bindings;
- the migration `v1-sweep-scheduler` applied;
- `schedule: 0 * * * *`.

- [ ] **Step 4: Prove dev's Neon compute now sleeps.**
  1. Record `last_active` for project `tiny-voice-01133644`, endpoint `ep-tiny-forest-b2t07xnp`. Use `npx neonctl --config-dir ~/.config/neonctl-naotem` or the API with that token.
  2. Make no requests for 10 minutes.
  3. Check that `current_state` becomes `idle` and `last_active` stops advancing. Before this change it advanced every minute.
  4. Do one real write on dev, e.g. open a support request as a test user.
  5. Check that the endpoint wakes for it and, if a notice is owed, wakes again ~2 minutes later.
  6. Check that it goes idle again.

- [ ] **Step 5: Stop and ask the owner** before deploying to QA and prod. Deploy QA before 2026-09-24 and prod before 2026-09-27:
  - `bun run deploy:qa`, then `deploy:prod`, in `apps/backend/api`;
  - fast-forward the `qa` and `main` branches to the merge commit, as with earlier releases;
  - repeat the Step 4 idle check against `ntizo-qa` (`sweet-brook-25682512`) and `ntizo-pro` (`old-rain-06218646`).

- [ ] **Step 6: Clean up.**
  1. Delete the `feat/sweep-scheduler` branch locally and on origin. Only `main`, `qa` and `dev` are kept long-lived.
  2. Remove the worktree.
  3. Record the outcome in memory (`ntizo-neon-compute-limit.md`).
