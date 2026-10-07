import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  CreditCard,
  FileText,
  Mail,
  Phone,
  KeyRound,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { Badge, buttonVariants, cn } from "@ntizo/frontend-ui";
import { useSession } from "@ntizo/auth-client";
import { useCurrentUser } from "@/features/user/viewmodel/use-current-user";
import { EmptyCard } from "@/shared/components/empty-card";
import {
  AppearancePreference,
  LanguagePreference,
} from "@/features/account/ui/language-preference";
import { CUSTOMER_CARD, CardHead } from "@/features/account/ui/customer-page";

/**
 * The card every settings page is: the section's name and one line on what
 * it is for, then its rows.
 *
 * A card heading, not a page title: `AccountShell` prints the area's title
 * over the nav, the way the provider's settings page has one title over its
 * section rail, so a second 44px heading here would be the page saying its
 * name twice.
 *
 * Deliberately not exported: `company-page.tsx` exports a different
 * `SectionHeading`, and two importable components for one job is a trap for
 * whoever autocompletes the wrong one.
 */
function SectionCard({
  title,
  blurb,
  icon,
  aside,
  children,
}: {
  title: string;
  blurb: string;
  icon: React.ComponentType<{ className?: string }>;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={CUSTOMER_CARD}>
      <CardHead title={title} hint={blurb} icon={icon} aside={aside} />
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** A row's action: the blue outline the done pages give a second action, at 40px. */
const ROW_ACTION = buttonVariants({ variant: "secondary", size: "sm" });

export function PaymentMethodsPage() {
  const { t } = useTranslation("account");
  return (
    <SectionCard
      title={t("navPaymentMethods")}
      blurb={t("paymentsBlurb")}
      icon={CreditCard}
    >
      <EmptyCard
        badge={CreditCard}
        title={t("paymentsEmptyTitle")}
        body={t("paymentsEmptyBody")}
      />
    </SectionCard>
  );
}

/**
 * One fact about the account, on a row divider: what it is, what it says,
 * and beside it the badge or the action that goes with it.
 */
function FactRow({
  icon: Icon,
  label,
  value,
  aside,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-[var(--color-line-2)] py-[18px] first:border-t-0 first:pt-0 last:pb-0">
      {/* `basis-full sm:basis-0` so the badge drops to its own line on a
          phone rather than crushing an e-mail address into two characters
          per line. flex-1 alone would let it shrink without ever wrapping. */}
      <div className="flex min-w-0 flex-1 basis-full items-start gap-4 sm:basis-0">
        <span
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-[var(--color-headline)]"
        >
          <Icon className="h-[21px] w-[21px]" />
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-[var(--color-headline)]">
            {label}
          </div>
          {/* An address and a phone number are single words with nowhere to
              break, so they set the row's minimum width and push the page
              into a sideways scroll. `anywhere` lets them wrap mid-token. */}
          <div className="mt-0.5 text-[15px] [overflow-wrap:anywhere] text-[var(--color-muted-foreground)]">
            {value}
          </div>
        </div>
      </div>
      {aside && (
        <div className="flex items-center gap-3 pl-[37px] sm:pl-0">{aside}</div>
      )}
    </div>
  );
}

function Confirmed({ verified }: { verified: boolean }) {
  const { t } = useTranslation("account");
  return verified ? (
    <Badge tone="success" className="gap-1">
      <BadgeCheck className="h-3.5 w-3.5" />
      {t("confirmed")}
    </Badge>
  ) : (
    <Badge tone="warning">{t("unconfirmed")}</Badge>
  );
}

export function SecurityPage() {
  const { t } = useTranslation("account");
  const { data: user } = useCurrentUser();
  // Read from the session, not the read model, the same way the profile
  // reads it: whether a number is verified is an auth fact. This page used
  // to call any number "confirmed" merely for existing, and so contradicted
  // the profile beside it about the same digits.
  //
  // `isPending` matters as much as the value. The session starts as
  // `{ data: null, isPending: true }` and is fetched only after mount, so a
  // page that reads the value alone renders "not confirmed" through the
  // server render and the first client paint, then flips — telling a
  // verified reader they have something to do, briefly, on every visit.
  const { data: session, isPending: sessionPending } = useSession();
  const phoneVerified = Boolean(session?.user?.phoneNumberVerified);

  // Empty string, not just null: the read model types this nullable, and a
  // blank line beside a "verify" action would be a row about nothing.
  const phone = user?.phoneNumber || null;

  return (
    <SectionCard
      title={t("navSecurity")}
      blurb={t("securityBlurb")}
      icon={ShieldCheck}
    >
      {/* Email is confirmed by definition: sign-in requires it. Showing the
          row anyway is what makes the phone row below it read as an
          outstanding task rather than an oddity. */}
      <FactRow
        icon={Mail}
        label={t("fieldEmail")}
        value={user?.email || t("notSet")}
        aside={<Confirmed verified />}
      />
      <FactRow
        icon={Phone}
        label={t("fieldPhone")}
        value={phone ?? t("notSet")}
        aside={
          !phone ? (
            // Not `/verify-phone`: reached with no number on the session,
            // that route itself redirects straight to /account. The place
            // to add one is the profile form.
            <Link to="/account" className={ROW_ACTION}>
              {t("addPhone")}
            </Link>
          ) : sessionPending ? null : (
            <>
              <Confirmed verified={phoneVerified} />
              {/* The badge says there is something to do, so the row has to
                  carry the doing of it. "Verificar" opens /verify-phone,
                  which confirms the number by WhatsApp. */}
              {!phoneVerified && (
                <Link to="/verify-phone" className={ROW_ACTION}>
                  {t("verifyPhone")}
                </Link>
              )}
            </>
          )
        }
      />
      {/* Goes through the same emailed link as a forgotten password rather
          than an in-page form. Changing a password from an already-open
          session proves nothing about who is at the keyboard; the email
          does. */}
      <FactRow
        icon={KeyRound}
        label={t("passwordTitle")}
        value={t("passwordBlurb")}
        aside={
          <Link to="/forgot-password" className={ROW_ACTION}>
            {t("changePassword")}
          </Link>
        }
      />
    </SectionCard>
  );
}

/**
 * Preferences: the language and the appearance, one under the other.
 *
 * There is no notification section. Every notification is sent by email and
 * nothing is switchable, so four rows of disabled checkboxes with a note
 * saying they were not saved — which is what stood here until 2026-09-07 —
 * offered a choice that did not exist. A settings page that is mostly inert
 * controls reads as broken; when there is something to choose, the section
 * comes back with controls that work.
 */
export function PreferencesPage() {
  const { t } = useTranslation("account");

  return (
    <SectionCard
      title={t("navPreferences")}
      blurb={t("preferencesBlurb")}
      icon={SlidersHorizontal}
    >
      <LanguagePreference />
      <AppearancePreference />
    </SectionCard>
  );
}

export function LegalPage() {
  const { t } = useTranslation("account");
  return (
    <SectionCard title={t("navLegal")} blurb={t("legalBlurb")} icon={FileText}>
      <ul className="m-0 grid list-none p-0">
        {["terms", "privacy", "cookies"].map((key) => (
          <li
            key={key}
            className={cn(
              "flex flex-wrap items-baseline gap-x-2 border-t border-[var(--color-line-2)] py-4 text-[15px] font-semibold text-[var(--color-headline)]",
              "first:border-t-0 first:pt-0 last:pb-0",
            )}
          >
            {t(`legal.${key}`)}
            <span className="text-sm font-normal text-[var(--color-muted-foreground)]">
              {t("legalPending")}
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
