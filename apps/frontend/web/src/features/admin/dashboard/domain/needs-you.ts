/**
 * What is owed, in the order somebody is waiting on it: a customer whose
 * money is in dispute, a business waiting to trade, a person waiting on
 * support, a person who wrote in. All four are always drawn — a source at
 * zero is a card that says nothing waits, not a missing card — so the row
 * keeps the four columns of the readings under it on every day.
 *
 * A count that has not arrived is left out of the row's numbers but not of
 * the row: it is `null`, and the card shows its placeholder rather than a
 * zero it does not know yet.
 */
export type NeedsYouKey = "disputed" | "providers" | "support" | "contact";

export interface NeedsYouItem {
  key: NeedsYouKey;
  count: number | null;
}

export const NEEDS_YOU_ORDER: readonly NeedsYouKey[] = ["disputed", "providers", "support", "contact"];

/** How many applications the dashboard lists: enough to see who is new, few enough to stay a glance. */
export const LATEST_APPLICATIONS_LIMIT = 5;

export function needsYou(counts: Partial<Record<NeedsYouKey, number | undefined>>): NeedsYouItem[] {
  return NEEDS_YOU_ORDER.map((key) => ({ key, count: counts[key] ?? null }));
}
