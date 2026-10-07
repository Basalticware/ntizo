import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Sparkles, icons } from "lucide-react";
import { Skeleton } from "@ntizo/frontend-ui";
import { BrandImage } from "@/shared/components/brand-image";
import { ScrollRail } from "@/shared/components/browse/scroll-rail";
import { useCategoryPreview } from "@/features/landing/viewmodel/use-categories";
import { SectionHead } from "@/features/landing/ui/section-head";

/** How many the home page shows before "all categories". */
export const LANDING_CATEGORIES = 8;

/**
 * Resolve a Lucide icon name from the database to the component.
 *
 * Looked up rather than imported one by one: the set lives in a table an
 * administrator edits, so the code cannot know it at build time. An unknown or
 * missing name falls back to `Sparkles` rather than rendering nothing — an
 * empty navy square says less than a wrong-but-present mark.
 */
function getIconComponent(name: string | null) {
  if (!name) return Sparkles;
  return icons[name as keyof typeof icons] ?? Sparkles;
}

/**
 * Eight trades, on `/services`' own category tile.
 *
 * The soft blue tile with the blue glyph and the name under it — the tile
 * "Categorias populares" draws beside the listing — so a category looks the
 * same on the home as on the page it opens. Where an administrator gave the
 * category a photograph, it sits in the tile's round, where the glyph would.
 *
 * A category with no `imageUrl` draws its own icon rather than `BrandImage`'s
 * brand tile: the brand tile prints initials, and a row of eight tiles each
 * printing two letters of its own name is a row of eight near-identical
 * squares.
 *
 * Below `sm` the grid becomes `ScrollRail`'s sideways row. `cardWidth="38%"`
 * lands two tiles on screen at 390px with a clear quarter-tile peek of a
 * third — a small square with one line of text under it reads fine that
 * dense, unlike the two bigger card sections below it on the page.
 */
export function CategoryGrid() {
  const { t } = useTranslation("landing"); // t:CategoryGrid
  const { data, isLoading } = useCategoryPreview(LANDING_CATEGORIES);
  const items = data?.items ?? [];

  if (!isLoading && items.length === 0) return null;

  return (
    <section className="public-inset pt-14">
      <SectionHead
        title={t("home.categoriesTitle")}
        blurb={t("home.categoriesBlurb")}
        more={{ label: t("home.categoriesAll"), to: "/services" }}
      />
      <ScrollRail
        as="ul"
        columns={4}
        cardWidth="38%"
        className="sm:gap-x-4 sm:gap-y-4 xl:grid-cols-8"
      >
        {isLoading
          ? Array.from({ length: LANDING_CATEGORIES }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-[120px] w-full rounded-[10px]" />
              </li>
            ))
          : items.map((c) => {
              const Icon = getIconComponent(c.icon);
              const isFallback = !c.icon || !icons[c.icon as keyof typeof icons];
              const glyph = (
                <Icon
                  data-testid={isFallback ? "category-icon-fallback" : `category-icon-${c.icon}`}
                  className="h-7 w-7 text-[var(--color-primary)]"
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
              );
              return (
                <li key={c.id}>
                  <Link
                    to="/services"
                    search={{ category: c.code }}
                    className="flex h-full min-h-[120px] flex-col items-center justify-center gap-3 rounded-[10px] bg-[var(--color-blue-softer)] px-2 py-4 text-center hover:bg-[var(--color-blue-soft)]"
                  >
                    <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--color-card)]">
                      <BrandImage
                        src={c.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        fallback={glyph}
                      />
                    </span>
                    <b className="line-clamp-2 text-[14px] leading-[1.3] font-semibold text-[var(--color-ink-2)]">
                      {c.name}
                    </b>
                  </Link>
                </li>
              );
            })}
      </ScrollRail>
    </section>
  );
}
