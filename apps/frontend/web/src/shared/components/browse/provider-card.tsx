import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Check, MapPin, Tag, type LucideIcon } from "lucide-react";
import { VerifiedPill } from "@/shared/components/browse/verified-pill";
import type { ProviderPublicDTO } from "@ntizo/shared";
import { BrandImage } from "@/shared/components/brand-image";
import { RatingMark, TILE_TITLE_LINK_CLASS } from "@/shared/components/browse/result-tile";
import { initialsFrom } from "@/shared/lib/initials";
import { formatRating } from "@/shared/domain/rating";
import { formatHeadlinePrice } from "@/features/directory/services/domain/service-card";

/**
 * One business — the single card the whole site shows for it.
 *
 * First approved for the home page's "verified providers" rail and now the
 * only shape a provider is drawn in: `/providers`' grid imports this same
 * component rather than keeping its own borderless row.
 *
 * **What a row could say that a card cannot.** The row this replaces on
 * `/providers` also printed a business's own description paragraph and up to
 * three of its services with their prices — a ticket-stub rail a card's three
 * lines (the name, the trade and city, the rating and price) have no room for.
 * Both drop with the row. A row with no listed category also fell back to
 * naming the provider's kind (`filterProviderKindOption.individual` /
 * `.organization`); this card's trade line shows nothing in that case rather
 * than manufacturing a label the business never gave. The row also closed its
 * link with a screen-reader-only "View business" / "View profile" suffix;
 * this card's link carries only the business's name.
 *
 * Every fact still comes from the shared domain: `formatHeadlinePrice` is the
 * same formatter `ServiceCard` prices with, and `RatingMark`/`ratingNew` are
 * the same mark and the same "New" label every caller shares, from the
 * `directory` namespace.
 *
 * **No button, and one exception.** The rating and the price are what the eye
 * lands on and the card is the link. The favourite earns its exception by
 * costing almost nothing: it stands on the photograph rather than in the
 * words, so the body's lines keep their column and a saved card is exactly as
 * tall as an unsaved one.
 */
export function ProviderCard({
  provider,
  locale,
  favourite,
  variant = "grid",
  categoryIcon: CategoryGlyph = Tag,
}: {
  provider: ProviderPublicDTO;
  locale: string;
  /**
   * The trade's own glyph, for the grid card's category line. The page
   * resolves it from the category list it already holds; a caller with no
   * list gets the plain tag.
   */
  categoryIcon?: LucideIcon;
  /**
   * The heart, drawn on the photograph — or nothing, for a caller that wants
   * a card with no control on it at all, which is what the home page's rails
   * pass.
   *
   * A node the page builds rather than a `saved` flag this card turns into
   * one: the marks for a page come from a single `useFavouriteMarks` call up
   * there, so the page is what knows the answer, and the card goes on being a
   * thing that is handed a `ProviderPublicDTO` and asks nobody anything.
   */
  favourite?: ReactNode;
  /**
   * `"grid"` is the listings' card, from the October 2026 list-with-sidebar
   * mockup: a wide photograph with the verified pill on it, the name, the
   * trade, the score and the city, and "desde" in blue on the right.
   * `"feature"` is the home page's, from the
   * October 2026 home mockup: the name and its seal first, then the trade
   * and the place on lines of their own, the rating beside the count of
   * services, and "desde" with the lowest price at the foot.
   */
  variant?: "grid" | "feature";
}) {
  const { t } = useTranslation("landing"); // t:ProviderCard
  // The rating's accessible label lives in the directory namespace, next to
  // `RatingMark`'s other caller: duplicating the string into `landing` here
  // would be the same mistake `formatHeadlinePrice` already made once.
  const { t: td } = useTranslation("directory");
  const where = [provider.district, provider.city].filter(Boolean).join(", ");
  const trade = provider.categories[0]?.name ?? null;
  const priced = provider.fromAmountMinor !== null && provider.fromCurrency !== null;
  // The background is the provider's own photograph only, never the logo —
  // `provider-row.tsx` got this right and this card used to not: falling back
  // to `logoUrl` here stretched the logo full-bleed into the frame *and* left
  // the badge below drawing the same picture again, small, on top of itself.
  const photo = provider.photoUrls[0] ?? null;

  const feature = variant === "feature";

  const seal = provider.verified ? (
    // `inline-grid`, not the service card's own `grid`: that badge
    // sits inside a flex row, this one sits inside a line-clamped
    // heading's normal text flow, where a block-level badge would
    // force a line break before the name. `align-middle` on an inline
    // badge beside running text is the same trick `collection-card.tsx`
    // already uses.
    <span
      className="ml-1.5 inline-grid h-[14px] w-[14px] shrink-0 place-items-center rounded-full bg-[var(--color-navy-surface)] align-middle"
      aria-label={t("badgeVerified")}
    >
      <Check
        className="h-2.5 w-2.5 text-[var(--color-navy-on)]"
        strokeWidth={3.4}
        aria-hidden="true"
      />
    </span>
  ) : null;

  const title = (
    <h3
      className={`line-clamp-2 text-base leading-[1.25] text-[var(--color-headline)] group-hover:underline group-hover:decoration-[1.5px] group-hover:underline-offset-[3px] group-focus-within:underline ${feature ? "font-bold" : "font-extrabold"}`}
    >
      <Link
        to="/providers/$slug"
        params={{ slug: provider.slug }}
        className={TILE_TITLE_LINK_CLASS}
      >
        {provider.name}
      </Link>
      {seal}
    </h3>
  );

  const rating =
    provider.ratingAverage === null ? (
      // Not a zero: a provider nobody has reviewed yet is new, the same
      // rule every caller of this card follows for the same reason.
      <span className="shrink-0 text-[13px] text-[var(--color-muted-foreground)]">
        {td("ratingNew")}
      </span>
    ) : (
      // The same shared mark the directory row printed, with the
      // accessible label it carries: the digits alone read as "4.8 (12)"
      // to a screen reader, with no unit and no clue what the number in
      // parentheses is.
      <RatingMark
        average={provider.ratingAverage}
        count={provider.reviewCount}
        locale={locale}
        label={td("providerRatingLabel", {
          score: formatRating(provider.ratingAverage, locale),
          count: provider.reviewCount,
        })}
      />
    );

  // The grid card says the count in words — "(4 avaliações)".
  const countedRating =
    provider.ratingAverage === null ? (
      rating
    ) : (
      <RatingMark
        average={provider.ratingAverage}
        count={provider.reviewCount}
        countText={td("ratingCount", { count: provider.reviewCount })}
        locale={locale}
        label={td("providerRatingLabel", {
          score: formatRating(provider.ratingAverage, locale),
          count: provider.reviewCount,
        })}
      />
    );

  const price = priced ? (
    <b className="text-right text-base font-extrabold whitespace-nowrap text-[var(--color-headline)]">
      <span className="mr-[3px] text-[12.5px] font-medium text-[var(--color-muted-foreground)]">
        {td("priceFromPrefix")}
      </span>
      <span className="tabular-nums">
        {formatHeadlinePrice(provider.fromAmountMinor!, provider.fromCurrency!, locale)}
      </span>
    </b>
  ) : null;

  const services =
    provider.serviceCount > 0 ? td("providerServiceCount", { count: provider.serviceCount }) : null;

  return (
    // The service card's shell exactly — 12px corners, the light line — so
    // the two browse grids are one system (October 2026 list mockup).
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[12px] border border-[var(--color-line-2)] bg-[var(--color-card)] text-[var(--color-card-foreground)]">
      {/* `relative` is the positioning context the heart resolves against, and
          this box rather than the `<article>` is the slot's home: it is the
          same box whether the business has a photograph or the site's
          placeholder, so the control does not move depending on whether one
          was uploaded. The heart carries `z-[3]`, which is what keeps it above
          the logo badge below (`z-[2]`) as well as above the title link's
          full-card `::after`. */}
      <div
        className={`relative w-full overflow-hidden bg-[var(--color-muted)] ${feature ? "aspect-[290/140]" : "aspect-[5/2]"}`}
      >
        <BrandImage
          src={photo}
          alt=""
          // The home's wider frame keeps a portrait's upper third, where the
          // face usually is, rather than cutting through the middle of it.
          className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035] ${feature ? "object-[50%_30%]" : ""}`}
        />
        {favourite}
        {/* The badge draws whenever there is a logo, independent of whether a
            photograph sits behind it. With no photo the background is
            `BrandImage`'s own `MediaFallback`, not the logo, so the two can
            never repeat the same picture — unlike the background itself, this
            has nothing to fall back to when it is absent. A logo that 404s
            falls back to the provider's initials rather than the brand mark:
            this badge is the business's own face, not a missing photograph. */}
        {!feature && provider.verified ? <VerifiedPill /> : null}
        {/* On the grid card the bottom-left is the verified pill's, so the
            logo moves to the bottom-right. */}
        {provider.logoUrl ? (
          <span className={`absolute bottom-3 z-[2] ${feature ? "left-3" : "right-3"} grid h-11 w-11 place-items-center overflow-hidden rounded-[10px] border border-[var(--color-border)] bg-[var(--color-card)]`}>
            <BrandImage
              src={provider.logoUrl}
              alt=""
              className="h-full w-full object-cover"
              fallback={
                <span
                  aria-hidden="true"
                  className="text-[13px] font-semibold text-[var(--color-primary)]"
                >
                  {initialsFrom(provider.name)}
                </span>
              }
            />
          </span>
        ) : null}
      </div>
      {feature ? (
        <div className="flex flex-1 flex-col px-[18px] pt-3.5 pb-4">
          {title}
          <div className="mt-1 grid gap-1 text-[14px] leading-[1.25] text-[var(--color-muted-foreground)]">
            {trade && <span className="truncate">{trade}</span>}
            {where && <span className="truncate">{where}</span>}
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--color-muted-foreground)]">
            {rating}
            {rating && services && <span aria-hidden="true">·</span>}
            {services && <span className="whitespace-nowrap">{services}</span>}
          </p>
          {price ? <div className="mt-auto pt-3">{price}</div> : null}
        </div>
      ) : (
        // The list-with-sidebar mockup's three lines (October 2026): the name
        // and its seal, the trade with its glyph, then the score and the
        // city — and "desde" with the price in the brand blue on the right.
        <div className="flex flex-1 items-end justify-between gap-4 px-4 pt-3 pb-3.5">
          <div className="grid min-w-0 gap-1.5">
            <h3 className="line-clamp-2 text-[17px] leading-[1.2] font-extrabold text-[var(--color-headline)] group-hover:underline group-hover:decoration-[1.5px] group-hover:underline-offset-[3px] group-focus-within:underline">
              <Link to="/providers/$slug" params={{ slug: provider.slug }} className={TILE_TITLE_LINK_CLASS}>
                {provider.name}
              </Link>
              {seal}
            </h3>
            {trade && (
              <p className="flex min-w-0 items-center gap-2 text-[13.5px] leading-[1.2] text-[var(--color-muted-foreground)]">
                <CategoryGlyph className="h-[15px] w-[15px] shrink-0" strokeWidth={2} aria-hidden="true" />
                <span className="truncate">{trade}</span>
              </p>
            )}
            <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--color-muted-foreground)]">
              {countedRating}
              {/* The pin is the separator, not a dot: a narrow card wraps the
                  city onto its own line, and a dot would start that line. */}
              {provider.city && (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <MapPin className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                  {provider.city}
                </span>
              )}
            </p>
          </div>
          {priced ? (
            <b className="shrink-0 text-right font-extrabold whitespace-nowrap text-[var(--color-primary)]">
              <span className="block text-[13px] font-medium text-[var(--color-muted-foreground)]">
                {td("priceFromPrefix")}
              </span>
              <span className="text-[20px] tabular-nums xl:text-[22px]">
                {formatHeadlinePrice(provider.fromAmountMinor!, provider.fromCurrency!, locale)}
              </span>
            </b>
          ) : null}
        </div>
      )}
    </article>
  );
}
