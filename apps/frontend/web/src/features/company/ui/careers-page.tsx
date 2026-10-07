import { useTranslation } from "react-i18next";
import { SectionHead } from "@/features/landing/ui/section-head";
import { CONTACT } from "@/shared/lib/contact";
import { CompanyPage } from "./company-page";
import { buttonVariants } from "@ntizo/frontend-ui";
import {
  CARD_BODY_CLASS,
  CARD_TITLE_CLASS,
  PUBLIC_CARD_CLASS,
} from "@/features/landing/ui/public-page";

interface Principle {
  title: string;
  body: string;
}

/**
 * No open roles, said plainly, and a spontaneous application by email. The
 * three "how we work" sentences are the only copy on the five pages not
 * derived from the code; the owner approved them.
 *
 * Drawn on the home page's rules since 2026-09-07. Two of this page's eyebrows
 * were the only thing naming their block, so they became the headings rather
 * than disappearing with the treatment.
 */
export function CareersPage() {
  const { t } = useTranslation("company");
  const how = t("careers.how", { returnObjects: true }) as Principle[] | string;
  const mailto = `mailto:${CONTACT.general}?subject=${encodeURIComponent(t("careers.mailSubject"))}`;

  return (
    <CompanyPage page="careers" title={t("careers.heading")} lede={t("careers.lede")}>
      <section className="public-inset pb-14">
        <div className="grid gap-10 md:grid-cols-2 md:gap-14">
          <div>
            {/* Was an eyebrow with two paragraphs under it and no heading at
                all. It is the heading now. */}
            <SectionHead title={t("careers.buildingEyebrow")} />
            <div className={PUBLIC_CARD_CLASS}>
              <p className="text-[16px] leading-relaxed text-[var(--color-ink-2)]">
                {t("careers.building1")}
              </p>
              <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-ink-2)]">
                {t("careers.building2")}
              </p>
            </div>
          </div>
          <div>
            <SectionHead title={t("careers.howEyebrow")} />
            <ul className="grid list-none gap-6 p-0">
              {Array.isArray(how) &&
                how.map((p) => (
                  <li key={p.title} className={PUBLIC_CARD_CLASS}>
                    <h3 className={CARD_TITLE_CLASS}>{p.title}</h3>
                    <p className={`mt-1.5 ${CARD_BODY_CLASS}`}>
                      {p.body}
                    </p>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </section>

      {/* The ask, on the soft blue info panel — it is the only thing in its
          section — with the system's primary button. */}
      <section className="public-inset pb-14">
        <div className="rounded-[14px] bg-[var(--color-blue-softer)] p-6 md:p-8">
          <h2 className="text-[22px] font-extrabold tracking-[-0.01em] text-[var(--color-headline)]">
            {t("careers.openingsTitle")}
          </h2>
          <p className="mt-2 max-w-[56ch] text-[16px] leading-relaxed text-[var(--color-ink-2)]">
            {t("careers.openingsBody")}
          </p>
          <a
            href={mailto}
            className={`mt-6 no-underline ${buttonVariants()}`}
          >
            {t("careers.openingsCta")}
          </a>
          <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
            {t("careers.openingsHint", { email: CONTACT.general })}
          </p>
        </div>
      </section>
    </CompanyPage>
  );
}
