import type { ComponentType, ReactNode } from "react";
import { cn } from "@ntizo/frontend-ui";

/**
 * The pieces every signed-in customer page is built from, so the bookings,
 * the quotes, the inbox and the account read as one console in the public
 * frame rather than five pages that resemble each other.
 *
 * They copy the consoles' measures rather than inventing new ones: the title
 * is `ConsolePageHeading`'s, a card is the settings page's `SETTINGS_BOX`
 * with the room the detail pages give it, and a card's heading is the size
 * the admin's detail cards use. The customer zone has no console shell to
 * print the title for it, which is the only reason these exist apart from
 * those.
 */

/** A page's own title: 44px navy from `md`, the sentence under it 7px below. */
export function CustomerPageHeading({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** The page's one action, on the right of the title from `sm`. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-x-6 gap-y-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display text-[30px] leading-[1.1] font-extrabold tracking-[-0.02em] [overflow-wrap:anywhere] text-[var(--color-headline)] md:text-[44px] md:leading-[1.05]">
          {title}
        </h1>
        {subtitle ? (
          <div className="mt-[7px] max-w-[70ch] text-base text-[var(--color-muted-foreground)] md:text-[16.5px]">
            {subtitle}
          </div>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {action}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A detail page's title — one booking, one quote. The admin's provider file
 * sets the size: a step under a list page's 44px, because a service name and
 * its package together run long and a heading that tall pushed the status and
 * the actions below the fold.
 */
export const DETAIL_TITLE =
  "m-0 font-display text-[26px] leading-tight font-extrabold tracking-[-0.01em] [overflow-wrap:anywhere] text-[var(--color-headline)] md:text-[35px]";

/** The two-column body of a detail page: the record, and a 360px rail beside it from `lg`. */
export const DETAIL_GRID =
  "grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start";

/** Every box on these pages: white, the `border` token, 14px corners, no shadow. */
export const CUSTOMER_CARD =
  "min-w-0 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card)] p-5 sm:p-6";

/** A card's heading, and whatever sits at its right end — a count, a link. */
export function CardHead({
  title,
  hint,
  aside,
  icon: Icon,
}: {
  title: ReactNode;
  /** One muted line under the heading. */
  hint?: ReactNode;
  aside?: ReactNode;
  /** A 21px glyph in the brand blue before the heading. */
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[var(--color-primary)]"
          >
            <Icon className="h-[21px] w-[21px]" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="m-0 text-lg leading-snug font-bold text-[var(--color-headline)]">
            {title}
          </h2>
          {hint ? (
            <p className="m-0 mt-1 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
              {hint}
            </p>
          ) : null}
        </div>
      </div>
      {aside ? (
        <div className="flex shrink-0 items-center gap-3">{aside}</div>
      ) : null}
    </div>
  );
}

/** The "← Reservas" over a detail page. A class, so it goes on the router's own `Link`. */
export const BACK_LINK_CLASS =
  "inline-flex items-center gap-1.5 text-[15px] font-medium text-[var(--color-primary)] hover:underline [&_svg]:h-4 [&_svg]:w-4";

/**
 * One fact in a detail card: a muted label and its value under it.
 *
 * Label above value, the shape the account's own details already used, and
 * no tracked capitals over it — the done pages dropped those everywhere.
 */
export function Fact({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-sm text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className="m-0 mt-1 text-[15px] leading-normal [overflow-wrap:anywhere] text-[var(--color-ink-2)]">
        {children}
      </dd>
    </div>
  );
}

/** A line of secondary text: 13–14px muted, never the 12px `type-caption`. */
export const MUTED_SMALL =
  "text-[13.5px] leading-normal text-[var(--color-muted-foreground)]";

/** A field's label: 14.5px semibold navy, 8px above the control. */
export const FIELD_LABEL =
  "text-[14.5px] font-semibold text-[var(--color-headline)]";

/**
 * The numbered "what happens next" list the quote rails draw — a disc on the
 * soft blue ground, the step, and one line under it.
 */
export function NumberedSteps({
  steps,
}: {
  steps: readonly { key: string; title: ReactNode; body?: ReactNode }[];
}) {
  return (
    <ol className="m-0 grid list-none gap-4 p-0">
      {steps.map((step, index) => (
        <li key={step.key} className="flex items-start gap-3.5">
          <span
            aria-hidden="true"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-blue-soft)] text-sm font-bold text-[var(--color-primary)]"
          >
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="m-0 text-[15px] font-semibold text-[var(--color-headline)]">
              {step.title}
            </p>
            {step.body ? (
              <p className={cn("m-0 mt-0.5", MUTED_SMALL)}>{step.body}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
