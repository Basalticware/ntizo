import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SectionHead } from "@/features/landing/ui/section-head";
import { CompanyPage } from "./company-page";
import { buttonVariants } from "@ntizo/frontend-ui";
import {
  CARD_BODY_CLASS,
  CARD_TITLE_CLASS,
  PUBLIC_CARD_CLASS,
  STEP_MARKER_CLASS,
} from "@/features/landing/ui/public-page";

/**
 * Who Ntizo is, told through what the product does — mission, the three
 * steps, two audiences. No founding year, no city, no names: the owner chose
 * (2026-09-02) not to publish them.
 *
 * Four blocks since October 2026. "Four rules" went — each one restated a
 * step or the mission — and so did the "see also" strip, which repeated the
 * footer directly under it.
 *
 * Drawn on the home page's rules since 2026-09-07. The blue half-headline,
 * the blue `01`/`02`/`03`, the eyebrow over every block and the rounded
 * cells sharing one outer border are gone; what replaced them is what the
 * home uses — `SectionHead`, `CARD_SURFACE_CLASS` per block, and navy where
 * something is affirmative.
 */
export function AboutPage() {
  const { t } = useTranslation("company");

  return (
    <CompanyPage
      page="about"
      seeAlso={false}
      title={`${t("about.heading")} ${t("about.headingAccent")}.`}
      lede={t("about.lede")}
    >
      {/* The mission statement is the heading. It used to sit under an
          eyebrow reading "Our mission", which said less than the sentence
          below it did. Two calm columns on the page itself, not a card: it
          is the page's argument, not one item among several. */}
      <section className="public-inset pb-14">
        <div className="grid gap-6 md:grid-cols-[1fr_1fr] md:gap-14">
          <h2 className="max-w-[24ch] text-[24px] leading-[1.15] font-extrabold tracking-[-0.02em] text-[var(--color-headline)] md:text-[28px]">
            {t("about.missionTitle")}
          </h2>
          <div className="text-[16px] leading-relaxed text-[var(--color-ink-2)]">
            <p>{t("about.mission1")}</p>
            <p className="mt-4">{t("about.mission2")}</p>
          </div>
        </div>
      </section>

      {/* These three keep their numbers: search, book, pay is an order, and
          the whole point of the section is that paying comes last. Small soft
          blue markers, the same shape the provider pitch's steps use — not
          outlined `01`s the size of a heading. */}
      <section className="public-inset pb-14">
        <SectionHead title={t("about.howTitle")} />
        <ol className="grid list-none gap-6 p-0 md:grid-cols-3">
          {(["search", "book", "pay"] as const).map((key, i) => (
            <li key={key} className={PUBLIC_CARD_CLASS}>
              <span aria-hidden="true" className={`mb-4 ${STEP_MARKER_CLASS}`}>
                {i + 1}
              </span>
              <h3 className={CARD_TITLE_CLASS}>{t(`about.steps.${key}.title`)}</h3>
              <p className={`mt-1.5 ${CARD_BODY_CLASS}`}>
                {t(`about.steps.${key}.body`)}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="public-inset pb-14">
        <div className="grid gap-6 md:grid-cols-2">
          <Audience
            title={t("about.customersTitle")}
            body={t("about.customersBody")}
            cta={t("about.customersCta")}
            to="/services"
          />
          <Audience
            title={t("about.providersTitle")}
            body={t("about.providersBody")}
            cta={t("about.providersCta")}
            to="/become-provider"
          />
        </div>
      </section>
    </CompanyPage>
  );
}

/**
 * One of the two doors off this page.
 *
 * Both are the same button — the system's `secondary`, outlined in blue — and
 * neither is filled. They used to be a filled blue pill and an outlined one,
 * which ranked them: the customer's way out was the loud one and the
 * provider's the quiet one, on a page whose whole last section exists to
 * offer both. Two equal buttons keep them unranked.
 */
function Audience({
  title,
  body,
  cta,
  to,
}: {
  title: string;
  body: string;
  cta: string;
  to: string;
}) {
  return (
    <article className={PUBLIC_CARD_CLASS}>
      <h3 className="text-[20px] font-bold tracking-[-0.01em] text-[var(--color-headline)]">
        {title}
      </h3>
      <p className={`mt-2.5 ${CARD_BODY_CLASS}`}>{body}</p>
      <Link to={to} className={`mt-5 ${buttonVariants({ variant: "secondary", size: "sm" })}`}>
        {cta}
      </Link>
    </article>
  );
}
