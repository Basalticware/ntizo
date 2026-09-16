/**
 * When the notify-unread sweep next has something to do.
 *
 * `null` means no message is owed a notice at all, not "none yet": the
 * scheduler sets no alarm for this context until a new message arrives.
 */
export interface NoticeScheduleReaderPort {
  earliestNoticeDueAt(): Promise<Date | null>;
}
