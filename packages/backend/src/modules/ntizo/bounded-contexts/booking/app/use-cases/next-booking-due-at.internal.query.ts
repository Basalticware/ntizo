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
