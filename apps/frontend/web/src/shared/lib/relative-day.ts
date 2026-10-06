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
  // Long month, because `pt-MZ`'s short day-and-month is the numeric "9/10";
  // the year only when it is not this one.
  const sameYear = civil(target).slice(0, 4) === civil(now).slice(0, 4);
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(target);
}
