import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Database,
  MapPin,
  ShieldCheck,
  Star,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage, cn } from "@ntizo/frontend-ui";
import { BrandImage } from "@/shared/components/brand-image";
import { initialsFrom } from "@/shared/lib/initials";
import { formatRating } from "@/shared/domain/rating";
import { formatAmount } from "@/features/directory/services/domain/service-card";
import type { CompactSlot } from "@/features/checkout/domain/slot-wording";

/**
 * Whether the *provider* travels to the job, which is the only reading under
 * which "Deslocação — Incluída" is a true sentence.
 *
 * A barber's shop (`at_provider`) and a remote consultation involve no
 * journey the platform could include or charge for, and telling a customer
 * their travel is included when they are the one travelling is worse than
 * saying nothing. `locationType` is a bare `string` on the read model rather
 * than an enum, so an unrecognised value answers "no" and the line is simply
 * absent — the safe direction for a claim about money.
 */
function providerTravels(locationType: string | null): boolean {
  return locationType === "at_customer" || locationType === "flexible";
}

/**
 * "Em sua casa · 240 min" — where the work happens and how long it takes,
 * with each half dropping out on its own when the caller cannot answer it.
 *
 * A hook rather than a plain function because both halves are translated, and
 * exported because **step 2 prints this line twice**: once in its own
 * "MARCAÇÃO ESCOLHIDA" panel, which is the only one on screen below `lg`, and
 * once in the rail, which is the only one at and above it. Two copies of the
 * join would be two places for the separator, the order and the empty cases
 * to drift — on one page, where a customer meeting the two on a phone and on
 * a laptop would be told the appointment differently each time.
 *
 * `hourly` changes the second half rather than the first: an hourly package's
 * duration is a *minimum* ("Mínimo de 60 min") and printing it as a length
 * would tell the customer the job is over when it is not.
 */
export function useWhereAndLength(
  locationType: string | null,
  durationMinutes: number | null,
  hourly = false,
): { where: string; length: string; line: string } {
  const { t: td } = useTranslation("directory");

  const where = locationType
    ? // `defaultValue: ""` rather than i18next's own "key not found" echo:
      // `locationType` is a bare `string` on the read model, so an
      // unrecognised value drops the half instead of printing its own key at
      // the customer.
      td(`filterWhereOption.${locationType}`, { defaultValue: "" })
    : "";
  const length =
    durationMinutes === null
      ? ""
      : td(hourly ? "serviceMinimumMinutes" : "serviceDurationMinutes", {
          count: durationMinutes,
        });

  // The halves come back too, because the price breakdown pairs the length
  // with the package name and has no use for the location.
  return { where, length, line: [where, length].filter(Boolean).join(" · ") };
}

/**
 * The card that runs down the right of every checkout page: what is being
 * booked, when, what it costs, and the two promises the platform actually
 * keeps.
 *
 * One component rather than a copy per step, because the three pages
 * previously carried three near-identical rails and the price line is the one
 * thing on this flow that must not be allowed to drift between them.
 *
 * **There is no commission line and no fee line, on purpose.** The commission
 * comes out of the provider's payout, so the customer pays the price the
 * provider set and is never shown a split; a "Taxa Ntizo" row here would
 * invent a charge nobody is being asked for. The checkout query does not even
 * fetch the commission — see `CheckoutBooking` and `BOOKING_FIELDS` for the
 * two levels that keep it off the wire as well as off the screen.
 *
 * Likewise absent: a cancellation window, which nothing in this product
 * models, and a materials note, which the catalogue has no concept of.
 */
export function CheckoutRail({
  imageUrl,
  serviceName,
  providerName,
  providerRatingAverage,
  providerVerified,
  optionName,
  slot,
  locationType,
  durationMinutes,
  priceMinor,
  currency,
  hourly = false,
  categoryName = null,
  place = null,
  providerSlug = null,
  providerLogoUrl = null,
  showTrust = true,
  onChangeSlot,
  countdown,
  children,
}: {
  /** The service's own picture, or null when it has none — then the card opens on the title. */
  imageUrl: string | null;
  serviceName: string;
  providerName: string;
  /**
   * The business's average review score, or **null when nobody has reviewed
   * it** — in which case the score is left out entirely rather than shown as
   * a zero. Zero is a score a person could have given.
   */
  providerRatingAverage: number | null;
  /** Whether the platform has accepted at least one of the business's documents. */
  providerVerified: boolean;
  /** Which package is being booked — printed so a fallback substitution is never silent. */
  optionName: string | null;
  /**
   * The appointment, already worded **in the service's timezone**, or null
   * while the customer is still choosing one.
   *
   * Worded by the caller rather than formatted here, because a component
   * handed two instants is a component that will eventually format them in
   * whichever zone it is running in.
   */
  slot: CompactSlot | null;
  /** The service's location type, or null when the caller cannot know it. */
  locationType: string | null;
  durationMinutes: number | null;
  /**
   * What the customer pays, or **null when there is no price to state** — a
   * quote service, or a priced one whose last package was deactivated. The
   * price row is left out rather than printed as a zero.
   */
  priceMinor: number | null;
  currency: string;
  /** An hourly package: the price is a rate, and says so. */
  hourly?: boolean;
  /** The service's category, where the caller has it — step 1 does. */
  categoryName?: string | null;
  /** Where the business is ("Maputo, Sommerschield"), under the Local row. */
  place?: string | null;
  /** The business's page, for the provider row's chevron. */
  providerSlug?: string | null;
  providerLogoUrl?: string | null;
  /** The two promises at the foot; step 1's mockup ends on the provider. */
  showTrust?: boolean;
  /** Back to step 1. Absent on step 1 itself, which is already where the choosing happens. */
  onChangeSlot?: () => void;
  /** The hold countdown, on the steps that have a draft to count down. */
  countdown?: React.ReactNode;
  /** The step's own action area — its button, and whatever it has to say about it. */
  children?: React.ReactNode;
}) {
  const { t, i18n } = useTranslation("checkout");
  const { t: td } = useTranslation("directory");
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const { where, length } = useWhereAndLength(locationType, durationMinutes, hourly);
  // Guarded rather than defaulted to zero: `Intl.NumberFormat` throws on a
  // blank currency code, and a quote service genuinely has neither.
  const price = priceMinor === null ? null : formatAmount(priceMinor, currency, locale);
  const score = providerRatingAverage === null ? null : formatRating(providerRatingAverage, locale);

  return (
    <div className="grid gap-0 rounded-[14px] border border-[var(--color-line-2)] p-6">
      {countdown && <div className="mb-5">{countdown}</div>}

      {imageUrl && (
        // `alt=""`: the service is named in the heading right under it.
        <BrandImage src={imageUrl} alt="" className="mb-5 block h-[207px] w-full rounded-[10px] object-cover" />
      )}

      <h2 className="text-[22px] leading-[1.2] font-bold text-[var(--color-headline)] md:text-[27px]">{serviceName}</h2>
      {/* The trust line: what people have said about the business, and
          whether the platform has seen its documents — the reason a customer
          holding a slot believes somebody will turn up. Each half disappears
          on its own when it has nothing to say. */}
      {(score !== null || providerVerified) && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[15px] text-[var(--color-muted-foreground)]">
          {score !== null && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Star className="h-[19px] w-[19px] fill-[var(--color-star)] stroke-none" aria-hidden="true" />
              <b className="font-bold text-[var(--color-headline)]">{score}</b>
              <span className="sr-only">{td("railRatingOutOfFive")}</span>
            </span>
          )}
          {score !== null && providerVerified && (
            <span aria-hidden="true" className="mx-2.5 text-[var(--color-faint)]">
              •
            </span>
          )}
          {providerVerified && (
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-[22px] w-[22px] text-[var(--color-blue-public)]" strokeWidth={2} aria-hidden="true" />
              {td("providerVerifiedLong")}
            </span>
          )}
        </p>
      )}

      <div className="mt-[22px] mb-2 border-t border-[var(--color-line-2)]" />

      <dl className="grid">
        {length && (
          <RailRow icon={Clock} label={td("packageDuration")}>
            {length}
          </RailRow>
        )}
        {price !== null && (
          <RailRow icon={Database} label={td("railPriceLabel")} top={Boolean(optionName)}>
            <b className="text-[19px] font-bold tabular-nums">
              {price}
              {hourly && <span className="text-[15px] font-normal text-[var(--color-muted-foreground)]">{td("priceHourlySuffix")}</span>}
            </b>
            {/* Which package that price is for, so a fallback substitution
                is never silent. */}
            {optionName && <small className="mt-0.5 block text-[14.5px] text-[var(--color-muted-foreground)]">{optionName}</small>}
          </RailRow>
        )}
        {categoryName && (
          <RailRow icon={Building2} label={td("factCategory")}>
            {categoryName}
          </RailRow>
        )}
        {(where || place) && (
          <RailRow icon={MapPin} label={t("railPlaceLabel")} top>
            {where || place}
            {/* "Deslocação incluída" only where the provider is the one who
                travels — a claim about money, so the safe direction is
                silence for anything else. */}
            {providerTravels(locationType) ? (
              <small className="mt-0.5 block text-[14.5px] text-[var(--color-muted-foreground)]">
                {t("railPriceTravel")} · {t("railPriceTravelIncluded").toLowerCase()}
              </small>
            ) : (
              where && place && <small className="mt-0.5 block text-[14.5px] text-[var(--color-muted-foreground)]">{place}</small>
            )}
          </RailRow>
        )}
        {/* When: worded by the caller, or a sentence saying it is still to be
            chosen — never left blank. "Alterar" only where there is a step 1
            to go back to. */}
        <RailRow icon={CalendarDays} label={t("railWhenLabel")} top>
          {slot ? (
            <>
              <span className="tabular-nums">{t("railWhen", { date: slot.date, start: slot.start, end: slot.end })}</span>
              {onChangeSlot && (
                <button
                  type="button"
                  onClick={onChangeSlot}
                  className="mt-0.5 block w-full text-right text-[14.5px] font-semibold text-[var(--color-blue-public)] hover:underline"
                >
                  {t("railChangeAction")}
                </button>
              )}
            </>
          ) : (
            <span className="text-[14.5px] text-[var(--color-muted-foreground)]">{t("railWhenPending")}</span>
          )}
        </RailRow>
      </dl>

      <div className="mt-2 border-t border-[var(--color-line-2)]" />

      <div className="mt-[18px] flex items-center">
        <Avatar className="mr-[18px] h-[74px] w-[74px] shrink-0">
          {providerLogoUrl && <AvatarImage src={providerLogoUrl} alt="" />}
          <AvatarFallback className="text-lg">{initialsFrom(providerName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="flex items-center gap-[7px] text-[17.5px] font-bold text-[var(--color-headline)]">
            <span className="truncate">{providerName}</span>
            {providerVerified && (
              <BadgeCheck className="h-5 w-5 shrink-0 fill-[var(--color-blue-public)] text-white" aria-label={td("providerVerified")} />
            )}
          </p>
          {score !== null && (
            <p className="mt-1.5 flex items-center gap-1 text-[14.5px] text-[var(--color-muted-foreground)]">
              <Star className="h-[18px] w-[18px] fill-[var(--color-star)] stroke-none" aria-hidden="true" />
              <b className="text-base font-bold text-[var(--color-headline)] tabular-nums">{score}</b>
            </p>
          )}
        </div>
        {providerSlug && (
          <Link
            to="/providers/$slug"
            params={{ slug: providerSlug }}
            aria-label={td("viewProviderProfile")}
            className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--color-blue-public)] hover:bg-[var(--color-blue-soft)]"
          >
            <ChevronRight className="h-[26px] w-[26px]" strokeWidth={2.2} aria-hidden="true" />
          </Link>
        )}
      </div>

      {children && <div className="mt-5 grid gap-3">{children}</div>}

      {/* Two promises the platform actually keeps: the money is held until
          the job is done, and the provider's papers were looked at. */}
      {showTrust && (
        <ul className="mt-5 grid gap-2 text-[13px] text-[var(--color-muted-foreground)]">
          {[t("railTrustPayment"), t("railTrustVerified")].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-success)]" aria-hidden="true" />
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One line of the summary: a glyph, its label, and the value on the right. */
function RailRow({
  icon: Icon,
  label,
  top = false,
  children,
}: {
  icon: LucideIcon;
  label: string;
  /** Align to the top, for a value that runs to a second line. */
  top?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-h-[50px] py-1 text-[15.5px] text-[var(--color-muted-foreground)]", top ? "items-start pt-2.5" : "items-center")}>
      <Icon className="mr-5 h-[26px] w-[26px] shrink-0 text-[var(--color-ink-2)]" strokeWidth={1.6} aria-hidden="true" />
      <dt className={cn(top && "mt-0.5")}>{label}</dt>
      <dd className="ml-auto pl-4 text-right text-base leading-[1.45] text-[var(--color-ink-2)]">{children}</dd>
    </div>
  );
}
