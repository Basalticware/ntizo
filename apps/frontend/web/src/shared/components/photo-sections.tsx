import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@ntizo/frontend-ui";

/**
 * The public pages' building blocks — the home page's, at page scale. The
 * company pages and `/become-provider` are built from them, which is why they
 * live here rather than in either feature.
 *
 * The photographs under `/images/company/` are the demo seed's stock
 * pictures (`packages/backend/scripts/demo-photos/CREDITS.md`), all free for
 * commercial use under the Pexels or Unsplash License:
 *
 * - `become-provider-why.jpg` — a worker in blue overalls, Divaris Shirichena (unsplash.com/photos/F4ox6XvbDps)
 * - `about-hero.jpg` — a barber at work, RDNE Stock project (pexels.com/photo/7697287)
 * - `about-mission.jpg` — a manicure at home, RDNE Stock project (pexels.com/photo/7755296)
 * - `careers-hero.jpg` — two builders in a corridor, Dave Garcia (pexels.com/photo/36153946)
 * - `careers-building.jpg` — an electrician wiring, Audy of Course (pexels.com/photo/20500461)
 * - `contact.jpg` — a gardener watering, Gustavo Fring (pexels.com/photo/4920238)
 * - `feedback.jpg` — a cleaner at a table, Tima Miroshnichenko (pexels.com/photo/6195194)
 */

/**
 * The opening on a photograph, as the home's `Hero` draws it: full-bleed,
 * white words, a dark gradient in from the left (an even wash on a phone,
 * where the words span the width). Black at an opacity rather than a token:
 * it is a shade over a photograph, the same in either theme.
 */
export function PhotoHero({
  photo,
  position = "center",
  title,
  lede,
  children,
}: {
  photo: string;
  /** The `object-position` that keeps the subject clear of the words. */
  position?: string;
  title: string;
  lede: string;
  /** Whatever follows the lede — a page's buttons, say. White words only. */
  children?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden">
      <img
        src={photo}
        alt=""
        style={{ objectPosition: position }}
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-black/55 md:bg-transparent md:bg-gradient-to-r md:from-black/80 md:via-black/45 md:via-45% md:to-black/0 md:to-75%"
      />
      <div className="public-inset flex min-h-[380px] flex-col justify-end pt-16 pb-12 md:min-h-[460px] md:justify-center md:pb-16">
        <h1 className="max-w-[14ch] text-[36px] leading-[1.02] font-extrabold tracking-[-0.02em] text-white xl:text-[53px]">
          {title}
        </h1>
        <p className="mt-4 max-w-[44ch] text-[17px] leading-normal text-white/90">{lede}</p>
        {children}
      </div>
    </section>
  );
}

/** A section's big heading: the home banner's 28–33px navy. */
export const SPLIT_TITLE_CLASS =
  "text-[28px] leading-[1.1] font-extrabold tracking-[-0.02em] text-[var(--color-headline)] sm:text-[33px]";

/** Running text beside a photograph. */
export const SPLIT_BODY_CLASS = "text-[16.5px] leading-relaxed text-[var(--color-ink-2)]";

/**
 * A photograph beside its words. The picture takes the larger share and goes
 * first on a phone; `flip` puts it on the right from `md`.
 */
export function PhotoSplit({
  photo,
  position = "center",
  flip = false,
  children,
}: {
  photo: string;
  position?: string;
  flip?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="public-inset pt-16 md:pt-20">
      <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-14">
        <img
          src={photo}
          alt=""
          style={{ objectPosition: position }}
          className={cn(
            "aspect-[4/3] w-full rounded-[14px] bg-[var(--color-muted)] object-cover",
            flip && "md:order-2",
          )}
        />
        <div>{children}</div>
      </div>
    </section>
  );
}

export interface IconItem {
  Icon: LucideIcon;
  title: string;
  body: string;
}

/**
 * Three things in a row, each an icon on a disc, a bold line and one
 * sentence — the home's `TrustBand` items. No box around any of them.
 *
 * `numbered` marks the discs 1, 2, 3 for a sequence and makes the list an
 * `<ol>`. `onBand` gives the discs the card colour, for the soft blue panel.
 * Four items go two by two until `xl`, where four in a row still leave each
 * sentence room.
 */
export function IconItems({
  items,
  numbered = false,
  onBand = false,
}: {
  items: readonly IconItem[];
  numbered?: boolean;
  onBand?: boolean;
}) {
  const List = numbered ? "ol" : "ul";
  return (
    <List
      className={cn(
        "m-0 grid list-none gap-7 p-0 sm:gap-8",
        items.length === 4 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3",
      )}
    >
      {items.map(({ Icon, title, body }, i) => (
        <li key={title} className="flex items-start gap-4">
          <span
            className={cn(
              "relative grid h-12 w-12 shrink-0 place-items-center rounded-full",
              onBand
                ? "bg-[var(--color-card)] shadow-[0_1px_3px_rgba(30,60,120,.08)]"
                : "bg-[var(--color-blue-softer)]",
            )}
          >
            <Icon className="h-[22px] w-[22px] text-[var(--color-primary)]" strokeWidth={2} aria-hidden="true" />
            {numbered && (
              <span
                aria-hidden="true"
                className="absolute -top-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-[var(--color-primary)] text-[11px] font-bold text-[var(--color-primary-foreground)] tabular-nums"
              >
                {i + 1}
              </span>
            )}
          </span>
          <span>
            <h3 className="text-[16px] leading-snug font-bold text-[var(--color-headline)]">{title}</h3>
            <p className="mt-1 text-[15px] leading-snug text-[var(--color-muted-foreground)]">{body}</p>
          </span>
        </li>
      ))}
    </List>
  );
}

/** The soft blue panel the home's trust band sits on, inside the page's inset. */
export function SoftBand({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className="public-inset pt-16 md:pt-20">
      <div className={cn("rounded-[14px] bg-[var(--color-blue-softer)] px-6 py-8 sm:px-10 sm:py-10", className)}>
        {children}
      </div>
    </section>
  );
}
