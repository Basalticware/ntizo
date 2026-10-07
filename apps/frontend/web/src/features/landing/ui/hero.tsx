import { useTranslation } from "react-i18next";
import { BadgeCheck, ShieldCheck, Smartphone } from "lucide-react";
import { SiteHeader } from "@/shared/components/site-header";
import { BrowseSearchBar } from "@/features/directory/services/ui/browse-hero";

/**
 * The offer, on a photograph, with the search under it — the October 2026
 * home mockup.
 *
 * **The photograph is full-bleed** and the text sits on it in white. The
 * picture is bright, so a dark gradient runs in from the left edge to carry
 * the words; on a phone, where the text spans the whole width, the scrim is
 * an even wash instead. Black at an opacity rather than a token: it is a
 * shade over a photograph, which looks the same in either theme.
 *
 * **The search is back in the hero**, and out of the header on this one page
 * (`withSearch={false}`). It is `/services`' own bar — the term, the city and
 * "Pesquisar" — submitting to `/services?q=&city=`, so the home asks the
 * question the way the listing it opens does. Two fields in one screenful
 * was the reason it left the hero in September; the mockup answers that by
 * taking the header's away here instead.
 *
 * The three claims under it are the ones the read models support. The
 * mockup's third said "Pagamento seguro", which suggests money held on the
 * customer's behalf; nothing on the platform does that, so it says M-Pesa.
 *
 * The quote panel sits bottom-right from `xl`. Below that the search bar
 * needs the width, and the panel would land on top of it.
 */
export function Hero() {
  const { t } = useTranslation("landing"); // t:Hero

  return (
    <>
      <SiteHeader />
      <section className="relative isolate overflow-hidden">
        <img
          src="/images/home-hero.jpg"
          alt=""
          data-testid="hero-photo"
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[72%_28%]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-black/55 md:bg-transparent md:bg-gradient-to-r md:from-black/80 md:via-black/45 md:via-45% md:to-black/0 md:to-75%"
        />
        <div className="public-inset grid gap-8 pt-10 pb-8 md:min-h-[400px] md:pt-12 xl:grid-cols-[minmax(0,1fr)_216px] xl:items-end">
          <div>
            <h1 className="max-w-[13ch] text-[36px] leading-[1.02] font-extrabold tracking-[-0.02em] text-white xl:text-[53px]">
              {t("home.heroTitle")}
            </h1>
            <p className="mt-3.5 max-w-[46ch] text-[17px] leading-normal text-white/90">
              {t("home.heroSubtitle")}
            </p>
            <div className="mt-6 max-w-[763px]">
              <BrowseSearchBar current={{}} />
            </div>
            {/* Two even columns on a phone: as a wrapping row the first item
                shrank and its second line ran into the next item's disc. */}
            <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-12">
              {[
                { Icon: BadgeCheck, label: t("home.proofPrice") },
                { Icon: ShieldCheck, label: t("home.proofVerified") },
                { Icon: Smartphone, label: t("home.proofPayment") },
              ].map(({ Icon, label }) => (
                <li
                  key={label}
                  className="flex min-w-0 items-center gap-2.5 text-[13.5px] leading-[1.35] font-semibold whitespace-pre-line text-white sm:gap-3 sm:text-[14px]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white">
                    <Icon
                      className="h-5 w-5 text-[var(--color-blue-public)]"
                      strokeWidth={2.2}
                      aria-hidden="true"
                    />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <p
            data-testid="hero-quote"
            className="relative hidden rounded-xl bg-[var(--color-info-bg)] pt-4 pr-5 pb-[18px] pl-6 text-[17px] leading-[1.45] whitespace-pre-line text-[var(--color-headline)] xl:block"
          >
            {t("home.heroQuote")}
            <span
              aria-hidden="true"
              className="absolute -right-2 -bottom-2 h-6 w-6 rounded-full bg-[var(--color-blue-outline)]"
            />
          </p>
        </div>
      </section>
    </>
  );
}
