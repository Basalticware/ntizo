import type { BookingDTO } from "@ntizo/shared/read-models";

/**
 * The facts a row of "Minhas reservas" prints, worded once so the list and
 * the "Próxima reserva" card beside it cannot disagree about one booking.
 */

/** "15 de outubro de 2026" — the civil date of the start, in the provider's zone. */
export function longDateWording(
  startsAt: string,
  locale: string,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(new Date(startsAt));
}

/**
 * "45 min", "2h", "1h30" — the length of the job, as the mockup writes it
 * after the time range. Built from digits only, the way `timeLeftWording`
 * is, so no locale has a sentence to keep in step.
 */
export function durationWording(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)}h${rest ? String(rest).padStart(2, "0") : ""}`;
}

/**
 * "Maputo, Sommerschield", or null when the booking carries neither.
 *
 * The city and the district only — never `addressLine`. A row is read at a
 * glance by whoever is looking at the screen, and the street belongs to the
 * detail page, which decides on its own terms when to show it.
 */
export function placeWording(
  b: Pick<BookingDTO, "addressCity" | "addressDistrict">,
): string | null {
  const parts = [b.addressCity, b.addressDistrict].filter(
    (p): p is string => !!p && p.trim() !== "",
  );
  return parts.length ? parts.join(", ") : null;
}

/** Two letters for an avatar with no picture: "Hélder Cossa" → "HC". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * The booking the "Próxima reserva" card shows: the one whose slot starts
 * soonest, among those still ahead of `now` and still alive — confirmed, or
 * waiting on the provider or on the payment.
 *
 * Read off two answers the page already asks for. `upcoming` is the server's
 * `upcoming` tab, which is every confirmed booking still ahead, soonest
 * first, so its first row is exact. `waiting` is the `waiting` tab's first
 * page, ordered by when it was *requested* rather than by when it happens —
 * so it may only be trusted when it is the whole tab. The caller passes
 * null otherwise, and the card then shows the soonest confirmed booking:
 * a true answer to a narrower question rather than a guess at the wider one.
 */
export function nextBooking(
  upcoming: readonly BookingDTO[],
  waiting: readonly BookingDTO[] | null,
  now: Date,
): BookingDTO | null {
  const ahead = (b: BookingDTO) => new Date(b.startsAt).getTime() >= now.getTime();
  const candidates = [
    ...upcoming.filter((b) => b.status === "CONFIRMED" && ahead(b)).slice(0, 1),
    ...(waiting ?? []).filter(
      (b) =>
        (b.status === "AWAITING_PROVIDER" || b.status === "PENDING_PAYMENT") &&
        ahead(b),
    ),
  ];
  let best: BookingDTO | null = null;
  for (const b of candidates) {
    if (!best || new Date(b.startsAt).getTime() < new Date(best.startsAt).getTime())
      best = b;
  }
  return best;
}
