import { useTranslation } from "react-i18next";
import { FileText, Rocket, Users } from "lucide-react";
import { buttonVariants } from "@ntizo/frontend-ui";
import { CONTACT } from "@/shared/lib/contact";
import { CompanyPage } from "./company-page";
import {
  IconItems,
  PhotoHero,
  PhotoSplit,
  SPLIT_BODY_CLASS,
  SPLIT_TITLE_CLASS,
  SoftBand,
} from "@/shared/components/photo-sections";

interface Principle {
  title: string;
  body: string;
}

const PRINCIPLE_ICONS = [FileText, Rocket, Users] as const;

/**
 * No open roles, said plainly, and a spontaneous application by email. The
 * three "how we work" sentences are the only copy on the company pages not
 * derived from the code; the owner approved them.
 *
 * On the home page's pieces since October 2026: a photograph to open on,
 * what we are building beside a second one, the three principles as icons in
 * a row, and the ask on the soft blue band. The "see also" strip went — the
 * footer under it links the same pages.
 */
export function CareersPage() {
  const { t } = useTranslation("company");
  const how = t("careers.how", { returnObjects: true }) as Principle[] | string;
  const mailto = `mailto:${CONTACT.general}?subject=${encodeURIComponent(t("careers.mailSubject"))}`;

  return (
    <CompanyPage>
      <PhotoHero
        photo="/images/company/careers-hero.jpg"
        position="75% 40%"
        title={t("careers.heading")}
        lede={t("careers.lede")}
      />

      <PhotoSplit photo="/images/company/careers-building.jpg" position="50% 35%" flip>
        <h2 className={SPLIT_TITLE_CLASS}>{t("careers.buildingEyebrow")}</h2>
        <p className={`mt-5 ${SPLIT_BODY_CLASS}`}>{t("careers.building1")}</p>
        <p className={`mt-4 ${SPLIT_BODY_CLASS}`}>{t("careers.building2")}</p>
      </PhotoSplit>

      <section className="public-inset pt-16 md:pt-20">
        <h2 className="mb-8 text-[24px] leading-tight font-extrabold md:text-[26px] tracking-[-0.01em] text-[var(--color-headline)]">
          {t("careers.howEyebrow")}
        </h2>
        {Array.isArray(how) && (
          <IconItems
            items={how.map((p, i) => ({ Icon: PRINCIPLE_ICONS[i % PRINCIPLE_ICONS.length]!, ...p }))}
          />
        )}
      </section>

      <SoftBand className="mb-16 flex flex-col gap-6 md:mb-20 md:flex-row md:items-center md:justify-between md:gap-12">
        <div>
          <h2 className="text-[24px] leading-tight font-extrabold md:text-[26px] tracking-[-0.01em] text-[var(--color-headline)]">
            {t("careers.openingsTitle")}
          </h2>
          <p className="mt-2 max-w-[56ch] text-[16px] leading-relaxed text-[var(--color-ink-2)]">
            {t("careers.openingsBody")}
          </p>
        </div>
        <div className="shrink-0 md:text-right">
          <a href={mailto} className={`no-underline ${buttonVariants()}`}>
            {t("careers.openingsCta")}
          </a>
          <p className="mt-3 max-w-[32ch] text-sm text-[var(--color-muted-foreground)]">
            {t("careers.openingsHint", { email: CONTACT.general })}
          </p>
        </div>
      </SoftBand>
    </CompanyPage>
  );
}
