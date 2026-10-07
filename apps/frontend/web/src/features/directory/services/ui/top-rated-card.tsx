import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, FileText, ShieldCheck, type LucideIcon } from "lucide-react";
import {
  HIGHLIGHT_ACTION_CLASS,
  HighlightCard,
  HighlightFact,
} from "@/shared/components/browse/highlight-card";
import { ServiceMeta, ServicePrice, ServiceRating } from "@/shared/components/browse/service-card";
import type { ServiceDTO } from "@/features/directory/services/domain/types";

/**
 * The wide card above `/services`' grid: the best-rated service on the page in
 * hand, said at length — see `topRatedService` for how it is picked and when
 * there is none.
 *
 * The shell is `HighlightCard`, which `/providers` fills too. The score is
 * the provider's, as on every card. The facts are only true ones: a verified
 * provider when they are, and "Orçamento gratuito" only for a service that
 * works by quote — asking costs nothing until a quote is accepted.
 *
 * Every fact is printed by the grid card's own pieces — `ServiceRating`,
 * `ServiceMeta`, `ServicePrice` — so the wide card and the same service's
 * tile on page two can never disagree.
 */
export function TopRatedCard({
  service,
  locale,
  categoryIcon: CategoryGlyph,
  favourite,
}: {
  service: ServiceDTO;
  locale: string;
  categoryIcon: LucideIcon;
  /** The heart, exactly as on the grid card. */
  favourite?: ReactNode;
}) {
  const { t } = useTranslation("directory");
  const id = `top-rated-${service.id}`;
  return (
    <HighlightCard
      labelledBy={id}
      photo={service.imageUrls[0] ?? null}
      label={t("topRatedLabel")}
      verified={service.providerVerified}
      favourite={favourite}
      title={
        <h2
          id={id}
          className="text-[24px] leading-[1.15] font-extrabold tracking-[-0.01em] text-[var(--color-headline)]"
        >
          <Link to="/services/$id" params={{ id: service.id }} className="hover:underline">
            {service.name}
          </Link>
        </h2>
      }
      lines={
        <>
          <span className="flex items-center gap-2">
            <CategoryGlyph className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            {service.categoryName}
          </span>
          <ServiceMeta service={service} pin className="text-[14.5px]" />
          <span className="flex items-center gap-2">
            {service.providerName}
            {service.providerVerified && (
              <span
                className="grid h-[14px] w-[14px] place-items-center rounded-full bg-[var(--color-navy-surface)]"
                aria-label={t("providerVerified")}
              >
                <Check className="h-2.5 w-2.5 text-[var(--color-navy-on)]" strokeWidth={3.4} aria-hidden="true" />
              </span>
            )}
          </span>
        </>
      }
      rating={<ServiceRating service={service} locale={locale} counted />}
      description={service.description}
      price={<ServicePrice service={service} locale={locale} brand stacked className="text-[30px]" />}
      action={
        <Link to="/services/$id" params={{ id: service.id }} className={HIGHLIGHT_ACTION_CLASS}>
          {t("topRatedAction")}
          <ArrowRight className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
        </Link>
      }
      facts={
        <>
          {service.providerVerified && (
            <HighlightFact icon={<ShieldCheck className="h-4 w-4 text-[var(--color-headline)]" aria-hidden="true" />}>
              {t("topRatedVerified")}
            </HighlightFact>
          )}
          {service.bookingMode === "quote" && (
            <HighlightFact icon={<FileText className="h-4 w-4 text-[var(--color-headline)]" aria-hidden="true" />}>
              {t("topRatedQuoteFree")}
            </HighlightFact>
          )}
        </>
      }
    />
  );
}
