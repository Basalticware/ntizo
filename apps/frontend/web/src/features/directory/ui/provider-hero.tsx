import { useTranslation } from "react-i18next";
import { BadgeCheck, MapPin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@ntizo/frontend-ui";
import type { ProviderPublicDTO } from "@ntizo/shared";
import { initialsFrom } from "@/shared/lib/initials";
import { formatRating } from "@/shared/domain/rating";
import { Stars } from "@/features/directory/ui/provider-reviews";

/**
 * Who this business is — `client/prestador-detalhe.html`'s identity row: the
 * logo in a 114px circle, the name with its "Verificado" pill, the score, and
 * where it is.
 *
 * Everything here is something the platform actually knows. The logo falls
 * back to the business's initials; the pill is `verified` — an administrator
 * accepted at least one of its documents — and absent otherwise; the score
 * is absent until somebody has reviewed, because empty stars would show a
 * business nobody has rated as the worst on the platform.
 *
 * The trade moved out of an eyebrow over the name and into the facts row
 * below, where the mockup puts it.
 */
export function ProviderHero({ provider }: { provider: ProviderPublicDTO }) {
  const { t, i18n } = useTranslation("directory");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const where = [provider.district, provider.city, provider.country].filter(Boolean).join(", ");
  const score = provider.ratingAverage === null ? null : formatRating(provider.ratingAverage, locale);

  return (
    <header className="mt-6 flex min-w-0 items-center gap-5 sm:gap-7">
      <Avatar className="h-20 w-20 shrink-0 sm:h-[114px] sm:w-[114px]">
        {provider.logoUrl && <AvatarImage src={provider.logoUrl} alt="" />}
        <AvatarFallback className="text-2xl">{initialsFrom(provider.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center gap-2.5 text-[26px] leading-[1.1] font-extrabold tracking-[-0.02em] text-[var(--color-headline)] sm:text-[33px]">
          {provider.name}
          {provider.verified && (
            <span className="inline-flex h-7 items-center gap-2 rounded-[14px] bg-[var(--color-info-bg)] pr-2.5 pl-1 text-[15px] font-medium tracking-normal text-[var(--color-primary)]">
              <BadgeCheck className="h-[22px] w-[22px] fill-[var(--color-primary)] text-white" strokeWidth={2.4} aria-hidden="true" />
              {t("providerVerified")}
            </span>
          )}
        </h1>
        {score !== null && provider.ratingAverage !== null && (
          <p
            className="mt-3 flex items-center gap-1.5 text-[15px]"
            aria-label={t("providerRatingLabel", { score, count: provider.reviewCount })}
          >
            <Stars value={provider.ratingAverage} size={18} />
            <b aria-hidden="true" className="ml-1.5 font-semibold text-[var(--color-headline)]">
              {score}
            </b>
            <span aria-hidden="true" className="text-[var(--color-muted-foreground)]">
              ({provider.reviewCount})
            </span>
          </p>
        )}
        {where && (
          <p className="mt-3.5 flex items-center gap-2.5 text-[15px] text-[var(--color-ink-2)]">
            <MapPin className="h-[17px] w-[17px] text-[var(--color-ink-2)]" aria-hidden="true" />
            {where}
          </p>
        )}
      </div>
    </header>
  );
}
