import { cn } from "@ntizo/frontend-ui";

/**
 * A pill of mutually exclusive options, with the chosen one raised out of the
 * track.
 *
 * Not `ChoiceChips`, which is the right control for a *set* being picked from
 * — categories, weekdays, booking modes — and reads as a row of independent
 * things. This is one question with one answer, sitting in a context strip
 * beside the thing it changes, so it wants the compact segmented shape rather
 * than a legend and a row of separate chips.
 *
 * A `radiogroup` rather than a set of buttons: it is a single-choice control,
 * and the roving arrow-key behaviour a screen reader offers for one is exactly
 * how this should be operated.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex rounded-[10px] border border-[var(--color-border)] bg-[var(--color-card)]"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              // The console's joined tabs: hairlines between, the chosen one on
              // the soft blue ground and drawn over the frame's edge.
              "-my-px cursor-pointer border px-3.5 py-1.5 text-[13.5px] font-medium whitespace-nowrap transition-colors first:-ml-px first:rounded-l-[10px] last:-mr-px last:rounded-r-[10px]",
              selected
                ? "relative z-[1] rounded-[10px] border-[var(--color-blue-line)] bg-[var(--color-blue-soft)] text-[color-mix(in_srgb,var(--color-primary)_80%,var(--color-headline))]"
                : "border-transparent text-[var(--color-headline)] hover:bg-[color-mix(in_srgb,var(--color-blue-soft)_50%,transparent)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
