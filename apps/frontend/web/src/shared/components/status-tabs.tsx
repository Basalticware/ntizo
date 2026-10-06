import { cn } from "@ntizo/frontend-ui";

/**
 * The row of tabs above a console list — "Todas 12 · Por responder 3 · …".
 *
 * One component because every list in the mockups draws the same row: a box
 * per tab, the chosen one on the soft blue ground, and a count chip whose
 * colour says what kind of rows the tab holds. The count is optional per tab:
 * a list whose server only knows the size of the tab on screen shows that one
 * number and leaves the others bare, rather than inventing them.
 */
export type StatusTabTone = "primary" | "warning" | "success" | "danger" | "info" | "neutral";

export interface StatusTab<K extends string> {
  key: K;
  label: string;
  /** Omit when the number is not known; the tab then shows no chip. */
  count?: number | null;
  /** The chip's colour when the tab is not chosen. The chosen tab's chip is always the brand blue. */
  tone?: StatusTabTone;
}

const CHIP_TONE: Record<StatusTabTone, string> = {
  primary: "bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[var(--color-primary)]",
  warning: "bg-[color-mix(in_srgb,var(--color-warning)_20%,transparent)] text-[#8a5a00] dark:text-[var(--color-warning)]",
  success: "bg-[color-mix(in_srgb,var(--color-success)_16%,transparent)] text-[var(--color-success)]",
  danger: "bg-[color-mix(in_srgb,var(--color-destructive)_12%,transparent)] text-[var(--color-destructive)]",
  info: "bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] text-[var(--color-primary)]",
  neutral: "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
};

export function StatusTabs<K extends string>({
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
    // Scrolls sideways on a phone rather than wrapping: a wrapped tab row reads
    // as two rows of filters.
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("-mx-1 flex shrink-0 gap-[15px] overflow-x-auto px-1 py-px [scrollbar-width:none]", className)}
    >
      {tabs.map((tab) => {
        const selected = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.key)}
            className={cn(
              "inline-flex h-[47px] shrink-0 items-center gap-3.5 rounded-[10px] border px-5 text-base font-medium whitespace-nowrap transition-colors",
              selected
                ? "border-[var(--color-blue-line)] bg-[var(--color-blue-soft)] pl-[22px] text-[color-mix(in_srgb,var(--color-primary)_80%,var(--color-headline))]"
                : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-headline)] hover:border-[var(--color-blue-line)]",
            )}
          >
            {tab.label}
            {tab.count != null && (
              <span
                className={cn(
                  "grid h-[26px] min-w-[26px] place-items-center rounded-full px-[7px] text-sm font-semibold tabular-nums",
                  selected
                    ? "min-w-[34px] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                    : CHIP_TONE[tab.tone ?? "neutral"],
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
