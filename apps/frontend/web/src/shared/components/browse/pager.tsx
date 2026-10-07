import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  pageNumbers,
  type PageSlot,
} from "@/shared/components/browse/domain/page-numbers";

/**
 * Numbered paging.
 *
 * Replaces a bare previous/next pair, which could say how to step but never how
 * far there was to go — a reader on page one of eight had no way to learn there
 * were eight. It became possible only once both listings returned a `total`.
 *
 * `renderPage` rather than a `to`/`search` pair: each page's links are typed
 * against its own route and its own search model, and a shared component that
 * built them would have to erase both.
 */
export function Pager({
  total,
  pageSize,
  offset,
  label,
  renderPage,
  previous,
  next,
}: {
  total: number;
  pageSize: number;
  offset: number;
  label: string;
  renderPage: (slot: Exclude<PageSlot, "gap">) => ReactNode;
  previous?: ReactNode;
  next?: ReactNode;
}) {
  const slots = pageNumbers(total, pageSize, offset);
  if (slots.length === 0) return null;

  return (
    <nav aria-label={label} className="flex items-center justify-center gap-1.5 pt-9">
      {previous}
      {slots.map((slot, i) =>
        slot === "gap" ? (
          // Not a link, and not focusable: a "…" a keyboard user can reach is
          // a tab stop that goes nowhere.
          <span
            // The index is the only stable identity a gap has — there is no
            // page number behind it, and two gaps in one pager are otherwise
            // indistinguishable.
            key={`gap-${String(i)}`}
            aria-hidden="true"
            className="type-body-medium grid h-9 w-9 place-items-center text-[var(--color-muted-foreground)]"
          >
            …
          </span>
        ) : (
          renderPage(slot)
        ),
      )}
      {next}
    </nav>
  );
}

/**
 * One page number, as a small square (October 2026 list mockup: ‹ 1 2 ›).
 *
 * The current page is filled headline navy — the same fill the phone's
 * floating control wears, because both say "this one is on" rather than
 * "press me". The rest are outlined in the light line, the same box the
 * arrows either side wear, so the row reads as one control.
 *
 * Only the colours move between the two states, never the size — a number
 * that grew when it became current would shift every number after it as the
 * reader paged, which is the same rule `facetOptionClass` and
 * `FilterPill`'s own summary follow. The weight is the size: both states take
 * `type-body-medium`'s 500 and neither adds a `font-*` of its own.
 */
export function pagerPageClass(current: boolean): string {
  const base =
    "type-body-medium grid h-9 min-w-9 place-items-center rounded-[8px] border px-2.5 transition-colors";
  return current
    ? `${base} border-[var(--color-navy-surface)] bg-[var(--color-navy-surface)] text-[var(--color-navy-on)]`
    : `${base} border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-ink-2)] hover:border-[var(--color-headline)]`;
}

/** The ‹ and › either side of the numbers, the numbers' own box. */
export const PAGER_EDGE_CLASS =
  "grid h-9 w-9 place-items-center rounded-[8px] border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-headline)]";

/**
 * The arrow inside an edge link. The page's `<Link>` carries the words as its
 * `aria-label` — a bare "‹" says nothing to a screen reader.
 */
export function PagerChevron({ direction }: { direction: "previous" | "next" }) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;
  return <Icon className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />;
}

/**
 * An edge the reader cannot step to — page one's ‹, the last page's ›.
 *
 * Drawn, faded, rather than left out, so the numbers do not shift sideways
 * between the first page and the second. Not a link and not focusable, and
 * hidden from assistive technology: a control that goes nowhere is a tab
 * stop that goes nowhere.
 */
export function PagerEdgeOff({ direction }: { direction: "previous" | "next" }) {
  return (
    <span
      aria-hidden="true"
      data-testid={`pager-${direction}-off`}
      className={`${PAGER_EDGE_CLASS} pointer-events-none opacity-40`}
    >
      <PagerChevron direction={direction} />
    </span>
  );
}
