import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { BrandImage } from "@/shared/components/brand-image";
import { VerifiedPill } from "@/shared/components/browse/verified-pill";

/**
 * The wide card at the top of a browse page's results — the shell both
 * pages' "Mais bem avaliado" cards fill (October 2026 list-with-sidebar
 * mockup).
 *
 * Presentational only: which item earns it, and every fact on it, is the
 * page's. The mockup labels it "Em destaque"; nothing in the data marks
 * anything as featured, so callers pass the label that says what the pick
 * is. The fact chips at the foot are the caller's too, and only true ones —
 * the mockup's "Resposta rápida" and its "garantia" are not anything this
 * product records or offers.
 */
export function HighlightCard({
  labelledBy,
  photo,
  label,
  verified,
  title,
  lines,
  rating,
  description,
  price,
  action,
  facts,
  favourite,
}: {
  /** The id of the title's heading, which names the `<article>`. */
  labelledBy: string;
  photo: string | null;
  /** The chip on the photograph — "Mais bem avaliado". */
  label: string;
  verified: boolean;
  /** An `<h2 id={labelledBy}>` with the link inside. */
  title: ReactNode;
  /** The category and the place, one line each, glyph first. */
  lines: ReactNode;
  rating: ReactNode;
  description?: string | null;
  /** "desde" and the amount, already formatted. */
  price: ReactNode;
  /** The blue call to action — "Ver perfil →". */
  action: ReactNode;
  /** Small true facts with glyphs; nothing drawn when empty. */
  facts?: ReactNode;
  favourite?: ReactNode;
}) {
  return (
    <article
      aria-labelledby={labelledBy}
      // `grid-cols-[minmax(0,1fr)]` on a phone, not the implicit `auto`
      // track: an auto track sizes to the photograph's natural width, and
      // the card ran past the right edge of the screen.
      className="relative grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[14px] border border-[var(--color-line-2)] bg-[var(--color-card)] p-2.5 shadow-[0_2px_10px_rgba(30,60,120,.05)] md:grid-cols-[minmax(240px,42%)_minmax(0,1fr)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-[10px] bg-[var(--color-muted)] md:aspect-auto md:min-h-[250px]">
        <BrandImage src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-card)] px-3 py-1.5 text-[12.5px] leading-none font-semibold text-[var(--color-info-fg)] shadow-sm">
          <Star className="h-3.5 w-3.5 fill-[var(--color-primary)] text-[var(--color-primary)]" aria-hidden="true" />
          {label}
        </span>
      </div>

      {/* The heart sits on the card's corner: over the photograph on a
          phone, where the photo is the top of the card, and at the top
          right of the text from `md`. Its own class is `absolute top-2.5
          right-2.5`, so this box only moves the corner it measures from. */}
      {favourite && <div className="absolute top-3 right-3 md:top-0 md:right-0">{favourite}</div>}

      {/* Phone: the facts, then the price and the button on one row at the
          foot. From `md`: the price at the top right, beside the name, as
          the mockup draws it. One element each, placed by grid areas. */}
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-x-4 px-2 pt-4 pb-1.5 [grid-template-areas:'head_head'_'desc_desc'_'facts_facts'_'price_action'] md:grid-rows-[auto_auto_1fr] md:items-start md:px-6 md:pt-4 md:pb-2 md:[grid-template-areas:'head_price'_'desc_desc'_'facts_action']">
        <div className="min-w-0 [grid-area:head] md:pr-8">
          {verified && <VerifiedPill floating={false} />}
          <div className={verified ? "mt-2.5" : ""}>{title}</div>
          <div className="mt-2 grid gap-1.5 text-[14.5px] text-[var(--color-muted-foreground)]">{lines}</div>
          <div className="mt-2">{rating}</div>
        </div>
        <div className="mt-4 [grid-area:price] md:mt-0 md:pr-10 md:text-right">{price}</div>
        {description && (
          <p className="mt-3 line-clamp-2 text-[14.5px] leading-[1.5] text-[var(--color-ink-2)] [grid-area:desc]">
            {description}
          </p>
        )}
        {facts && (
          <div className="mt-3 grid gap-1.5 self-end text-[13px] text-[var(--color-ink-2)] [grid-area:facts] md:mt-4">
            {facts}
          </div>
        )}
        <div className="mt-4 justify-self-end [grid-area:action] md:self-end">{action}</div>
      </div>
    </article>
  );
}

/** The highlight card's call to action: the site's blue, an arrow after. */
export const HIGHLIGHT_ACTION_CLASS =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[12px] bg-[var(--color-blue-public)] px-5 text-[15px] font-semibold whitespace-nowrap md:h-12 md:px-6 text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90";

/** One fact at the card's foot: a glyph and a few words. */
export function HighlightFact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      {icon}
      {children}
    </span>
  );
}
