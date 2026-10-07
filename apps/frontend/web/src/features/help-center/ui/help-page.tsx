import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CompanyPage } from "@/features/company/ui/company-page";
import { FAQ_CATEGORIES } from "@/features/help-center/domain/faq";
import { searchFaq } from "@/features/help-center/domain/faq-search";
import { FaqAccordion } from "@/features/help-center/ui/faq-accordion";
import { useFaqEntries } from "@/features/help-center/ui/help-faq";
import { HelpSearchField } from "@/features/help-center/ui/help-search-field";
import { useHelpCenter } from "@/features/help-center/viewmodel/use-help-center";
import { CONTACT } from "@/shared/lib/contact";
import { SectionHead } from "@/features/landing/ui/section-head";
import { Button } from "@ntizo/frontend-ui";
import { INFO_PANEL_CLASS } from "@/features/landing/ui/public-page";

/**
 * The FAQ, on a page anyone can link to and a crawler can read.
 *
 * The same twenty answers the panel shows, from the same `help` namespace —
 * one FAQ, two surfaces. Its categories carry ids so `/help#payments` lands
 * where it says.
 *
 * **Since October 2026** it opens on a short soft blue band with the title
 * and a search, and no photograph: this is a page somebody comes to with a
 * question, and the field is the fastest way to the answer. The search
 * filters this page's own list (the panel keeps its own query), with the
 * authored order kept; a search that finds nothing offers the support
 * thread. The column is centred under the band at 860px, the measure the
 * answers read best at.
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
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const matches = searchFaq(entries, query);

  return (
    <CompanyPage>
      <section className="bg-[var(--color-blue-softer)]">
        <div className="public-inset py-12 text-center md:py-16">
          <h1 className="text-[30px] leading-[1.05] font-extrabold tracking-[-0.02em] text-[var(--color-headline)] md:text-[44px]">
            {t("page.title")}
          </h1>
          <p className="mx-auto mt-3 max-w-[52ch] text-[16.5px] leading-relaxed text-[var(--color-muted-foreground)]">
            {t("page.lede")}
          </p>
          <div className="mx-auto mt-7 max-w-[640px] text-left">
            <HelpSearchField value={query} onChange={setQuery} />
          </div>
        </div>
      </section>

      <div className="public-inset pt-12 pb-16 md:pb-20">
        <div className="mx-auto grid max-w-[860px] gap-10">
          {matches.length === 0 && (
            <p className="text-[16px] text-[var(--color-ink-2)]">
              {t("searchNoResults", { query })}{" "}
              <button
                type="button"
                onClick={() => help.composeNew()}
                className="font-semibold text-[var(--color-primary)] hover:underline"
              >
                {t("searchNoResultsAction")}
              </button>
            </p>
          )}
          {FAQ_CATEGORIES.map((category) => {
            const inCategory = matches.filter((entry) => entry.categoryId === category.id);
            if (inCategory.length === 0) return null;
            return (
              <section key={category.id} id={category.id} className="scroll-mt-24">
                <SectionHead title={t(`faq.${category.id}.title`)} />
                <FaqAccordion
                  entries={inCategory}
                  openId={openId}
                  onToggle={(id) => setOpenId((current) => (current === id ? null : id))}
                />
              </section>
            );
          })}

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
