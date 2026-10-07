import type { WalletEntryDTO } from "@ntizo/shared/read-models";

/**
 * Minor units to a string a person reads.
 *
 * The division by 100 happens here and only here. Every other layer carries
 * integers — 150055, not 1500.55 — because a float that has been through
 * arithmetic is a number nobody can reconcile against a bank statement.
 */
export function formatMoney(
  minor: number,
  currency: string,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

/**
 * An amount as the console's lists write it: "1 200 MTn" — no cents when there
 * are none, and the thousands always grouped. `pt-MZ`'s default minimum
 * grouping leaves four-digit amounts ungrouped ("1200"), which is not how the
 * October 2026 mockups write a single price anywhere.
 */
export function formatMoneyShort(minor: number, currency: string, locale: string): string {
  const whole = minor % 100 === 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
    useGrouping: "always",
  }).format(minor / 100);
}

/**
 * What a ledger row did to the balance, as one signed number.
 *
 * The two deltas are separate in the database because one entry legitimately
 * moves both — releasing a completed booking is pending −X and available +X.
 * A reader scanning a list wants one number per line, and the one that answers
 * "what changed for me" is the available side.
 */
export function movementMinor(entry: WalletEntryDTO): number {
  return entry.availableDeltaMinor;
}

/**
 * Whether a row moved money at all.
 *
 * Cash settled outside the platform is the case: an amount of the full price
 * and deltas of zero. Showing "+0,00 MT" beside "1 500,00 MT" would read as a
 * bug; showing the amount alone, with no sign, is what actually happened.
 */
export function movedNothing(entry: WalletEntryDTO): boolean {
  return entry.availableDeltaMinor === 0 && entry.pendingDeltaMinor === 0;
}

export function movementTone(entry: WalletEntryDTO): "up" | "down" | "flat" {
  if (movedNothing(entry)) return "flat";
  return movementMinor(entry) >= 0 ? "up" : "down";
}
