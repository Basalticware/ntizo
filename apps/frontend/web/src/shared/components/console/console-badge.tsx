/**
 * The one badge: a count beside a nav label, in every rendering of the menu
 * — sidebar, tab bar, sheet. One class, so a count cannot be blue in one
 * place and red in another. Position and the collapsed-rail dot are the
 * caller's modifiers; the badge itself is this.
 */
export const CONSOLE_BADGE =
  "grid h-[26px] min-w-[26px] place-items-center rounded-full bg-[var(--color-destructive)] px-1.5 text-sm font-semibold leading-none text-[var(--color-destructive-foreground)] tabular-nums";
