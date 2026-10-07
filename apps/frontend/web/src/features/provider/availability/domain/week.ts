import type { WeeklyRuleDraft } from "./types";
import { WEEKDAY_ORDER, weekdayDisplayIndex } from "@/shared/domain/week-format";

export {
  WEEKDAY_ORDER,
  weekdayDisplayIndex,
  weekdayLabel,
  weekdayShortLabel,
  weekdayNarrowLabel,
  minutesToLabel,
  labelToMinutes,
  formatDayList,
  formatHours,
} from "@/shared/domain/week-format";

/**
 * One weekly row's place in the canonical draft order: its day in the
 * Monday-first display order, then its start.
 *
 * The draft is kept sorted rather than sorted at each read, so what a reader
 * sees, what the cards group, and what `setWeeklyPattern` sends are all one
 * sequence — a member whose Sunday row was typed first does not get a
 * different payload from one who typed it last.
 */
export function compareRules(a: WeeklyRuleDraft, b: WeeklyRuleDraft): number {
  const byDay = weekdayDisplayIndex(a.weekday) - weekdayDisplayIndex(b.weekday);
  return byDay !== 0 ? byDay : a.startMinute - b.startMinute;
}

/**
 * What the weekly pattern itself adds up to, before any date on the calendar
 * touches it.
 *
 * The number beside it — `weekTotals(previewDays).totalMinutes` — is what a
 * *particular* week produces once closures and exceptions have had their say.
 * Showing only that one leaves the provider to work out for themselves why this
 * week reads 38 hours when they set 44; the difference between the two is the
 * sentence the old screen could not say at all.
 *
 * One row per weekday means the sum is already exactly one week. It is not a
 * count of anything on a calendar, so a rule on a weekday that this particular
 * week's closure blackens still counts here — that is the point.
 */
export function patternMinutes(
  rules: readonly Pick<WeeklyRuleDraft, "startMinute" | "endMinute">[],
): number {
  return rules.reduce((sum, rule) => sum + (rule.endMinute - rule.startMinute), 0);
}

/**
 * The rows that share a pair of times *and the same shape*, as one thing a
 * provider can name.
 *
 * "Monday to Friday, 09:00 to 17:00" is one decision, and the database stores
 * it as five rows because a row is per-day. A card per row would ask somebody
 * to change their mind five times to move their morning, so the screen groups
 * them back and the drawer edits the group; `rules` is the expansion the wire
 * still wants.
 *
 * Grouping decision, spelled out because it is easy to get backwards: the
 * group's identity is the hours *and* `bufferMinutes`/`slotIntervalMinutes`/
 * `capacity` together, not the hours alone. Two rows that read the same
 * 09:00–17:00 but disagree on capacity — Wednesday capped at one booking,
 * every other day left at the default — become two separate cards rather
 * than one. Grouping by hours alone would have merged them into a single
 * card with a single drawer, and the drawer can only hand back *one* shape
 * for every day it edits — saving that card would have silently overwritten
 * Wednesday's real capacity with whatever the drawer's field said (typically
 * blank, since the drawer has no way to show "3 on one day, default on the
 * rest"). Splitting the card is the safer surprise: it costs a provider an
 * extra card to look at, where the alternative cost them data they never
 * knew was at risk.
 */
export interface WeekRuleGroup {
  /** Stable within a draft — hours and shape together are the group's identity. */
  readonly id: string;
  readonly startMinute: number;
  readonly endMinute: number;
  /** This group's own shape — shared by construction across every rule folded into it. See the grouping decision above. */
  readonly bufferMinutes: number | null;
  readonly slotIntervalMinutes: number | null;
  readonly capacity: number | null;
  /** Stored weekday numbers (0 = Sunday), in Monday-first display order. */
  readonly weekdays: readonly number[];
  /** One row per day, in the same order — what goes back over the wire. */
  readonly rules: readonly WeeklyRuleDraft[];
}

/** A row's group identity: hours and shape, both — see {@link WeekRuleGroup}'s grouping decision. */
function groupKey(rule: WeeklyRuleDraft): string {
  return `${rule.startMinute}-${rule.endMinute}-${rule.bufferMinutes}-${rule.slotIntervalMinutes}-${rule.capacity}`;
}

export function groupRules(rules: readonly WeeklyRuleDraft[]): WeekRuleGroup[] {
  const byKey = new Map<string, { shape: WeeklyRuleDraft; days: number[] }>();
  for (const rule of rules) {
    const key = groupKey(rule);
    const entry = byKey.get(key) ?? { shape: rule, days: [] };
    if (!entry.days.includes(rule.weekday)) entry.days.push(rule.weekday);
    byKey.set(key, entry);
  }

  return [...byKey.entries()]
    .map(([id, { shape, days }]) => {
      const { startMinute, endMinute, bufferMinutes, slotIntervalMinutes, capacity } = shape;
      const weekdays = [...days].sort((a, b) => weekdayDisplayIndex(a) - weekdayDisplayIndex(b));
      return {
        id,
        startMinute,
        endMinute,
        bufferMinutes,
        slotIntervalMinutes,
        capacity,
        weekdays,
        // Rebuilt rather than carried through from the input: the group is the
        // authority on its own hours and shape, so an expansion can never
        // disagree with what the card and the drawer are showing above it.
        rules: weekdays.map((weekday) => ({
          weekday,
          startMinute,
          endMinute,
          bufferMinutes,
          slotIntervalMinutes,
          capacity,
        })),
      };
    })
    .sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);
}

/**
 * Whether `candidate` overlaps any existing rule on the same weekday.
 *
 * A usability guard for the form, not an invariant — the engine merges
 * overlapping rules harmlessly and the server never refuses one. Half-open
 * interval comparison: a row starting exactly where another ends does not
 * overlap it, the same way two back-to-back shifts do not.
 */
export function overlaps(rules: readonly WeeklyRuleDraft[], candidate: WeeklyRuleDraft): boolean {
  return rules.some(
    (rule) =>
      rule.weekday === candidate.weekday &&
      rule.startMinute < candidate.endMinute &&
      candidate.startMinute < rule.endMinute,
  );
}

/** One weekday's rows, earliest first — what a day's row in the week editor lists. */
export function rulesOn(rules: readonly WeeklyRuleDraft[], weekday: number): WeeklyRuleDraft[] {
  return rules.filter((r) => r.weekday === weekday).sort(compareRules);
}

/**
 * The draft minus exactly one row, matched on every field.
 *
 * Rows carry no id (see `WeeklyRuleDraft`), so the row's whole content is its
 * identity. Two identical rows on one day are the same instruction twice, and
 * removing one of them removes the instruction — which is why every match
 * goes, not just the first.
 */
export function withoutRule(
  rules: readonly WeeklyRuleDraft[],
  target: WeeklyRuleDraft,
): WeeklyRuleDraft[] {
  return rules.filter(
    (r) =>
      !(
        r.weekday === target.weekday &&
        r.startMinute === target.startMinute &&
        r.endMinute === target.endMinute &&
        r.bufferMinutes === target.bufferMinutes &&
        r.slotIntervalMinutes === target.slotIntervalMinutes &&
        r.capacity === target.capacity
      ),
  );
}

/** The hours a day starts with when nothing else in the week suggests better. */
export const DEFAULT_DAY = { startMinute: 9 * 60, endMinute: 17 * 60 } as const;

/**
 * What switching a day on gives it: the nearest earlier working day's rows,
 * moved onto this weekday, or 09:00–17:00 when the week is still empty.
 *
 * Copying is the guess most people want — turning Saturday on after a
 * Monday-to-Friday week usually means "the same again" — and it carries each
 * row's own shape along, so a copied rule sells what the original did rather
 * than quietly falling back to the defaults. "Earlier" walks back through the
 * Monday-first display order and wraps, so Monday copies Sunday when Sunday is
 * the only day set.
 */
export function seedDay(rules: readonly WeeklyRuleDraft[], weekday: number): WeeklyRuleDraft[] {
  const at = weekdayDisplayIndex(weekday);
  for (let step = 1; step < 7; step++) {
    const donor = WEEKDAY_ORDER[(at - step + 7) % 7]!;
    const rows = rulesOn(rules, donor);
    if (rows.length > 0) return rows.map((r) => ({ ...r, weekday }));
  }
  return [
    { weekday, ...DEFAULT_DAY, bufferMinutes: null, slotIntervalMinutes: null, capacity: null },
  ];
}

/**
 * The hours offered to a new interval on a day that already has some: from
 * the first whole hour after the day's last one ends — a lunch-sized gap after
 * a morning ending on the hour — for up to four hours, never past midnight.
 * A day with nothing set, or with no room left, is offered the default.
 */
export function nextIntervalOn(
  rules: readonly WeeklyRuleDraft[],
  weekday: number,
): { startMinute: number; endMinute: number } {
  const rows = rulesOn(rules, weekday);
  if (rows.length === 0) return { ...DEFAULT_DAY };
  const lastEnd = rows.reduce((max, r) => Math.max(max, r.endMinute), 0);
  const startMinute = (Math.floor(lastEnd / 60) + 1) * 60;
  if (startMinute >= 24 * 60) return { ...DEFAULT_DAY };
  return { startMinute, endMinute: Math.min(startMinute + 4 * 60, 24 * 60) };
}

/** How many weekdays the pattern works at all. */
export function workingDayCount(rules: readonly Pick<WeeklyRuleDraft, "weekday">[]): number {
  return new Set(rules.map((r) => r.weekday)).size;
}
