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
