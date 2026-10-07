import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, CalendarCheck, Search, Smartphone } from "lucide-react";
import { CompanyPage } from "./company-page";
import {
  IconItems,
  PhotoHero,
  PhotoSplit,
  SPLIT_BODY_CLASS,
  SPLIT_TITLE_CLASS,
  SoftBand,
} from "./company-sections";

/**
 * Who Ntizo is, told through what the product does — mission, the three
 * steps, two audiences. No founding year, no city, no names: the owner chose
 * (2026-09-02) not to publish them.
 *
 * On the home page's pieces since October 2026, after the owner called the
 * text-in-boxes version "muito mau": a photograph to open on, the mission
 * beside a second one, the steps as icons on the soft blue band, and the two
 * doors on the navy band the home ends with. The copy was cut by about half;
 * every claim left is one the old page made.
 */
export function AboutPage() {
  const { t } = useTranslation("company");

  return (
    <CompanyPage>
      <PhotoHero
        photo="/images/company/about-hero.jpg"
        position="70% 18%"
        title={`${t("about.heading")} ${t("about.headingAccent")}.`}
        lede={t("about.lede")}
      />

      <PhotoSplit photo="/images/company/about-mission.jpg" position="60% 50%">
        <h2 className={SPLIT_TITLE_CLASS}>{t("about.missionTitle")}</h2>
        <p className={`mt-5 ${SPLIT_BODY_CLASS}`}>{t("about.mission1")}</p>
        <p className={`mt-4 ${SPLIT_BODY_CLASS}`}>{t("about.mission2")}</p>
      </PhotoSplit>

      {/* Numbered: search, book, pay is an order, and the point of the
          section is that paying comes last. */}
      <SoftBand>
        <h2 className="mb-8 text-[26px] leading-tight font-extrabold tracking-[-0.01em] text-[var(--color-headline)]">
          {t("about.howTitle")}
        </h2>
        <IconItems
          numbered
          onBand
          items={[
            { Icon: Search, title: t("about.steps.search.title"), body: t("about.steps.search.body") },
            { Icon: CalendarCheck, title: t("about.steps.book.title"), body: t("about.steps.book.body") },
            { Icon: Smartphone, title: t("about.steps.pay.title"), body: t("about.steps.pay.body") },
          ]}
        />
      </SoftBand>

      <AudienceBand />
    </CompanyPage>
  );
}

/**
 * The two doors off this page, on the home's navy band.
 *
 * Both are the same white pill, so neither audience outranks the other —
 * a page whose last section exists to offer both should not pick one.
 */
function AudienceBand() {
  const { t } = useTranslation("company");
  const doors = [
    { key: "customers", to: "/services" },
    { key: "providers", to: "/become-provider" },
  ] as const;

  return (
    <section className="mt-16 bg-[var(--color-navy-surface)] text-[var(--color-navy-on)] md:mt-20">
      <div className="public-inset grid gap-10 py-12 md:grid-cols-2 md:gap-0 md:py-14">
        {doors.map((door, i) => (
          <article
            key={door.key}
            className={i === 1 ? "md:border-l md:border-[var(--color-navy-on)]/20 md:pl-12" : "md:pr-12"}
          >
            <h2 className="max-w-[22ch] text-[24px] leading-[1.15] font-extrabold tracking-[-0.01em] md:text-[28px]">
              {t(`about.${door.key}Title`)}
            </h2>
            <Link
              to={door.to}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--color-navy-on)] px-6 text-[15px] font-semibold text-[var(--color-navy-surface)] hover:opacity-90"
            >
              {t(`about.${door.key}Cta`)}
              <ArrowRight className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
