/**
 * The site footer.
 *
 * Lifted out of `landing-page.tsx` when a second public page needed it. A
 * footer copied into two files is a footer that disagrees with itself the
 * first time a link changes — and the page that had no footer at all simply
 * ended, leaving the reader nowhere to go but back.
 */
import { useTranslation } from "react-i18next";
import { Link, useRouterState } from "@tanstack/react-router";
import { CONTACT } from "@/shared/lib/contact";
import { useHelpCenter } from "@/features/help-center/viewmodel/use-help-center";

/**
 * The two brands' own colours, kept out of the markup so the pair reads as a
 * set. With M-Pesa's red they are the only literal colours left in the
 * footer, on purpose: a brand's mark is its colour, in light mode and dark. Instagram has no single colour — the gradient is the mark — and this is
 * the linear approximation of it that its own brand assets use at small sizes.
 */
const INSTAGRAM = "linear-gradient(45deg, #F9CE34 0%, #EE2A7B 50%, #6228D7 100%)";
const LINKEDIN = "#0A66C2";
/** M-Pesa's own red, for the one payment chip. */
const MPESA = "#e60000";

/**
 * A footer row, link or button alike. `text-start` matters on the button: the
 * browser's own stylesheet centres a button's label and Tailwind's preflight
 * does not reset it, so without it "Falar com o suporte" sat in the middle of
 * a column whose every neighbour sits at its left edge. `start` rather than
 * `left`, so it still means the reading edge in a right-to-left locale.
 */
const LINK_CLASS =
  "text-sm text-[var(--color-muted-foreground)] no-underline hover:text-[var(--color-headline)] hover:underline";

export function Footer() {
  const { t } = useTranslation("landing"); // t:Footer
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const help = useHelpCenter();
  return (
    <>
      {/* White, with a hairline instead of a tint — on tokens, so it turns with
          dark mode like the page above it. The inset is the page's own
          `--pw-pad`, so the footer's columns start where the header's logo
          does. */}
      <footer className="public-inset mt-[60px] border-t border-[var(--color-border)] bg-[var(--color-card)] pt-[60px] pb-8 text-[var(--color-card-foreground)]">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:gap-10">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <img src="/brand/logo-primary.svg" alt="Ntizo" className="h-7 w-auto" />
            {/* Through i18next. It used to be an English sentence written
                into the markup, so this one paragraph stayed in English on a
                page whose every other word followed the language switcher —
                and `footer.blurb`, which says the same thing in all eight,
                sat in the locale files with nothing reading it. */}
            <p className="mt-4 max-w-[300px] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
              {t("footer.blurb")}
            </p>
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
                whatever page the reader is on. `#132`'s "or `/help` until it
                exists" no longer applies — it exists. */}
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
            {/* No third row. `/admin` stood here, labelled `t("admin")` — a
                key no locale file defines, so the fallback rendered the literal
                lower-case word "admin" under two properly translated legal
                links, on every public page, for every visitor. It pointed at a
                console almost none of them can open. Staff reach `/admin` by
                typing it; the footer is not a staff door. */}
          </FooterCol>

          {/* A "Get the App" column stood here with an App Store and a Google
              Play badge, both on `href="#"`. Ntizo ships no mobile app, so the
              column advertised two downloads that do not exist — the one thing
              on a footer a reader is most likely to act on. */}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-6 border-t border-[var(--color-border)] pt-8 sm:flex-row sm:items-center">
          <div>
            <div className="mb-3 text-[13px] text-[var(--color-muted-foreground)]">
              {t("footer.ourSocials")}
            </div>
            <div className="flex gap-2.5">
              <SocialIcon
                href={CONTACT.instagram}
                label="Instagram"
                background={INSTAGRAM}
              >
                <InstagramGlyph />
              </SocialIcon>
              <SocialIcon
                href={CONTACT.linkedin}
                label="LinkedIn"
                background={LINKEDIN}
              >
                <LinkedInGlyph />
              </SocialIcon>
            </div>
          </div>
          {/* The alignment is a breakpoint's business, so it is in classes.
              The strip is a row from `sm` up, socials at one end and payments
              at the other, so the block right-aligns to meet the edge. Below
              `sm` the strip stacks `items-start` and the inline
              `text-align: right` no breakpoint could reach was still firing:
              the label sat left and the chip was pushed to the far side of
              it, which is what a reader sees as a chip belonging to nothing. */}
          <div className="text-left sm:text-right">
            <div className="mb-3 text-[13px] text-[var(--color-muted-foreground)]">
              {t("footer.acceptedPayments")}
            </div>
            <div className="flex flex-wrap justify-start gap-2.5 sm:justify-end">
              {/* One chip, because one method charges. e-Mola, Visa and
                  Mastercard stood here until 2026-09-02, advertising methods
                  the checkout refuses — see the FAQ's "que métodos aceitam".
                  Each returns the day its charge path ships
                  (follow-ups #129). */}
              <PayChip color={MPESA}>M-Pesa</PayChip>
            </div>
          </div>
        </div>

        {/* Through i18next like the blurb above it. "All rights reserved."
            was the last English sentence left in the markup, so it stayed in
            English under a footer that had just translated everything else. */}
        <div className="mt-8 border-t border-[var(--color-border)] pt-6 text-center text-[13px] text-[var(--color-muted-foreground)]">
          © {new Date().getFullYear()} Ntizo. {t("footer.rights")}
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
      <h2 className="mb-4 text-[15px] font-bold text-[var(--color-headline)]">{title}</h2>
      <div className="flex flex-col gap-2.5">
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
  const valueClass = "text-sm font-semibold text-[var(--color-headline)] no-underline";
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
 * One social link, wearing its own brand colour.
 *
 * `label` is a prop rather than the fixed "social" it used to be: all four
 * icons announced themselves with the same word, so somebody listening to the
 * page was told there were links here and nothing about where any of them
 * went. With `href="#"` on every one, that was at least accurate.
 */
function SocialIcon({
  href,
  label,
  background,
  children,
}: {
  href: string;
  label: string;
  background: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      style={{ background }}
      className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-full text-white no-underline"
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

function PayChip({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{ color }}
      className="rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-2 text-[13px] font-extrabold tracking-[0.02em]"
    >
      {children}
    </span>
  );
}

function InstagramGlyph() {
  return (
    <svg
      width="16"
      height="16"
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.4v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43A2.06 2.06 0 1 1 5.34 3.3a2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45z" />
    </svg>
  );
}
