import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { cn } from "@ntizo/frontend-ui";
import type { BookingDTO } from "@ntizo/shared/read-models";
import { BrandImage } from "@/shared/components/brand-image";
import { DETAILS_BUTTON_CLASS } from "@/shared/components/list-cells";
import { compactSlotWording } from "@/features/checkout/domain/slot-wording";
import { formatMoney } from "@/features/wallet/domain/money";
import { type CustomerBookingStatus } from "../domain/status";
import {
  durationWording,
  initialsOf,
  longDateWording,
  placeWording,
} from "../domain/list-row";
import { BookingStatusBadge } from "./booking-status-badge";

/** Every bordered box on this page: the list's rows and the rail's cards. */
export const BOOKINGS_CARD =
  "min-w-0 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card)]";

/** The countdown's colour: amber while the provider is deciding, blue while the customer is. */
export function countdownTone(status: CustomerBookingStatus): string {
  return status === "PENDING_PAYMENT"
    ? "text-[var(--color-primary)]"
    : "text-[var(--color-warn-fg)]";
}

/** The provider's picture at avatar size, or their initials on the soft ground. */
export function ProviderAvatar({
  name,
  logoUrl,
  className,
}: {
  name: string;
  logoUrl: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-[22px] w-[22px] shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--color-blue-soft)] text-[10px] font-bold text-[var(--color-primary)]",
        className,
      )}
    >
      {logoUrl ? (
        <BrandImage
          src={logoUrl}
          alt=""
          className="h-full w-full object-cover"
          fallback={initialsOf(name)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}

/** One fact with its glyph — the date, the time, the place. */
export function MetaFact({
  icon: Icon,
  children,
}: {
  icon: typeof CalendarDays;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Icon
        className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]"
        aria-hidden="true"
      />
      <span className="min-w-0">{children}</span>
    </span>
  );
}

/**
 * The booking's appointment, worded once for the row and the rail: the long
 * date, "10:00 – 12:00 (2h)", and the place, each null-safe.
 */
export function useAppointment(b: BookingDTO) {
  const { i18n } = useTranslation("bookings");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const slot = compactSlotWording(b.startsAt, b.endsAt, locale, b.timezone);
  return {
    date: longDateWording(b.startsAt, locale, b.timezone),
    time: `${slot.start} – ${slot.end} (${durationWording(b.durationMinutes)})`,
    place: placeWording(b),
    // Grouped always ("1 200,00 MTn"), as every other price on the site.
    price: formatMoney(b.priceMinor, b.currency, locale),
  };
}

/**
 * One booking as the October 2026 mockup draws it: a bordered card with the
 * service photo, the service and the provider, the appointment, the price,
 * the status and "Ver detalhes".
 *
 * **One element per fact, placed by grid areas** rather than a table and a
 * card drawn side by side for CSS to pick from. On a phone the photo sits
 * beside the title, the appointment runs under both, and the status and the
 * price share a line above the buttons; from `md` the same elements line up
 * as photo · text · price · status-and-buttons.
 *
 * The title is the row's link; "Ver detalhes" is the same link drawn as the
 * button the mockup puts there, out of the tab order and the accessibility
 * tree so a reader meets each row once.
 */
export function BookingRow({
  booking: b,
  countdown,
  primaryAction,
  quietActions,
}: {
  booking: BookingDTO;
  /** "termina em 1h42", already worded; null when no deadline is running. */
  countdown: string | null;
  /** Pagar, when paying is what is being waited for. */
  primaryAction?: ReactNode;
  /** Mensagem and Cancelar, quietly, under the appointment. */
  quietActions?: ReactNode;
}) {
  const { t } = useTranslation("bookings");
  const when = useAppointment(b);

  return (
    <li
      className={cn(
        BOOKINGS_CARD,
        "grid items-start gap-x-3 gap-y-3 p-3 sm:p-4",
        "grid-cols-[88px_minmax(0,1fr)_auto] [grid-template-areas:'photo_head_head'_'meta_meta_meta'_'status_status_price'_'act_act_act']",
        "md:grid-cols-[132px_minmax(0,1fr)_auto_168px] md:gap-x-5 md:gap-y-2 md:[grid-template-areas:'photo_head_price_status'_'photo_meta_price_act']",
      )}
    >
      {/* Empty `alt`: the service name is right beside it. `BrandImage`
          draws the house mark on the soft ground when there is no photo,
          which is most bookings. */}
      <span className="h-[76px] w-[88px] overflow-hidden rounded-[10px] [grid-area:photo] md:h-[88px] md:w-[132px]">
        <BrandImage
          src={b.serviceImageUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      </span>

      <div className="min-w-0 [grid-area:head]">
        <Link
          to="/bookings/$bookingId"
          params={{ bookingId: b.id }}
          className="text-base leading-snug font-bold text-[var(--color-headline)] [overflow-wrap:anywhere] hover:underline md:text-[17px]"
        >
          {b.serviceName}
          {b.optionName ? ` · ${b.optionName}` : ""}
        </Link>
        <p className="m-0 mt-1.5 flex min-w-0 items-center gap-2 text-sm text-[var(--color-headline)]">
          <ProviderAvatar name={b.providerName} logoUrl={b.providerLogoUrl} />
          <span className="truncate">{b.providerName}</span>
          {b.providerVerified && (
            <span className="shrink-0 font-semibold whitespace-nowrap text-[var(--color-primary)]">
              ✓ {t("verified")}
            </span>
          )}
        </p>
      </div>

      <div className="min-w-0 [grid-area:meta]">
        <p className="m-0 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13.5px] text-[var(--color-muted-foreground)] tabular-nums">
          <MetaFact icon={CalendarDays}>{when.date}</MetaFact>
          <MetaFact icon={Clock}>{when.time}</MetaFact>
          {when.place && <MetaFact icon={MapPin}>{when.place}</MetaFact>}
        </p>
        {quietActions && (
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1">
            {quietActions}
          </div>
        )}
      </div>

      {/* The exact amount, never the browse card's rounded headline: this
          is the booking's own total, and the pay dialog asks for it. */}
      <span className="justify-self-end text-lg font-bold whitespace-nowrap text-[var(--color-headline)] tabular-nums [grid-area:price] md:pt-0.5">
        {when.price}
      </span>

      <div className="flex min-w-0 flex-col items-start gap-1 [grid-area:status] md:items-stretch">
        <span className="md:flex md:justify-center">
          <BookingStatusBadge status={b.status} />
        </span>
        {countdown && (
          <span
            className={cn(
              "text-[13px] font-semibold md:text-center",
              countdownTone(b.status),
            )}
          >
            {countdown}
          </span>
        )}
      </div>

      <div className="flex gap-2 [grid-area:act] md:flex-col">
        <Link
          to="/bookings/$bookingId"
          params={{ bookingId: b.id }}
          className={cn(DETAILS_BUTTON_CLASS, "flex-1 md:w-full md:flex-none")}
          tabIndex={-1}
          aria-hidden="true"
        >
          {t("common:viewDetails")}
        </Link>
        {primaryAction}
      </div>
    </li>
  );
}

/** The row's shape while the first page is on its way. */
export function BookingRowSkeleton() {
  const bar = "rounded bg-[var(--color-muted)] animate-pulse";
  return (
    <li
      aria-hidden="true"
      className={cn(
        BOOKINGS_CARD,
        "grid items-start gap-x-3 gap-y-3 p-3 sm:p-4",
        "grid-cols-[88px_minmax(0,1fr)] md:grid-cols-[132px_minmax(0,1fr)_auto_168px] md:gap-x-5",
      )}
    >
      <span className={cn(bar, "h-[76px] w-[88px] rounded-[10px] md:h-[88px] md:w-[132px]")} />
      <span className="grid gap-2.5 pt-1">
        <span className={cn(bar, "h-4 w-3/5")} />
        <span className={cn(bar, "h-3.5 w-2/5")} />
        <span className={cn(bar, "h-3.5 w-4/5")} />
      </span>
      <span className={cn(bar, "hidden h-5 w-20 md:block")} />
      <span className="hidden gap-2 md:grid">
        <span className={cn(bar, "mx-auto h-6 w-24 rounded-full")} />
        <span className={cn(bar, "h-10 w-full rounded-lg")} />
      </span>
    </li>
  );
}
