import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check } from "lucide-react";

/**
 * The offer made to somebody thinking about listing their work — the
 * October 2026 home mockup's navy band.
 *
 * Full width, the page's only dark surface: the pitch and its two ways in on
 * the left, four ticked points in the middle, and a provider's photograph
 * with the quote panel on the right.
 *
 * **Every point is one the platform keeps.** The mockup's "Pagamentos
 * seguros" became "Pagamento por M-Pesa" — the platform holds no money, so
 * "safe payments" promised more than it does — and its body's "junte-se a
 * centenas de profissionais" is gone: no number here is one anything serves.
 * The copy is not a headline percentage either: the commission is
 * per-provider, so a figure would be wrong for everybody not on the default.
 *
 * The photograph is the hero's own electrician, cropped to him; it goes
 * below `xl`, where the text needs the width.
 */
export function ProviderBand() {
  const { t } = useTranslation("landing"); // t:ProviderBand
  const points = [
    t("home.bandPoints.clients"),
    t("home.bandPoints.simple"),
    t("home.bandPoints.payment"),
    t("home.bandPoints.support"),
  ];

  return (
    <section className="mt-12 overflow-hidden bg-[var(--color-navy-surface)] text-[var(--color-navy-on)]">
      <div className="public-inset grid items-center gap-8 py-9 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_auto_260px] lg:py-0">
        <div className="lg:py-8">
          <h2 className="text-[24px] leading-[1.15] font-extrabold tracking-[-0.01em] whitespace-pre-line md:text-[30px]">
            {t("home.bandTitle")}
          </h2>
          <p className="mt-3 max-w-[52ch] text-[16px] leading-relaxed text-[var(--color-navy-on)]/80">
            {t("home.bandBody")}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-7 gap-y-3">
            {/* White on the navy, as the mockup draws it: the band's one
                filled shape. The navy text is the band's own ground, so it
                inverts with the theme along with it. */}
            <Link
              to="/become-provider"
              className="inline-flex h-11 items-center rounded-full bg-[var(--color-navy-on)] px-7 text-[15px] font-semibold text-[var(--color-navy-surface)] hover:opacity-90"
            >
              {t("home.bandCta")}
            </Link>
            <Link
              to="/become-provider"
              className="inline-flex items-center gap-2 text-[15px] font-semibold hover:underline"
            >
              {t("home.bandLink")}
              <ArrowRight className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <ul className="grid gap-3 lg:border-l lg:border-[var(--color-navy-on)]/20 lg:py-2 lg:pl-10">
          {points.map((p) => (
            <li key={p} className="flex items-center gap-3 text-[16px] text-[var(--color-navy-on)]/95">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-blue-public)]">
                <Check className="h-3 w-3 text-white" strokeWidth={3.4} aria-hidden="true" />
              </span>
              {p}
            </li>
          ))}
        </ul>
        <div aria-hidden="true" className="relative hidden h-[236px] self-end xl:block">
          <img
            src="/images/home-provider.jpg"
            alt=""
            className="absolute bottom-0 left-0 h-[236px] w-auto max-w-none [mask-image:linear-gradient(to_right,transparent,black_30%)]"
          />
          <p className="absolute top-6 right-0 w-[150px] rounded-xl bg-[var(--color-info-bg)] px-4 py-3 text-[14px] leading-[1.4] whitespace-pre-line text-[var(--color-headline)]">
            {t("home.bandQuote")}
            <span className="absolute -right-1.5 -bottom-1.5 h-5 w-5 rounded-full bg-[var(--color-blue-outline)]" />
          </p>
        </div>
      </div>
    </section>
  );
}
