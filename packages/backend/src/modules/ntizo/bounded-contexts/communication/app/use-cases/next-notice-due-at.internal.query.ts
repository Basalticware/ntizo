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
