import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Ellipsis, ShieldCheck } from "lucide-react";
import { categoryIcon } from "@/features/directory/services/ui/category-icon";
import {
  CATEGORY_FILTER_LIMIT,
  useCategoryPreview,
} from "@/features/landing/viewmodel/use-categories";

/** How many tiles the grid holds: two rows of four. */
const TILES = 8;

/**
 * Opens the bar's Categoria pill — where every category is, searchable — and
 * brings it into view. The tiles show eight; the pill is the whole list, so
 * "Ver todas" goes there rather than to a page that does not exist.
 */
function openCategoryPill() {
  const pill = document.getElementById(CATEGORY_PILL_ID);
  if (!pill) return;
  pill.setAttribute("open", "");
  pill.scrollIntoView({ block: "center", behavior: "smooth" });
  pill.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true });
}

/** The `id` the services bar gives its Categoria pill. */
export const CATEGORY_PILL_ID = "filter-category";

/**
 * "Categorias populares": the platform's real categories as tiles, each a
 * link to the list narrowed to it — `client/servicos.html`'s side column.
 *
 * When there are more than fit, the last tile is "Mais categorias" and opens
 * the Categoria pill, as "Ver todas" does; with eight or fewer there is
 * nothing more to see, and neither appears. Nothing at all with none.
 */
export function PopularCategories() {
  const { t } = useTranslation("directory");
  const categories = useCategoryPreview(CATEGORY_FILTER_LIMIT).data?.items ?? [];
  if (categories.length === 0) return null;

  const more = categories.length > TILES;
  const shown = categories.slice(0, more ? TILES - 1 : TILES);
  const tileClass =
    "flex min-h-[88px] flex-col items-center gap-2 rounded-[10px] bg-[#f1f8fe] px-1 pt-3.5 pb-3 text-center text-[13px] leading-[1.3] text-[var(--color-ink-2)] hover:bg-[var(--color-blue-soft)]";

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
            className="ml-auto flex items-center gap-2 text-sm font-semibold text-[#1d7dfc] hover:underline"
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
              <Link to="/services" search={{ category: c.code }} className={tileClass}>
                <Icon className="h-6 w-6 shrink-0 text-[#005cfe]" strokeWidth={2.4} aria-hidden="true" />
                {c.name}
              </Link>
            </li>
          );
        })}
        {more && (
          <li>
            <button type="button" onClick={openCategoryPill} className={`${tileClass} w-full`}>
              <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full bg-white">
                <Ellipsis className="h-4 w-4 text-[#005cfe]" strokeWidth={2.4} />
              </span>
              {t("moreCategories")}
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}

/**
 * The side column's closing note. Static copy about what the platform checks,
 * stated the same for everyone — it names no provider and no number.
 */
export function VerifiedBanner() {
  const { t } = useTranslation("directory");
  return (
    <div className="flex items-center gap-4 rounded-xl bg-[#eff7fe] px-5 py-[18px]">
      <span aria-hidden="true" className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-[#d6ebfe]">
        <ShieldCheck className="h-[26px] w-[26px] text-[#005cfe]" strokeWidth={2} />
      </span>
      <div>
        <b className="block text-[15px] font-bold text-[#000a5c]">{t("verifiedBannerTitle")}</b>
        <p className="mt-1 text-[13px] leading-[1.45] text-[var(--color-muted-foreground)]">
          {t("verifiedBannerBody")}
        </p>
      </div>
    </div>
  );
}
