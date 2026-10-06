/**
 * A weekday as the mockups abbreviate it — "Sáb", "Seg", "Sun", "So" —
 * with its first letter raised and no trailing point.
 *
 * `Intl`'s own short form is used where the locale has one. Portuguese
 * (`pt-PT`, `pt-MZ`) has none in CLDR: its "short" weekday is the whole word
 * — "domingo", or "segunda" for "segunda-feira" — which is why the three
 * letters are taken off the long name there, the abbreviation every
 * Portuguese calendar prints.
 */
export function weekdayAbbrev(locale: string, date: Date, timeZone = "UTC"): string {
  const short = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone }).format(date).replace(/\.$/, "");
  const long = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone }).format(date);
  // Anything past four letters is not an abbreviation ("segunda" for
  // "segunda-feira"), so the first three letters stand in for it.
  const word = short === long || short.length > 4 ? long.slice(0, 3) : short;
  return word.charAt(0).toLocaleUpperCase(locale) + word.slice(1);
}

/** The same, for a stored weekday number (0 = Sunday). */
export function weekdayNumberAbbrev(locale: string, weekday: number): string {
  // 2023-01-01 was a Sunday.
  return weekdayAbbrev(locale, new Date(Date.UTC(2023, 0, 1 + weekday, 12)));
}
