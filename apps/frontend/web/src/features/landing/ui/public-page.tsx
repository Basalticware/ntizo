import type { ReactNode } from "react";
import { cn } from "@ntizo/frontend-ui";
import { CARD_SURFACE_CLASS } from "@/shared/components/card-surface";

/**
 * The side inset every public page outside the listings wears: `/services`'
 * own, 100px at a 1440px window. Set on the page's wrapper, it is read by the
 * header's `.public-inset` and by every section's, so the logo, the title and
 * the cards all start on one line — and on the same line as `/services`.
 */
export const PUBLIC_PAGE_CLASS = "[--pw-pad:clamp(16px,7.3vw,100px)]";

/** A section's heading: 22px, bold, navy. */
export const SECTION_TITLE_CLASS =
  "text-[22px] leading-tight font-extrabold tracking-[-0.01em] text-[var(--color-headline)]";

/** A card's own heading: 17px, bold, navy. */
export const CARD_TITLE_CLASS = "text-[17px] leading-snug font-bold text-[var(--color-headline)]";

/** A card's running text: 15px, the secondary grey. */
export const CARD_BODY_CLASS = "text-[15px] leading-relaxed text-[var(--color-muted-foreground)]";

/** The public card at the system's 24px padding. */
export const PUBLIC_CARD_CLASS = `${CARD_SURFACE_CLASS} p-6`;

/** The panel a note sits on: `blue-softer`, 14px corners, no edge. */
export const INFO_PANEL_CLASS = "rounded-[14px] bg-[var(--color-blue-softer)] p-6";

/**
 * A step's number: a soft blue disc with the figure in the brand blue — the
 * consoles' marker, where these pages used to draw a navy one.
 */
export const STEP_MARKER_CLASS =
  "grid h-8 w-8 place-items-center rounded-full bg-[var(--color-blue-soft)] text-[14px] font-bold text-[var(--color-primary)] tabular-nums";

/**
 * The opening of a page with no artwork: the title at 44px and its line 7px
 * under it — the sizes the consoles' headings use, so a reader crossing from
 * a public page into an account sees one system.
 */
export function PageIntro({
  title,
  lede,
  centred = false,
  className,
  before,
  children,
}: {
  title: ReactNode;
  lede?: ReactNode;
  centred?: boolean;
  className?: string;
  /** Drawn above the title — a way back, say. */
  before?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={cn("public-inset pt-10 pb-10 md:pt-12", centred && "text-center", className)}>
      {before}
      <h1
        className={cn(
          "max-w-[22ch] text-[30px] leading-[1.08] font-extrabold tracking-[-0.02em] text-[var(--color-headline)] md:text-[44px]",
          centred && "mx-auto",
        )}
      >
        {title}
      </h1>
      {lede ? (
        <p
          className={cn(
            "mt-[7px] max-w-[60ch] text-[16.5px] leading-relaxed text-[var(--color-muted-foreground)]",
            centred && "mx-auto",
          )}
        >
          {lede}
        </p>
      ) : null}
      {children}
    </section>
  );
}
