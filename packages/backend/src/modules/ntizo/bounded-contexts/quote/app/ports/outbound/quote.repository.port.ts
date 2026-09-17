import type { Quote } from "../../../domain/aggregates/quote.aggregate";

/**
 * An extra condition on `save`'s compare-and-swap.
 *
 * `dueBy`: apply only while the stored deadline is at or before this instant.
 * The status alone cannot tell a sweep that its snapshot is stale — a
 * revision is `PROPOSED → PROPOSED` and moves only the deadline — so the sweep
 * re-checks its own selection at the moment it writes.
 */
export interface QuoteSaveGuard {
  dueBy?: Date;
  /**
   * Apply only while the stored deadline is still exactly this one — the
   * deadline the command read. Every revision stamps a new `validUntil` onto
   * `expires_at`, so this is how acceptance tells that the proposal it read is
   * still the live one. A column on the quote row itself, not a lookup of the
   * proposal table, because Postgres re-checks a row's own columns against
   * the committed version when a concurrent write held the row, and would
   * not re-run a subquery.
   */
  unchangedExpiresAt?: Date;
}

export interface QuoteRepositoryPort {
  /**
   * Writes the quote row and any proposal rows. Throws `QuoteAlreadyOpenError`
   * when `quote_open_per_customer_service_uq` refuses. Returns the quote with ids.
   */
  insert(quote: Quote): Promise<Quote>;

  findById(id: string): Promise<Quote | null>;

  /**
   * Compare-and-swap: updates the row only while its status is still
   * `expectedStatus`; inserts proposals whose id is null and stamps
   * supersession on the rest. Returns the persisted quote (ids assigned) or
   * null when the row had moved on — including, with `guard.dueBy`, when its
   * deadline is no longer due.
   */
  save(quote: Quote, expectedStatus: Quote["status"], guard?: QuoteSaveGuard): Promise<Quote | null>;

  /** Open quotes whose clock has run out, oldest deadline first. */
  findDueForSweep(now: Date, limit: number): Promise<Quote[]>;
}
