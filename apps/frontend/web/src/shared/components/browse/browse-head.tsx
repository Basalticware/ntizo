import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";

/**
 * The top of a browse page: a short breadcrumb, the title and one line under
 * it — the size `PageIntro` and the consoles use, so a list reads as the same
 * system as every other page.
 *
 * Shared by `/services` and `/providers` so the twins open the same way. It
 * replaced a hero with a photograph and a quote panel bleeding to the
 * window's edge (October 2026): artwork that pushed the results a screen
 * down and said nothing the title did not. The October 2026 list mockup puts
 * a photograph of the city back beside the title; there is still no licensed
 * one, so the head stays text rather than faking it.
 *
 * The breadcrumb took the eyebrow's place, as in that mockup: "Início › "
 * and the page's own name, which is the one word the eyebrow said. Only the
 * home is a link — the last crumb is where the reader already is.
 *
 * `title` is the page's `h1`. A newline in it is a soft break in the copy,
 * not a layout: at 44px the title fits one line, so it is read as a space.
 */
export function BrowseHead({
  crumb,
  title,
  subtitle,
}: {
  /** The page's own name, the breadcrumb's last step. */
  crumb: string;
  title: string;
  subtitle: string;
}) {
  const { t } = useTranslation("directory");
  return (
    <section className="pt-7 pr-[var(--pw-pad)] pb-1 pl-[var(--pw-pad)]">
      <nav aria-label={t("breadcrumbLabel")}>
        <ol className="flex list-none items-center gap-1.5 p-0 text-[13px] leading-[1.2] text-[var(--color-muted-foreground)]">
          <li>
            <Link to="/" className="hover:text-[var(--color-headline)] hover:underline">
              {t("breadcrumbHome")}
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          </li>
          <li aria-current="page" className="font-semibold text-[var(--color-ink-2)]">
            {crumb}
          </li>
        </ol>
      </nav>
      <h1 className="mt-3 text-[30px] leading-[1.08] font-extrabold tracking-[-0.02em] text-[var(--color-headline)] md:text-[44px]">
        {title}
      </h1>
      <p className="mt-[7px] text-[16.5px] leading-relaxed text-[var(--color-muted-foreground)]">
        {subtitle}
      </p>
    </section>
  );
}
