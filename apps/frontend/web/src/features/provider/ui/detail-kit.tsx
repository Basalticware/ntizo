import type { ReactNode } from "react";
import { Check, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@ntizo/frontend-ui";

/**
 * The pieces the console's detail pages are drawn from — the booking, the
 * quote — laid out as the October mockup's booking file
 * (`docs/design/2026-10-mockups/admin/reserva-detalhe.html`): a crumb, a
 * title row with its pills, a meta line with icons, cards on the left and a
 * rail with the decision and the timeline on the right.
 *
 * Shapes only. What goes in each card, and which rows exist, is the page's.
 */

/** Every card on a detail page: a hairline edge, the card ground, 24px in. */
export const DETAIL_CARD =
  "min-w-0 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card)] p-5 md:p-6";

/** The square back button at the head of the title row. */
export const DETAIL_BACK_CLASS =
  "grid h-12 w-12 shrink-0 place-items-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-headline)] hover:border-[var(--color-blue-line)] hover:bg-[var(--color-blue-softer)] md:h-[52px] md:w-[52px]";

/** The crumb's link back to the list. */
export const DETAIL_CRUMB_LINK_CLASS = "shrink-0 text-[var(--color-primary)] hover:underline";

/** The two columns under the head: the record, and the rail beside it. */
export const DETAIL_COLUMNS =
  "mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px]";

export function DetailCrumb({ label, link, current }: { label: string; link: ReactNode; current: string }) {
  return (
    <nav
      aria-label={label}
      className="flex min-w-0 items-center gap-2 text-[15px] text-[var(--color-muted-foreground)]"
    >
      {link}
      <ChevronRight aria-hidden="true" className="mx-1 h-3.5 w-3.5 shrink-0" />
      <span className="truncate font-medium text-[var(--color-ink-2)]">{current}</span>
    </nav>
  );
}

/**
 * The back square, the title with its pills, and the meta line under them.
 * The title is the page's one `h1`.
 */
export function DetailHead({
  back,
  title,
  pills,
  children,
}: {
  back: ReactNode;
  title: ReactNode;
  pills?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mt-[18px] grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 md:gap-x-[26px]">
      {back}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
          <h1 className="m-0 mr-1.5 font-display text-[28px] leading-tight font-extrabold tracking-[-0.01em] break-words text-[var(--color-headline)] md:text-[35.5px]">
            {title}
          </h1>
          {pills}
        </div>
        {children}
      </div>
    </header>
  );
}

/** The pill size the title row draws, a step under the base `Badge`'s. */
export const TITLE_PILL_CLASS = "h-[30px] px-3.5 text-[14.5px]";

/**
 * "Serviços eléctricos | Maputo | 11 Out 2024 | 14:00 – 16:00": the facts
 * under a title.
 *
 * Each fact carries its divider on its own left edge, and the row is pulled
 * left by one gap and clipped, so whichever fact starts a line — the first,
 * or one the wrap carried down — has its divider cut off instead of opening
 * the line with a stray bar.
 */
export function MetaLine({ items }: { items: Array<{ key: string; icon?: LucideIcon; text: ReactNode }> }) {
  return (
    <div className="mt-3.5 overflow-hidden">
      <div className="-ml-[33px] flex flex-wrap items-center gap-y-2 text-[15px] text-[var(--color-muted-foreground)] md:-ml-[45px]">
        {items.map(({ key, icon: Icon, text }) => (
          <span
            key={key}
            className="ml-4 inline-flex min-w-0 items-center border-l border-[var(--color-border)] pl-4 md:ml-[22px] md:pl-[22px]"
          >
            {Icon && <Icon aria-hidden="true" className="mr-3 h-5 w-5 shrink-0 text-[var(--color-ink-2)]" />}
            <span className="min-w-0">{text}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function CardHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="flex min-h-[30px] flex-wrap items-center justify-between gap-3">
      <h2 className="m-0 text-lg font-bold text-[var(--color-headline)]">{title}</h2>
      {action}
    </header>
  );
}

/**
 * One labelled fact in a card: the icon, the label and the value side by side
 * from `sm`, the value under its label on a phone.
 */
export function DataRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-4 gap-y-1 text-[15px] sm:grid-cols-[20px_170px_minmax(0,1fr)] sm:gap-x-[19px]">
      <Icon aria-hidden="true" className="row-span-2 h-5 w-5 text-[var(--color-ink-2)] sm:row-span-1" />
      <dt className="text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className="m-0 min-w-0 leading-[1.45] break-words text-[var(--color-ink-2)]">{children}</dd>
    </div>
  );
}

/** A line with an icon and nothing else — a phone number, an email. */
export function IconLine({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center text-[15px] text-[var(--color-ink-2)]">
      <Icon aria-hidden="true" className="mr-4 h-[19px] w-[19px] shrink-0 text-[var(--color-ink-2)]" />
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

/** The blue panel that says, in a sentence, where the thing stands. */
export function InfoBox({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mt-[18px] flex gap-[18px] rounded-[14px] bg-[var(--color-blue-softer)] p-[18px]">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--color-blue-soft)] text-[var(--color-primary)]">
        <Icon aria-hidden="true" className="h-6 w-6" />
      </span>
      <div className="min-w-0 self-center">
        {title && <p className="m-0 text-[15px] font-semibold text-[var(--color-primary)]">{title}</p>}
        {children && (
          <div className={cn("text-[14.5px] leading-[1.45] text-[var(--color-muted-foreground)]", title && "mt-1")}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

const TILE_TONE = {
  ok: "bg-[var(--color-ok-bg)] text-[var(--color-ok-fg)]",
  violet: "bg-[var(--color-violet-bg)] text-[var(--color-violet-fg)]",
  info: "bg-[var(--color-info-bg)] text-[var(--color-info-fg)]",
} as const;

/** The money breakdown's row: as many tiles across as fit, one under another on a phone. */
export const MONEY_TILES = "mt-[18px] mb-0 grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]";

/** One number of the money breakdown, on a tinted icon. Sits in a `dl`. */
export function MoneyTile({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: LucideIcon;
  tone: keyof typeof TILE_TONE;
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[10px] border border-[var(--color-border)] p-3">
      <span className={cn("grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[10px]", TILE_TONE[tone])}>
        <Icon aria-hidden="true" className="h-[22px] w-[22px]" />
      </span>
      <div className="min-w-0">
        <dt className="text-[13px] text-[var(--color-muted-foreground)]">{label}</dt>
        <dd className="m-0 mt-1 text-[17px] font-extrabold whitespace-nowrap text-[var(--color-headline)] tabular-nums">
          {value}
        </dd>
      </div>
    </div>
  );
}

export interface TimelineEntry {
  key: string;
  label: string;
  /** Under the label: when, and anything else worth a line. */
  lines: ReactNode[];
  /** Done is ticked green; `pending` is a deadline still ahead, ringed in blue. */
  pending?: boolean;
}

/**
 * The history as the mockup draws it: a dot per entry on a rail, ticked for
 * what happened, ringed for the deadline still ahead. Each entry is a list
 * item named by its label.
 */
export function Timeline({ entries }: { entries: readonly TimelineEntry[] }) {
  return (
    <ol className="mt-5 mb-0 grid list-none gap-6 p-0">
      {entries.map((e, i) => (
        <li key={e.key} aria-label={e.label} className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-x-5">
          {i < entries.length - 1 && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-7 -bottom-6 left-[13px] w-0.5",
                entries[i + 1]?.pending ? "bg-[var(--color-border)]" : "bg-[var(--color-success)]",
              )}
            />
          )}
          {e.pending ? (
            <span
              aria-hidden="true"
              className="relative grid h-7 w-7 place-items-center rounded-full border-2 border-[var(--color-primary)] bg-[var(--color-card)]"
            >
              <span className="h-[11px] w-[11px] rounded-full bg-[var(--color-primary)]" />
            </span>
          ) : (
            <span
              aria-hidden="true"
              className="relative grid h-7 w-7 place-items-center rounded-full bg-[var(--color-success)] text-white"
            >
              <Check className="h-[15px] w-[15px]" strokeWidth={3} />
            </span>
          )}
          <div className="min-w-0 pt-[3px]">
            <p
              className={cn(
                "m-0 text-[15px] font-bold",
                e.pending ? "text-[var(--color-primary)]" : "text-[var(--color-headline)]",
              )}
            >
              {e.label}
            </p>
            {e.lines.map((line, j) => (
              <div key={j} className="mt-1 text-sm leading-[1.4] text-[var(--color-muted-foreground)]">
                {line}
              </div>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}
