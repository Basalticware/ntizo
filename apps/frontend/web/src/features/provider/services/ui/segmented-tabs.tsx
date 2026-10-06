import { cn } from "@ntizo/frontend-ui";

/**
 * The services page's tab strip: one bordered bar, a hairline between the
 * items, the chosen one boxed on the soft blue ground — the mockup's
 * "Todos 5 · Ativos 3 · …". Not the console's `StatusTabs`, whose tabs are
 * separate boxes: this screen's mockup draws them as one control.
 *
 * Every count is known — the whole catalogue is one request — so every tab
 * carries one.
 */
export function SegmentedTabs<K extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: readonly { key: K; label: string; count: number }[];
  value: K;
  onChange: (key: K) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex h-[54px] w-full max-w-full shrink-0 overflow-x-auto xl:w-auto rounded-[10px] border border-[var(--color-border)] bg-[var(--color-card)] [scrollbar-width:none]"
    >
      {tabs.map((tab, i) => {
        const selected = tab.key === value;
        const afterSelected = i > 0 && tabs[i - 1]!.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.key)}
            className={cn(
              "relative flex shrink-0 items-center justify-center whitespace-nowrap",
              selected
                ? "-my-px -ml-px gap-5 rounded-[10px] border border-[var(--color-blue-line)] bg-[var(--color-blue-soft)] pr-7 pl-[30px] text-[15.5px] font-medium text-[color-mix(in_srgb,var(--color-primary)_80%,var(--color-headline))]"
                : "gap-4 px-7 text-sm font-medium text-[var(--color-ink-2)] hover:text-[var(--color-headline)]",
              // The hairline between two plain items; the boxed one draws its own edge.
              !selected && i > 0 && !afterSelected &&
                "before:absolute before:top-[13px] before:bottom-[13px] before:left-0 before:w-px before:bg-[var(--color-border)]",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "grid place-items-center rounded-full font-semibold tabular-nums",
                selected
                  ? "h-[30px] min-w-[30px] bg-[var(--color-primary)] px-1.5 text-base text-[var(--color-primary-foreground)]"
                  : "h-[26px] min-w-[26px] bg-[#eef2f9] px-1.5 text-[15px] text-[var(--color-ink-2)] dark:bg-[var(--color-muted)]",
              )}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
