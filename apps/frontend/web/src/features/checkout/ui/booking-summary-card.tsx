import { useTranslation } from "react-i18next";
import type { ComponentType, ReactNode } from "react";
import {
  CalendarDays,
  Clock,
  MapPin,
  ShieldCheck,
  Star,
  Wallet,
} from "lucide-react";
import { BrandImage } from "@/shared/components/brand-image";
import { formatRating } from "@/shared/domain/rating";
import { formatAmount } from "@/features/directory/services/domain/service-card";
import { slotWording } from "@/features/checkout/domain/slot-wording";
import type { CheckoutBooking } from "@/features/checkout/viewmodel/use-checkout";
import { CHECKOUT_CARD } from "@/features/checkout/ui/checkout-page-frame";

/**
 * Where the work happens, in one line: "Em sua casa · Av. Julius Nyerere,
 * Polana, Maputo".
 *
 * **The address only where the work is at it.** Step 2 asks every customer
 * for one, but on an `at_provider` or `remote` service it is not where the
 * job happens — printing it under "Local" would tell the customer to wait at
 * home for an appointment that is somewhere else. The provider's own address
 * is not on the booking, so those two read the phrase alone.
 */
export function placeWording(
  locationType: CheckoutBooking["locationType"],
  address: string | null,
  phrase: (type: string) => string,
): string | null {
  const bits: string[] = [];
  const said = locationType ? phrase(locationType) : "";
  if (said) bits.push(said);
  const atCustomer =
    locationType === null ||
    locationType === "at_customer" ||
    locationType === "flexible";
  if (address && atCustomer) bits.push(address);
  return bits.length ? bits.join(" · ") : null;
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-3">
      <Icon
        aria-hidden="true"
        className="mt-0.5 h-5 w-5 text-[var(--color-blue-public)]"
      />
      <div className="min-w-0">
        <dt className="text-[13.5px] text-[var(--color-muted-foreground)]">
          {label}
        </dt>
        <dd className="m-0 mt-0.5 text-[15px] font-semibold [overflow-wrap:anywhere] text-[var(--color-headline)]">
          {children}
        </dd>
      </div>
    </div>
  );
}

/**
 * What was asked for, as one card: the service's picture, the service and
 * its package, who, when, where and for how much.
 *
 * Every line is read off the booking itself — the same row the provider is
 * looking at — and in the service's zone, the one `slotWording` insists on.
 * `address` is passed in rather than read because the page that has just
 * sent the request holds the address it sent, while the booking in its cache
 * is still the draft that had none; a refresh reads the booking's own.
 */
export function BookingSummaryCard({
  booking,
  address,
}: {
  booking: CheckoutBooking;
  address: string | null;
}) {
  const { t, i18n } = useTranslation("checkout");
  const { t: td } = useTranslation("directory");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const when = slotWording(
    booking.startsAt,
    booking.endsAt,
    locale,
    booking.timezone,
  );
  const place = placeWording(booking.locationType, address, (type) =>
    td(`filterWhereOption.${type}`, { defaultValue: "" }),
  );

  return (
    <section
      aria-labelledby="outcome-summary-title"
      className={`${CHECKOUT_CARD} min-w-0`}
    >
      <h2
        id="outcome-summary-title"
        className="text-lg leading-snug font-bold text-[var(--color-headline)]"
      >
        {t("outcome.summaryTitle")}
      </h2>

      <div className="mt-4 flex items-start gap-4">
        <span className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-[12px] sm:h-[88px] sm:w-[88px]">
          <BrandImage
            src={booking.serviceImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </span>
        <div className="min-w-0">
          <p className="m-0 text-[17px] leading-snug font-bold [overflow-wrap:anywhere] text-[var(--color-headline)]">
            {booking.serviceName}
          </p>
          {booking.optionName && (
            <p className="m-0 mt-0.5 text-sm text-[var(--color-muted-foreground)]">
              {booking.optionName}
            </p>
          )}
          <p className="m-0 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14.5px] text-[var(--color-ink-2)]">
            <span>{booking.providerName}</span>
            {booking.providerVerified && (
              <ShieldCheck
                role="img"
                aria-label={t("outcome.verified")}
                className="h-4 w-4 text-[var(--color-blue-public)]"
              />
            )}
            {/* No score is a score nobody has given yet, not a zero. */}
            {booking.providerRatingAverage !== null && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Star
                  aria-hidden="true"
                  className="h-3.5 w-3.5 fill-[var(--color-star)] text-[var(--color-star)]"
                />
                {formatRating(booking.providerRatingAverage, locale)}
              </span>
            )}
          </p>
        </div>
      </div>

      <dl className="m-0 mt-5 grid gap-4 border-t border-[var(--color-line-2)] pt-5">
        <Row icon={CalendarDays} label={t("outcome.date")}>
          {when.date}
        </Row>
        <Row icon={Clock} label={t("outcome.time")}>
          <span className="tabular-nums">
            {t("slotRange", { start: when.start, end: when.end })}
          </span>
        </Row>
        {place && (
          <Row icon={MapPin} label={t("outcome.place")}>
            {place}
          </Row>
        )}
        <Row icon={Wallet} label={t("outcome.price")}>
          {/* The exact amount, never a headline rounded to whole units: this
              is what the M-Pesa prompt will ask for. */}
          <span className="tabular-nums">
            {formatAmount(booking.priceMinor, booking.currency, locale)}
          </span>
        </Row>
      </dl>
    </section>
  );
}
