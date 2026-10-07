import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@ntizo/frontend-ui";
import { initialsFrom } from "@/shared/lib/initials";
import type { ServiceDetailDTO } from "@ntizo/shared/read-models";
import { formatRating } from "@/shared/domain/rating";
import { Stars } from "@/features/directory/ui/provider-reviews";
import { useProviderReviews } from "@/features/directory/viewmodel/use-directory";

/**
 * The business behind this service, beside the title — the card at the top
 * right of `client/servico-detalhe.html`.
 *
 * Only enough to say *who*, well enough that a reader recognises the business
 * and can reach its full page: the logo, the name, what kind of business and
 * where, and its score.
 *
 * Logo falls back to a monogram: `AvatarImage` unmounts itself on error, which
 * is what lets the initials beneath lay out inside the circle.
 *
 * The tick beside the name is `providerVerified` — an administrator accepted
 * at least one of the business's documents — and nothing else. The score is
 * the business's reviews, read from the same query the reviews section below
 * uses, and absent until somebody has reviewed.
 */
export function ServiceProviderCard({ service }: { service: ServiceDetailDTO }) {
  const { t, i18n } = useTranslation("directory");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const reviews = useProviderReviews(service.providerId);
  const place = [service.providerCity, service.providerDistrict].filter(Boolean).join(", ");
  const kind = t(service.providerType === "organization" ? "typeOrganization" : "typeIndividual");
  const average = reviews?.summary.average ?? null;
  const count = reviews?.summary.count ?? 0;

  return (
    <div className="self-start rounded-xl border border-[var(--color-border)] p-4">
      <div className="flex items-start gap-3.5">
        <Avatar className="h-[72px] w-[72px] shrink-0">
          {service.providerLogoUrl && <AvatarImage src={service.providerLogoUrl} alt="" />}
          <AvatarFallback>{initialsFrom(service.providerName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-base font-semibold text-[var(--color-headline)]">
            <span className="truncate">{service.providerName}</span>
            {service.providerVerified && (
              <BadgeCheck
                className="h-4 w-4 shrink-0 fill-[var(--color-blue-public)] text-white"
                aria-label={t("providerVerified")}
              />
            )}
          </p>
          <p className="mt-1 text-[13px] leading-[1.45] text-[var(--color-faint)]">
            {kind}
            {place && (
              <>
                <span className="mx-1">•</span>
                {place}
              </>
            )}
          </p>
          {average !== null && count > 0 && (
            <p
              className="mt-1.5 flex flex-wrap items-center text-[13px] text-[var(--color-faint)]"
              aria-label={t("providerRatingLabel", { score: formatRating(average, locale), count })}
            >
              <Stars value={average} size={14} />
              <b aria-hidden="true" className="mr-1 ml-2 text-sm font-bold text-[var(--color-headline)]">
                {formatRating(average, locale)}
              </b>
              <span aria-hidden="true">({t("reviewsCount", { count })})</span>
            </p>
          )}
        </div>
      </div>
      <Link
        to="/providers/$slug"
        params={{ slug: service.providerSlug }}
        className="mt-4 flex h-[42px] items-center justify-center gap-2 rounded-[9px] bg-[var(--color-blue-soft)] text-[15px] font-medium text-[var(--color-info-fg)] hover:bg-[var(--color-blue-soft)]"
      >
        {t("viewProviderProfile")}
        <ArrowRight className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
      </Link>
    </div>
  );
}
