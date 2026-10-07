import { useState } from "react";
import {
  Building2,
  ChevronRight,
  CircleDollarSign,
  House,
  Languages,
  LayoutGrid,
  MapPin,
  RotateCcw,
  SlidersHorizontal,
  User,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LOCALES } from "@ntizo/shared";
import { FilterSheet } from "@/shared/components/browse/filter-sheet";
import {
  ACTIVE_CHIP_CLASS,
  ActiveFilters,
  FilterSidebar,
  MoreOptions,
  SidebarSection,
  chipOptionClass,
  listOptionClass,
  tileOptionClass,
} from "@/shared/components/browse/filter-sidebar";
import {
  FloatingControls,
  floatingControlClass,
} from "@/shared/components/browse/floating-controls";
import {
  SortDropdown,
  type SortDropdownOption,
} from "@/shared/components/browse/sort-dropdown";
import { SearchableOptions } from "@/shared/components/browse/searchable-options";
import { EXACT_MATCH } from "@/shared/components/browse/active-match";
import {
  browseSearch,
  type BrowseSearch,
} from "@/features/directory/services/domain/browse-search";
import { browseFilterChips } from "@/features/directory/services/domain/browse-chips";
import type { BrowseSort } from "@/features/directory/services/domain/types";
import { useServiceCities } from "@/features/directory/services/viewmodel/use-browse-services";
import { PriceRangeFilter } from "@/features/directory/services/ui/price-range-filter";
import { categoryIcon } from "@/features/directory/services/ui/category-icon";
import {
  CATEGORY_FILTER_LIMIT,
  useCategoryPreview,
} from "@/features/landing/viewmodel/use-categories";

/**
 * The four places a service can happen.
 *
 * Spelled here rather than read from the server: they are a closed set the
 * database's own CHECK enforces, and a filter offering whatever happened to
 * be in the data would quietly lose an option the day nobody had chosen it
 * yet.
 */
export const LOCATION_TYPES = ["remote", "at_provider", "at_customer", "flexible"] as const;

/**
 * The three ways a customer can pay, as they experience them.
 *
 * Flattened from two fields — `bookingMode` and the default option's
 * `pricingMode` — because "fixed price, per hour, or ask" is one question to
 * a customer and two columns to the schema. See `SERVICE_PAYMENT_MODES`.
 */
export const PAYMENT_MODES = ["fixed", "hourly", "quote"] as const;

/** A person, or an establishment with staff. */
export const PROVIDER_KINDS = ["individual", "organization"] as const;

/**
 * The languages a listing can be written in.
 *
 * Taken from `LOCALES` rather than spelled again: this is the same closed set
 * the translation step offers a provider, and a language the platform gained
 * must appear here without anybody remembering this file.
 *
 * What it filters is which languages the *listing* is readable in — see
 * `filterLanguageHint`, which says so on screen. It is not a claim about what
 * the provider speaks, because nothing in the product records that yet.
 */
export const LANGUAGES = LOCALES;

/**
 * Everything the pill bar can narrow, taken off at once — but not what was
 * typed.
 *
 * The set `browseFilterChips` lists other than `q`, plus the category. The
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
export function clearedBrowseSearch(current: BrowseSearch): BrowseSearch {
  return browseSearch(current, {
    // The category came off the strip above the results and onto this bar, so
    // "clear all" owes it the same clearing as every other filter beside it.
    category: undefined,
    locationType: undefined,
    paymentMode: undefined,
    providerType: undefined,
    language: undefined,
    city: undefined,
    minPrice: undefined,
    maxPrice: undefined,
    offset: undefined,
  });
}

/**
 * Every order this browse offers, default first — `SortDropdown`'s menu.
 *
 * Written once because the page draws this control twice: on the heading's
 * right for a wide screen and inside the phone's floating capsule. Two copies
 * of the list is how a fourth order gets added to one of them and the phone
 * quietly goes on offering three, which is the same drift the `*Options`
 * components and `ClearAll` exist to prevent.
 *
 * Takes `t` rather than calling `useTranslation` itself: it is a list, not a
 * component, and both callers already hold the namespace.
 */
export function serviceSortOptions(
  t: (key: string) => string,
): ReadonlyArray<SortDropdownOption<BrowseSort>> {
  return [
    { value: undefined, label: t("sortOption.default") },
    { value: "newest", label: t("sortOption.newest") },
    { value: "price", label: t("sortOption.price") },
  ];
}

/**
 * Writes the chosen order and resets to the first page — page 4 of "cheapest"
 * is not page 4 of "newest".
 *
 * `browseSearch` is what keeps every other filter and writes the default order
 * as an absent parameter rather than `sort=default`; `/services` and
 * `/services?sort=default` would otherwise be one page at two URLs.
 *
 * Curried on the router and the search so both placements of the control hand
 * it the same three arguments, for the same reason `serviceSortOptions` is one
 * list: a second copy is a second thing to forget to fix.
 */
export function chooseServiceSort(
  navigate: ReturnType<typeof useNavigate>,
  current: BrowseSearch,
): (value: BrowseSort | undefined) => void {
  return (value) =>
    void navigate({
      to: "/services",
      search: browseSearch(current, { sort: value, offset: undefined }),
    });
}


/**
 * How many narrowings are on.
 *
 * `q` is not one of them, for the same reason `clearedBrowseSearch` keeps it:
 * the typed term belongs to the search bar, and a count that included it
 * would put a number on a control that offers no way to take it off. See R18.
 */
function appliedCount(current: BrowseSearch): number {
  return activeChips(current, undefined).length;
}

/**
 * Every narrowing that is on, as the sidebar's "Filtros activos" lists them:
 * `browseFilterChips` without the term, plus the category, which that
 * function leaves to the heading. Each carries the URL that removes it.
 *
 * The city chip says just the place; `browseFilterChips`' "em Maputo" reads
 * right beside the count of results, not as a chip of its own.
 */
function activeChips(
  current: BrowseSearch,
  categoryName: string | undefined,
): Array<{ key: string; label: string | { key: string; values?: Record<string, string | number> }; next: BrowseSearch }> {
  const chips = browseFilterChips(current)
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
          next: browseSearch(current, { category: undefined, offset: undefined }),
        },
        ...chips,
      ]
    : chips;
}

/**
 * The link that takes every narrowing off at once, or nothing at all.
 *
 * Nothing to clear is not a disabled link — it is no link. One component,
 * two placements: the sidebar's head and the sheet's footer. A second copy is
 * how the two started offering different URLs — the sheet's once cleared
 * the typed term the bar's kept.
 *
 * `onNavigate` is the sheet's way of closing behind itself; it sits in the
 * footer, outside the `closeOnChoice` wrapper that closes on a chosen option.
 */
function ClearAll({ current, onNavigate }: { current: BrowseSearch; onNavigate?: () => void }) {
  const { t } = useTranslation("directory");
  if (appliedCount(current) === 0) return null;

  return (
    <Link
      to="/services"
      activeOptions={EXACT_MATCH}
      search={clearedBrowseSearch(current)}
      {...(onNavigate ? { onClick: onNavigate } : {})}
      className="inline-flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap text-[var(--color-blue-edge)] hover:underline"
    >
      <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
      {t("filtersClearAll")}
    </Link>
  );
}

/**
 * The browse's filters as a sticky card down the left of the results, from
 * `lg` — the October 2026 list-with-sidebar mockup, with only the groups the
 * services API can apply.
 *
 * The mockup is the directory's: it has a rating floor, the verified switch
 * and "Responde rápido". The services API filters by none of those, so this
 * card carries what it does take — city, category, price, where it happens,
 * who provides it, how you pay and the listing's language. "Responde rápido"
 * is nowhere: nothing records how fast anybody answers.
 *
 * Every option is a **link**, never a form control, so there is no "Aplicar
 * filtros" button — each choice applies as it is made. See `FilterSidebar`.
 */
export function ServiceSidebar({ current }: { current: BrowseSearch }) {
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
                  to="/services"
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
        <ServiceFilterSections current={current} />
      </div>
    </FilterSidebar>
  );
}

/**
 * Every group, in the order the sidebar and the sheet both draw them.
 *
 * One definition, two placements: the sidebar from `lg`, the phone's sheet
 * below it. Two copies is how a phone quietly stops offering a filter its own
 * badge is counting.
 */
function ServiceFilterSections({ current }: { current: BrowseSearch }) {
  const { t } = useTranslation("directory");
  const cities = useServiceCities();
  return (
    <>
      {/* Only when there is more than one place to choose between. The hint
          is the one thing the chips cannot say for themselves: `?city=…`
          matches "this city OR remote", so a remote service shows in all of
          them. */}
      {cities.length > 1 && (
        <SidebarSection icon={MapPin} label={t("filterCity")} hint={t("filterCityHint")}>
          <CityOptions current={current} />
        </SidebarSection>
      )}

      <SidebarSection icon={LayoutGrid} label={t("filterCategories")}>
        <CategoryOptions current={current} />
      </SidebarSection>

      {/* The one group that is not a closed set, so the one that is not
          links — see `PriceRangeFilter`, which explains why a range has to
          be typed and submitted. No slider: it would need an apply step the
          rest of the card does not have. */}
      <SidebarSection icon={CircleDollarSign} label={t("filterPrice")}>
        <PriceRangeFilter current={current} />
      </SidebarSection>

      <SidebarSection icon={House} label={t("filterWhere")}>
        <div className="flex flex-wrap gap-2">
          {LOCATION_TYPES.map((v) => (
            <OptionLink
              key={v}
              look="chip"
              label={t(`filterWhereOption.${v}`)}
              active={current.locationType === v}
              search={browseSearch(current, {
                locationType: current.locationType === v ? undefined : v,
                offset: undefined,
              })}
            />
          ))}
        </div>
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
              search={browseSearch(current, {
                providerType: current.providerType === v ? undefined : v,
                offset: undefined,
              })}
            />
          ))}
        </div>
      </SidebarSection>

      <SidebarSection icon={Wallet} label={t("filterPayment")}>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_MODES.map((v) => (
            <OptionLink
              key={v}
              look="chip"
              label={t(`filterPaymentOption.${v}`)}
              active={current.paymentMode === v}
              search={browseSearch(current, {
                paymentMode: current.paymentMode === v ? undefined : v,
                offset: undefined,
              })}
            />
          ))}
        </div>
      </SidebarSection>

      {/* "Listing language" is a phrase a reader can only read one of two
          ways, and the wrong one — the language the provider speaks — is the
          one they actually want, so the group says which it is. */}
      <SidebarSection icon={Languages} label={t("filterLanguage")} hint={t("filterLanguageHint")}>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((v) => (
            <OptionLink
              key={v}
              look="chip"
              label={t(`filterLanguageOption.${v}`, { defaultValue: v })}
              active={current.language === v}
              search={browseSearch(current, {
                language: current.language === v ? undefined : v,
                offset: undefined,
              })}
            />
          ))}
        </div>
      </SidebarSection>
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
 * sort. Its options and its chooser are `serviceSortOptions` and
 * `chooseServiceSort`, the same two the page hands its own copy.
 *
 * Its footer button states the outcome — "Show 38 results" — rather than
 * saying "Apply", because a reader should know what they did before they
 * commit to it, not after.
 */
export function MobileServiceFilters({
  current,
  total,
}: {
  current: BrowseSearch;
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
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={floatingControlClass()}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {t("filtersTitle")}
          {/* Beside the word rather than in a badge on top of it: the capsule
              is one line of text, and a counter bubble on a 44px control is a
              second thing to aim at. */}
          {count > 0 && ` · ${String(count)}`}
        </button>

        <SortDropdown
          active={current.sort}
          options={serviceSortOptions(t)}
          sortLabel={t("sortTrigger")}
          triggerClassName={floatingControlClass()}
          onChoose={chooseServiceSort(navigate, current)}
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
        <ServiceFilterSections current={current} />
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
function CityOptions({ current }: { current: BrowseSearch }) {
  const { t } = useTranslation("directory");
  const cities = useServiceCities();
  const head = cities.slice(0, VISIBLE_CITIES);
  const tail = cities.slice(VISIBLE_CITIES);
  const chosen = tail.find((c) => c.city === current.city);
  const shown = chosen ? [...head, chosen] : head;
  const folded = tail.filter((c) => c !== chosen);

  const chip = (c: { city: string; count: number }) => (
    <OptionLink
      key={c.city}
      look="chip"
      label={c.city}
      active={current.city === c.city}
      search={browseSearch(current, {
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
 * a reader can type the name of and be told does not exist. See
 * `CATEGORY_FILTER_LIMIT`.
 */
function CategoryOptions({ current }: { current: BrowseSearch }) {
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
          search={browseSearch(current, { category: undefined, offset: undefined })}
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
            search={browseSearch(current, {
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
 * says "clicking the active one clears it": a filter you set by clicking
 * should come off the same way. `aria-pressed` is what says it is a toggle.
 */
function OptionLink({
  look,
  label,
  sub,
  icon: Icon,
  active,
  search,
}: {
  look: "chip" | "row" | "tile";
  label: string;
  /** A tile's second line. */
  sub?: string;
  icon?: LucideIcon;
  active: boolean;
  search: BrowseSearch;
}) {
  const className =
    look === "chip"
      ? chipOptionClass(active)
      : look === "row"
        ? `${listOptionClass(active)} mb-1.5`
        : tileOptionClass(active);
  return (
    <Link
      to="/services"
      activeOptions={EXACT_MATCH}
      search={search}
      aria-pressed={active}
      className={className}
    >
      {Icon && (
        <Icon
          className={look === "tile" ? "h-5 w-5" : "h-[17px] w-[17px] shrink-0"}
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
