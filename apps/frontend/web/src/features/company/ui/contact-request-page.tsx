import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ContactRequestKind } from "@ntizo/shared";
import { CONTACT } from "@/shared/lib/contact";
import { CompanyPage } from "./company-page";
import { ContactForm } from "./contact-form";
import {
  CARD_BODY_CLASS,
  CARD_TITLE_CLASS,
  PUBLIC_CARD_CLASS,
} from "@/features/landing/ui/public-page";

/** A link inside a note: the brand blue, the way the listings draw one. */
const NOTE_LINK_CLASS = "font-semibold text-[var(--color-primary)] hover:underline";

/** Which three cards sit under each form, and where the linking one goes. */
const CARDS: Record<ContactRequestKind, ReadonlyArray<{ key: string; kind: "email" | "social" | "text" | "link"; to?: string }>> = {
  contact: [
    { key: "email", kind: "email" },
    { key: "social", kind: "social" },
    { key: "feedback", kind: "link", to: "/feedback" },
  ],
  feedback: [
    { key: "read", kind: "text" },
    { key: "contact", kind: "link", to: "/contact" },
    { key: "social", kind: "social" },
  ],
};

/**
 * Contact and Feedback: a centred band, the form, three cards.
 *
 * On the October 2026 system: white, the heading in navy, the three notes on
 * the site's card, and the links inside them in the brand blue.
 *
 * Single centred column, decided 2026-09-02 against a side rail: the form is
 * what the page is for, and the alternatives sit under it rather than beside
 * it. Each kind's copy lives under its own key in the `company` namespace,
 * and the kind doubles as the frame's page id.
 */
export function ContactRequestPage({ kind }: { kind: ContactRequestKind }) {
  const { t } = useTranslation("company");
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <CompanyPage page={kind} title={t(`${kind}.heading`)} lede={t(`${kind}.lede`)} centred>
      <section className="public-inset pb-14">
        <div className="mx-auto max-w-[640px]">
          <ContactForm kind={kind} messagePlaceholder={t(`${kind}.messagePlaceholder`)} />
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {CARDS[kind].map((card) => (
            <article
              key={card.key}
              className={PUBLIC_CARD_CLASS}
            >
              <h2 className={`m-0 ${CARD_TITLE_CLASS}`}>
                {t(`${kind}.cards.${card.key}.title`)}
              </h2>
              <p className={`mt-1.5 mb-0 ${CARD_BODY_CLASS}`}>
                {card.kind === "email" && (
                  <>
                    <a href={`mailto:${CONTACT.general}`} className={NOTE_LINK_CLASS}>
                      {CONTACT.general}
                    </a>
                    <br />
                  </>
                )}
                {t(`${kind}.cards.${card.key}.body`)}
                {card.kind === "social" && (
                  <>
                    <br />
                    <a
                      href={CONTACT.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={NOTE_LINK_CLASS}
                    >
                      Instagram
                    </a>
                    {" · "}
                    <a
                      href={CONTACT.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={NOTE_LINK_CLASS}
                    >
                      LinkedIn
                    </a>
                  </>
                )}
              </p>
              {card.to && (
                <Link
                  to={card.to}
                  search={card.to === "/feedback" ? { from: pathname } : undefined}
                  className={`mt-3 inline-flex items-center gap-2 text-sm ${NOTE_LINK_CLASS}`}
                >
                  {t(`${kind}.cards.${card.key}.cta`)}
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>
    </CompanyPage>
  );
}
