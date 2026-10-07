import type { ComponentType, ReactNode, SVGProps } from "react";
import { ChevronDown, Filter } from "lucide-react";
import { cn } from "@ntizo/frontend-ui";

type Glyph = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * The browse pages' filters, as a sticky card down the left of the results
 * (October 2026 list-with-sidebar mockup), from `lg`.
 *
 * Every option inside is still a route-typed `<Link>` the page owns, so a
 * filtered list is a URL somebody can send, the back button undoes it, and
 * the whole card works before any script has run. That is also why there is
 * no "Aplicar filtros" button: the mockup draws one, but each choice already
 * applies as it is made, and a button that applied nothing would be a lie.
 * The price range is the one group typed rather than chosen, and it has its
 * own OK.
 *
 * Below `lg` it is not drawn; the floating capsule opens a `FilterSheet` that
 * holds the same sections. The sections are the page's, built once and
 * placed twice, so the two can never offer different filters.
 *
 * `top-[84px]`: the site header is sticky at 68px, and the card stops 16px
 * under it. It scrolls inside itself when it is taller than the window.
 */
export function FilterSidebar({
  title,
  clear,
  active,
  children,
}: {
  title: string;
  /** The page's "Limpar tudo" link, or nothing when nothing is narrowing. */
  clear?: ReactNode;
  /** The "Filtros activos" box, or nothing. See `ActiveFilters`. */
  active?: ReactNode;
  children: ReactNode;
}) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-[84px] max-h-[calc(100svh-100px)] overflow-y-auto rounded-[14px] border border-[var(--color-line-2)] bg-[var(--color-card)] p-5 shadow-[0_2px_10px_rgba(30,60,120,.05)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2.5 text-[20px] font-extrabold text-[var(--color-headline)]">
            <Filter className="h-5 w-5 fill-[var(--color-primary)] text-[var(--color-primary)]" aria-hidden="true" />
            {title}
          </h2>
          {clear}
        </div>
        {active}
        {children}
      </div>
    </aside>
  );
}

/**
 * "Filtros activos (n)" and a chip per narrowing, each chip the page's own
 * link to the same URL without it. Nothing at all when nothing is on.
 */
export function ActiveFilters({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-4 rounded-[12px] bg-[var(--color-muted)] p-3.5">
      <p className="text-[14px] font-semibold text-[var(--color-headline)]">{label}</p>
      <div className="mt-2.5 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** One active filter's chip — the page's `<Link>` wears this, with an `×` inside. */
export const ACTIVE_CHIP_CLASS =
  "inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--color-blue-line)] bg-[var(--color-card)] py-1 pr-2 pl-3 text-[13px] font-medium text-[var(--color-info-fg)] hover:bg-[var(--color-blue-soft)]";

/**
 * One headed group: a glyph, a name, the options.
 *
 * Inside the sheet the same section is used, which is why it carries its
 * own top rule rather than relying on the card's padding.
 */
export function SidebarSection({
  icon: Icon,
  label,
  hint,
  children,
}: {
  icon: Glyph;
  label: string;
  /** A line under the heading, where the label alone would overclaim. */
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-5 border-t border-[var(--color-border)] pt-5 first:mt-0 first:border-t-0 first:pt-0">
      <h3 className="flex items-center gap-2.5 text-[15px] font-bold text-[var(--color-headline)]">
        <Icon className="h-[17px] w-[17px] text-[var(--color-headline)]" strokeWidth={2.2} aria-hidden="true" />
        {label}
      </h3>
      {hint && (
        <p className="type-caption mt-1.5 text-[var(--color-muted-foreground)]">{hint}</p>
      )}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** A city, as a chip: filled blue once chosen. */
export function chipOptionClass(active: boolean): string {
  return cn(
    "inline-flex h-9 items-center justify-center rounded-full border px-4 text-[13.5px] font-medium whitespace-nowrap transition-colors",
    active
      ? "border-[var(--color-blue-public)] bg-[var(--color-blue-public)] text-[var(--color-primary-foreground)]"
      : "border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-ink-2)] hover:border-[var(--color-blue-line)]",
  );
}

/** A category row: its glyph, its name, a chevron; tinted once chosen. */
export function listOptionClass(active: boolean): string {
  return cn(
    "flex min-h-10 w-full items-center gap-3 rounded-[10px] border px-3 py-2 text-[14px] transition-colors",
    active
      ? "border-[var(--color-blue-line)] bg-[var(--color-blue-soft)] font-semibold text-[var(--color-info-fg)]"
      : "border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-ink-2)] hover:border-[var(--color-blue-line)]",
  );
}

/** A tile — a rating floor, a kind of provider: outlined in blue once chosen. */
export function tileOptionClass(active: boolean): string {
  return cn(
    "flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-[10px] border px-2 py-2 text-center text-[13px] font-medium transition-colors",
    active
      ? "border-[var(--color-blue-public)] bg-[var(--color-blue-soft)] text-[var(--color-info-fg)] ring-1 ring-[var(--color-blue-public)]"
      : "border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-ink-2)] hover:border-[var(--color-blue-line)]",
  );
}

/**
 * The picture of a switch, for an on/off filter that is a link.
 *
 * Decoration only: the link around it carries `aria-pressed`, which is what
 * says it is a toggle and whether it is on.
 */
export function SwitchMark({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative ml-auto inline-flex h-6 w-11 shrink-0 rounded-full transition-colors",
        on ? "bg-[var(--color-blue-public)]" : "bg-[var(--color-border-strong)]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-[var(--color-background)] shadow transition-[left]",
          on ? "left-[22px]" : "left-0.5",
        )}
      />
    </span>
  );
}

/**
 * Options past the first few, behind one more chip — "Outras cidades".
 *
 * A `<details>`, so the links inside stay in the document for a crawler and
 * the disclosure opens with no script. Closed, it is one more chip in the
 * row; open, it takes a row of its own under the chip.
 */
export function MoreOptions({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group open:w-full">
      <summary
        className={cn(
          chipOptionClass(false),
          "cursor-pointer list-none gap-1.5 [&::-webkit-details-marker]:hidden",
        )}
      >
        {label}
        <ChevronDown
          className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
          strokeWidth={2.4}
          aria-hidden="true"
        />
      </summary>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </details>
  );
}
