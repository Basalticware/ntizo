import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@ntizo/frontend-ui";
import { ScrollRail } from "@/shared/components/browse/scroll-rail";
import { useCategoryPreview } from "@/features/landing/viewmodel/use-categories";
import { SectionHead } from "@/features/landing/ui/section-head";
import { CategoryPicture } from "@/features/landing/ui/category-picture";

/** How many the home page shows before "all categories". */
export const LANDING_CATEGORIES = 8;

/**
 * "O que precisa de resolver?": eight trades as photographs, from the October
 * 2026 home mockup.
 *
 * A rounded photograph with the name under it, eight across on a wide screen.
 * The picture is `CategoryPicture`'s: the category's own upload, else its
 * icon on the soft blue tile — so a category an administrator added
 * yesterday still draws a deliberate tile rather than a hole.
 *
 * Below `sm` the grid becomes `ScrollRail`'s sideways row. `cardWidth="38%"`
 * lands two tiles on screen at 390px with a clear peek of a third.
 */
export function CategoryGrid() {
  const { t } = useTranslation("landing"); // t:CategoryGrid
  const { data, isLoading } = useCategoryPreview(LANDING_CATEGORIES);
  const items = data?.items ?? [];

  if (!isLoading && items.length === 0) return null;

  return (
    <section className="public-inset pt-10">
      <SectionHead
        title={t("home.categoriesTitle")}
        blurb={t("home.categoriesBlurb")}
        more={{ label: t("home.categoriesAll"), to: "/services" }}
      />
      <ScrollRail
        as="ul"
        columns={4}
        cardWidth="38%"
        className="sm:gap-x-4 sm:gap-y-5 lg:grid-cols-8"
      >
        {isLoading
          ? Array.from({ length: LANDING_CATEGORIES }, (_, i) => (
              <li key={i}>
                <Skeleton className="aspect-[10/9] w-full rounded-[10px]" />
                <Skeleton className="mx-auto mt-2.5 h-[14px] w-2/3" />
              </li>
            ))
          : items.map((c) => (
              <li key={c.id}>
                <Link
                  to="/services"
                  search={{ category: c.code }}
                  className="group block text-center"
                >
                  <span className="block aspect-[10/9] overflow-hidden rounded-[10px] bg-[var(--color-muted)]">
                    <CategoryPicture
                      category={c}
                      className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  </span>
                  <b className="mt-2.5 line-clamp-2 block text-[14px] leading-[1.3] font-semibold text-[var(--color-ink-2)] group-hover:text-[var(--color-headline)] group-hover:underline">
                    {c.name}
                  </b>
                </Link>
              </li>
            ))}
      </ScrollRail>
    </section>
  );
}
