import type { ReactNode } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Card, CardContent, Skeleton, cn } from "@ntizo/frontend-ui";

/**
 * The uppercase label every card on this page wears, and nothing else — no
 * rule, no accent, no glyph before it.
 */
export const CAPTION =
  "type-caption font-bold tracking-[0.14em] text-[var(--color-muted-foreground)] uppercase";

/** A card's way out, at caption size: small enough not to compete with the number. */
export const CARD_LINK =
  "type-caption inline-flex items-center gap-1.5 font-semibold text-[var(--color-primary)] hover:underline";

/** A card link's trailing arrow — "Decidir →". Decorative: the words carry the name. */
export function LinkArrow() {
  return <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />;
}

/**
 * The status tones as a soft ground and a strong glyph, from the same
 * tokens the badges use — so a red disc means what a red pill means, and
 * the pair is redefined for dark mode with everything else.
 */
export type DiscTone = "info" | "danger" | "success" | "warning" | "violet" | "muted";

const DISC_TONE: Record<DiscTone, string> = {
  info: "bg-[var(--color-blue-soft)] text-[var(--color-primary)]",
  danger: "bg-[var(--color-bad-bg)] text-[var(--color-bad-fg)]",
  success: "bg-[var(--color-ok-bg)] text-[var(--color-ok-fg)]",
  warning: "bg-[var(--color-warn-bg)] text-[var(--color-warn-fg)]",
  violet: "bg-[var(--color-violet-bg)] text-[var(--color-violet-fg)]",
  muted: "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
};

/** A card's glyph on a tinted disc: what the card is about, before the words say it. */
export function IconDisc({
  icon: Icon,
  tone = "info",
  className,
}: {
  icon: LucideIcon;
  tone?: DiscTone;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", DISC_TONE[tone], className)}
    >
      <Icon aria-hidden="true" className="h-5 w-5" />
    </span>
  );
}

/**
 * One reading. The value is the point, so it is the only thing at heading
 * size; the hint under it is what the number means, and `action` is a verb —
 * only the card that is a task gets one.
 *
 * The placeholder replaces the value alone rather than the whole card: the
 * label and the hint are known before the number arrives, so blanking them
 * too would make the grid flash four grey rectangles and then four different
 * shapes.
 *
 * The value is sized by the card, not the viewport. The widest thing this
 * is handed is the platform's gross — "99 999,99 MTn" measures 7.25em in
 * Poppins SemiBold — and the text column beside the disc is anything from
 * 120px (four-up at 1280px, beside the console's sidebar) to 400px (two-up
 * at 1100px). `13cqi` keeps that string inside its column at any of them;
 * the clamp keeps a phone at the scale's 18px step and stops a wide card
 * passing `type-h1`'s 28px.
 *
 * In a card narrower than 15rem the disc sits over the text rather than
 * beside it — two counts sharing a 390px row, or four tiles beside the
 * console's sidebar at 1280px — where a disc beside the label would fold
 * "Novos prestadores (30 dias)" onto three lines. Measured on the card, not
 * the viewport, because the same width means a different card in each zone.
 *
 * `quiet` is a task card with nothing waiting: the same shape, so its row
 * never changes, but the number steps back to the muted ink.
 */
export function StatCard({
  label,
  value,
  hint,
  action,
  loading,
  icon,
  tone,
  quiet,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  loading?: boolean;
  icon?: LucideIcon;
  tone?: DiscTone;
  quiet?: boolean;
  /** The grid cell's own placement — a tile that needs the full width on a phone says so here. */
  className?: string;
}) {
  return (
    <Card className={cn("@container", className)}>
      <CardContent className="flex h-full flex-col gap-3 p-4 @[15rem]:flex-row @[15rem]:gap-3.5 @[15rem]:p-5">
        {icon && <IconDisc icon={icon} tone={tone} />}
        {/* A column, so the verb can sit at the card's foot: cards in one row
            share a height, and their links then share a line whatever the
            label or the hint above them wraps to. */}
        <div className="@container flex min-w-0 flex-1 flex-col gap-1">
          <p className={cn(CAPTION, "tracking-[0.1em]")}>{label}</p>
          {loading ? (
            <Skeleton className="h-[clamp(24px,13cqi,36px)] w-20" />
          ) : (
            // A literal size rather than `type-h1` alone: the type scale lives
            // in a plain `@layer components` block, so no variant of it can
            // follow the card's width. `type-h1` still carries the family,
            // the weight and the leading.
            <p
              className={cn(
                // 22px at the least: in a phone's two-up grid the card is ~130px
                // wide and 18px read smaller than the label above it. A long
                // amount wraps there rather than leave the card.
                "type-h1 text-[clamp(22px,13cqi,28px)] font-semibold break-words tabular-nums @[15rem]:whitespace-nowrap",
                quiet ? "text-[var(--color-muted-foreground)]" : "text-[var(--color-headline)]",
              )}
            >
              {value}
            </p>
          )}
          {hint && <p className="type-caption text-[var(--color-muted-foreground)]">{hint}</p>}
          {action && <div className="mt-auto pt-1">{action}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
