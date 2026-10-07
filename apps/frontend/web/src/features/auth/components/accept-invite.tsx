import { useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Building2, Clock } from "lucide-react";
import { Badge, Button, Skeleton, buttonVariants } from "@ntizo/frontend-ui";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { AUTH_ERROR } from "@/features/auth/components/auth-styles";
import { useCurrentUser } from "@/features/user/viewmodel/use-current-user";
import { providerErrorMessage } from "@/features/provider/viewmodel/error-message";
import { useAcceptInvite } from "@/features/provider/viewmodel/use-member-mutations";
import {
  useDeclineInvite,
  useInvite,
} from "@/features/provider/viewmodel/use-invite";
import type { PublicInvite } from "@/features/provider/domain/types";

/**
 * The page an invitation link opens.
 *
 * It used to fire the accept mutation on mount and show one line of text. That
 * made joining an organisation something that happened *to* someone: no
 * mention of which workspace, who invited them, or what they would be able to
 * do, and a redirect 800ms later. Joining a business is a consent, and consent
 * needs to be asked for.
 *
 * So the invitation is read first — over the anonymous endpoint, because the
 * token is the credential and the page must be able to explain itself before
 * asking anyone to sign in. Then a button.
 */
export function AcceptInvite() {
  const { t } = useTranslation("auth");
  const { token } = useParams({ from: "/_public/accept-invite/$token" });
  const nav = useNavigate();

  const { data: invite, isLoading, error } = useInvite(token);
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { mutateAsync: accept, isPending: accepting } = useAcceptInvite();
  const { mutateAsync: decline, isPending: declining } = useDeclineInvite();
  const [failure, setFailure] = useState<string | null>(null);

  if (isLoading || userLoading) return <InviteSkeleton />;

  // A token nobody holds and a token that never existed look the same on
  // purpose: distinguishing them would turn this page into an oracle for
  // guessing tokens.
  if (error || !invite) {
    return (
      <DeadEnd title={t("inviteUnknownTitle")} body={t("inviteUnknownBody")} />
    );
  }

  if (invite.status !== "pending") {
    return (
      <DeadEnd
        title={t("inviteClosedTitle")}
        body={t(`inviteClosed.${invite.status}`)}
      />
    );
  }

  // Signed in as the wrong person. Accepting would put *this* account in the
  // workspace, which is not what the invitation said and not what the sender
  // meant, so it is refused before it is tried rather than after.
  const wrongAccount =
    !!user && user.email.toLowerCase() !== invite.email.toLowerCase();

  async function onAccept() {
    setFailure(null);
    try {
      await accept(token);
      await nav({ to: "/provider" });
    } catch (e) {
      setFailure(providerErrorMessage(t, e));
    }
  }

  async function onDecline() {
    setFailure(null);
    try {
      await decline(token);
      await nav({ to: "/" });
    } catch (e) {
      setFailure(providerErrorMessage(t, e));
    }
  }

  return (
    <AuthLayout
      title={t("inviteTitle", { name: invite.providerName })}
      subtitle=""
      footer={null}
    >
      <div className="grid gap-5">
        <Summary invite={invite} />

        {!user ? (
          // Signed out. The invitation has already been shown, so signing in is
          // now a step towards something known rather than a leap of faith —
          // which is the reason this page reads before it asks.
          <div className="grid gap-3">
            <p className="mb-1 text-[15px] leading-[1.5] text-[var(--color-muted-foreground)]">
              {t("inviteSignInPrompt", { email: invite.email })}
            </p>
            <Link
              to="/sign-in"
              search={{ next: `/accept-invite/${token}` }}
              className={buttonVariants({ className: "w-full" })}
            >
              {t("inviteSignIn")}
            </Link>
            <Link
              to="/sign-up"
              search={{ next: `/accept-invite/${token}` }}
              className={buttonVariants({
                variant: "outline",
                className: "w-full",
              })}
            >
              {t("inviteSignUp")}
            </Link>
          </div>
        ) : wrongAccount ? (
          <div className="grid gap-3">
            <Warning>
              {t("inviteWrongAccount", {
                invited: invite.email,
                current: user.email,
              })}
            </Warning>
            <Button
              variant="outline"
              onClick={() => void nav({ to: "/account" })}
            >
              {t("inviteSwitchAccount")}
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            <Button
              className="w-full"
              disabled={accepting || declining}
              onClick={() => void onAccept()}
            >
              {accepting ? t("acceptingInvite") : t("inviteAccept")}
            </Button>
            {/* "Not now" leaves without deciding; declining is a decision the
                sender sees. Two different things, so two different controls. */}
            <Button
              variant="ghost"
              className="w-full"
              disabled={accepting || declining}
              onClick={() => void onDecline()}
            >
              {declining ? t("inviteDeclining") : t("inviteDecline")}
            </Button>
            <Link
              to="/"
              className="mt-1 text-center text-[14.5px] font-medium text-[var(--color-muted-foreground)] hover:text-[var(--color-headline)] hover:underline"
            >
              {t("inviteNotNow")}
            </Link>
          </div>
        )}

        {failure && (
          <p role="alert" className={AUTH_ERROR}>
            {failure}
          </p>
        )}
      </div>
    </AuthLayout>
  );
}

/** What is being joined, before anything is decided about it. */
function Summary({ invite }: { invite: PublicInvite }) {
  const { t, i18n } = useTranslation("auth");
  const expires = new Intl.DateTimeFormat(
    i18n.resolvedLanguage ?? i18n.language,
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  ).format(new Date(invite.expiresAt));

  return (
    <div className="grid gap-5 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card)] p-6">
      <div className="flex items-center gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--color-blue-soft)] text-[var(--color-primary)]">
          <Building2 className="h-[22px] w-[22px]" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[17px] font-bold text-[var(--color-headline)]">
            {invite.providerName}
          </p>
          <p className="mt-0.5 truncate text-[14px] text-[var(--color-muted-foreground)]">
            {t("inviteFrom", { name: invite.inviterName })}
          </p>
        </div>
      </div>

      <dl className="grid gap-3 border-t border-[var(--color-line-2)] pt-5">
        <Row label={t("inviteRoleLabel")}>
          <Badge tone="info">{t(`inviteRole.${invite.role}`)}</Badge>
        </Row>
        <Row label={t("inviteExpiresLabel")}>
          <span className="text-[15px] text-[var(--color-ink-2)]">
            {expires}
          </span>
        </Row>
      </dl>

      <p className="rounded-[10px] bg-[var(--color-blue-softer)] px-4 py-3 text-[14px] leading-[1.5] text-[var(--color-ink-2)]">
        {t(`inviteRoleBlurb.${invite.role}`)}
      </p>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[14px] text-[var(--color-muted-foreground)]">
        {label}
      </dt>
      <dd className="m-0 text-right">{children}</dd>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-3 rounded-[10px] bg-[var(--color-warn-bg)] px-4 py-3 text-[14.5px] leading-[1.5] text-[var(--color-warn-chip)]">
      <AlertTriangle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--color-warn-fg)]" />
      {children}
    </p>
  );
}

/**
 * An invitation that cannot be used.
 *
 * No retry button: nothing the reader can do changes the outcome, and a
 * control that cannot work is worse than none. The way out is asking the
 * sender for a new one, which the copy says.
 */
function DeadEnd({ title, body }: { title: string; body: string }) {
  const { t } = useTranslation("auth");
  return (
    <AuthLayout title={title} subtitle={body} footer={null} icon={<Clock />}>
      <div className="grid gap-6">
        <Link
          to="/"
          className={buttonVariants({
            variant: "outline",
            className: "w-full",
          })}
        >
          {t("inviteGoHome")}
        </Link>
      </div>
    </AuthLayout>
  );
}

function InviteSkeleton() {
  const { t } = useTranslation("auth");
  return (
    <AuthLayout title={t("acceptInvite")} subtitle="" footer={null}>
      <div className="grid gap-5" aria-busy="true">
        <div className="grid gap-5 rounded-[14px] border border-[var(--color-border)] p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-[23px] w-40" />
              <Skeleton className="h-[17px] w-52" />
            </div>
          </div>
          <div className="grid gap-3 border-t border-[var(--color-line-2)] pt-5">
            <Skeleton className="h-[22px] w-full" />
            <Skeleton className="h-[22px] w-full" />
          </div>
          <Skeleton className="h-[17px] w-full" />
        </div>
        <Skeleton className="h-[47px] w-full rounded-[var(--radius-field)]" />
      </div>
    </AuthLayout>
  );
}
