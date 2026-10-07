import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { buttonVariants } from "@ntizo/frontend-ui";

/**
 * The offer made to somebody thinking about listing their work.
 *
 * The page's only dark surface, and full width rather than a rounded box
 * floating in the page — a navy card with two blurred circles on it was the
 * last piece of the template. It carries no ornament of its own; the navy
 * ground is the whole of it.
 *
 * The copy is deliberately not a headline percentage: the commission is
 * per-provider, so a number printed here would be wrong for everybody not on
 * the default.
 */
export function ProviderBand() {
  const { t } = useTranslation("landing"); // t:ProviderBand
  const facts = [
    { title: t("home.factPriceTitle"), body: t("home.factPriceBody") },
    { title: t("home.factAgendaTitle"), body: t("home.factAgendaBody") },
    { title: t("home.factMoneyTitle"), body: t("home.factMoneyBody") },
  ];

  return (
    <section className="relative mt-16 overflow-hidden bg-[var(--color-navy-surface)] text-[var(--color-navy-on)]">
      <div className="public-inset relative z-[1] grid items-center gap-14 py-16 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <h2 className="max-w-[18ch] text-[30px] leading-[1.08] font-extrabold tracking-[-0.02em] md:text-[36px]">
            {t("home.bandTitle")}
          </h2>
          <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-[var(--color-navy-on)]/75">
            {t("home.bandBody")}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-6">
            {/* The site's own primary button — blue, 47px — which reads on
                the navy as it does on white. It was a white pill of its own
                before the October system gave every page one button. */}
            <Link
              to="/become-provider"
              className={buttonVariants()}
            >
              {t("home.bandCta")}
            </Link>
            {/* No colour class of its own: it inherits `--color-navy-on` from
                this section's own `text-[…]`, which is already the
                dark-aware light text this band needs — the same reason it
                reads fine in both themes without repeating the fix above. */}
            <Link
              to="/become-provider"
              className="text-[15px] font-semibold underline decoration-[var(--color-navy-on)]/40 underline-offset-4"
            >
              {t("home.bandLink")}
            </Link>
          </div>
        </div>
        <ul className="grid gap-3.5 border-l border-[var(--color-navy-on)]/20 pl-7">
          {facts.map((f) => (
            <li key={f.title} className="text-[15px] leading-snug text-[var(--color-navy-on)]/90">
              <b className="block text-[17px] font-bold text-[var(--color-navy-on)]">{f.title}</b>
              {f.body}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
