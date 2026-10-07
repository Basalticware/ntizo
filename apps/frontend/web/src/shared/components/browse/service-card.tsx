import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Check, Clock3, MapPin, Tag, type LucideIcon } from "lucide-react";
import { VerifiedPill } from "@/shared/components/browse/verified-pill";
import { BrandImage } from "@/shared/components/brand-image";
import { RatingMark, TILE_TITLE_LINK_CLASS } from "@/shared/components/browse/result-tile";
import { formatRating } from "@/shared/domain/rating";
import {
  formatHeadlinePrice,
  servicePriceLine,
} from "@/features/directory/services/domain/service-card";
import type { ServiceDTO } from "@/features/directory/services/domain/types";

/**
 * One published service — the single card the whole site shows for it.
 *
 * A bordered product tile — photograph on top, flush to the edge, then a
 * padded body — first approved on the home page and now the only shape a
 * service is drawn in: the home page's "popular services" rail, `/services`'
 * grid and any future list all import this one component rather than each
 * keeping its own idea of what a service looks like.
 *
 * Every fact still comes from the shared domain: `servicePriceLine` decides
 * what the price area shows (a fixed amount, an hourly one, a "from" and its
 * count of options, or the words a quote service prints in place of a price),
 * and `RatingMark`/`ratingNew` are the same mark and the same "New" label
 * every caller shares, from the `directory` namespace. The pieces are
 * exported — `ServiceByline`, `ServiceRating`, `ServiceMeta`, `ServicePrice`
 * — because `/services`' wide "best rated" card says the same facts in a
 * different arrangement, and a second copy of how a price is printed is how
 * the two would come to disagree.
 *
 * **No button, and one exception.** The price is what the eye lands on and the
 * card is the link; a blue button repeated twenty-four times down a page would
 * compete with every price on it. The favourite earns its exception by
 * costing almost nothing: it stands on the photograph rather than in the
 * words, so the body's lines keep their column and a saved card is exactly as
 * tall as an unsaved one.
 */
export function ServiceCard({
  service,
  locale,
  favourite,
  variant = "grid",
  categoryIcon: CategoryGlyph = Tag,
}: {
  service: ServiceDTO;
  locale: string;
  /**
   * The category's own glyph, for the grid card's category line. The page
   * resolves it from the category list it already holds; a caller with no
   * list gets the plain tag.
   */
  categoryIcon?: LucideIcon;
  /**
   * The heart, drawn on the photograph — or nothing, for a caller that wants
   * a card with no control on it at all.
   *
   * A node the page builds rather than a `saved` flag this card turns into
   * one: the marks for a page come from a single `useFavouriteMarks` call up
   * there, so the page is what knows the answer, and the card goes on being a
   * thing that is handed a `ServiceDTO` and asks nobody anything.
   */
  favourite?: ReactNode;
  /**
   * `"grid"` is the listings' card, from the October 2026 list-with-sidebar
   * mockup: a wide photograph with the verified pill on it, then the name,
   * the category, the score and who sells it on the left and the price in
   * blue on the right. `"feature"` is the home
   * page's: the category named on the photograph, the rating, the length and
   * where on lines of their own, and the price at the foot.
   */
  variant?: "grid" | "feature";
}) {
  const feature = variant === "feature";

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[12px] border border-[var(--color-line-2)] bg-[var(--color-card)] text-[var(--color-card-foreground)]">
      {/* `relative` is the positioning context the heart resolves against, and
          this box rather than the `<article>` is the slot's home: it is the
          same box whether the listing has a photograph or the site's
          placeholder, so the control does not move depending on whether a
          provider uploaded a picture. */}
      <div
        className={`relative w-full overflow-hidden bg-[var(--color-muted)] ${feature ? "aspect-[290/160]" : "aspect-[5/2]"}`}
      >
        <BrandImage
          src={service.imageUrls[0] ?? null}
          alt=""
          className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035] ${feature ? "object-[50%_30%]" : ""}`}
        />
        {feature && service.categoryName ? (
          <span className="absolute bottom-2.5 left-2.5 max-w-[calc(100%-20px)] truncate rounded-md bg-[var(--color-card)] px-2 py-1 text-[12px] leading-none font-medium text-[var(--color-ink-2)]">
            {service.categoryName}
          </span>
        ) : null}
        {!feature && service.providerVerified ? <VerifiedPill /> : null}
        {favourite}
      </div>
      {feature ? (
        <div className="flex flex-1 flex-col px-[18px] pt-3.5 pb-4">
          <ServiceTitle service={service} className="font-bold" />
          <ServiceByline service={service} className="mt-1 text-[14px]" />
          <div className="mt-2">
            <ServiceRating service={service} locale={locale} />
          </div>
          <ServiceMeta service={service} pin className="mt-2" />
          <div className="mt-auto pt-3.5">
            <ServicePrice service={service} locale={locale} className="text-[17px]" />
          </div>
        </div>
      ) : (
        // The list-with-sidebar mockup's three lines on the left — the name,
        // the category with its glyph, the score and who sells it — and the
        // price in the brand blue on the right.
        <div className="flex flex-1 items-end justify-between gap-4 px-4 pt-3 pb-3.5">
          <div className="grid min-w-0 gap-1.5">
            <ServiceTitle service={service} className="text-[17px] font-extrabold" />
            <p className="flex min-w-0 items-center gap-2 text-[13.5px] leading-[1.2] text-[var(--color-muted-foreground)]">
              <CategoryGlyph className="h-[15px] w-[15px] shrink-0" strokeWidth={2} aria-hidden="true" />
              <span className="truncate">{service.categoryName}</span>
            </p>
            <div className="flex min-w-0 items-center gap-1.5 text-[13px] text-[var(--color-muted-foreground)]">
              <ServiceRating service={service} locale={locale} counted />
              <span aria-hidden="true">·</span>
              <ServiceByline service={service} className="min-w-0" />
            </div>
          </div>
          <ServicePrice
            service={service}
            locale={locale}
            brand
            stacked
            className="shrink-0 text-right text-[20px] xl:text-[22px]"
          />
        </div>
      )}
    </article>
  );
}

/** The service's name, carrying the whole-card link. */
export function ServiceTitle({
  service,
  className = "",
}: {
  service: ServiceDTO;
  className?: string;
}) {
  return (
    <h3
      className={`truncate text-base leading-[1.2] text-[var(--color-headline)] group-hover:underline group-hover:decoration-[1.5px] group-hover:underline-offset-[3px] group-focus-within:underline ${className}`}
    >
      <Link to="/services/$id" params={{ id: service.id }} className={TILE_TITLE_LINK_CLASS}>
        {service.name}
      </Link>
    </h3>
  );
}

/** Who sells it, and the navy seal when the platform verified them. */
export function ServiceByline({
  service,
  className = "",
}: {
  service: ServiceDTO;
  className?: string;
}) {
  const { t } = useTranslation("directory");
  return (
    <p
      className={`flex min-w-0 items-center gap-1.5 leading-[1.2] text-[var(--color-muted-foreground)] ${className}`}
    >
      <span className="min-w-0 truncate">{service.providerName}</span>
      {service.providerVerified && (
        <span
          className="grid h-[13px] w-[13px] shrink-0 place-items-center rounded-full bg-[var(--color-navy-surface)]"
          aria-label={t("providerVerified")}
        >
          <Check className="h-2.5 w-2.5 text-[var(--color-navy-on)]" aria-hidden="true" strokeWidth={3.4} />
        </span>
      )}
    </p>
  );
}

/**
 * The provider's score — or "New", never a zero: a provider nobody has
 * reviewed yet is new, the same rule every caller of this card follows.
 */
export function ServiceRating({
  service,
  locale,
  counted = false,
}: {
  service: ServiceDTO;
  locale: string;
  /** Say the count as words — "(4 avaliações)" — rather than a bare number. */
  counted?: boolean;
}) {
  const { t } = useTranslation("directory");
  if (service.providerRatingAverage === null) {
    return (
      <span className="shrink-0 text-[13px] text-[var(--color-muted-foreground)]">
        {t("ratingNew")}
      </span>
    );
  }
  return (
    <RatingMark
      average={service.providerRatingAverage}
      count={service.providerReviewCount}
      {...(counted ? { countText: t("ratingCount", { count: service.providerReviewCount }) } : {})}
      locale={locale}
      label={t("providerRatingLabel", {
        score: formatRating(service.providerRatingAverage, locale),
        count: service.providerReviewCount,
      })}
    />
  );
}

/**
 * The length (or the count of options, or a quote's hint) and where it
 * happens, as one wrapping line.
 *
 * `lead` starts it with a dot, for a row where it follows the rating; `pin`
 * draws the place's map pin, which the wider layouts have room for; `show`
 * draws only one half, for the grid card, which gives each its own line.
 */
export function ServiceMeta({
  service,
  lead = false,
  pin = false,
  show = "both",
  className = "",
}: {
  service: ServiceDTO;
  lead?: boolean;
  pin?: boolean;
  show?: "both" | "length" | "where";
  className?: string;
}) {
  const { t } = useTranslation("directory");
  const line = servicePriceLine(service);
  const metaText =
    show !== "where" && line.meta ? t(line.meta.key, line.meta.values ?? {}) : null;
  const where =
    show !== "length" ? t(`filterWhereOption.${service.locationType}`, { defaultValue: "" }) : "";
  if (!metaText && !where) return null;

  const dot = (
    <span aria-hidden="true" className="mx-[3px]">
      ·
    </span>
  );
  return (
    <p
      className={`flex min-w-0 ${show === "both" ? "flex-wrap" : ""} items-center gap-1.5 text-[13px] leading-[1.2] text-[var(--color-muted-foreground)] ${className}`}
    >
      {lead && dot}
      {/* The clock only beside a length — the same line can carry a count of
          packages or a quote's hint instead. */}
      {metaText && line.meta?.key.endsWith("Minutes") && (
        <Clock3 className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
      )}
      {metaText && <span className="min-w-0 truncate whitespace-nowrap">{metaText}</span>}
      {metaText && where && dot}
      {where && (
        // The pin rides in the same nowrap box as the place, so a narrow
        // card wraps the pair together rather than stranding the glyph.
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          {pin && <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />}
          {where}
        </span>
      )}
    </p>
  );
}

/** The price, always grouped by `formatHeadlinePrice`, or the words that stand for one. */
export function ServicePrice({
  service,
  locale,
  className = "",
  brand = false,
  stacked = false,
}: {
  service: ServiceDTO;
  locale: string;
  className?: string;
  /** The brand blue rather than headline navy — the list-with-sidebar cards. */
  brand?: boolean;
  /** "desde" on a line of its own above the amount. */
  stacked?: boolean;
}) {
  const { t } = useTranslation("directory");
  const line = servicePriceLine(service);
  const tone = brand ? "text-[var(--color-primary)]" : "text-[var(--color-headline)]";
  return (
    <b className={`font-extrabold whitespace-nowrap ${tone} ${className}`}>
      {line.amount.kind === "words" ? (
        <span className="text-[14px] font-semibold text-[var(--color-headline)]">
          {t(line.amount.key)}
        </span>
      ) : (
        <>
          {line.amount.from && (
            <span
              className={`font-medium text-[var(--color-muted-foreground)] ${stacked ? "block text-[13px]" : "mr-[3px] text-[12.5px]"}`}
            >
              {t("priceFromPrefix")}
            </span>
          )}
          <span className="tabular-nums">
            {formatHeadlinePrice(line.amount.amountMinor, line.amount.currency, locale)}
            {line.amount.perHour && (
              <span className="text-[12.5px] font-semibold text-[var(--color-muted-foreground)]">
                {t("pricePerHourUnit")}
              </span>
            )}
          </span>
        </>
      )}
    </b>
  );
}
