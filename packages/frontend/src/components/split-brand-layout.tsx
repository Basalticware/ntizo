import type { ReactNode } from "react";

export interface SplitBrandLayoutProps {
  /** Brand wordmark shown at the top of the coloured panel. */
  wordmark: ReactNode;
  /**
   * The wordmark again, on the light ground above the form, for the widths
   * where the panel is hidden. Without it a phone shows a form with no brand
   * on it at all.
   */
  compactWordmark?: ReactNode;
  /** The panel's headline — what this page is for, in the user's words. */
  pitch: ReactNode;
  /** Short proof points under the pitch. */
  points: readonly ReactNode[];
  /** Ticked list (sign-up) versus one muted dot-separated line (sign-in). */
  pointsAsList?: boolean;
  /** Small print under the form column, e.g. a copyright line. */
  footnote?: ReactNode;
  children: ReactNode;
}

/**
 * Two-panel shell: the brand's navy panel beside a centred content column.
 *
 * Every string arrives as a prop and nothing here calls `useTranslation`.
 * That is the reason this can live in the UI package at all — no component
 * in here depends on i18n, and `react-i18next` is not a dependency of the
 * package. Adding one would force every future consumer to configure i18n
 * just to import a button.
 *
 * The brand panel is `hidden lg:flex`: below that width it disappears rather
 * than stacking above the content. On a phone, a screen of marketing copy
 * between the user and the form is a cost — these are pages people arrive at
 * wanting to finish, not to read. `compactWordmark` keeps the brand on the
 * page there.
 *
 * Navy (`--color-navy-surface`, the brand manual's #00244C) rather than the
 * interface blue: the blue is what a button is on this page, and a panel the
 * colour of the primary action competes with it for the eye.
 */
export function SplitBrandLayout({
  wordmark,
  compactWordmark,
  pitch,
  points,
  pointsAsList = false,
  footnote,
  children,
}: SplitBrandLayoutProps) {
  return (
    <div className="min-h-svh grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] bg-[var(--color-background)]">
      <aside className="hidden lg:flex flex-col bg-[var(--color-navy-surface)] px-14 py-12 text-[var(--color-navy-on)] xl:px-20">
        <div>{wordmark}</div>

        <div className="my-auto flex flex-col gap-8 py-12">
          <p className="max-w-[18ch] text-[40px] leading-[1.1] font-extrabold tracking-[-0.02em]">
            {pitch}
          </p>

          {pointsAsList ? (
            <ul className="flex flex-col gap-3.5 text-[16.5px]">
              {points.map((point, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-navy-on)_14%,transparent)] text-[15px] font-bold"
                  >
                    ✓
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[16.5px] opacity-80">
              {points.map((point, i) => (
                <span key={i}>
                  {i > 0 ? " · " : ""}
                  {point}
                </span>
              ))}
            </p>
          )}
        </div>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-8 lg:py-12">
        {compactWordmark ? (
          <div className="mb-10 lg:hidden">{compactWordmark}</div>
        ) : null}
        <div className="mx-auto my-auto w-full max-w-[460px]">{children}</div>
        {footnote ? (
          <p className="mt-10 text-center text-[13px] text-[var(--color-muted-foreground)] opacity-80">
            {footnote}
          </p>
        ) : null}
      </main>
    </div>
  );
}
