import type { ReactNode } from "react";
import { Calendar, MapPin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage, cn } from "@ntizo/frontend-ui";
import { initialsFrom } from "@/shared/lib/initials";

/**
 * The cells every console table in the mockups is made of. One definition,
 * so a list cannot draw its people at 40px and the next at 48, or put the
 * place under a name with a pin in one table and without it in another.
 */

/** A photo (or monogram), the name — usually the row's link — and the place under it. */
export function PersonCell({
  name,
  title,
  avatarUrl,
  place,
}: {
  /** Used for the monogram; `title` is what is drawn. */
  name: string;
  /** The name as drawn — a `Link` when the row leads somewhere. */
  title: ReactNode;
  avatarUrl?: string | null;
  place?: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-5">
      <Avatar className="h-[58px] w-[58px] shrink-0">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback className="bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] text-sm font-semibold text-[var(--color-primary)]">
          {initialsFrom(name)}
        </AvatarFallback>
      </Avatar>
      <div className="grid min-w-0 leading-tight">
        <div className="truncate text-base font-bold text-[var(--color-headline)]">{title}</div>
        {place && (
          <span className="mt-1 flex min-w-0 items-center gap-[5px] text-sm text-[var(--color-muted-foreground)]">
            <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{place}</span>
          </span>
        )}
      </div>
    </div>
  );
}

/** A bold line and a muted one under it: a service and what it is. */
export function TwoLineCell({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="grid min-w-0 leading-tight">
      <span className="truncate text-[15px] font-bold text-[var(--color-headline)]">{title}</span>
      {sub && <span className="mt-1 truncate text-sm text-[var(--color-muted-foreground)]">{sub}</span>}
    </div>
  );
}

/** The calendar glyph, the day, and the hours under it. */
export function WhenCell({ day, time }: { day: ReactNode; time: ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <Calendar aria-hidden="true" className="mt-0.5 h-[22px] w-[22px] shrink-0 text-[var(--color-primary)]" />
      <div className="grid leading-tight tabular-nums">
        <span className="text-[15px] font-medium text-[var(--color-headline)]">{day}</span>
        <span className="mt-1 text-sm text-[var(--color-muted-foreground)]">{time}</span>
      </div>
    </div>
  );
}

/**
 * The class for a row's "Ver detalhes" — an outlined blue button. A class
 * rather than a component so it goes on the router's `Link` itself and the
 * row stays one real link, not a button wrapped around one.
 */
export const DETAILS_BUTTON_CLASS = cn(
  "inline-flex h-10 items-center justify-center rounded-lg border border-[var(--color-blue-edge)] bg-[var(--color-card)] px-[22px] text-[15px] font-semibold whitespace-nowrap text-[var(--color-primary)]",
  "hover:bg-[color-mix(in_srgb,var(--color-primary)_6%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]",
);
