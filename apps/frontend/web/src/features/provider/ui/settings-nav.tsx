import { useEffect, useState } from "react";
import { cn } from "@ntizo/frontend-ui";

export interface SettingsSection {
  id: string;
  label: string;
  /** The line under the label: what the section holds. */
  hint?: string;
  icon: React.ReactNode;
  /** Drives the unsaved dot. */
  dirty?: boolean;
  tone?: "danger";
}

/**
 * Which section is on screen.
 *
 * `IntersectionObserver` with a top-heavy root margin rather than a scroll
 * handler doing arithmetic: the browser already knows where these elements
 * are, and asking it costs nothing per frame. The margin pulls the trigger
 * line to roughly a quarter down the viewport so a heading becomes "current"
 * when you arrive at it, not when it is about to leave.
 */
function useCurrentSection(ids: readonly string[]): string | null {
  const [current, setCurrent] = useState<string | null>(ids[0] ?? null);

  // A string, not the array. `sections.map(...)` allocates a fresh array on
  // every render, so an array dependency re-ran this effect on every render —
  // and because the effect sets state, each run scheduled the next. It
  // converged, but it tore the observer down and rebuilt it continuously for
  // no reason. A joined key changes only when the sections do.
  const key = ids.join(",");

  useEffect(() => {
    const ids = key.split(",");
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // The first in document order among those on screen — scrolling down
        // past a section boundary should advance, not jump to whichever
        // observer callback fired last.
        const first = ids.find((id) => visible.has(id));
        if (first) setCurrent(first);
      },
      { rootMargin: "-25% 0px -60% 0px" },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [key]);

  return current;
}

/**
 * The rail beside the settings form.
 *
 * Anchor links, not tabs or routes. Every section stays rendered and
 * scrollable, which is what makes the single save bar at the bottom honest —
 * it saves the whole page, so the whole page has to be reachable without
 * losing an edit made three sections up.
 *
 * Hidden below `lg`, where the sections simply stack: a nav rail that eats a
 * third of a phone screen to save two thumb-flicks is not a trade worth
 * making.
 */
export function SettingsNav({
  sections,
  title,
}: {
  sections: readonly SettingsSection[];
  title: string;
}) {
  const ids = sections.map((s) => s.id);
  const current = useCurrentSection(ids);

  return (
    <nav aria-label={title} className="hidden 2xl:block">
      {/* One white box, as the section cards are; the current section on the
          soft blue ground with the brand bar on its left edge. */}
      <ul className="sticky top-6 grid gap-1 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card)] px-3 pt-2.5 pb-3">
        {sections.map((section) => {
          const active = current === section.id;
          return (
            // `min-w-0` because a grid item defaults to `min-width: auto`,
            // which refuses to shrink below its content — so the row grew
            // past the rail instead of letting the label truncate.
            <li key={section.id} className="relative min-w-0">
              {active && (
                <span
                  aria-hidden
                  className="absolute top-1/2 -left-3 h-[50px] w-[3px] -translate-y-1/2 rounded-r-sm bg-[var(--color-primary)]"
                />
              )}
              <a
                href={`#${section.id}`}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex gap-4 rounded-[9px] py-3 pr-2 pl-2.5 transition-colors",
                  active
                    ? "bg-[var(--color-blue-soft)] text-[var(--color-primary)]"
                    : "text-[var(--color-headline)] hover:bg-[color-mix(in_srgb,var(--color-blue-soft)_50%,transparent)]",
                  section.tone === "danger" && !active && "text-[var(--color-destructive)]",
                )}
              >
                <span className="mt-1 shrink-0 [&_svg]:h-[21px] [&_svg]:w-[21px]">{section.icon}</span>
                <span className="grid min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14.5px] leading-[19px] font-medium">{section.label}</span>
                    {section.dirty && (
                      // The one thing this rail knows that the headings don't:
                      // where the unsaved edit is, when it has been scrolled off.
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]"
                      />
                    )}
                  </span>
                  {section.hint && (
                    <span className="mt-0.5 text-[13px] leading-[1.4] text-[var(--color-muted-foreground)]">
                      {section.hint}
                    </span>
                  )}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
