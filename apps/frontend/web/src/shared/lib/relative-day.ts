/**
 * "Hoje", "Amanhã", "Ontem" — or the date, for anything further away.
 *
 * Measured in the appointment's own zone, not the machine's: a booking at
 * 00:30 in Maputo is "tomorrow" there even when the browser sits an hour
 * west. The words are `Intl`'s, so every locale gets its own.
 */
export function relativeDayLabel(iso: string, timeZone: string, now: Date, locale: string): string {
  const civil = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const toDay = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) / 86_400_000;
  const target = new Date(iso);
  const diff = toDay(civil(target)) - toDay(civil(now));
  if (Math.abs(diff) <= 1) {
    const word = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(diff, "day");
    return word.charAt(0).toLocaleUpperCase(locale) + word.slice(1);
  }
  return shortDate(iso, timeZone, locale, { year: true });
}

/**
 * "11 Out", or "13 Out 2024" with the year — the mockups' short date.
 *
 * Built in two steps, because CLDR answers `pt-MZ`'s short day-and-month
 * (with or without the year) with a numeric pattern, "11/10". The word order
 * comes from the long form ("11 de outubro de 2024" → day, month, year;
 * en-US "October 11, 2024" → month, day, year), and the month is then
 * written in the locale's own abbreviation, asked for on its own, without
 * its point and with its first letter raised.
 */
export function shortDate(iso: string, timeZone: string, locale: string, opts: { year?: boolean } = {}): string {
  const date = new Date(iso);
  const month = new Intl.DateTimeFormat(locale, { timeZone, month: "short" })
    .format(date)
    .replace(/\.$/, "");
  const order = new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "numeric",
    month: "long",
    ...(opts.year ? { year: "numeric" } : {}),
  }).formatToParts(date);
  return order
    .filter((p) => p.type === "day" || p.type === "month" || p.type === "year")
    .map((p) => (p.type === "month" ? month.charAt(0).toLocaleUpperCase(locale) + month.slice(1) : p.value))
    .join(" ");
}
