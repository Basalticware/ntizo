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
