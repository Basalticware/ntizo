import type { ReactNode } from "react";

/**
 * One setting: what it is, one line on what it affects, and the control.
 *
 * Stacked rather than tabbed. Tabs hide settings behind a click and make the
 * page a place you navigate; a settings page is a place you scan.
 *
 * The control carries the current value itself, so nothing repeats it beside
 * the heading — the page used to print "Português (Portugal)" twice within
 * three lines — and there is no tracked-out label above the control either:
 * the heading two lines up already names it, and the control's own
 * accessible name is what a screen reader hears.
 *
 * Rows of the section's card, divided by the table's row line: the card
 * carries the section's heading, so this is a step below it.
 */
export function Setting({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-[var(--color-line-2)] py-5 first:border-t-0 first:pt-0 last:pb-0">
      <h3 className="m-0 text-base font-bold text-[var(--color-headline)]">
        {title}
      </h3>
      <p className="m-0 mt-1 text-sm text-[var(--color-muted-foreground)]">
        {blurb}
      </p>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}
