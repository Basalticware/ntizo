import { useTranslation } from "react-i18next";
import { Skeleton } from "@ntizo/frontend-ui";
import { ProviderCard } from "@/shared/components/browse/provider-card";
import { ScrollRail } from "@/shared/components/browse/scroll-rail";
import { FavouriteButton } from "@/features/favourites/ui/favourite-button";
import { useFavouriteMarks } from "@/features/favourites/viewmodel/use-favourite-marks";
import { usePopularProviders } from "@/features/landing/viewmodel/use-popular-providers";
import { useLocale } from "@/features/landing/viewmodel/use-locale";
import { SectionHead } from "@/features/landing/ui/section-head";

/** How many businesses the home page names: one row of four. */
export const LANDING_PROVIDERS = 4;

/**
 * "Pessoas em quem pode confiar": the businesses whose documents an
 * administrator checked, best scored first.
 *
 * Both halves of the claim come off the row: a score customers gave, and a
 * verification an administrator performed (`verifiedOnly` in the query).
 *
 * The shared `ProviderCard` in its `"feature"` layout — the October 2026 home
 * mockup's card: the name and its seal, the trade, the place, the rating
 * beside the count of services, and "desde" with the lowest price. Every one
 * of those is a field on the row; a business that lacks one simply prints
 * one line fewer.
 *
 * Below `sm` the grid becomes `ScrollRail`'s sideways row, at
 * `cardWidth="78%"`, which keeps a clear peek of the next business.
 */
export function VerifiedProviders() {
  const { t } = useTranslation("landing"); // t:VerifiedProviders
  const locale = useLocale();
  const { data, isLoading } = usePopularProviders(LANDING_PROVIDERS);
  const items = data?.items ?? [];
  const marks = useFavouriteMarks(
    "provider",
    items.map((p) => p.id),
  );

  if (!isLoading && items.length === 0) return null;

  return (
    <section className="public-inset pt-10">
      <SectionHead
        title={t("home.providersTitle")}
        blurb={t("home.providersBlurb")}
        more={{ label: t("home.providersAll"), to: "/providers" }}
      />
      <ScrollRail as="ul" columns={2} cardWidth="78%" className="lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: LANDING_PROVIDERS }, (_, i) => (
              <li key={i}>
                <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
                  <Skeleton className="aspect-[290/140] w-full rounded-none" />
                  <div className="grid gap-2 p-4">
                    <Skeleton className="h-[17px] w-3/4" />
                    <Skeleton className="h-[13px] w-1/2" />
                    <Skeleton className="h-[13px] w-2/3" />
                    <Skeleton className="mt-2 h-[15px] w-1/3" />
                  </div>
                </div>
              </li>
            ))
          : items.map((p) => (
              <li key={p.id}>
                <ProviderCard
                  provider={p}
                  locale={locale}
                  variant="feature"
                  favourite={
                    <FavouriteButton
                      targetType="provider"
                      targetId={p.id}
                      saved={marks.isMarked(p.id)}
                    />
                  }
                />
              </li>
            ))}
      </ScrollRail>
    </section>
  );
}
