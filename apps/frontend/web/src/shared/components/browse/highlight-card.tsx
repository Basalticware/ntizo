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
      className="grid overflow-hidden rounded-[14px] border border-[var(--color-line-2)] bg-[var(--color-card)] p-2.5 shadow-[0_2px_10px_rgba(30,60,120,.05)] md:grid-cols-[minmax(240px,42%)_1fr]"
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-[10px] bg-[var(--color-muted)] md:aspect-auto md:min-h-[250px]">
        <BrandImage src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-card)] px-3 py-1.5 text-[12.5px] leading-none font-semibold text-[var(--color-info-fg)] shadow-sm">
          <Star className="h-3.5 w-3.5 fill-[var(--color-primary)] text-[var(--color-primary)]" aria-hidden="true" />
          {label}
        </span>
      </div>

      <div className="relative flex min-w-0 flex-col px-3 pt-4 pb-2 md:px-6 md:pt-4">
        {/* The heart's own positioning is `absolute top-2.5 right-2.5`. */}
        {favourite}
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 pr-10">
          <div className="min-w-0">
            {verified && <VerifiedPill floating={false} />}
            <div className={verified ? "mt-2.5" : ""}>{title}</div>
            <div className="mt-2 grid gap-1.5 text-[14.5px] text-[var(--color-muted-foreground)]">{lines}</div>
            <div className="mt-2">{rating}</div>
          </div>
          <div className="ml-auto text-right">{price}</div>
        </div>
        {description && (
          <p className="mt-3 line-clamp-2 text-[14.5px] leading-[1.5] text-[var(--color-ink-2)]">
            {description}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-4">
          <div className="grid gap-1.5 text-[13px] text-[var(--color-ink-2)]">{facts}</div>
          {action}
        </div>
      </div>
    </article>
  );
}

/** The highlight card's call to action: the site's blue, an arrow after. */
export const HIGHLIGHT_ACTION_CLASS =
  "inline-flex h-12 items-center justify-center gap-2 rounded-[12px] bg-[var(--color-blue-public)] px-6 text-[15px] font-semibold text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90";

/** One fact at the card's foot: a glyph and a few words. */
export function HighlightFact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      {icon}
      {children}
    </span>
  );
}
