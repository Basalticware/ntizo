/**
 * The top of a browse page: a small eyebrow, the 44px title and one line
 * under it — the size `PageIntro` and the consoles use, so a list reads as
 * the same system as every other page.
 *
 * Shared by `/services` and `/providers` so the twins open the same way. It
 * replaced a hero with a photograph and a quote panel bleeding to the
 * window's edge (October 2026): artwork that pushed the results a screen
 * down and said nothing the title did not.
 *
 * `title` is the page's `h1`. A newline in it is a soft break in the copy,
 * not a layout: at 44px the title fits one line, so it is read as a space.
 */
export function BrowseHead({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <section className="pt-9 pr-[var(--pw-pad)] pb-1 pl-[var(--pw-pad)]">
      <p className="text-[13px] leading-[1.2] font-bold tracking-[0.04em] text-[var(--color-primary)] uppercase">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-[30px] leading-[1.08] font-extrabold tracking-[-0.02em] text-[var(--color-headline)] md:text-[44px]">
        {title}
      </h1>
      <p className="mt-[7px] text-[16.5px] leading-relaxed text-[var(--color-muted-foreground)]">
        {subtitle}
      </p>
    </section>
  );
}
