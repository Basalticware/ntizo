import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, MapPin, ShieldCheck, type LucideIcon } from "lucide-react";
import type { ProviderPublicDTO } from "@ntizo/shared";
import {
  HIGHLIGHT_ACTION_CLASS,
  HighlightCard,
  HighlightFact,
} from "@/shared/components/browse/highlight-card";
import { RatingMark } from "@/shared/components/browse/result-tile";
import { formatRating } from "@/shared/domain/rating";
import { formatHeadlinePrice } from "@/features/directory/services/domain/service-card";

/**
 * The wide card above `/providers`' grid: the best-rated business on the
 * page in hand — see `topRatedProvider` for how it is picked and when there
 * is none.
 *
 * The same `HighlightCard` `/services` fills, with the business's own facts:
 * its trade and city, its rating, its description, and "desde" with the
 * cheapest thing it sells. The only fact chip is "Prestador verificado", and
 * only when it is; the mockup's "Resposta rápida" and "Orçamento gratuito"
 * are not things a business as a whole can be said to have.
 */
export function TopRatedProviderCard({
  provider,
  locale,
  categoryIcon: CategoryGlyph,
  favourite,
}: {
  provider: ProviderPublicDTO;
  locale: string;
  categoryIcon: LucideIcon;
  favourite?: ReactNode;
}) {
  const { t } = useTranslation("directory");
  const id = `top-rated-${provider.id}`;
  const trade = provider.categories[0]?.name ?? null;
  const where = [provider.district, provider.city].filter(Boolean).join(", ");
  const priced = provider.fromAmountMinor !== null && provider.fromCurrency !== null;

  return (
    <HighlightCard
      labelledBy={id}
      photo={provider.photoUrls[0] ?? provider.logoUrl ?? null}
      label={t("topRatedLabel")}
      verified={provider.verified}
      favourite={favourite}
      title={
        <h2
          id={id}
          className="flex items-center gap-2 text-[26px] leading-[1.15] font-extrabold tracking-[-0.01em] text-[var(--color-headline)]"
        >
          <Link to="/providers/$slug" params={{ slug: provider.slug }} className="hover:underline">
            {provider.name}
          </Link>
          {provider.verified && (
            <span
              className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-[var(--color-navy-surface)]"
              aria-label={t("providerVerified")}
            >
              <Check className="h-3 w-3 text-[var(--color-navy-on)]" strokeWidth={3.4} aria-hidden="true" />
            </span>
          )}
        </h2>
      }
      lines={
        <>
          {trade && (
            <span className="flex items-center gap-2">
              <CategoryGlyph className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              {trade}
            </span>
          )}
          {where && (
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              {where}
            </span>
          )}
        </>
      }
      rating={
        provider.ratingAverage !== null && (
          <RatingMark
            average={provider.ratingAverage}
            count={provider.reviewCount}
            countText={t("ratingCount", { count: provider.reviewCount })}
            locale={locale}
            label={t("providerRatingLabel", {
              score: formatRating(provider.ratingAverage, locale),
              count: provider.reviewCount,
            })}
          />
        )
      }
      description={provider.description}
      price={
        priced ? (
          <b className="font-extrabold whitespace-nowrap text-[var(--color-primary)]">
            <span className="block text-[13px] font-medium text-[var(--color-muted-foreground)]">
              {t("priceFromPrefix")}
            </span>
            <span className="text-[30px] tabular-nums">
              {formatHeadlinePrice(provider.fromAmountMinor!, provider.fromCurrency!, locale)}
            </span>
          </b>
        ) : null
      }
      action={
        <Link to="/providers/$slug" params={{ slug: provider.slug }} className={HIGHLIGHT_ACTION_CLASS}>
          {t("topRatedProfileAction")}
          <ArrowRight className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
        </Link>
      }
      facts={
        provider.verified ? (
          <HighlightFact icon={<ShieldCheck className="h-4 w-4 text-[var(--color-headline)]" aria-hidden="true" />}>
            {t("topRatedVerified")}
          </HighlightFact>
        ) : null
      }
    />
  );
}
