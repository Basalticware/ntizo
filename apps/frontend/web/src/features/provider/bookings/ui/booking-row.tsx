import { Link } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import type { ProviderBookingDTO } from "@ntizo/shared/read-models";
import type {
  CollectionColumn,
  CollectionRow,
} from "@/shared/components/collection-card";
import { compactSlotWording } from "@/features/checkout/domain/slot-wording";
import { formatMoneyShort } from "@/features/wallet/domain/money";
import { DETAILS_BUTTON_CLASS, PersonCell, TwoLineCell, WhenCell } from "@/shared/components/list-cells";
import { relativeDayLabel, shortDate } from "@/shared/lib/relative-day";
import { timeLeftWording } from "../domain/status";
import { BookingStatusBadge } from "./booking-status-badge";

/**
 * The list's columns: the five the dashboard also reads, and the row's way in. The dashboard passes a subset — a column the card
 * does not receive is not drawn, and the cell for it is simply never read.
 */
export function bookingColumns(t: TFunction<"provider">): CollectionColumn[] {
  return [
    { key: "customer", label: t("bookings.col.customer"), className: "w-[277px]" },
    { key: "service", label: t("bookings.col.service"), skeletonWidth: "w-40", className: "w-[289px]" },
    { key: "when", label: t("bookings.col.when"), skeletonWidth: "w-28", className: "w-[242px]" },
    {
      key: "price",
      label: t("bookings.col.price"),
      skeletonWidth: "w-20",
      className: "w-[142px]",
    },
    {
      key: "status",
      label: t("bookings.col.status"),
      skeletonWidth: "w-24",
      skeletonShape: "badge",
      className: "w-[149px]",
    },
    { key: "actions", label: t("common:colActions"), className: "pr-5", hideOnCard: true },
  ];
}

/**
 * One row, built once for the two screens that show bookings in a table. The
 * list and the dashboard differ in which columns they ask for, never in what
 * a row says.
 *
 * `now` is passed in rather than read here, because the countdown must be
 * measured from the moment the page was answered — every row on screen then
 * counts down from one instant, and a re-render for an unrelated reason
 * cannot move the clock a minute while nothing about the data changed.
 */
export function bookingRow(
  b: ProviderBookingDTO,
  ctx: { slug: string; locale: string; now: Date; t: TFunction<"provider"> },
): CollectionRow {
  const { slug, locale, now, t } = ctx;
  const slot = compactSlotWording(b.startsAt, b.endsAt, locale, b.timezone);
  const left = b.respondBy ? timeLeftWording(b.respondBy, now) : null;
  const href = { to: "/provider/$slug/bookings/$bookingId", params: { slug, bookingId: b.id } } as const;
  const place = [b.addressDistrict, b.addressCity].filter(Boolean).join(", ");
  return {
    key: b.id,
    // The customer's name *is* the way into the booking — a whole-row click
    // handler is not one: it cannot be tabbed to, opened in a new tab, or read
    // out as a destination. "Ver detalhes" beside it is the same link, drawn
    // where the mockups put the row's action.
    primary: (
      <PersonCell
        name={b.customerFirstName}
        place={place || null}
        title={
          <Link {...href} className="hover:underline">
            {b.customerFirstName}
          </Link>
        }
      />
    ),
    cells: {
      service: (
        <TwoLineCell
          title={b.serviceName}
          // The option, then who does it — the professional is what a team
          // workspace scans this column for.
          sub={[b.optionName, b.memberFirstName ?? t("bookings.memberAnyone")].filter(Boolean).join(" · ")}
        />
      ),
      when: (
        <WhenCell
          day={relativeDayLabel(b.startsAt, b.timezone, now, locale)}
          time={`${shortDate(b.startsAt, b.timezone, locale)} • ${slot.start} – ${slot.end}`}
        />
      ),
      price: (
        <span className="text-lg font-bold whitespace-nowrap text-[var(--color-headline)] tabular-nums">
          {formatMoneyShort(b.priceMinor, b.currency, locale)}
        </span>
      ),
      status: (
        <span className="inline-flex flex-wrap items-center gap-2">
          <BookingStatusBadge status={b.status} />
          {left && (
            <span className="type-caption text-[var(--color-muted-foreground)]">
              {left}
            </span>
          )}
        </span>
      ),
    },
    actions: (
      <Link {...href} className={DETAILS_BUTTON_CLASS} tabIndex={-1}>
        {t("common:viewDetails")}
      </Link>
    ),
  };
}
