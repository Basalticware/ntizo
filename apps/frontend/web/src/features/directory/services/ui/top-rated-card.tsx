import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Tag } from "lucide-react";
import { BrandImage } from "@/shared/components/brand-image";
import {
  ServiceByline,
  ServiceMeta,
  ServicePrice,
  ServiceRating,
} from "@/shared/components/browse/service-card";
import type { ServiceDTO } from "@/features/directory/services/domain/types";

/**
 * The wide card above `/services`' grid: the best-rated service on the page in
 * hand, said at length — see `topRatedService` for how it is picked and when
 * there is none.
 *
 * From the October 2026 list mockup, with its words corrected. The mockup
 * labels this "Serviço em destaque"; nothing in the data marks a service as
 * featured, so the label says what the pick actually is, "Mais bem avaliado".
 * The score is the provider's, as on every card. The mockup's facts column
 * also says "Disponível hoje", which nothing here can know, so the facts are
 * the two this listing does carry: a verified provider, and its category.
 *
 * The one card on the page with a button. The grid's cards carry none — a
 * button twenty-four times over competes with every price — but this one is
 * a single call to action by design, and the title is still the link for
 * anybody who reads rather than aims.
 *
 * Every fact is printed by the grid card's own pieces — `ServiceByline`,
 * `ServiceRating`, `ServiceMeta`, `ServicePrice` — so the wide card and the
 * same service's tile in the grid on page two can never disagree.
 */
export function TopRatedCard({
  service,
  locale,
  favourite,
}: {
  service: ServiceDTO;
  locale: string;
  /** The heart, on the photograph, exactly as on the grid card. */
  favourite?: ReactNode;
}) {
  const { t } = useTranslation("directory");
  return (
    <article
      aria-labelledby={`top-rated-${service.id}`}
      className="mt-6 grid overflow-hidden rounded-[14px] border border-[var(--color-blue-line)] bg-[var(--color-blue-softer)] md:grid-cols-[minmax(220px,300px)_1fr] lg:grid-cols-[300px_1fr_240px]"
    >
      <div className="relative aspect-[16/9] bg-[var(--color-muted)] md:aspect-auto md:min-h-[190px]">
        <BrandImage
          src={service.imageUrls[0] ?? null}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        {favourite}
      </div>

      <div className="min-w-0 px-5 pt-4 pb-1 md:pt-5 md:pb-5 lg:px-7">
        <p className="inline-flex rounded-[6px] bg-[var(--color-info-bg)] px-2 py-1 text-[11.5px] leading-none font-bold tracking-[0.04em] text-[var(--color-info-fg)] uppercase">
          {t("topRatedLabel")}
        </p>
        <h2
          id={`top-rated-${service.id}`}
          className="mt-3 text-[22px] leading-[1.15] font-extrabold tracking-[-0.01em] text-[var(--color-headline)]"
        >
          <Link to="/services/$id" params={{ id: service.id }} className="hover:underline">
            {service.name}
          </Link>
        </h2>
        <ServiceByline service={service} className="mt-1.5 text-[14px]" />
        <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <ServiceRating service={service} locale={locale} />
          <ServiceMeta service={service} lead pin />
        </div>
        {service.description && (
          <p className="mt-3 line-clamp-2 max-w-[60ch] text-[14px] leading-[1.5] text-[var(--color-ink-2)]">
            {service.description}
          </p>
        )}
      </div>

      {/* The price, the action and the facts: a column of its own on a wide
          screen, the foot of the card below it. */}
      <div className="flex flex-col gap-3 px-5 pt-3 pb-5 md:col-span-2 md:flex-row md:items-center md:justify-between md:pt-0 lg:col-span-1 lg:flex-col lg:items-stretch lg:justify-center lg:py-5 lg:pr-6 lg:pl-0">
        <ServicePrice service={service} locale={locale} className="text-[24px] lg:text-left" />
        <Link
          to="/services/$id"
          params={{ id: service.id }}
          className="inline-flex h-11 items-center justify-center rounded-[10px] bg-[var(--color-blue-public)] px-6 text-[14px] font-semibold text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90 md:order-last lg:order-none"
        >
          {t("topRatedAction")}
        </Link>
        <ul className="grid list-none gap-1.5 p-0 text-[13px] text-[var(--color-ink-2)]">
          {service.providerVerified && (
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--color-primary)]" strokeWidth={2} aria-hidden="true" />
              {t("topRatedVerified")}
            </li>
          )}
          <li className="flex min-w-0 items-center gap-2">
            <Tag className="h-4 w-4 shrink-0 text-[var(--color-primary)]" strokeWidth={2} aria-hidden="true" />
            <span className="truncate">{service.categoryName}</span>
          </li>
        </ul>
      </div>
    </article>
  );
}
