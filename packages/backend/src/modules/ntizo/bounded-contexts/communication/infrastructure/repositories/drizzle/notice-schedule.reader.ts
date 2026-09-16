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
