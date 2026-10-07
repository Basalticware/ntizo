import { relativeDayLabel, shortDate } from "@/shared/lib/relative-day";

/**
 * When a conversation last moved, as an inbox writes it: "10:24" today,
 * "Ontem" yesterday, "9 Out" before that.
 *
 * In the reader's own zone, not the provider's: a message's time is when it
 * reached the person reading the list.
 */
export function lastMessageWhen(iso: string, now: Date, locale: string): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const at = new Date(iso);
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: zone });
  if (day(at) === day(now)) {
    return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: zone }).format(at);
  }
  if (day(at) === day(new Date(now.getTime() - 86_400_000))) return relativeDayLabel(iso, zone, now, locale);
  return shortDate(iso, zone, locale);
}

/**
 * The line a conversation draws over the first message of each day — "Hoje,
 * 11 de outubro", "Ontem, …", or the full date further back.
 */
export function dayDividerLabel(iso: string, now: Date, locale: string): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: zone }).format(new Date(iso));
  const near = relativeDayLabel(iso, zone, now, locale);
  // `relativeDayLabel` answers with a word only for yesterday, today and
  // tomorrow; anything else comes back as the date itself.
  if (near === shortDate(iso, zone, locale, { year: true })) {
    const full = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: zone }).format(
      new Date(iso),
    );
    return full.charAt(0).toLocaleUpperCase(locale) + full.slice(1);
  }
  return `${near}, ${date}`;
}

/** The civil day a message belongs to, in the reader's zone — what the dividers group by. */
export function messageDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
}
