import { useEffect, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Check, CircleAlert, CircleCheck, MessageCircle } from "lucide-react";
import { buttonVariants, cn } from "@ntizo/frontend-ui";
import { useSession } from "@/shared/lib/api/auth-client";
import { SiteHeader } from "@/shared/components/site-header";
import { AUTH_LEDE, AUTH_TITLE } from "@/features/auth/components/auth-styles";
import { usePhoneVerification } from "@/features/auth/viewmodel/use-phone-verification";
import { formatPhone } from "@/features/auth/domain/phone-verification";
import { textAction } from "@/shared/ui/text-action";

/**
 * Confirming a phone number by sending Ntizo a WhatsApp message.
 *
 * Drawn on the site's rules: the public header, a white page, the navy
 * heading, the blue action and hairlines. The layout is the approved mockup's,
 * docs/superpowers/specs/2026-09-21-whatsapp-phone-verification.mockup.html;
 * the type and the buttons are the October 2026 system's.
 *
 * `next` present means the page was reached as the invite after an email
 * confirmation: "Agora não" and "Continuar" go there, and a stage without
 * WhatsApp is skipped silently. Absent means Conta → Segurança sent them.
 */
export function VerifyPhone({ next }: { next?: string }) {
  const { t, i18n } = useTranslation("auth");
  const navigate = useNavigate();
  const { data: session } = useSession();
  const phone =
    (session?.user as { phoneNumber?: string | null } | undefined)
      ?.phoneNumber ?? "";
  const { state, markSent, restart } = usePhoneVerification((code) =>
    t("verifyPhone.message", { code }),
  );

  const invite = next !== undefined;
  const goOn = () => void navigate({ href: next ?? "/account", replace: true });

  useEffect(() => {
    if (invite && state.status === "unavailable")
      void navigate({ href: next, replace: true });
  }, [invite, next, navigate, state.status]);

  const leave = invite ? (
    <button type="button" onClick={goOn} className={quiet}>
      {t("verifyPhone.notNow")}
    </button>
  ) : (
    <Link to="/account" className={quiet}>
      {t("verifyPhone.backToAccount")}
    </Link>
  );

  const numberFact = phone ? (
    <div className="flex items-end justify-between gap-4 border-y border-[var(--color-border)] py-4">
      <div>
        <p className="text-[14px] text-[var(--color-muted-foreground)]">
          {t("verifyPhone.yourNumber")}
        </p>
        <p className="mt-0.5 text-[21px] font-bold tabular-nums text-[var(--color-headline)]">
          {formatPhone(phone)}
        </p>
      </div>
      <Link to="/account" className={textAction()}>
        {t("verifyPhone.change")}
      </Link>
    </div>
  ) : null;

  if (
    state.status === "starting" ||
    (invite && state.status === "unavailable")
  ) {
    return (
      <Page>
        <p className={LEDE} aria-live="polite">
          {t("verifyPhone.preparing")}
        </p>
      </Page>
    );
  }

  if (state.status === "ready") {
    return (
      <Page>
        {invite ? (
          <p className="flex items-center gap-1.5 text-[15px] font-semibold text-[var(--color-ok-fg)]">
            <Check className="h-[18px] w-[18px]" aria-hidden />
            {t("verifyPhone.emailConfirmed")}
          </p>
        ) : null}
        <h1 className={AUTH_TITLE}>{t("verifyPhone.title")}</h1>
        <p className={LEDE}>{t("verifyPhone.lede")}</p>
        {numberFact}
        <a
          href={state.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={markSent}
          className={primary}
        >
          <MessageCircle className="h-5 w-5" aria-hidden />
          {t("verifyPhone.confirmWithWhatsApp")}
        </a>
        <p className="-mt-2 text-[14px] leading-[1.5] text-[var(--color-muted-foreground)]">
          {t("verifyPhone.hint")}
        </p>
        <div className="pt-2">{leave}</div>
      </Page>
    );
  }

  if (state.status === "waiting") {
    const until = new Intl.DateTimeFormat(i18n.language, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(state.expiresAt);
    return (
      <Page
        head={
          <>
            <h1 className={AUTH_TITLE}>{t("verifyPhone.waitingTitle")}</h1>
            <p className={LEDE}>{t("verifyPhone.waitingLede")}</p>
          </>
        }
        aside={
          <div className="rounded-[14px] bg-[var(--color-blue-softer)] p-6">
            <p className="text-[14px] font-semibold text-[var(--color-muted-foreground)]">
              {t("verifyPhone.messageLabel")}
            </p>
            <p className="mt-2 text-[16px] leading-[1.45] text-[var(--color-ink-2)] md:text-[19px]">
              {t("verifyPhone.message", { code: "" }).trim()}{" "}
              <span className="font-bold tracking-[0.06em] text-[var(--color-headline)] tabular-nums">
                {state.code}
              </span>
            </p>
            <p className="mt-4 flex justify-between gap-3 border-t border-[var(--color-blue-line)] pt-3 text-[13.5px] text-[var(--color-muted-foreground)]">
              <span>
                {t("verifyPhone.messageTo", {
                  number: formatPhone(state.businessNumber),
                })}
              </span>
              <span className="tabular-nums">
                {t("verifyPhone.validUntil", { time: until })}
              </span>
            </p>
          </div>
        }
      >
        <p
          className="flex items-center gap-2.5 text-[15px] font-semibold text-[var(--color-headline)]"
          aria-live="polite"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-primary)] opacity-40 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]" />
          </span>
          {t("verifyPhone.waiting")}
        </p>
        <a
          href={state.link}
          target="_blank"
          rel="noopener noreferrer"
          className={secondary}
        >
          <MessageCircle className="h-5 w-5" aria-hidden />
          {t("verifyPhone.openAgain")}
        </a>
        <p className="text-[14px] leading-[1.5] text-[var(--color-muted-foreground)]">
          {t("verifyPhone.noWhatsApp")}
        </p>
        <div>{leave}</div>
      </Page>
    );
  }

  if (state.status === "confirmed") {
    return (
      <Page>
        <CircleCheck
          className="h-12 w-12 text-[var(--color-ok-fg)]"
          strokeWidth={1.6}
          aria-hidden
        />
        <h1 className={AUTH_TITLE}>{t("verifyPhone.confirmedTitle")}</h1>
        {phone ? (
          <p className={LEDE}>
            {t("verifyPhone.confirmedLede", { phone: formatPhone(phone) })}
          </p>
        ) : null}
        <button type="button" onClick={goOn} className={primary}>
          {t("verifyPhone.continue")}
        </button>
      </Page>
    );
  }

  const expired = state.status === "expired";
  return (
    <Page>
      {expired ? (
        <p className="flex items-center gap-1.5 text-[15px] font-semibold text-[var(--color-bad-fg)]">
          <CircleAlert className="h-[18px] w-[18px]" aria-hidden />
          {t("verifyPhone.expiredEyebrow")}
        </p>
      ) : null}
      <h1 className={AUTH_TITLE}>
        {expired ? t("verifyPhone.expiredTitle") : t("verifyPhone.failedTitle")}
      </h1>
      <p className={LEDE}>
        {expired ? t("verifyPhone.expiredLede") : t("verifyPhone.failedLede")}
      </p>
      {expired ? numberFact : null}
      <button type="button" onClick={restart} className={primary}>
        {expired ? <MessageCircle className="h-5 w-5" aria-hidden /> : null}
        {expired ? t("verifyPhone.newCode") : t("verifyPhone.retry")}
      </button>
      <div className="pt-2">{leave}</div>
    </Page>
  );
}

/** The lede under each title; the column's 22px rhythm does the spacing. */
const LEDE = cn(AUTH_LEDE, "mt-0 max-w-[40ch]");

const primary = buttonVariants({ className: "w-full" });
const secondary = buttonVariants({
  variant: "secondary",
  className: "w-full md:w-auto md:self-start",
});
const quiet =
  "text-[15px] font-medium text-[var(--color-muted-foreground)] hover:text-[var(--color-headline)] hover:underline underline-offset-4 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2";

/**
 * The page frame: the site header, then one column (two on wide screens when there is an aside).
 *
 * DOM order is always head → aside → rest, so a single-column phone shows the
 * message right after the lede, before the "not now" way out. On md+, `head`
 * and `children` are pinned to the same grid column (rows 1 and 2) so they
 * still read as one column, and `aside` spans both rows, centred beside them.
 */
function Page({
  children,
  head,
  aside,
}: {
  children: ReactNode;
  head?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="min-h-svh bg-[var(--color-background)]">
      <SiteHeader current="none" />
      <main
        className={
          aside
            ? "mx-auto grid max-w-[980px] gap-y-[22px] px-6 py-12 md:grid-cols-[minmax(0,460px)_minmax(0,420px)] md:items-center md:justify-center md:gap-x-24 md:py-20"
            : "mx-auto max-w-[460px] px-6 py-12 md:py-20"
        }
      >
        {head ? (
          <div
            className={`flex flex-col gap-[22px]${aside ? " md:col-start-1 md:row-start-1" : ""}`}
          >
            {head}
          </div>
        ) : null}
        {aside ? (
          <div className="md:col-start-2 md:row-start-1 md:row-span-2 md:self-center">
            {aside}
          </div>
        ) : null}
        <div
          className={`flex flex-col gap-[22px]${aside ? " md:col-start-1 md:row-start-2" : ""}`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
