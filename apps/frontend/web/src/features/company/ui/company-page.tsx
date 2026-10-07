import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/features/landing/ui/footer";
import { SectionHead } from "@/features/landing/ui/section-head";
import { SiteHeader } from "@/shared/components/site-header";
import {
  CARD_BODY_CLASS,
  CARD_TITLE_CLASS,
  PUBLIC_CARD_CLASS,
  PUBLIC_PAGE_CLASS,
  PageIntro,
} from "@/features/landing/ui/public-page";

export type CompanyPageId = "about" | "contact" | "feedback" | "careers" | "help";

/**
 * The strip's candidates, in priority order. A page shows the first three
 * that are not itself. `/help` joins this list ahead of `about` — the FAQ is
 * a more likely next stop from a company page than the about page is.
 */
const STRIP: ReadonlyArray<{ id: CompanyPageId; to: string }> = [
  { id: "contact", to: "/contact" },
  { id: "feedback", to: "/feedback" },
  { id: "help", to: "/help" },
  { id: "about", to: "/about" },
  { id: "careers", to: "/careers" },
];

/**
 * The frame every company page wears.
 *
 * **On the home page's rules since 2026-09-07.** It used to open with a
 * compact dark band — `SiteHeader overlay` over near-black with two blurred
 * blue circles behind it — on a `#f2f8fe` ground, and it ended with three
 * cells sharing one rounded outer border. That was a system of its own, and
 * the site has one: white, `--color-headline` navy, `CARD_SURFACE_CLASS` for
 * anything that is its own object, and the header solid because there is no
 * artwork left for it to sit on.
 *
 * The eyebrow went with it. A tracked-out uppercase label over every heading
 * is the tell the listings and the home both removed; where an eyebrow was the
 * only thing naming a block, it became that block's heading instead of
 * disappearing.
 *
 * **On the October 2026 system since.** The title is the 44px heading the
 * consoles and the listings share (`PageIntro`), the inset is `/services`'
 * own (`PUBLIC_PAGE_CLASS`), cards carry the system's 24px padding, and the
 * way on from a card is the brand blue's arrow.
 *
 * Below the page's own sections, the "see also" strip and the footer, the
 * same on all five — which is how a reader who landed on the wrong page
 * reaches the right one without scrolling for the footer.
 */
export function CompanyPage({
  page,
  title,
  lede,
  centred = false,
  seeAlso = true,
  children,
}: {
  page: CompanyPageId;
  /**
   * Whether to draw the "see also" strip. `/about` turns it off: it ends on
   * its own two doors, and the footer under them links the same pages.
   */
  seeAlso?: boolean;
  title: ReactNode;
  lede: string;
  /** The form pages centre their opening, because the form under it is centred. */
  centred?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation("company");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const strip = STRIP.filter((link) => link.id !== page).slice(0, 3);

  return (
    <main className={PUBLIC_PAGE_CLASS}>
      <SiteHeader current="none" />

      <PageIntro title={title} lede={lede} centred={centred} />

      {children}

      {seeAlso && (
        <section className="public-inset border-t border-[var(--color-border)] pt-12 pb-14">
          <SectionHead title={t("shared.seeAlso")} />
          <div className="grid gap-6 md:grid-cols-3">
            {strip.map((link) => (
              <Link
                key={link.id}
                to={link.to}
                search={link.id === "feedback" ? { from: pathname } : undefined}
                className={`group no-underline hover:border-[var(--color-blue-line)] ${PUBLIC_CARD_CLASS}`}
              >
                <span className={`flex items-center gap-1.5 ${CARD_TITLE_CLASS}`}>
                  {t(`shared.links.${link.id}.title`)}
                  <ArrowRight
                    className="h-4 w-4 text-[var(--color-primary)]"
                    strokeWidth={2.4}
                    aria-hidden="true"
                  />
                </span>
                <span className={`mt-1.5 block ${CARD_BODY_CLASS}`}>
                  {t(`shared.links.${link.id}.body`)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Footer />
    </main>
  );
}
