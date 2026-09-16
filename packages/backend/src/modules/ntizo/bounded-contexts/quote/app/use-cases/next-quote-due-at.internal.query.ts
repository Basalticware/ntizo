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
