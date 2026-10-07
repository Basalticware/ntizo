import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SECTION_TITLE_CLASS } from "@/features/landing/ui/public-page";

/**
 * One heading shape for every section on the page.
 *
 * The title and its line on the left, the way out on the right, aligned on the
 * title's baseline rather than the blurb's last line — a two-line blurb used to
 * drag the link down and put it in a different place in every section.
 *
 * The sizes are the system's section title (22px, navy) and the listings' own
 * "Ver todas →": the link in the brand blue with its arrow, as `/services`'
 * popular categories draw it.
 *
 * **It only reads as a row when there is room for one.** Below `sm` the link
 * took its own share of a 390px line and left the blurb three words wide, so
 * "Escolha um ofício para ver quem trabalha nele." ran down four ragged lines
 * beside it while the heading above wrapped as well. Stacked, each part gets
 * the full column: title, line, then the way out under them both.
 */
export function SectionHead({
  title,
  blurb,
  more,
}: {
  title: string;
  blurb?: string;
  more?: { label: string; to: string };
}) {
  return (
    <div className="mb-5 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
      <div>
        <h2 className={SECTION_TITLE_CLASS}>{title}</h2>
        {blurb ? (
          <p className="mt-1.5 text-[15px] text-[var(--color-muted-foreground)]">{blurb}</p>
        ) : null}
      </div>
      {more ? (
        <Link
          to={more.to}
          className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-[var(--color-primary)] hover:underline"
        >
          {more.label}
          <ArrowRight className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
