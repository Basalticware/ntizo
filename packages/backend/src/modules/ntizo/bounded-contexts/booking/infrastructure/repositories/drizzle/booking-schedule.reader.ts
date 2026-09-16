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
