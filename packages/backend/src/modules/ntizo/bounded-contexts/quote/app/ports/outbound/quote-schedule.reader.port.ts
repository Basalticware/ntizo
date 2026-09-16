/** When the quote sweep next has something to do; null when no open quote has a clock running. */
export interface QuoteScheduleReaderPort {
  earliestDeadline(): Promise<Date | null>;
}
