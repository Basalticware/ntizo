/**
 * The site footer.
 *
 * Lifted out of `landing-page.tsx` when a second public page needed it. A
 * footer copied into two files is a footer that disagrees with itself the
 * first time a link changes — and the page that had no footer at all simply
 * ended, leaving the reader nowhere to go but back.
 *
 * **One compact row**, from the October 2026 home mockup: the logo with its
 * line and the socials under it, the three link columns, then the payment
 * method and "Feito em Moçambique" at the far end. Every public page wears it,
 * so the home's footer is everybody's.
 */
import { useTranslation } from "react-i18next";
import { Link, useRouterState } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { cn } from "@ntizo/frontend-ui";
import { CONTACT } from "@/shared/lib/contact";
import { useHelpCenter } from "@/features/help-center/viewmodel/use-help-center";


/**
 * A footer row, link or button alike. `text-start` matters on the button: the
 * browser's own stylesheet centres a button's label and Tailwind's preflight
 * does not reset it, so without it "Falar com o suporte" sat in the middle of
 * a column whose every neighbour sits at its left edge. `start` rather than
 * `left`, so it still means the reading edge in a right-to-left locale.
 */
const LINK_CLASS =
  "text-[13px] leading-snug text-[var(--color-muted-foreground)] no-underline hover:text-[var(--color-headline)] hover:underline";

export function Footer({
  flush = false,
}: {
  /**
   * No margin above it: the home page ends on the navy band, and the footer
   * starts where the band stops, as the mockup draws it.
   */
  flush?: boolean;
} = {}) {
  const { t } = useTranslation("landing"); // t:Footer
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const help = useHelpCenter();
  return (
    <>
      {/* White, with a hairline instead of a tint — on tokens, so it turns with
          dark mode like the page above it. The inset is the page's own
          `--pw-pad`, so the footer's columns start where the header's logo
          does. */}
      <footer
        className={cn(
          "public-inset border-t border-[var(--color-border)] bg-[var(--color-card)] pt-8 pb-7 text-[var(--color-card-foreground)]",
          !flush && "mt-[60px]",
        )}
      >
        <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:gap-10">
          <div className="col-span-2 flex flex-col justify-between gap-5 sm:col-span-3 lg:col-span-1">
            <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
              <img src="/brand/logo-primary.svg" alt="Ntizo" className="h-7 w-auto" />
              {/* Through i18next. It used to be an English sentence written
                  into the markup, so this one paragraph stayed in English on
                  a page whose every other word followed the language
                  switcher. */}
              <p className="max-w-[260px] text-[13px] leading-relaxed text-[var(--color-muted-foreground)]">
                {t("footer.blurb")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <div className="flex gap-4">
                <SocialIcon href={CONTACT.instagram} label="Instagram">
                  <InstagramGlyph />
                </SocialIcon>
                <SocialIcon href={CONTACT.linkedin} label="LinkedIn">
                  <LinkedInGlyph />
                </SocialIcon>
              </div>
              {/* Through i18next like the blurb above it. "All rights
                  reserved." was the last English sentence left in the
                  markup. */}
              <p className="text-[12px] text-[var(--color-muted-foreground)]">
                © {new Date().getFullYear()} Ntizo. {t("footer.rights")}
              </p>
            </div>
          </div>

          <FooterCol title={t("footer.support")}>
            {/* The phone line that used to sit above this was
                "+1 (800) 000-0000" under the label "Toll Free Customer Care" —
                a number in a country Ntizo does not operate in, that nobody
                could ring. It is gone rather than replaced: an address that
                reaches somebody beats a number that does not. */}
            <FooterMeta
              label={t("footer.supportEmailLabel")}
              value={CONTACT.support}
              href={`mailto:${CONTACT.support}`}
            />
          </FooterCol>

          <FooterCol title={t("footer.company")}>
            <FooterLink to="/about">{t("footer.links.about")}</FooterLink>
            <FooterLink to="/contact">{t("footer.links.contact")}</FooterLink>
            {/* A button, not a link: support is the panel, which opens over
                whatever page the reader is on. */}
            <button
              type="button"
              onClick={() => help.composeNew()}
              className={`${LINK_CLASS} cursor-pointer text-start`}
            >
              {t("footer.links.support")}
            </button>
            <FooterLink to="/help">{t("footer.links.faq")}</FooterLink>
            <FooterLink to="/feedback" search={{ from: pathname }}>{t("footer.links.feedback")}</FooterLink>
            {/* The public pitch, not registration. A link labelled "become a
                provider" that opens a sign-up form skips the part where someone
                finds out what they would be signing up for — and that page's
                own buttons carry the intent onward from there. */}
            <FooterLink to="/become-provider">{t("footer.becomeProvider")}</FooterLink>
            <FooterLink to="/careers">{t("footer.links.careers")}</FooterLink>
          </FooterCol>

          <FooterCol title={t("footer.legal")}>
            <FooterLink to="/terms">{t("footer.terms")}</FooterLink>
            <FooterLink to="/privacy">{t("footer.privacy")}</FooterLink>
            {/* No third row. `/admin` stood here, labelled with a key no
                locale file defines, on every public page, for every visitor.
                Staff reach `/admin` by typing it; the footer is not a staff
                door. */}
          </FooterCol>

          {/* "Feito em Moçambique", right-aligned at the end of the row from
              `sm`. A payment-methods block stood above it until 7 October
              2026, when it was removed from the footer. */}
          <div className="col-span-2 flex flex-col justify-end gap-5 sm:col-span-3 sm:items-end lg:col-span-1">
            <p className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-muted-foreground)] sm:justify-end">
              {t("footer.madeIn")}
              <Heart
                className="h-3.5 w-3.5 fill-[var(--color-alert)] text-[var(--color-alert)]"
                aria-hidden="true"
              />
            </p>
          </div>

          {/* A "Get the App" column stood here with an App Store and a Google
              Play badge, both on `href="#"`. Ntizo ships no mobile app, so the
              column advertised two downloads that do not exist. */}
        </div>
      </footer>
    </>
  );
}

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-2.5 text-[12px] font-bold tracking-[0.04em] text-[var(--color-headline)] uppercase">
        {title}
      </h2>
      <div className="flex flex-col gap-1">
        {children}
      </div>
    </div>
  );
}

function FooterLink({
  to,
  href,
  search,
  children,
}: {
  to?: string;
  href?: string;
  search?: Record<string, string>;
  children: React.ReactNode;
}) {
  if (to)
    return (
      <Link to={to} search={search} className={LINK_CLASS}>
        {children}
      </Link>
    );
  return (
    <a href={href ?? "#"} className={LINK_CLASS}>
      {children}
    </a>
  );
}

/**
 * A labelled way to reach somebody.
 *
 * `href` is optional and, when given, makes the value itself the link — an
 * address printed as plain text is one a reader has to select and copy, on a
 * phone especially. Without it the value stays text, which is right for
 * anything that is not dialable or mailable.
 */
function FooterMeta({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const valueClass = "text-[13px] font-semibold text-[var(--color-headline)] no-underline";
  return (
    <div>
      <div className="text-[13px] text-[var(--color-muted-foreground)]">{label}</div>
      {href ? (
        <a href={href} className={`${valueClass} hover:underline`}>
          {value}
        </a>
      ) : (
        <div className={valueClass}>{value}</div>
      )}
    </div>
  );
}

/**
 * One social link.
 *
 * `label` is a prop rather than the fixed "social" it used to be: all four
 * icons announced themselves with the same word, so somebody listening to the
 * page was told there were links here and nothing about where any of them
 * went.
 */
function SocialIcon({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="inline-flex h-6 w-6 items-center justify-center text-[var(--color-ink-2)] no-underline hover:text-[var(--color-primary)]"
      aria-label={label}
      // Both of these leave the site, so both open away from it. `noopener` is
      // the half that matters: without it the opened page can reach back
      // through `window.opener` and navigate this one.
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}


function InstagramGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.4A4 4 0 1 1 12.6 8 4 4 0 0 1 16 11.4z" />
      <line x1="17.5" y1="6.5" x2="17.5" y2="6.5" />
    </svg>
  );
}
function LinkedInGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.4v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43A2.06 2.06 0 1 1 5.34 3.3a2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45z" />
    </svg>
  );
}
