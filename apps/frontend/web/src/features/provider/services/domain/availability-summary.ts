import { mergeIntervals, type Interval } from "@ntizo/shared/scheduling";
import {
  WEEKDAY_ORDER,
  formatDayList,
  minutesToLabel,
} from "@/shared/domain/week-format";
import { weekdayNumberAbbrev } from "@/features/provider/domain/weekday-abbrev";

/**
 * A service's week in two short lines — "Seg – Sáb" over "08:00 – 18:00" —
 * the way the services table writes its "Disponibilidade" column.
 *
 * Read off the weekly pattern of whoever performs the service, merged: the
 * days anybody on it works, at the hours anybody does. Exceptions and closures
 * are left out on purpose; this is the shape of the week, not today's answer,
 * which the availability screen gives.
 *
 * When the days do not all keep the same hours, the most common set of hours
 * is the one written, and `more` says other days differ — a row is not the
 * place for a timetable, and naming one stretch as if it were the whole week
 * would be wrong.
 */
export interface AvailabilitySummary {
  /** `"all"` when every day of the week has the same hours. */
  days: "all" | string;
  hours: string;
  more: boolean;
}

export function availabilitySummary(
  rules: readonly { weekday: number; startMinute: number; endMinute: number }[],
  locale: string,
): AvailabilitySummary | null {
  const byDay = new Map<number, Interval[]>();
  for (const r of rules) {
    byDay.set(r.weekday, [...(byDay.get(r.weekday) ?? []), { start: r.startMinute, end: r.endMinute }]);
  }

  // Days grouped by their hours, in Monday-first order.
  const groups = new Map<string, { hours: Interval[]; days: number[] }>();
  for (const weekday of WEEKDAY_ORDER) {
    const hours = mergeIntervals(byDay.get(weekday) ?? []);
    if (hours.length === 0) continue;
    const key = hours.map((h) => `${h.start}-${h.end}`).join(",");
    const group = groups.get(key) ?? { hours, days: [] };
    group.days.push(weekday);
    groups.set(key, group);
  }
  if (groups.size === 0) return null;

  const main = [...groups.values()].sort((a, b) => b.days.length - a.days.length)[0]!;
  return {
    days: main.days.length === 7 ? "all" : dayPhrase(main.days, locale),
    hours: main.hours.map((h) => `${minutesToLabel(h.start)} – ${minutesToLabel(h.end)}`).join(", "),
    more: groups.size > 1,
  };
}

/** "Seg – Sáb" for a run of three or more days in a row, the listed days otherwise. */
function dayPhrase(days: readonly number[], locale: string): string {
  const positions = days.map((d) => (WEEKDAY_ORDER as readonly number[]).indexOf(d));
  const consecutive = positions.every((p, i) => i === 0 || p === positions[i - 1]! + 1);
  if (consecutive && days.length >= 3) {
    return `${short(days[0]!, locale)} – ${short(days[days.length - 1]!, locale)}`;
  }
  const list = formatDayList(locale, days);
  return list.charAt(0).toLocaleUpperCase(locale) + list.slice(1);
}

function short(weekday: number, locale: string): string {
  return weekdayNumberAbbrev(locale, weekday);
}
