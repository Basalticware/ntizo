import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CompanyPage } from "@/features/company/ui/company-page";
import { FAQ_CATEGORIES } from "@/features/help-center/domain/faq";
import { FaqAccordion } from "@/features/help-center/ui/faq-accordion";
import { useFaqEntries } from "@/features/help-center/ui/help-faq";
import { useHelpCenter } from "@/features/help-center/viewmodel/use-help-center";
import { CONTACT } from "@/shared/lib/contact";
import { SectionHead } from "@/features/landing/ui/section-head";
import { Button } from "@ntizo/frontend-ui";
import { INFO_PANEL_CLASS } from "@/features/landing/ui/public-page";

/**
 * The FAQ, on a page anyone can link to and a crawler can read.
 *
 * The same twenty answers the panel shows, from the same `help` namespace —
 * one FAQ, two surfaces. It wears `CompanyPage`'s frame so it sits beside
 * `/about` and `/contact` rather than inventing a third page shape, and its
 * categories carry ids so `/help#payments` lands where it says.
 *
 * The panel is the primary way out at the end, not a mailto: somebody
 * reading the FAQ is already signed in more often than not, and a request
 * that arrives as a thread beats one that arrives as an email nobody can
 * reply to inside the product. The address stays as the second line, for
 * whoever cannot sign in.
 */
export function HelpPage() {
  const { t } = useTranslation("help");
  const entries = useFaqEntries();
  const help = useHelpCenter();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <CompanyPage page="help" title={t("page.title")} lede={t("page.lede")}>
      {/* The page's own gutter. `CompanyPage` puts its opening inside
          `public-inset` and hands `children` through untouched, because every
          other page it frames brings its own — this one never did, so the
          categories and every accordion row ran the full width of the window
          while the heading above them sat in the column. The answers read
          best at a measure, so the column stops at 860px. */}
      <div className="public-inset pb-14">
        <div className="grid max-w-[860px] gap-10">
        {FAQ_CATEGORIES.map((category) => (
          <section key={category.id} id={category.id} className="scroll-mt-24">
            <SectionHead title={t(`faq.${category.id}.title`)} />
            <FaqAccordion
              entries={entries.filter((entry) => entry.categoryId === category.id)}
              openId={openId}
              onToggle={(id) => setOpenId((current) => (current === id ? null : id))}
            />
          </section>
        ))}

        {/* The way out, on the soft blue info panel, with the system's
            primary button. */}
        <section className={`grid gap-2 ${INFO_PANEL_CLASS}`}>
          <h2 className="text-[20px] font-extrabold text-[var(--color-headline)]">
            {t("page.contactTitle")}
          </h2>
          <p className="text-[16px] leading-relaxed text-[var(--color-ink-2)]">{t("page.contactBody")}</p>
          <Button type="button" onClick={() => help.composeNew()} className="mt-2 justify-self-start">
            {t("page.contactAction")}
          </Button>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {t("page.contactEmailPrefix")}{" "}
            <a href={`mailto:${CONTACT.support}`} className="font-semibold text-[var(--color-primary)] hover:underline">
              {CONTACT.support}
            </a>
            .
          </p>
        </section>
        </div>
      </div>
    </CompanyPage>
  );
}
