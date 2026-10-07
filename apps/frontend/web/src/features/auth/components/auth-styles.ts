/**
 * The October 2026 measures every door into the app shares — sign-in,
 * sign-up, the password pages and the invitation — so they read as one
 * design and as the same site as the public pages behind them.
 */

/** The page's own heading: the public pages' 44px title, at 30px on a phone. */
export const AUTH_TITLE =
  "text-[30px] leading-[1.1] font-extrabold tracking-[-0.02em] text-[var(--color-headline)] md:text-[44px]";

/** The sentence under it, 7px below. */
export const AUTH_LEDE =
  "mt-[7px] text-[16.5px] leading-[1.5] text-[var(--color-muted-foreground)]";

/** A form's column of fields: 20px between them. */
export const AUTH_FORM = "flex flex-col gap-5";

/** One field: its label 8px above it. */
export const AUTH_FIELD = "flex flex-col gap-2";

export const AUTH_HINT =
  "text-[13.5px] leading-[1.45] text-[var(--color-muted-foreground)]";

/** A refusal, on its tinted ground. */
export const AUTH_ERROR =
  "rounded-[10px] bg-[var(--color-bad-bg)] px-4 py-3 text-[14.5px] leading-[1.45] font-medium text-[var(--color-bad-fg)]";

/** The platform telling the reader something — sent, waiting, what happens next. */
export const AUTH_INFO =
  "rounded-[14px] bg-[var(--color-blue-softer)] px-5 py-4 text-[15px] leading-[1.5] text-[var(--color-ink-2)]";

/** A link in a sentence: "Criar conta", "Esqueceu-se da palavra-passe?". */
export const AUTH_LINK =
  "font-semibold text-[var(--color-primary)] hover:underline";

/** The tinted disc a page's glyph sits in — a padlock, an envelope. */
export const AUTH_ICON_DISC =
  "grid h-14 w-14 place-items-center rounded-full bg-[var(--color-blue-soft)] text-[var(--color-primary)] [&_svg]:h-6 [&_svg]:w-6";

export const AUTH_INPUT_GROUP_BUTTON =
  "mr-1 h-9 w-9 text-[var(--color-muted-foreground)] hover:text-[var(--color-headline)] [&_svg]:size-[18px]";

/** "ou continue com", between two hairlines. */
export const AUTH_DIVIDER_TEXT =
  "text-[13.5px] text-[var(--color-muted-foreground)]";
