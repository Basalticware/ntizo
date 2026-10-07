import { useId, type ComponentType } from "react";
import { Check } from "lucide-react";
import { cn } from "@ntizo/frontend-ui";

export interface ChoiceCard {
  value: string;
  label: string;
  /** One short line under the label. Omit for a card that is only its name. */
  hint?: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  disabled?: boolean;
}

/**
 * The wizard's single-choice questions as cards a thumb can hit: an icon, a
 * name and at most one line under it.
 *
 * Native radios underneath, for the same reason `ChoiceChips` gives — the
 * browser already does arrow keys, one tab stop and "2 of 3" — and styled from
 * the input's own state through `has-[:checked]`, so the look and the value
 * cannot disagree.
 *
 * The input is named by the label alone and described by the hint, so a
 * screen reader hears "Remotely, radio button" and then the detail, rather
 * than one long sentence that buries which option this is.
 */
export function ChoiceCards({
  name,
  legend,
  value,
  onChange,
  options,
  columns = 2,
}: {
  name: string;
  legend: string;
  value: string | null;
  onChange: (value: string) => void;
  options: readonly ChoiceCard[];
  columns?: 2 | 3;
}) {
  const id = useId();
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-3 p-0 text-[15px] leading-tight font-semibold text-[var(--color-headline)]">
        {legend}
      </legend>
      <div className={cn("grid gap-3", columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {options.map((option) => {
          const Icon = option.icon;
          const labelId = `${id}-${option.value}-label`;
          const hintId = `${id}-${option.value}-hint`;
          return (
            <label
              key={option.value}
              className={cn(
                "group relative flex min-w-0 cursor-pointer items-start gap-3.5 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-colors sm:p-[18px]",
                "hover:border-[var(--color-blue-line)]",
                "has-[:checked]:border-[var(--color-primary)] has-[:checked]:bg-[var(--color-blue-softer)]",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--color-ring)] has-[:focus-visible]:ring-offset-2",
                "has-[:disabled]:cursor-default has-[:disabled:not(:checked)]:opacity-55 has-[:disabled:not(:checked)]:hover:border-[var(--color-border)]",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                disabled={option.disabled}
                onChange={() => onChange(option.value)}
                aria-labelledby={labelId}
                {...(option.hint ? { "aria-describedby": hintId } : {})}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[var(--color-blue-soft)] text-[var(--color-primary)] transition-colors group-has-[:checked]:bg-[var(--color-primary)] group-has-[:checked]:text-[var(--color-primary-foreground)]"
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="grid min-w-0 flex-1 gap-1 pt-0.5 pr-6">
                <span
                  id={labelId}
                  className="text-[15.5px] leading-tight font-semibold text-[var(--color-headline)]"
                >
                  {option.label}
                </span>
                {option.hint ? (
                  <span
                    id={hintId}
                    className="text-[13.5px] leading-[1.45] text-[var(--color-muted-foreground)]"
                  >
                    {option.hint}
                  </span>
                ) : null}
              </span>
              {/* The tick, so the chosen card reads as chosen without relying
                  on the tint alone. */}
              <span
                aria-hidden="true"
                className="absolute top-4 right-4 grid h-5 w-5 place-items-center rounded-full border-2 border-[var(--color-border)] transition-colors group-has-[:checked]:border-[var(--color-primary)] group-has-[:checked]:bg-[var(--color-primary)] sm:top-[18px] sm:right-[18px]"
              >
                <Check className="hidden h-3 w-3 text-[var(--color-primary-foreground)] group-has-[:checked]:block" strokeWidth={3.5} />
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
