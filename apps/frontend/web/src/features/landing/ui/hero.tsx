import { useTranslation } from "react-i18next";
import { Tag, ShieldCheck, Smartphone } from "lucide-react";
import { SiteHeader } from "@/shared/components/site-header";
import { HeroCollage } from "@/features/landing/ui/hero-collage";

/**
 * The offer and three photographs.
 *
 * White, not artwork. The header used to sit on a generated gradient with a
 * wave cut out of the bottom of it, which is why it needed `overlay`; the
 * page now begins where every other public page begins, so the header is the
 * ordinary solid one. `overlay` stays on the component because the company
 * pages still pass it; `become-provider` stopped on 2026-09-07, when it moved
 * onto these same rules, and `SurfaceArt` went with it — that page held its
 * last five usages.
 *
 * The headline is the offer in a customer's words. "Encontre. Reserve.
 * Feito." was a slogan that said nothing about what is being sold, and is
 * gone rather than moved — the section it used to title, "Como funciona",
 * was removed from the page outright.
 *
 * The search is gone from here too, and for the same reason: it is in the
 * header on every page now, so a field under the subtitle would be the same
 * question asked twice in one screenful.
 *
 * **Type and colour are `/services`' hero's** (October 2026): the 53px navy
 * title, the 17px grey line, the brand-blue glyphs — so the home and the
 * listing it leads to read as one site. The photograph beside it is the same
 * artwork that hero carries.
 *
 * The provider's door is deliberately not in this header. It sat among the
 * destinations for one day and cost the search bar its centring on this page
 * alone — the "centring that failed" look the user had already rejected twice
 * — so he asked for it removed. The footer's Company column carries
 * `/become-provider` on every page, and the navy band further down this one is
 * the provider's real invitation.
 */
export function Hero() {
  const { t } = useTranslation("landing"); // t:Hero

  return (
    <>
      <SiteHeader />
      {/* `lg:pb-14`, not `pb-14`. Every section on this page is separated
          from the one above it by the 56px of its own `pt-14` and nothing
          else; this one also paid 56px on the way out, which balances the
          collage sitting beside the text on a wide screen. On a phone the
          collage is gone and the two paddings simply stacked — 112px of white
          between the last trust claim and "Explorar por categoria", measured
          at 390px on the deployed page. The phone now falls back to the same
          rhythm as every other junction. */}
      {/* `/services`' hero grid: the text inset by the page's `--pw-pad`,
          the photograph running out to the window's right edge. */}
      <section className="mx-auto grid max-w-[1440px] lg:grid-cols-[minmax(0,1fr)_minmax(0,730px)] lg:gap-x-6 lg:pb-14">
        <div className="pt-[22px] pr-[var(--pw-pad)] pl-[var(--pw-pad)] lg:pr-0">
          <h1 className="max-w-[13ch] text-[36px] leading-[1.02] font-extrabold tracking-[-0.02em] text-[var(--color-headline)] lg:text-[53px]">
            {t("home.heroTitle")}
          </h1>
          <p className="mt-3.5 max-w-[46ch] text-[17px] leading-normal text-[var(--color-muted-foreground)]">
            {t("home.heroSubtitle")}
          </p>
          {/* Three claims the read models can support today. The version this
              replaces promised "payment held until it's done", which nothing
              on the platform does. */}
          <ul className="mt-7 flex flex-wrap gap-x-7 gap-y-3">
            {[
              { Icon: Tag, label: t("home.proofPrice") },
              { Icon: ShieldCheck, label: t("home.proofVerified") },
              { Icon: Smartphone, label: t("home.proofPayment") },
            ].map(({ Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-2.5 text-[15px] font-medium text-[var(--color-ink-2)]"
              >
                <Icon
                  className="h-5 w-5 text-[var(--color-primary)]"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                {label}
              </li>
            ))}
          </ul>
        </div>
        <HeroCollage />
      </section>
    </>
  );
}
