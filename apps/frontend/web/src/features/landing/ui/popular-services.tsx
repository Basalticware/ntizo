import { useTranslation } from "react-i18next";
import { Skeleton } from "@ntizo/frontend-ui";
import { ServiceCard } from "@/shared/components/browse/service-card";
import { ScrollRail } from "@/shared/components/browse/scroll-rail";
import { FavouriteButton } from "@/features/favourites/ui/favourite-button";
import { useFavouriteMarks } from "@/features/favourites/viewmodel/use-favourite-marks";
import { usePopularServices } from "@/features/landing/viewmodel/use-popular-services";
import { useLocale } from "@/features/landing/viewmodel/use-locale";
import { SectionHead } from "@/features/landing/ui/section-head";

/** How many services the home page leads with: one row of four. */
export const LANDING_SERVICES = 4;

/**
 * The services, with their prices.
 *
 * The shared `ServiceCard` in its `"feature"` layout — the October 2026 home
 * mockup's card, with the category on the photograph and the price on a line
 * of its own — four across, one row.
 *
 * The heart is the listings' own `FavouriteButton`, with the page's one marks
 * query behind it, and no `onSaved`: a press here is a quick save, and the
 * filing dialog stays on the pages that list things.
 *
 * Below `sm` the grid becomes `ScrollRail`'s sideways row, at the rail's own
 * default `cardWidth` (72%): one card plus a generous peek of the next.
 */
export function PopularServices() {
  const { t } = useTranslation("landing"); // t:PopularServices
  const locale = useLocale();
  const { data, isLoading } = usePopularServices(LANDING_SERVICES);
  const items = data?.items ?? [];
  const marks = useFavouriteMarks(
    "service",
    items.map((s) => s.id),
  );

  // Nothing published, so the section does not appear. A heading over an empty
  // grid says the platform sells nothing.
  if (!isLoading && items.length === 0) return null;

  return (
    <section className="public-inset pt-10">
      <SectionHead
        title={t("home.servicesTitle")}
        blurb={t("home.servicesBlurb")}
        more={{ label: t("home.servicesAll"), to: "/services" }}
      />
      <ScrollRail as="ul" columns={2} className="lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: LANDING_SERVICES }, (_, i) => (
              <li key={i}>
                {/* The same shape as the card it stands in for, so a cold
                    load does not reflow the moment the real card replaces
                    it. */}
                <div className="overflow-hidden rounded-[10px] border border-[var(--color-line-2)]">
                  <Skeleton className="aspect-[290/160] w-full rounded-none" />
                  <div className="grid gap-2 p-4">
                    <Skeleton className="h-[17px] w-4/5" />
                    <Skeleton className="h-[13px] w-1/2" />
                    <Skeleton className="h-[13px] w-1/3" />
                    <Skeleton className="mt-2 h-[18px] w-1/3" />
                  </div>
                </div>
              </li>
            ))
          : items.map((s) => (
              <li key={s.id}>
                <ServiceCard
                  service={s}
                  locale={locale}
                  variant="feature"
                  favourite={
                    <FavouriteButton
                      targetType="service"
                      targetId={s.id}
                      saved={marks.isMarked(s.id)}
                    />
                  }
                />
              </li>
            ))}
      </ScrollRail>
    </section>
  );
}
