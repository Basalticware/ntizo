import type { ReactNode } from "react";

/**
 * The top of a browse page: a photograph across the window with the title on
 * its left, one line under it, and the page's own search bar sitting over
 * the photograph's bottom edge (October 2026 list-with-sidebar mockup).
 *
 * Shared by `/services` and `/providers` so the twins open the same way. The
 * photograph is the home page's own electrician — the one licensed picture
 * the platform has — under a fade from the page's ground on the left to
 * clear on the right, so the navy title reads over it in both themes.
 *
 * **The phone gets no photograph.** At 390px the fade would have to cover
 * the whole picture for the title to read, which leaves a grey band where a
 * photograph was; the head is the title, the line and the bar, as before.
 *
 * `title` is the page's `h1`. A newline in it splits the two lines the
 * mockup draws, and the second one wears the brand blue. A narrowed title
 * ("Serviços em Maputo") has no newline and is one navy line.
 *
 * What the mockup adds and this leaves out: a "Centenas de prestadores
 * verificados" badge, which is not true of the platform, and a handwritten
 * line over the photograph.
 */
export function BrowseHead({
  title,
  subtitle,
  search,
}: {
  title: string;
  subtitle: string;
  /** The page's `BrowseSearchForm`, drawn over the photograph's foot. */
  search: ReactNode;
}) {
  const [first, ...rest] = title.split("\n");
  const second = rest.join(" ").trim();
  return (
    <section className="relative">
      <div className="relative overflow-hidden md:min-h-[330px]">
        <img
          src="/images/home-hero.jpg"
          alt=""
          data-testid="browse-hero-photo"
          className="absolute inset-0 hidden h-full w-full object-cover object-[78%_30%] md:block"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden bg-[linear-gradient(90deg,var(--color-background)_0%,var(--color-background)_32%,color-mix(in_srgb,var(--color-background)_55%,transparent)_55%,transparent_78%)] md:block"
        />
        <div className="relative pt-7 pr-[var(--pw-pad)] pb-5 pl-[var(--pw-pad)] md:pt-12 md:pb-[72px]">
          <h1 className="max-w-[620px] text-[30px] leading-[1.06] font-extrabold tracking-[-0.025em] text-[var(--color-headline)] md:text-[48px]">
            {first}
            {second && (
              <>
                <br />
                <span className="text-[var(--color-primary)]">{second}</span>
              </>
            )}
          </h1>
          <p className="mt-3 max-w-[520px] text-[16px] leading-relaxed text-[var(--color-ink-2)] md:text-[17px]">
            {subtitle}
          </p>
        </div>
      </div>
      {/* Over the photograph's foot from `md`: half on it, half on the page. */}
      <div className="relative z-[1] pr-[var(--pw-pad)] pl-[var(--pw-pad)] md:-mt-[38px]">{search}</div>
    </section>
  );
}
