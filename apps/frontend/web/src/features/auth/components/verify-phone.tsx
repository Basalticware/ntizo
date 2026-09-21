import { useEffect, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Check, CircleAlert, CircleCheck, MessageCircle } from "lucide-react";
import { useSession } from "@/shared/lib/api/auth-client";
import { usePhoneVerification } from "@/features/auth/viewmodel/use-phone-verification";
import { formatPhone } from "@/features/auth/domain/phone-verification";
import { textAction } from "@/shared/ui/text-action";

/**
 * Confirming a phone number by sending Ntizo a WhatsApp message.
 *
 * Drawn on the site's rules rather than on `AuthLayout`'s card: white page,
 * navy heading and action, hairlines, no tinted icon circle. See the approved
 * mockup, docs/superpowers/specs/2026-09-21-whatsapp-phone-verification.mockup.html.
 *
 * `next` present means the page was reached as the invite after an email
 * confirmation: "Agora não" and "Continuar" go there, and a stage without
 * WhatsApp is skipped silently. Absent means Conta → Segurança sent them.
 */
export function VerifyPhone({ next }: { next?: string }) {
  const { t, i18n } = useTranslation("auth");
  const navigate = useNavigate();
  const { data: session } = useSession();
  const phone = (session?.user as { phoneNumber?: string | null } | undefined)?.phoneNumber ?? "";
  const { state, markSent, restart } = usePhoneVerification((code) =>
    t("verifyPhone.message", { code }),
  );

  const invite = next !== undefined;
  const goOn = () => void navigate({ href: next ?? "/account", replace: true });

  useEffect(() => {
    if (invite && state.status === "unavailable") void navigate({ href: next, replace: true });
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
        <p className="type-caption text-[var(--color-muted-foreground)]">{t("verifyPhone.yourNumber")}</p>
        <p className="text-[21px] font-semibold tabular-nums text-[var(--color-foreground)]">{formatPhone(phone)}</p>
      </div>
      <Link to="/account" className={textAction()}>
        {t("verifyPhone.change")}
      </Link>
    </div>
  ) : null;

  if (state.status === "starting" || (invite && state.status === "unavailable")) {
    return (
      <Page>
        <p className="type-body text-[var(--color-muted-foreground)]" aria-live="polite">
          {t("verifyPhone.preparing")}
        </p>
      </Page>
    );
  }

  if (state.status === "ready") {
    return (
      <Page>
        {invite ? (
          <p className="type-body-medium flex items-center gap-1.5 text-[var(--color-success)]">
            <Check className="h-4 w-4" aria-hidden />
            {t("verifyPhone.emailConfirmed")}
          </p>
        ) : null}
        <h1 className="type-h1 text-[var(--color-headline)]">{t("verifyPhone.title")}</h1>
        <p className="type-body max-w-[40ch] text-[var(--color-muted-foreground)]">{t("verifyPhone.lede")}</p>
        {numberFact}
        <a href={state.link} target="_blank" rel="noopener noreferrer" onClick={markSent} className={primary}>
          <MessageCircle className="h-5 w-5" aria-hidden />
          {t("verifyPhone.confirmWithWhatsApp")}
        </a>
        <p className="type-body -mt-2 text-[var(--color-muted-foreground)]">{t("verifyPhone.hint")}</p>
        <div className="pt-2">{leave}</div>
      </Page>
    );
  }

  if (state.status === "waiting") {
    const until = new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit" }).format(
      state.expiresAt,
    );
    return (
      <Page
        aside={
          <div className="rounded-[18px] bg-[var(--color-muted)] p-5">
            <p className="type-caption text-[var(--color-muted-foreground)]">{t("verifyPhone.messageLabel")}</p>
            <p className="mt-2 text-[16px] leading-[1.45] text-[var(--color-foreground)] md:text-[19px]">
              {t("verifyPhone.message", { code: "" }).trim()}{" "}
              <span className="font-bold tracking-[0.06em] text-[var(--color-headline)] tabular-nums">
                {state.code}
              </span>
            </p>
            <p className="type-caption mt-3 flex justify-between gap-3 border-t border-[var(--color-border)] pt-2.5 text-[var(--color-muted-foreground)]">
              <span>{t("verifyPhone.messageTo", { number: formatPhone(state.businessNumber) })}</span>
              <span className="tabular-nums">{t("verifyPhone.validUntil", { time: until })}</span>
            </p>
          </div>
        }
      >
        <h1 className="type-h1 text-[var(--color-headline)]">{t("verifyPhone.waitingTitle")}</h1>
        <p className="type-body max-w-[40ch] text-[var(--color-muted-foreground)]">{t("verifyPhone.waitingLede")}</p>
        <p className="type-body-medium flex items-center gap-2.5 text-[var(--color-foreground)]" aria-live="polite">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-headline)] opacity-40 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--color-headline)]" />
          </span>
          {t("verifyPhone.waiting")}
        </p>
        <a href={state.link} target="_blank" rel="noopener noreferrer" className={secondary}>
          <MessageCircle className="h-5 w-5" aria-hidden />
          {t("verifyPhone.openAgain")}
        </a>
        <p className="type-body text-[var(--color-muted-foreground)]">{t("verifyPhone.noWhatsApp")}</p>
        <div>{leave}</div>
      </Page>
    );
  }

  if (state.status === "confirmed") {
    return (
      <Page>
        <CircleCheck className="h-11 w-11 text-[var(--color-success)]" strokeWidth={1.6} aria-hidden />
        <h1 className="type-h1 text-[var(--color-headline)]">{t("verifyPhone.confirmedTitle")}</h1>
        {phone ? (
          <p className="type-body text-[var(--color-muted-foreground)]">
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
        <p className="type-body-medium flex items-center gap-1.5 text-[var(--color-destructive)]">
          <CircleAlert className="h-4 w-4" aria-hidden />
          {t("verifyPhone.expiredEyebrow")}
        </p>
      ) : null}
      <h1 className="type-h1 text-[var(--color-headline)]">
        {expired ? t("verifyPhone.expiredTitle") : t("verifyPhone.failedTitle")}
      </h1>
      <p className="type-body max-w-[40ch] text-[var(--color-muted-foreground)]">
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

const primary =
  "inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] bg-[var(--color-navy-surface)] px-5 text-[16px] font-semibold text-[var(--color-navy-on)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2";
const secondary =
  "inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] border border-[var(--color-border-strong)] px-5 text-[16px] font-semibold text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 md:w-auto md:self-start";
const quiet =
  "type-body-medium text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:underline underline-offset-4";

/** The page frame: the wordmark, then one column (two on wide screens when there is an aside). */
function Page({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="min-h-svh bg-[var(--color-background)]">
      <div className="px-6 pt-6 md:px-14 md:pt-7">
        <Link to="/" className="text-[24px] font-extrabold leading-none tracking-[-0.04em] text-[var(--color-primary)]">
          ntizo
        </Link>
      </div>
      <main
        className={
          aside
            ? "mx-auto grid max-w-[980px] gap-10 px-6 py-12 md:grid-cols-[minmax(0,460px)_minmax(0,420px)] md:items-center md:justify-center md:gap-24 md:py-20"
            : "mx-auto max-w-[460px] px-6 py-12 md:py-20"
        }
      >
        <div className="flex flex-col gap-[22px]">{children}</div>
        {aside ?? null}
      </main>
    </div>
  );
}
