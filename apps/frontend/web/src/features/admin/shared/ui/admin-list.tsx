import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Filter, Search } from "lucide-react";
import { Avatar, AvatarFallback, Input, Select, cn, type SelectOption } from "@ntizo/frontend-ui";
import { CollectionCard } from "@/shared/components/collection-card";
import { StatusTabs, type StatusTab } from "@/shared/components/status-tabs";
import { initialsFrom } from "@/shared/lib/initials";
import { shortDate } from "@/shared/lib/relative-day";

/**
 * The admin console's list screens, as the October mockups draw them
 * (`docs/design/2026-10-mockups/admin/admin.css`): a row of status tabs, then
 * a row of search, inline filters and Filtrar, then the table, then the count
 * and the pager on one line under it.
 *
 * The workspace's lists put tabs and search on one toolbar inside
 * `CollectionCard`; the admin's are "a size smaller" and stack them. Rather
 * than a second table, the rows are still `CollectionCard`'s — the same row
 * description, the same phone cards, skeletons and empty states — and this
 * file draws the toolbar and the footer around it and takes the table down to
 * the admin measurements.
 */

/** The status tabs at the admin size: 50px boxes 21px apart, 30px count chips. */
export function AdminTabs<K extends string>(props: {
  tabs: readonly StatusTab<K>[];
  value: K;
  onChange: (key: K) => void;
  ariaLabel: string;
}) {
  return (
    <StatusTabs
      {...props}
      className={cn(
        "gap-[21px]",
        "[&>button]:h-[50px] [&>button]:gap-6 [&>button]:pr-7 [&>button]:pl-[22px] [&>button]:text-[15.5px]",
        "[&>button>span]:h-[30px] [&>button>span]:rounded-[15px] [&>button>span]:px-3 [&>button>span]:text-base [&>button>span]:font-medium",
      )}
    />
  );
}

/**
 * The row above an admin list: the tabs on the left and the search (with
 * Filtrar) on the right, on one line when they fit and wrapped under the tabs
 * when they do not.
 */
export function AdminToolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-x-[21px] gap-y-5">{children}</div>;
}

/** The filter bar's width inside `AdminToolbar`: it grows into the free space up to a comfortable search width. */
export const TOOLBAR_SEARCH_CLASS = "min-w-[280px] flex-1 justify-end xl:max-w-[520px] [&>div:first-child]:lg:max-w-none";

/**
 * Search on the left, any filters the server can apply beside it, and
 * Filtrar at the far right for the rest.
 */
export function AdminFilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  onOpenFilters,
  activeFilterCount = 0,
  children,
  className,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  onOpenFilters?: () => void;
  activeFilterCount?: number;
  /** Inline `AdminFilterSelect`s. */
  children?: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation("provider");
  return (
    <div className={cn("flex flex-wrap items-center gap-[19px]", className)}>
      <div className="relative min-w-[200px] flex-1 lg:max-w-[555px]">
        <Search className="pointer-events-none absolute top-1/2 left-[18px] h-[22px] w-[22px] -translate-y-1/2 text-[var(--color-primary)]" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-[47px] rounded-[10px] pl-[58px] text-[15.5px] placeholder:text-[var(--color-faint)]"
        />
      </div>
      {children}
      {onOpenFilters && (
        <button
          type="button"
          onClick={onOpenFilters}
          // Named explicitly: the label is hidden below `sm`.
          aria-label={t("peopleFilter")}
          className="ml-auto inline-flex h-[47px] shrink-0 items-center justify-center gap-3.5 rounded-[10px] border border-[var(--color-blue-outline)] bg-[var(--color-card)] px-[22px] text-[17px] font-semibold text-[var(--color-primary)] hover:bg-[color-mix(in_srgb,var(--color-primary)_6%,transparent)] sm:min-w-[134px]"
        >
          <Filter className="h-[22px] w-[22px]" aria-hidden="true" />
          <span className="hidden sm:inline">{t("peopleFilter")}</span>
          {activeFilterCount > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--color-primary)] px-1.5 text-[11px] font-semibold text-[var(--color-primary-foreground)]">
              {activeFilterCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

/**
 * One inline filter: the field's name on the trigger until something is
 * chosen. The "all" option is offered only once a value is set — it is the
 * way back, and before then the placeholder already says it.
 */
export function AdminFilterSelect({
  id,
  label,
  value,
  onChange,
  allLabel,
  options,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: readonly SelectOption[];
  className?: string;
}) {
  return (
    <Select
      id={id}
      value={value}
      onChange={onChange}
      ariaLabel={label}
      placeholder={label}
      options={value ? [{ value: "", label: allLabel }, ...options] : options}
      className={cn("w-full sm:w-[195px]", className)}
      triggerClassName="flex h-[47px] w-full items-center justify-between gap-2.5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-card)] pr-[18px] pl-[17px] text-left text-[15px] text-[var(--color-headline)] hover:border-[var(--color-blue-line)] focus-visible:border-[var(--color-primary)] focus-visible:outline-none"
    />
  );
}

/**
 * The table at the admin measurements: a 43px header and 67.5px rows, 16px
 * in from the frame. `CollectionCard`'s own toolbar and count line are
 * hidden — the page draws `AdminFilterBar` above and `AdminListFoot` below.
 */
const ADMIN_TABLE_CLASS = cn(
  "min-w-0",
  "[&>section>div:first-child]:hidden [&>section>div:last-child]:hidden",
  "[&_thead_tr]:h-[43px] [&_th]:text-[14.5px]",
  "[&_tbody_tr]:h-[67.5px] [&_tbody_td]:py-0 [&_tbody_td:first-child]:pl-4",
);

type AdminTableProps = Omit<
  ComponentProps<typeof CollectionCard>,
  "search" | "onSearchChange" | "searchPlaceholder" | "onOpenFilters" | "activeFilterCount" | "tabs" | "action"
>;

export function AdminTable(props: AdminTableProps) {
  return (
    <div className={ADMIN_TABLE_CLASS}>
      <CollectionCard {...props} />
    </div>
  );
}

/** A monogram, the name — usually the row's link — and one line under it. */
export function AdminPerson({
  name,
  title,
  sub,
  compact = false,
  className,
}: {
  /** For the monogram; `title` is what is drawn. */
  name: string;
  title: ReactNode;
  sub?: ReactNode;
  /** A 44px monogram, for a table that is a card on a page rather than the page. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center", compact ? "gap-4" : "gap-[25px]", className)}>
      <Avatar className={cn("shrink-0", compact ? "h-11 w-11" : "h-[54px] w-[54px]")}>
        <AvatarFallback className="bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] text-sm font-semibold text-[var(--color-primary)]">
          {initialsFrom(name)}
        </AvatarFallback>
      </Avatar>
      <div className="grid min-w-0 leading-[18px]">
        <div className="truncate text-[15.5px] font-bold text-[var(--color-headline)]">{title}</div>
        {sub && (
          <div className="mt-[5px] flex min-w-0 items-center gap-1.5 truncate text-sm leading-tight text-[var(--color-muted-foreground)]">
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * "A mostrar 1–8 de 123" on the left, the pager on the right.
 *
 * `total` is null where the server does not count the list; the line then
 * says only the range, and the pager offers the next page while the server
 * says there is one.
 */
export function AdminListFoot({
  label,
  offset,
  pageSize,
  total,
  onOffsetChange,
  hasNext = false,
}: {
  /** The whole sentence, already worded by the caller. Null hides it (e.g. while loading). */
  label: string | null;
  offset: number;
  pageSize: number;
  total: number | null;
  onOffsetChange: (offset: number) => void;
  /** Only read when `total` is null: whether the server has a page after this one. */
  hasNext?: boolean;
}) {
  const showPager = offset > 0 || (total !== null ? total > pageSize : hasNext);
  if (label === null && !showPager) return null;
  return (
    <div className="mt-2.5 flex min-h-[46px] flex-wrap items-center justify-between gap-3 text-[15.5px] text-[var(--color-muted-foreground)]">
      <span>{label}</span>
      {showPager && (
        <AdminPager
          offset={offset}
          pageSize={pageSize}
          total={total}
          hasNext={hasNext}
          onOffsetChange={onOffsetChange}
        />
      )}
    </div>
  );
}

/**
 * The pages to number: all of them up to seven, otherwise the first, the
 * last, and a window round the current one, with a gap marker between.
 */
export function pageItems(current: number, count: number): (number | "gap")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "gap", count];
  if (current >= count - 3) return [1, "gap", count - 4, count - 3, count - 2, count - 1, count];
  return [1, "gap", current - 1, current, current + 1, "gap", count];
}

function AdminPager({
  offset,
  pageSize,
  total,
  hasNext,
  onOffsetChange,
}: {
  offset: number;
  pageSize: number;
  total: number | null;
  hasNext: boolean;
  onOffsetChange: (offset: number) => void;
}) {
  const { t } = useTranslation("admin");
  const current = Math.floor(offset / pageSize) + 1;
  // Uncounted lists number only the page on screen: there is no last page
  // to put at the end, and a row of guesses would be worse than none.
  const count = total !== null ? Math.max(1, Math.ceil(total / pageSize)) : null;
  const canNext = count !== null ? current < count : hasNext;
  const items = count !== null ? pageItems(current, count) : [current];
  const step = "grid h-9 w-[35px] place-items-center rounded-lg text-[15.5px] tabular-nums";

  return (
    <nav aria-label={t("pager.label")} className="flex items-center">
      <button
        type="button"
        aria-label={t("pager.previous")}
        disabled={offset === 0}
        onClick={() => onOffsetChange(Math.max(0, offset - pageSize))}
        className="mr-2.5 grid h-9 w-6 place-items-center text-[var(--color-primary)] disabled:text-[var(--color-faint)] disabled:opacity-60"
      >
        <ChevronLeft className="h-[22px] w-[22px]" aria-hidden="true" />
      </button>
      {items.map((item, i) =>
        item === "gap" ? (
          <span key={`gap-${i}`} className={step} aria-hidden="true">
            …
          </span>
        ) : item === current ? (
          <span
            key={item}
            aria-current="page"
            className={cn(step, "w-[37px] bg-[var(--color-blue-soft)] font-bold text-[var(--color-primary)]")}
          >
            {item}
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onOffsetChange((item - 1) * pageSize)}
            className={cn(step, "hover:bg-[var(--color-blue-softer)]")}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label={t("pager.next")}
        disabled={!canNext}
        onClick={() => onOffsetChange(offset + pageSize)}
        className="grid h-9 w-10 place-items-center text-[var(--color-primary)] disabled:text-[var(--color-faint)] disabled:opacity-60"
      >
        <ChevronRight className="h-[22px] w-[22px]" aria-hidden="true" />
      </button>
    </nav>
  );
}

/**
 * A platform date as the admin mockups write it — "11 Out 2024" — in the
 * reader's own zone: these are moments on the platform (a sign-up, an
 * application), not appointments with a zone of their own.
 */
export function adminDate(iso: string, locale: string): string {
  return shortDate(iso, Intl.DateTimeFormat().resolvedOptions().timeZone, locale, { year: true });
}

/** The 1-based range a page shows, for the foot's sentence. */
export function pageRange(offset: number, shown: number): { from: number; to: number } {
  return shown === 0 ? { from: 0, to: 0 } : { from: offset + 1, to: offset + shown };
}
