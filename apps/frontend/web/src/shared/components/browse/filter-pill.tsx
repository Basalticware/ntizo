import { useEffect, useRef, type ComponentType, type ReactNode, type SVGProps } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

/**
 * One group of filters, as a pill that opens a small panel.
 *
 * **A `<details>`, not a menu.** `FacetGroup` already proved the pattern in
 * this codebase: it opens and closes with no script, it is keyboard-operable
 * and announced correctly without a line of ARIA, and it survives the
 * server-rendered first paint — which matters on a page built to be crawled,
 * where the filters are links a crawler should be able to follow.
 *
 * The options inside stay route-typed `<Link>`s owned by the page, so a
 * filtered list is still a URL somebody can send and the back button still
 * undoes it.
 */
export function FilterPill({
  label,
  active,
  clear,
  icon: Icon,
  id,
  panelClassName,
  children,
}: {
  /** Extra classes on the panel — the "more filters" pill lays its groups out wider. */
  panelClassName?: string;
  /** On the `<details>`, so something else on the page can open this pill. */
  id?: string;
  /**
   * A glyph at the pill's start — the list mockup draws one on every pill.
   * Decoration: the label is the pill's name.
   */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  /** The chosen option's label. Present means applied, and the pill fills. */
  active?: string | undefined;
  /** The page's own `<Link>` back to this URL without this parameter. */
  clear?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  // Progressive enhancement, both of them: without JavaScript the panel still
  // opens and still closes on its own summary, which is the floor. With it,
  // Escape and a click outside behave the way every other popover on the web
  // does.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) ref.current.removeAttribute("open");
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Only a pill that is actually open. This listener is on the document,
      // so every pill on the page hears every Escape, and focusing from a
      // closed one would take focus off whatever the reader was on.
      const pill = ref.current;
      if (!pill?.hasAttribute("open")) return;
      pill.removeAttribute("open");
      // Focus goes back to the summary that opened it: closing the panel
      // leaves the reader standing on an element that no longer renders,
      // which drops focus to `<body>` and sends the next Tab back to the top
      // of the document.
      pill.querySelector<HTMLElement>("summary")?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const on = active != null;
  return (
    <div className="relative inline-flex">
      <details ref={ref} id={id}>
        <summary
          /* Once applied, the pill draws the chosen option in place of the
             group's own name — "Fixed price", with "How you pay" gone — and a
             reader who cannot see the six pills beside it has no way to tell
             which group that answers. The label says both; the visible text
             stays the one word the design wants. */
          {...(on ? { "aria-label": `${label}: ${active}` } : {})}
          className={[
            // `font-medium` is in the base, not in the branches: an applied
            // pill that turned semibold grew, and the pill after it moved.
            // Only the colours say which one is on — the same rule
            // `pagerPageClass` and `facetOptionClass` keep.
            // A squared 44px box rather than a 38px capsule (October 2026 list
            // mockup): the bar reads as a row of fields, each with its glyph,
            // beside the one filled "Filtrar" button at its end.
            "flex h-11 cursor-pointer list-none items-center gap-2.5 rounded-[10px] border pr-3.5 pl-3.5 text-[13.5px] font-medium whitespace-nowrap transition-colors [&::-webkit-details-marker]:hidden",
            on
              ? "border-[var(--color-blue-line)] bg-[var(--color-blue-soft)] text-[var(--color-info-fg)]"
              : "border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-ink-2)] hover:border-[var(--color-blue-line)]",
            clear ? "pr-9" : "",
          ].join(" ")}
        >
          {Icon && <Icon aria-hidden="true" className="h-[17px] w-[17px] shrink-0" strokeWidth={2} />}
          {active ?? label}
          {!on && (
            <ChevronDown className="ml-1 h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
          )}
        </summary>
        <div
          className={`absolute top-[calc(100%+6px)] left-0 z-20 grid min-w-56 rounded-[var(--radius-card-sm)] border border-[var(--color-border)] bg-[var(--color-background)] p-3 shadow-[var(--shadow-float)] ${panelClassName ?? ""}`}
        >
          {children}
        </div>
      </details>
      {/* Outside the summary on purpose: a link inside it both navigates and
          toggles the disclosure, and which of the two wins is a browser
          detail rather than a decision. */}
      {clear && <span className="absolute top-1/2 right-2.5 -translate-y-1/2">{clear}</span>}
    </div>
  );
}

/**
 * The small link that sits on a filled pill and takes just that filter off.
 *
 * The pill's own styling — it is sized to the pill's `pr-9`, and it wears the
 * navy fill's `--color-navy-on` because that is the ground it sits on — so it
 * lives with the pill rather than with either page's copy of it. The `<Link>`
 * itself stays the page's: only the page knows the route and the search it
 * goes back to. See `FilterPill`'s `clear` for why it is outside the summary.
 */
export const PILL_CLEAR_CLASS =
  "grid h-[18px] w-[18px] place-items-center rounded-full text-[var(--color-info-fg)] transition-colors hover:bg-[var(--color-blue-line)]";

/**
 * The row the pills sit in, above the results and under the heading.
 *
 * **The desktop's only.** A toolbar of six popovers does not fit a thumb: below
 * `lg` it would wrap onto three rows of small targets between the reader and
 * the first result, and the phone already carries these same filters twice
 * over — as the quick chips above the results and as the stacked groups inside
 * the sheet the floating control opens. Three surfaces for one job is two too
 * many, so this one draws at exactly the width the other two hide at.
 *
 * The pills stay in the document either way, which is deliberate: they are
 * `<Link>`s a crawler should follow, and hiding them in CSS keeps them
 * followable while taking them off the phone's screen.
 *
 * **A few pills, then "Filtrar".** The bar used to wrap six or seven pills
 * onto two rows, then held four and a "More filters" pill. Since the October
 * 2026 list mockup it holds the filters a reader reaches for first and ends in
 * one filled button that opens the same sheet the phone's capsule opens, with
 * every group in it — see `FilterButton`. Which filters sit on the bar is
 * fixed per page, not worked out from the width, so it needs no
 * `ResizeObserver`.
 */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 hidden flex-wrap items-center gap-x-3 gap-y-2.5 lg:flex">
      {children}
    </div>
  );
}

/**
 * The bar's last control: the filled blue "Filtrar" that opens the page's
 * `FilterSheet` with every group in it.
 *
 * A button, not a `<details>`: what it opens is a dialog, and the pills
 * beside it already put the bar's links in the document for a crawler. The
 * count of filters on rides beside the word, as on the phone's capsule.
 * `ml-auto` pushes it to the bar's end, where the mockup draws it.
 */
export function FilterButton({
  label,
  count,
  onClick,
}: {
  label: string;
  /** How many narrowings are on; nothing is drawn for zero. */
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-auto inline-flex h-11 min-w-[150px] items-center justify-center gap-2.5 rounded-[10px] bg-[var(--color-blue-public)] px-6 text-[14px] font-semibold text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
    >
      <SlidersHorizontal className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
      {label}
      {count > 0 && ` · ${String(count)}`}
    </button>
  );
}
