import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Ellipsis } from "lucide-react";
import { categoryIcon } from "@/features/directory/services/ui/category-icon";
import {
  CATEGORY_FILTER_LIMIT,
  useCategoryPreview,
} from "@/features/landing/viewmodel/use-categories";

/** How many tiles the grid holds: two rows of four. */
const TILES = 8;

/** The `id` the directory's bar gives its Categoria pill. */
export const PROVIDER_CATEGORY_PILL_ID = "filter-provider-category";

/**
 * Opens the bar's Categoria pill — where every category is — and brings it
 * into view, as `/services`' "Ver todas" does.
 */
function openCategoryPill() {
  const pill = document.getElementById(PROVIDER_CATEGORY_PILL_ID);
  if (!pill) return;
  pill.setAttribute("open", "");
  pill.scrollIntoView({ block: "center", behavior: "smooth" });
  pill.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true });
}

/**
 * "Categorias populares" beside the directory: `/services`' own side column,
 * each tile a link to the businesses in that trade rather than to its
 * services. The platform's real categories and nothing else.
 *
 * When there are more than fit, the last tile is "Mais categorias" and opens
 * the Categoria pill; with eight or fewer neither it nor "Ver todas" appears.
 * Nothing at all with none.
 */
export function ProviderCategories() {
  const { t } = useTranslation("directory");
  const categories = useCategoryPreview(CATEGORY_FILTER_LIMIT).data?.items ?? [];
  if (categories.length === 0) return null;

  const more = categories.length > TILES;
  const shown = categories.slice(0, more ? TILES - 1 : TILES);
  const tileClass =
    "flex min-h-[88px] flex-col items-center gap-2 rounded-[10px] bg-[var(--color-blue-softer)] px-1 pt-3.5 pb-3 text-center text-[13px] leading-[1.3] text-[var(--color-ink-2)] hover:bg-[var(--color-blue-soft)]";

  return (
    <section>
      <div className="flex items-center">
        <h2 className="text-[19px] font-extrabold text-[var(--color-headline)]">
          {t("popularCategories")}
        </h2>
        {more && (
          <button
            type="button"
            onClick={openCategoryPill}
            className="ml-auto flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] hover:underline"
          >
            {t("categoriesSeeAll")}
            <ArrowRight className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
          </button>
        )}
      </div>
      <ul className="mt-4 grid list-none grid-cols-4 gap-2 p-0">
        {shown.map((c) => {
          const Icon = categoryIcon(c.icon);
          return (
            <li key={c.id}>
              <Link to="/providers" search={{ category: c.code }} className={tileClass}>
                <Icon className="h-6 w-6 shrink-0 text-[var(--color-primary)]" strokeWidth={2.4} aria-hidden="true" />
                {c.name}
              </Link>
            </li>
          );
        })}
        {more && (
          <li>
            <button type="button" onClick={openCategoryPill} className={`${tileClass} w-full`}>
              <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full bg-[var(--color-card)]">
                <Ellipsis className="h-4 w-4 text-[var(--color-primary)]" strokeWidth={2.4} />
              </span>
              {t("moreCategories")}
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}
