import { cn } from "@ntizo/frontend-ui";
import type { StatusTab } from "./status-tabs";

/**
 * The joined row of tabs the Membros and Notificações mockups draw — one
 * outlined box split by hairlines, the chosen segment on the soft blue ground —
 * where Reservas draws `StatusTabs`' separate boxes. Same tab description, so
 * a list can move between the two without touching its data.
 *
 * A `danger` tone paints the chip red while unchosen: the mockups' "Não lidas"
 * count, the one number on the row that asks for attention.
 *
 * Scrolls sideways on a phone rather than wrapping, for the reason
 * `StatusTabs` gives: a wrapped tab row reads as two rows of filters.
 */
export function SegmentedTabs<K extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  tabs: readonly StatusTab<K>[];
  value: K;
  onChange: (key: K) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    // `min-w-0` and no `shrink-0`: in a wrapping toolbar the row must be
    // allowed to be narrower than its tabs, or a phone scrolls the whole page
    // sideways instead of this row.
    <div className="-mx-1 max-w-full min-w-0 overflow-x-auto px-1 py-px [scrollbar-width:none]">
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          "inline-flex h-[49px] rounded-[10px] border border-[var(--color-border)] bg-[var(--color-card)]",
          className,
        )}
      >
        {tabs.map((tab, i) => {
          const selected = tab.key === value;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.key)}
              className={cn(
                "inline-flex shrink-0 items-center justify-center gap-[14px] px-6 text-[15px] font-medium whitespace-nowrap transition-colors",
                i > 0 && "border-l border-[var(--color-border)]",
                selected
                  ? // Drawn over the frame's own edge, so the chosen segment
                    // reads as a box of its own rather than a tinted cell.
                    "relative z-[1] -my-px rounded-[10px] border border-[var(--color-blue-line)] bg-[var(--color-blue-soft)] text-[color-mix(in_srgb,var(--color-primary)_80%,var(--color-headline))] first:-ml-px last:-mr-px"
                  : "text-[var(--color-headline)] first:rounded-l-[10px] last:rounded-r-[10px] hover:bg-[color-mix(in_srgb,var(--color-blue-soft)_50%,transparent)]",
              )}
            >
              {tab.label}
              {tab.count != null && (
                <span
                  className={cn(
                    "grid h-[26px] min-w-[26px] place-items-center rounded-full px-[7px] text-sm font-semibold tabular-nums",
                    selected
                      ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                      : tab.tone === "danger"
                        ? "bg-[var(--color-alert)] text-white"
                        : "bg-[color-mix(in_srgb,var(--color-ink-2)_8%,var(--color-background))] text-[var(--color-ink-2)]",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
