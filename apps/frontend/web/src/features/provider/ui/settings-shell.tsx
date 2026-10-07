import { cn } from "@ntizo/frontend-ui";

/**
 * The settings page's containers, shared by the real page and its skeleton.
 *
 * Shared rather than copied, and that is the whole point: a skeleton whose
 * card padding, icon tile or grid gutter is written out a second time drifts
 * the first time either side is touched, and the drift shows up as the page
 * jumping when the data lands. Here there is one definition of every box, so
 * the loading state cannot be a different size from the thing it stands in for.
 *
 * `title` and `blurb` are ReactNode, not string, so the skeleton can put grey
 * blocks exactly where the words go.
 */

/** Every box on the page: white, the `border` token, 14px corners. */
export const SETTINGS_BOX =
  "rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card)]";

/**
 * The page grid, as the mockup lays it out: the identity card across the
 * top of the left column, the section rail and the sections under it, and a
 * 302px column on the right for the profile's state and the save buttons.
 *
 * The save bar is the grid's last child rather than part of the right column,
 * and that is what lets one element serve both widths. From `xl` it is placed
 * in the right column's second row, which spans the rest of the page's
 * height, so it can stay in sight (`sticky`) while the sections scroll past.
 * Below `xl` the columns stack and it is the last thing in a tall container,
 * which is exactly where `sticky bottom-0` pins it to the foot of the screen.
 */
export function SettingsLayout({
  hero,
  nav,
  aside,
  save,
  children,
}: {
  hero: React.ReactNode;
  nav: React.ReactNode;
  aside: React.ReactNode;
  save: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-[1400px] xl:grid xl:grid-cols-[minmax(0,1fr)_302px] xl:grid-rows-[auto_1fr] xl:gap-x-5">
      <div className="min-w-0 xl:row-span-2">
        {hero}
        <div className="mt-4 lg:grid lg:grid-cols-[213px_minmax(0,1fr)] lg:items-start lg:gap-[15px]">
          {nav}
          <div className="grid min-w-0 gap-4">{children}</div>
        </div>
      </div>
      <aside className="mt-5 grid content-start gap-5 xl:col-start-2 xl:row-start-1 xl:mt-0">{aside}</aside>
      {save}
    </div>
  );
}

export function Section({
  id,
  icon,
  title,
  blurb,
  tone,
  side,
  children,
}: {
  id?: string;
  icon: React.ReactNode;
  title: React.ReactNode;
  blurb: React.ReactNode;
  tone?: "danger";
  /** A note beside the section's body on a wide screen — the mockup's "Dica". */
  side?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      // Anchored links land under the sticky page header without this.
      className={cn(
        "scroll-mt-6 rounded-[14px] border p-4 sm:grid sm:grid-cols-[58px_minmax(0,1fr)] sm:pt-4 sm:pr-5 sm:pb-5 sm:pl-[17px]",
        side && "2xl:grid-cols-[58px_minmax(0,1fr)_215px]",
        tone === "danger"
          ? "border-[color-mix(in_srgb,var(--color-destructive)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-destructive)_4%,var(--color-card))]"
          : "border-[var(--color-border)] bg-[var(--color-card)]",
      )}
    >
      <span
        className={cn(
          "mb-3 grid h-[38px] w-[38px] place-items-center rounded-[10px] sm:mb-0",
          tone === "danger"
            ? "bg-[color-mix(in_srgb,var(--color-destructive)_12%,transparent)] text-[var(--color-destructive)]"
            : "bg-[var(--color-blue-soft)] text-[var(--color-primary)]",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="text-base leading-[21px] font-bold text-[var(--color-headline)]">{title}</h2>
        <p className="mt-[3px] text-sm leading-[1.45] text-[var(--color-muted-foreground)]">{blurb}</p>
        <div className="mt-4">{children}</div>
      </div>
      {side && <div className="mt-4 2xl:mt-0 2xl:ml-5">{side}</div>}
    </section>
  );
}

/**
 * The save controls. A bar pinned to the foot of the screen below `xl`; from
 * `xl` the two buttons at the top of the right column, in sight while the
 * sections scroll. See `SettingsLayout` for why one element does both.
 */
export function SettingsSaveBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "sticky -bottom-6 z-20 -mx-6 -mb-6 mt-6 border-t border-[var(--color-border)] bg-[var(--color-background)]/95 px-6 backdrop-blur",
        "xl:top-6 xl:bottom-auto xl:col-start-2 xl:row-start-2 xl:mx-0 xl:mt-5 xl:mb-0 xl:self-start xl:border-0 xl:bg-transparent xl:px-0 xl:backdrop-blur-none",
      )}
    >
      {children}
    </div>
  );
}
