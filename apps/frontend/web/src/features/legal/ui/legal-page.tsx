import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { CONTACT } from "@/shared/lib/contact";
import { SiteHeader } from "@/shared/components/site-header";
import { Footer } from "@/features/landing/ui/footer";
import {
  PUBLIC_PAGE_CLASS,
  PageIntro,
  SECTION_TITLE_CLASS,
} from "@/features/landing/ui/public-page";

/**
 * The shared shape of both legal documents.
 *
 * One component, two routes, because a privacy policy and terms of service
 * differ only in their words. Sections come from the translation file as an
 * array so a translator can add or drop one without anybody editing this file
 * — and so the eight languages can legitimately differ in length, which they
 * will the moment one of them has to say something local.
 *
 * A public page like the rest since October 2026: the site's header, the
 * 44px title, prose at a reading measure, and the footer. It used to be a
 * bare `<main>` with no way onward but a link home.
 */
export interface LegalSection {
  heading: string;
  /** Paragraphs. Rendered as separate <p> so long documents stay readable. */
  body: string[];
}

export function LegalPage({ docKey }: { docKey: "privacy" | "terms" }) {
  const { t } = useTranslation("legal");
  // `returnObjects` because the sections are an array in the JSON. Typed
  // loosely on purpose: i18next cannot know the shape, and asserting it here
  // is the honest place to do it rather than pretending upstream.
  const sections = t(`${docKey}.sections`, { returnObjects: true }) as
    | LegalSection[]
    | string;

  return (
    <main className={PUBLIC_PAGE_CLASS}>
      <SiteHeader current="none" />

      {/* The way back sits above the title, as a breadcrumb would; the title
          and its date are every other public page's opening. */}
      <PageIntro
        title={t(`${docKey}.title`)}
        lede={t("lastUpdated", { date: t(`${docKey}.updated`) })}
        className="pb-8"
        before={
          <Link
            to="/"
            className="mb-4 inline-block text-sm font-semibold text-[var(--color-primary)] hover:underline"
          >
            {t("backHome")}
          </Link>
        }
      />

      {/* Prose at a reading measure: 16px on 1.7, the headings at the
          system's section size, and 24px between sections so a long document
          reads as a sequence of parts rather than one wall. */}
      <article className="public-inset pb-16">
        <div className="max-w-[760px]">
          <p className="text-[17px] leading-[1.7] text-[var(--color-ink-2)]">{t(`${docKey}.intro`)}</p>

          {Array.isArray(sections) &&
            sections.map((section, i) => (
              <section key={i} className="mt-10">
                <h2 className={SECTION_TITLE_CLASS}>{section.heading}</h2>
                {section.body.map((paragraph, j) => (
                  <p
                    key={j}
                    className="mt-3 text-[16px] leading-[1.7] text-[var(--color-muted-foreground)]"
                  >
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}

          <p className="mt-12 rounded-[14px] bg-[var(--color-blue-softer)] p-6 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
            {t("contact", { email: CONTACT.privacy })}
          </p>
        </div>
      </article>

      <Footer />
    </main>
  );
}
