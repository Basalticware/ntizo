import { useTranslation } from "react-i18next";

/**
 * The home's photograph: `/services`' own hero artwork, at its own size,
 * bleeding to the window's right edge with the sky-blue quote over it.
 *
 * It replaced three empty brand tiles. Ntizo still owns no photographs of
 * its providers' work, and this one is the site's artwork rather than a
 * claim about anybody — the same picture `BrowseHero` draws, so the home and
 * the listing it leads to open on one image. The quote is drawn as text over
 * the picture's own panel so it follows the reader's language; it is the
 * directory namespace's `browseHeroQuote`, the same words the listing prints.
 *
 * At its natural 730×205 and never scaled up: the file is that size, and a
 * blown-up photograph is worse than a short one.
 *
 * `hidden xl:block`: below the two-column hero it would be a strip between
 * the claim and the categories, and the phone reaches the categories sooner
 * without it.
 */
export function HeroCollage() {
  const { t } = useTranslation("directory");
  return (
    <div
      aria-hidden="true"
      data-testid="hero-photo"
      className="relative hidden h-[203px] self-start overflow-hidden xl:block"
    >
      <img
        src="/images/services-hero.jpg"
        alt=""
        className="block h-[205px] w-[730px] max-w-none object-cover object-left"
      />
      <p className="absolute top-[38px] left-[488px] w-[216px] rounded-xl bg-[var(--color-info-bg)] pt-4 pr-5 pb-[18px] pl-6 text-[17px] leading-[1.45] whitespace-pre-line text-[var(--color-headline)]">
        {t("browseHeroQuote")}
      </p>
    </div>
  );
}
