import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, Mail } from "lucide-react";
import type { ContactRequestKind } from "@ntizo/shared";
import { CONTACT } from "@/shared/lib/contact";
import { CompanyPage } from "./company-page";
import { ContactForm } from "./contact-form";

/** Where each kind sends somebody who came to the other one. */
const ELSEWHERE: Record<ContactRequestKind, string> = {
  contact: "/feedback",
  feedback: "/contact",
};

const PHOTO: Record<ContactRequestKind, string> = {
  contact: "/images/company/contact.jpg",
  feedback: "/images/company/feedback.jpg",
};

/**
 * Contact and Feedback: a photograph with the heading, the address and the
 * socials on one side, the form on the other.
 *
 * Since October 2026. It was a centred heading, the form, three cards under
 * it and the "see also" strip — the address, the socials and the way to the
 * other form said twice over. Now each is said once, on the photograph, and
 * the form sits level with it. Below `lg` the photograph goes on top, short,
 * and the form follows.
 *
 * The words on the photograph are white over a dark gradient from the
 * bottom, as the home's hero carries them; black at an opacity, because it
 * shades a picture and looks the same in either theme.
 */
export function ContactRequestPage({ kind }: { kind: ContactRequestKind }) {
  const { t } = useTranslation("company");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const elsewhere = ELSEWHERE[kind];

  return (
    <CompanyPage>
      <section className="public-inset pt-8 pb-16 md:pt-10 md:pb-20">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
          <div className="relative isolate flex min-h-[340px] flex-col justify-end overflow-hidden rounded-[14px] bg-[var(--color-muted)] p-6 pt-44 text-white sm:p-8 sm:pt-56 lg:min-h-[560px] lg:pt-8">
            <img
              src={PHOTO[kind]}
              alt=""
              className="absolute inset-0 -z-10 h-full w-full object-cover object-[60%_35%]"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/50 via-45% to-black/5"
            />
            <h1 className="text-[30px] leading-[1.05] font-extrabold tracking-[-0.02em] sm:text-[40px]">
              {t(`${kind}.heading`)}
            </h1>
            <p className="mt-3 max-w-[40ch] text-[16.5px] leading-normal text-white/90">
              {t(`${kind}.lede`)}
            </p>
            <a
              href={`mailto:${CONTACT.general}`}
              className="mt-6 inline-flex items-center gap-2.5 self-start text-[16px] font-semibold text-white hover:underline"
            >
              <Mail className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
              {CONTACT.general}
            </a>
            <p className="mt-3 text-[15px] text-white/85">
              <a href={CONTACT.instagram} target="_blank" rel="noopener noreferrer" className="font-semibold text-white hover:underline">
                Instagram
              </a>
              {" · "}
              <a href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer" className="font-semibold text-white hover:underline">
                LinkedIn
              </a>
            </p>
            <p className="mt-6 border-t border-white/25 pt-4 text-[15px] text-white/85">
              {t(`${kind}.elsewhere.title`)}{" "}
              <Link
                to={elsewhere}
                search={elsewhere === "/feedback" ? { from: pathname } : undefined}
                className="inline-flex items-center gap-1.5 font-semibold text-white hover:underline"
              >
                {t(`${kind}.elsewhere.cta`)}
                <ArrowRight className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
              </Link>
            </p>
          </div>

          <div className="lg:self-center">
            <ContactForm kind={kind} messagePlaceholder={t(`${kind}.messagePlaceholder`)} />
          </div>
        </div>
      </section>
    </CompanyPage>
  );
}
