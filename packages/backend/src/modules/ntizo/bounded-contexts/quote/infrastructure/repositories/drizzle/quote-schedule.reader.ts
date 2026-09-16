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
