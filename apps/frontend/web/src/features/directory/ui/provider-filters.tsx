import { useState } from "react";
import {
  Building2,
  ChevronRight,
  CircleDollarSign,
  LayoutGrid,
  MapPin,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { FilterSheet } from "@/shared/components/browse/filter-sheet";
import {
  ACTIVE_CHIP_CLASS,
  ActiveFilters,
  FilterSidebar,
  MoreOptions,
  SidebarSection,
  SwitchMark,
  chipOptionClass,
  listOptionClass,
  tileOptionClass,
} from "@/shared/components/browse/filter-sidebar";
import {
  FloatingControls,
  floatingControlClass,
} from "@/shared/components/browse/floating-controls";
import { SortDropdown, type SortDropdownOption } from "@/shared/components/browse/sort-dropdown";
import { SearchableOptions } from "@/shared/components/browse/searchable-options";
import { EXACT_MATCH } from "@/shared/components/browse/active-match";
import { formatRating } from "@/shared/domain/rating";
import {
  directorySearch,
  PROVIDER_KINDS,
  RATING_THRESHOLDS,
  type DirectorySearch,
  type DirectorySort,
} from "@/features/directory/domain/directory-search";
import { directoryFilterChips } from "@/features/directory/domain/directory-chips";
import { useProviderCities } from "@/features/directory/viewmodel/use-directory";
import {
  CATEGORY_FILTER_LIMIT,
  useCategoryPreview,
} from "@/features/landing/viewmodel/use-categories";
import { DirectoryPriceFilter } from "@/features/directory/ui/directory-price-filter";
import { categoryIcon } from "@/features/directory/services/ui/category-icon";

/**
 * Everything the pill bar can narrow, taken off at once — but not what was
 * typed.
 *
 * The set `directoryFilterChips` lists other than `q`, plus the category. The
 * **category goes** now that it is a pill on this bar: it used to be kept,
 * because the strip above the results went on showing it and clearing
 * something visible from a control somewhere else reads as a bug — but the
 * control and the category are the same control today, and a "Clear all" that
 * left one of its own pills filled would be the bug instead. The **sort is
 * kept**, because an order is not a narrowing and clearing filters should not
 * also reorder what is left.
 *
 * **The term is kept too.** It lives in the search bar under the header,
 * which shows it and has its own way of emptying it; a "Clear all" under a
 * bar of empty pills that also wiped what the reader typed would be taking
 * something this control never showed as on.
 *
 * `offset: undefined` because page 4 of a narrower result set is usually past
 * the end of it — a reader who cleared their filters would land on an empty
 * page having asked for a fuller one.
 */
export function clearedDirectorySearch(current: DirectorySearch): DirectorySearch {
  return directorySearch(current, {
    // The category came off the strip above the results and onto this bar, so
    // "clear all" owes it the same clearing as every other filter beside it.
    category: undefined,
    city: undefined,
    providerType: undefined,
    minRating: undefined,
    verified: undefined,
    minPrice: undefined,
    maxPrice: undefined,
    offset: undefined,
  });
}

/**
 * Every order this directory offers, default first — `SortDropdown`'s menu.
 *
 * Written once because the page draws this control twice: on the heading's
 * right for a wide screen and inside the phone's floating capsule. Two copies
 * of the list is how a sixth order gets added to one of them and the phone
 * quietly goes on offering five, which is the same drift the `*Options`
 * components and `ClearAll` exist to prevent.
 *
 * Takes `t` rather than calling `useTranslation` itself: it is a list, not a
 * component, and both callers already hold the namespace.
 */
export function providerSortOptions(
  t: (key: string) => string,
): ReadonlyArray<SortDropdownOption<DirectorySort>> {
  return [
    { value: undefined, label: t("sortOption.default") },
    { value: "rating", label: t("sortOption.rating") },
    { value: "reviews", label: t("sortOption.reviews") },
    { value: "price", label: t("sortOption.price") },
    { value: "name", label: t("sortOption.name") },
  ];
}

/**
 * Writes the chosen order and resets to the first page — page 3 of "best
 * rated" is not page 3 of "cheapest".
 *
 * `directorySearch` is what keeps every other filter and writes the default
 * order as an absent parameter rather than `sort=relevance`; `/providers` and
 * `/providers?sort=relevance` would otherwise be one page at two URLs.
 *
 * Curried on the router and the search so both placements of the control hand
 * it the same three arguments, for the same reason `providerSortOptions` is
 * one list: a second copy is a second thing to forget to fix.
 */
export function chooseProviderSort(
  navigate: ReturnType<typeof useNavigate>,
  current: DirectorySearch,
): (value: DirectorySort | undefined) => void {
  return (value) =>
    void navigate({
      to: "/providers",
      search: directorySearch(current, { sort: value, offset: undefined }),
    });
}


/**
 * How many narrowings are on.
 *
 * `q` is not one of them, for the same reason `clearedDirectorySearch` keeps
 * it: the typed term belongs to the search bar, and a count that included it
 * would put a number on a control that offers no way to take it off. See R18.
 */
function appliedCount(current: DirectorySearch): number {
  return activeChips(current, undefined).length;
}

/**
 * Every narrowing that is on, as the sidebar's "Filtros activos" lists them:
 * `directoryFilterChips` without the term, plus the category, which that
 * function leaves to the heading. The city chip says just the place.
 */
function activeChips(
  current: DirectorySearch,
  categoryName: string | undefined,
): Array<{ key: string; label: string | { key: string; values?: Record<string, string | number> }; next: DirectorySearch }> {
  const chips = directoryFilterChips(current)
    .filter((c) => c.key !== "q")
    .map((c) => ({
      key: c.key,
      label: c.key === "city" && current.city ? current.city : c.label,
      next: c.next,
    }));
  return current.category
    ? [
        {
          key: "category",
          label: categoryName ?? current.category,
          next: directorySearch(current, { category: undefined, offset: undefined }),
        },
        ...chips,
      ]
    : chips;
}

/**
 * The link that takes every narrowing off at once, or nothing at all.
 *
 * Nothing to clear is not a disabled link — it is no link. Gated on the chips
 * other than `q`: the term belongs to the search bar, so a search with only a
 * typed term on gets no clear-all. One component, two placements: the
 * sidebar's head and the sheet's footer.
 *
 * `onNavigate` is the sheet's way of closing behind itself; it sits in the
 * footer, outside the `closeOnChoice` wrapper that closes on a chosen option.
 */
function ClearAll({ current, onNavigate }: { current: DirectorySearch; onNavigate?: () => void }) {
  const { t } = useTranslation("directory");
  if (appliedCount(current) === 0) return null;

  return (
    <Link
      to="/providers"
      activeOptions={EXACT_MATCH}
      search={clearedDirectorySearch(current)}
      {...(onNavigate ? { onClick: onNavigate } : {})}
      className="inline-flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap text-[var(--color-primary)] hover:underline"
    >
      <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
      {t("filtersClearAll")}
    </Link>
  );
}

/**
 * The directory's filters as a sticky card down the left of the results,
 * from `lg` — the October 2026 list-with-sidebar mockup.
 *
 * Only the groups this API can apply: city, category, rating floor, price,
 * kind of provider and verified. The mockup's "Responde rápido" is not here:
 * nothing records how fast anybody answers. The rating tiles are the
 * thresholds the API takes (`RATING_THRESHOLDS`), not the mockup's 4/4.5/5.
 *
 * Every option is a **link**, never a form control, so there is no "Aplicar
 * filtros" button — each choice applies as it is made. See `FilterSidebar`.
 */
export function ProviderSidebar({ current }: { current: DirectorySearch }) {
  const { t } = useTranslation("directory");
  const categories = useCategoryPreview(CATEGORY_FILTER_LIMIT).data?.items ?? [];
  const categoryName = categories.find((c) => c.code === current.category)?.name;
  const chips = activeChips(current, categoryName);

  return (
    <FilterSidebar
      title={t("filtersTitle")}
      clear={<ClearAll current={current} />}
      active={
        chips.length > 0 ? (
          <ActiveFilters label={t("filtersActive", { count: chips.length })}>
            {chips.map((chip) => {
              const label = typeof chip.label === "string" ? chip.label : t(chip.label.key, chip.label.values ?? {});
              return (
                <Link
                  key={chip.key}
                  to="/providers"
                  activeOptions={EXACT_MATCH}
                  search={chip.next}
                  aria-label={t("filterPillRemove", { filter: label })}
                  className={ACTIVE_CHIP_CLASS}
                >
                  <span className="truncate">{label}</span>
                  <X className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} aria-hidden="true" />
                </Link>
              );
            })}
          </ActiveFilters>
        ) : undefined
      }
    >
      <div className="mt-5">
        <ProviderFilterSections current={current} />
      </div>
    </FilterSidebar>
  );
}

/**
 * Every group, in the order the sidebar and the sheet both draw them — one
 * definition, two placements.
 */
function ProviderFilterSections({ current }: { current: DirectorySearch }) {
  const { t, i18n } = useTranslation("directory");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const cities = useProviderCities();
  // Lowest floor first, after "all", the way the mockup reads them.
  const floors = [...RATING_THRESHOLDS].sort((a, b) => a - b);
  return (
    <>
      {cities.length > 1 && (
        <SidebarSection icon={MapPin} label={t("filterCity")}>
          <CityOptions current={current} />
        </SidebarSection>
      )}

      <SidebarSection icon={LayoutGrid} label={t("filterCategories")}>
        <CategoryOptions current={current} />
      </SidebarSection>

      <SidebarSection icon={Star} label={t("filterRatingMin")} hint={t("filterRatingHint")}>
        <div className="grid grid-cols-4 gap-2">
          <OptionLink
            look="tile"
            icon={Star}
            label={t("filterRatingAny")}
            active={current.minRating == null}
            search={directorySearch(current, { minRating: undefined, offset: undefined })}
          />
          {floors.map((v) => (
            <OptionLink
              key={v}
              look="tile"
              icon={Star}
              star
              label={t("filterRatingTile", { score: formatRating(v, locale) })}
              aria={t("filterRatingOption", { score: formatRating(v, locale) })}
              active={current.minRating === v}
              search={directorySearch(current, {
                minRating: current.minRating === v ? undefined : v,
                offset: undefined,
              })}
            />
          ))}
        </div>
      </SidebarSection>

      {/* The one group that is not a closed set, so the one that is not
          links — see `DirectoryPriceFilter`. No slider: it would need an
          apply step the rest of the card does not have. */}
      <SidebarSection icon={CircleDollarSign} label={t("filterPrice")}>
        <DirectoryPriceFilter current={current} />
      </SidebarSection>

      <SidebarSection icon={Users} label={t("filterProviderKindTitle")}>
        <div className="grid grid-cols-2 gap-2">
          {PROVIDER_KINDS.map((v) => (
            <OptionLink
              key={v}
              look="tile"
              icon={v === "individual" ? User : Building2}
              label={t(`filterProviderKindTile.${v}`)}
              sub={t(`filterProviderKindTileHint.${v}`)}
              active={current.providerType === v}
              search={directorySearch(current, {
                providerType: current.providerType === v ? undefined : v,
                offset: undefined,
              })}
            />
          ))}
        </div>
      </SidebarSection>

      {/* A switch, because there is nothing to choose between — only on or
          off. Still a link: `verified: false` is never written, see
          `directorySearch`, so turning it off is dropping the parameter. */}
      <section className="mt-5 border-t border-[var(--color-border)] pt-5">
        <Link
          to="/providers"
          activeOptions={EXACT_MATCH}
          search={directorySearch(current, { verified: !current.verified, offset: undefined })}
          aria-pressed={current.verified === true}
          className="flex items-center gap-2.5 text-[14px] font-medium text-[var(--color-ink-2)]"
        >
          <ShieldCheck className="h-[17px] w-[17px] shrink-0 text-[var(--color-headline)]" strokeWidth={2.2} aria-hidden="true" />
          {t("filterVerifiedSwitch")}
          <SwitchMark on={current.verified === true} />
        </Link>
        <p className="type-caption mt-1.5 pl-[27px] text-[var(--color-muted-foreground)]">
          {t("filterVerificationHint")}
        </p>
      </section>
    </>
  );
}

/**
 * The filters on a phone: one navy control at the thumb, opening a sheet that
 * holds the sidebar's own sections.
 *
 * Two halves, because a control with one half is a button: the filters, with
 * how many are on, and the same `SortDropdown` the heading row carries — the
 * heading's copy is `hidden lg:inline-flex`, so a phone shows exactly one
 * sort. Its options and its chooser are `providerSortOptions` and
 * `chooseProviderSort`, the same two the page hands its own copy.
 *
 * The mockup draws "Filtros / Mapa" here rather than a sort. There is no map
 * — providers carry a city and a district, never a point — so this capsule
 * is the services page's two halves rather than a toggle that goes nowhere.
 *
 * Its footer button states the outcome — "Show 38 results" — rather than
 * saying "Apply", because a reader should know what they did before they
 * commit to it, not after.
 */
export function MobileProviderFilters({
  current,
  total,
}: {
  current: DirectorySearch;
  /** How many results the current search matched, for the sheet's own button. */
  total: number;
}) {
  const { t } = useTranslation("directory");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const count = appliedCount(current);

  return (
    <>
      <FloatingControls>
        <button type="button" onClick={() => setOpen(true)} className={floatingControlClass()}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {t("filtersTitle")}
          {/* Beside the word rather than in a badge on top of it: the capsule
              is one line of text, and a counter bubble on a 44px control is a
              second thing to aim at. */}
          {count > 0 && ` · ${String(count)}`}
        </button>

        <SortDropdown
          active={current.sort}
          options={providerSortOptions(t)}
          sortLabel={t("sortTrigger")}
          triggerClassName={floatingControlClass()}
          onChoose={chooseProviderSort(navigate, current)}
        />
      </FloatingControls>

      <FilterSheet
        open={open}
        onOpenChange={setOpen}
        title={t("filtersTitle")}
        clear={<ClearAll current={current} onNavigate={() => setOpen(false)} />}
        apply={t("filterSheetApply", { count: total })}
        onApply={() => setOpen(false)}
      >
        <ProviderFilterSections current={current} />
      </FilterSheet>
    </>
  );
}

/** How many cities show as chips before the rest fold behind "Outras cidades". */
const VISIBLE_CITIES = 4;

/**
 * The cities as chips, the busiest first and the rest behind "Outras
 * cidades". A chosen city is always among the visible ones, so the chip that
 * says what is on is never folded away.
 */
function CityOptions({ current }: { current: DirectorySearch }) {
  const { t } = useTranslation("directory");
  const cities = useProviderCities();
  const head = cities.slice(0, VISIBLE_CITIES);
  const tail = cities.slice(VISIBLE_CITIES);
  const chosen = tail.find((c) => c.city === current.city);
  const shown = chosen ? [...head, chosen] : head;
  const folded = tail.filter((c) => c !== chosen);

  const chip = (c: { city: string }) => (
    <OptionLink
      key={c.city}
      look="chip"
      label={c.city}
      active={current.city === c.city}
      search={directorySearch(current, {
        city: current.city === c.city ? undefined : c.city,
        offset: undefined,
      })}
    />
  );

  return (
    <div className="flex flex-wrap gap-2">
      {shown.map(chip)}
      {folded.length > 0 && <MoreOptions label={t("filterCityMore")}>{folded.map(chip)}</MoreOptions>}
    </div>
  );
}

/**
 * The categories, as rows with their glyphs — "Todas as categorias" first.
 *
 * Every category in one request rather than a page of them: `SearchableOptions`
 * matches against what it holds, so a category left out of the response is one
 * a reader can type the name of and be told does not exist.
 */
function CategoryOptions({ current }: { current: DirectorySearch }) {
  const { t } = useTranslation("directory");
  const categories = useCategoryPreview(CATEGORY_FILTER_LIMIT).data?.items ?? [];

  return (
    <SearchableOptions
      searchLabel={t("filterCategorySearchLabel")}
      searchPlaceholder={t("filterCategorySearchPlaceholder")}
      noMatchLabel={(term) => t("filterCategoryNoMatch", { term })}
      lead={
        <OptionLink
          look="row"
          icon={LayoutGrid}
          label={t("filterCategoriesAll")}
          active={!current.category}
          search={directorySearch(current, { category: undefined, offset: undefined })}
        />
      }
      options={categories.map((c) => ({
        key: c.id,
        label: c.name,
        node: (
          <OptionLink
            look="row"
            icon={categoryIcon(c.icon)}
            label={c.name}
            active={current.category === c.code}
            search={directorySearch(current, {
              category: current.category === c.code ? undefined : c.code,
              offset: undefined,
            })}
          />
        ),
      }))}
    />
  );
}

/**
 * One option: a chip, a row or a tile, and always a link.
 *
 * It builds no search of its own — the group hands it the URL, which already
 * says "clicking the active one clears it". `aria-pressed` is what says it is
 * a toggle. `aria` names a tile whose visible text is a glyph and a number.
 */
function OptionLink({
  look,
  label,
  sub,
  aria,
  icon: Icon,
  star = false,
  active,
  search,
}: {
  look: "chip" | "row" | "tile";
  label: string;
  /** A tile's second line. */
  sub?: string;
  aria?: string;
  icon?: LucideIcon;
  /** Fill the glyph amber, for the rating tiles. */
  star?: boolean;
  active: boolean;
  search: DirectorySearch;
}) {
  const className =
    look === "chip"
      ? chipOptionClass(active)
      : look === "row"
        ? `${listOptionClass(active)} mb-1.5`
        : tileOptionClass(active);
  return (
    <Link
      to="/providers"
      activeOptions={EXACT_MATCH}
      search={search}
      aria-pressed={active}
      {...(aria ? { "aria-label": aria } : {})}
      className={className}
    >
      {Icon && (
        <Icon
          className={
            look === "tile"
              ? `h-[18px] w-[18px] ${star ? "fill-[var(--color-star)] text-[var(--color-star)]" : ""}`
              : "h-[17px] w-[17px] shrink-0"
          }
          strokeWidth={2}
          aria-hidden="true"
        />
      )}
      {look === "tile" ? (
        <span className="grid leading-tight">
          <span className="font-semibold">{label}</span>
          {sub && <span className="text-[11.5px] text-[var(--color-muted-foreground)]">{sub}</span>}
        </span>
      ) : (
        <span className="min-w-0 flex-1 truncate">{label}</span>
      )}
      {look === "row" && <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden="true" />}
    </Link>
  );
}
