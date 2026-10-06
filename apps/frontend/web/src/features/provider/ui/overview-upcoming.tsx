import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarCheck, MapPin, UserRound } from "lucide-react";
import { Skeleton } from "@ntizo/frontend-ui";
import type { ProviderBookingDTO } from "@ntizo/shared/read-models";
import { BrandImage } from "@/shared/components/brand-image";
import { EmptyCard } from "@/shared/components/empty-card";
import { DETAILS_BUTTON_CLASS } from "@/shared/components/list-cells";
import { initialsFrom } from "@/shared/lib/initials";
import { compactSlotWording } from "@/features/checkout/domain/slot-wording";
import { formatMoneyShort } from "@/features/wallet/domain/money";
import { useServices } from "@/features/provider/services/viewmodel/use-services";
import { useUpcomingBookings } from "../bookings/viewmodel/use-provider-bookings";
import { BookingStatusBadge } from "../bookings/ui/booking-status-badge";
import { UPCOMING_PREVIEW_LIMIT } from "../bookings/domain/status";
import { weekdayAbbrev } from "../domain/weekday-abbrev";
import { MORE_LINK } from "./overview-link";

/**
 * "Próximas reservas": the next four bookings on the calendar, each as the
 * mockup's row — the date stacked in a column, the service's own photo, what
 * and where, the status over the price, and the way into the booking.
 *
 * The photo is the service's first image, read off the catalogue the
 * workspace already loads; a service with none gets its monogram on the same
 * tile rather than a stock picture of somebody else's work.
 */
export function UpcomingBookings({
  providerId,
  slug,
  locale,
}: {
  providerId: string;
  slug: string;
  locale: string;
}) {
  const { t } = useTranslation("provider");
  const upcoming = useUpcomingBookings(providerId);
  const services = useServices(providerId);
  const photoOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of services.data ?? []) if (s.imageUrls[0]) map.set(s.id, s.imageUrls[0]);
    return map;
  }, [services.data]);
  const items = upcoming.data?.items ?? [];

  return (
    <section aria-labelledby="overview-upcoming" className="min-w-0">
      <div className="flex items-center justify-between pr-3 pl-0.5">
        <h2 id="overview-upcoming" className="text-[21.5px] leading-[1.1] font-extrabold text-[var(--color-headline)]">
          {t("overview.upcomingTitle")}
        </h2>
        <Link to="/provider/$slug/bookings" params={{ slug }} search={{ tab: "upcoming" }} className={MORE_LINK}>
          {t("overview.upcomingAll")}
          <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
        </Link>
      </div>

      <div className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
        {upcoming.isLoading ? (
          <ul className="m-0 list-none p-0">
            {Array.from({ length: UPCOMING_PREVIEW_LIMIT }, (_, i) => (
              <li key={i} className="flex items-center gap-6 border-t border-[var(--color-line-2)] px-5 py-[19px] first:border-t-0">
                <Skeleton className="h-[75px] w-[92px] rounded-md" />
                <div className="grid flex-1 gap-2">
                  <Skeleton className="h-[19px] w-48" />
                  <Skeleton className="h-[15px] w-64 max-w-full" />
                </div>
              </li>
            ))}
          </ul>
        ) : items.length === 0 ? (
          <EmptyCard
            badge={CalendarCheck}
            title={t("overview.upcomingEmptyTitle")}
            body={t("overview.upcomingEmpty")}
          />
        ) : (
          <ul className="m-0 list-none p-0">
            {items.map((b) => (
              <UpcomingRow key={b.id} booking={b} slug={slug} locale={locale} photo={photoOf.get(b.serviceId) ?? null} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function UpcomingRow({
  booking: b,
  slug,
  locale,
  photo,
}: {
  booking: ProviderBookingDTO;
  slug: string;
  locale: string;
  photo: string | null;
}) {
  const { t } = useTranslation("provider");
  const slot = compactSlotWording(b.startsAt, b.endsAt, locale, b.timezone);
  const part = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { timeZone: b.timezone, ...opts })
      .format(new Date(b.startsAt))
      .replace(/\.$/, "");
  const cap = (s: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
  const place = [b.addressCity, b.addressDistrict].filter(Boolean).join(", ");
  const href = { to: "/provider/$slug/bookings/$bookingId", params: { slug, bookingId: b.id } } as const;

  return (
    <li className="grid grid-cols-[60px_92px_minmax(0,1fr)] items-center gap-y-3 border-t border-[var(--color-line-2)] py-[19px] pr-[19px] first:border-t-0 sm:grid-cols-[60px_102px_minmax(0,1fr)_118px_131px]">
      <div className="text-center text-[13px] leading-none text-[var(--color-muted-foreground)]">
        {weekdayAbbrev(locale, new Date(b.startsAt), b.timezone)}
        <b className="mt-1.5 mb-[5px] block text-lg font-bold text-[var(--color-headline)]">{part({ day: "numeric" })}</b>
        {cap(part({ month: "short" }))}
      </div>
      <div className="ml-2.5 grid h-[75px] w-[92px] place-items-center overflow-hidden rounded-md bg-[var(--color-muted)]">
        {photo ? (
          <BrandImage src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm font-semibold text-[var(--color-muted-foreground)]">{initialsFrom(b.serviceName)}</span>
        )}
      </div>
      <div className="min-w-0 pr-3 pl-4 sm:pl-[27px]">
        <Link {...href} className="block truncate text-[15.5px] font-bold text-[var(--color-headline)] hover:underline">
          {b.serviceName}
        </Link>
        <p className="mt-[7px] flex items-center gap-1.5 text-[13px] leading-[1.45] whitespace-nowrap text-[var(--color-muted-foreground)]">
          {place && (
            <>
              <MapPin aria-hidden="true" className="h-[13px] w-[13px] shrink-0 text-[var(--color-ink-2)]" />
              <span className="min-w-0 truncate">{place}</span>
              <i aria-hidden="true" className="mx-[3px] h-[3px] w-[3px] shrink-0 rounded-full bg-[var(--color-muted-foreground)]" />
            </>
          )}
          <span className="shrink-0 tabular-nums">{`${slot.start} – ${slot.end}`}</span>
        </p>
        <p className="mt-[7px] flex items-center gap-1.5 text-[13px] leading-[1.45] text-[var(--color-muted-foreground)]">
          <UserRound aria-hidden="true" className="h-[13px] w-[13px] shrink-0 text-[var(--color-ink-2)]" />
          <span className="truncate">{b.customerFirstName}</span>
        </p>
      </div>
      <div className="col-span-2 col-start-2 flex items-center justify-between gap-3 pl-2.5 sm:col-span-1 sm:col-start-auto sm:flex-col sm:items-start sm:self-stretch sm:pl-0">
        <span className="[&>span]:h-[27px] [&>span]:px-3.5 [&>span]:text-[13px]">
          <BookingStatusBadge status={b.status} />
        </span>
        <span className="text-base font-bold whitespace-nowrap text-[var(--color-headline)] tabular-nums sm:mb-1 sm:self-end">
          {formatMoneyShort(b.priceMinor, b.currency, locale)}
        </span>
      </div>
      <Link
        {...href}
        tabIndex={-1}
        className={`${DETAILS_BUTTON_CLASS} col-start-3 h-[39px] w-[109px] justify-self-start border-[#9fc2fc] px-0 text-sm sm:col-start-auto sm:ml-[22px]`}
      >
        {t("common:viewDetails")}
      </Link>
    </li>
  );
}
