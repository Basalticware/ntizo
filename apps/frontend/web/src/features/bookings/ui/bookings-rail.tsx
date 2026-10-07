import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  Clock,
  Headphones,
  MapPin,
  Star,
} from "lucide-react";
import { buttonVariants, cn } from "@ntizo/frontend-ui";
import type { BookingDTO } from "@ntizo/shared/read-models";
import { BrandImage } from "@/shared/components/brand-image";
import { MessageProviderButton } from "@/features/directory/ui/provider-rail";
import { useHelpCenter } from "@/features/help-center/viewmodel/use-help-center";
import { BookingStatusBadge } from "./booking-status-badge";
import {
  BOOKINGS_CARD,
  MetaFact,
  ProviderAvatar,
  useAppointment,
} from "./booking-row";

const CARD_TITLE = "m-0 text-lg leading-snug font-bold text-[var(--color-headline)]";

/**
 * "Próxima reserva": the booking whose slot starts soonest — see
 * `nextBooking` for which ones qualify and why.
 *
 * "Falar com o prestador" is the directory's own `MessageProviderButton`,
 * the control the detail page and every row use: it opens (or creates) the
 * customer's thread with this provider and lands on `/messages`.
 *
 * The rating is the provider's live average, without a count: the booking's
 * read model carries the one and not the other, and a number in brackets
 * would have to be invented.
 */
export function NextBookingCard({
  booking,
  loading,
}: {
  booking: BookingDTO | null;
  loading: boolean;
}) {
  const { t } = useTranslation("bookings");
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={cn(BOOKINGS_CARD, "p-5")}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className={CARD_TITLE}>
          {t("list.next.title")}
        </h2>
        <Link
          to="/bookings"
          search={{ tab: "upcoming" }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] hover:underline"
        >
          {t("list.next.seeAll")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {loading ? (
        <div aria-hidden="true" className="mt-4 grid gap-3">
          <div className="flex gap-4">
            <span className="h-[96px] w-[112px] shrink-0 animate-pulse rounded-[10px] bg-[var(--color-muted)]" />
            <span className="grid flex-1 content-start gap-2.5 pt-1">
              <span className="h-5 w-20 animate-pulse rounded-full bg-[var(--color-muted)]" />
              <span className="h-4 w-4/5 animate-pulse rounded bg-[var(--color-muted)]" />
              <span className="h-3.5 w-3/5 animate-pulse rounded bg-[var(--color-muted)]" />
            </span>
          </div>
          <span className="h-3.5 w-2/3 animate-pulse rounded bg-[var(--color-muted)]" />
          <span className="h-3.5 w-1/2 animate-pulse rounded bg-[var(--color-muted)]" />
          <span className="h-11 w-full animate-pulse rounded-lg bg-[var(--color-muted)]" />
        </div>
      ) : booking ? (
        <NextBookingBody booking={booking} />
      ) : (
        <p className="m-0 mt-3 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          {t("list.next.none")}
        </p>
      )}
    </section>
  );
}

function NextBookingBody({ booking: b }: { booking: BookingDTO }) {
  const { t, i18n } = useTranslation("bookings");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const when = useAppointment(b);
  const rating =
    b.providerRatingAverage != null
      ? new Intl.NumberFormat(locale, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(b.providerRatingAverage)
      : null;

  return (
    <>
      <div className="mt-4 flex gap-4">
        <span className="h-[96px] w-[112px] shrink-0 overflow-hidden rounded-[10px]">
          <BrandImage
            src={b.serviceImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </span>
        <div className="min-w-0">
          <BookingStatusBadge status={b.status} />
          <p className="m-0 mt-2 text-base leading-snug font-bold text-[var(--color-headline)] [overflow-wrap:anywhere]">
            {b.serviceName}
          </p>
          <p className="m-0 mt-1.5 flex min-w-0 items-center gap-2 text-sm text-[var(--color-headline)]">
            <ProviderAvatar name={b.providerName} logoUrl={b.providerLogoUrl} />
            <span className="truncate">{b.providerName}</span>
          </p>
          {rating && (
            <p
              className="m-0 mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-headline)] tabular-nums"
              aria-label={t("list.rating", { rating })}
            >
              <Star
                className="h-4 w-4 fill-[var(--color-warning)] text-[var(--color-warning)]"
                aria-hidden="true"
              />
              {rating}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-2.5 text-[14.5px] text-[var(--color-headline)] tabular-nums">
        <MetaFact icon={CalendarDays}>{when.date}</MetaFact>
        <MetaFact icon={Clock}>{when.time}</MetaFact>
        {when.place && <MetaFact icon={MapPin}>{when.place}</MetaFact>}
        <MetaFact icon={Banknote}>
          <span className="font-bold">{when.price}</span>
        </MetaFact>
      </div>

      <div className="mt-5 grid gap-2.5">
        <Link
          to="/bookings/$bookingId"
          params={{ bookingId: b.id }}
          className={cn(buttonVariants(), "w-full")}
        >
          {t("list.next.viewDetails")}
        </Link>
        <MessageProviderButton
          providerId={b.providerId}
          variant="outline"
          label={t("list.next.message")}
        />
      </div>
    </>
  );
}

/**
 * "Precisa de ajuda?" — opens the help centre's own panel, the same one the
 * floating launcher and the footer's "Falar com o suporte" open, rather
 * than a contact page of its own.
 */
export function HelpCard() {
  const { t } = useTranslation("bookings");
  const help = useHelpCenter();
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={cn(BOOKINGS_CARD, "flex items-start gap-4 p-5")}
    >
      <span
        aria-hidden="true"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--color-blue-soft)] text-[var(--color-primary)]"
      >
        <Headphones className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id={headingId} className={CARD_TITLE}>
          {t("list.help.title")}
        </h2>
        <p className="m-0 mt-1 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          {t("list.help.body")}
        </p>
        <button
          type="button"
          onClick={() => help.openPanel()}
          className={cn(buttonVariants({ variant: "outline" }), "mt-3 w-full")}
        >
          {t("list.help.cta")}
        </button>
      </div>
    </section>
  );
}
