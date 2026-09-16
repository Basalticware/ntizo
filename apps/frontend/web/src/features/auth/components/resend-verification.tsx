import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authClient } from "@/shared/lib/api/auth-client";
import { authErrorMessage } from "@/features/auth/viewmodel/auth-error";
import { textAction } from "@/shared/ui/text-action";

/**
 * Asks for a new verification link.
 *
 * Without it an account that missed its first link had no way back: the link
 * lasts an hour, sign-in refuses an unconfirmed address, registering again
 * with the same address answers with a quiet success and sends nothing, and a
 * password reset does not confirm anything. Three QA accounts ended up there.
 *
 * `callbackURL` must be absolute and point at this app — better-auth resolves
 * a relative one against the API origin, and the link would land on its JSON
 * root instead of back here, signed in.
 *
 * Once sent, the button gives way to the confirmation rather than staying
 * pressable: another click would only send another copy of the same link.
 */
export function ResendVerification({
  email,
  callbackURL,
}: {
  email: string;
  callbackURL: string;
}) {
  const { t, i18n } = useTranslation("auth");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setStatus("sending");
    setError(null);
    try {
      const { error: failure } = await authClient.sendVerificationEmail({
        email,
        callbackURL,
        // The mail in the language on screen, as at sign-up.
        fetchOptions: { headers: { "Accept-Language": i18n.language } },
      });
      if (failure) {
        setError(authErrorMessage(t, failure));
        setStatus("idle");
        return;
      }
      setStatus("sent");
    } catch (err) {
      setError(authErrorMessage(t, err));
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <p role="status" className="text-sm text-center text-[var(--color-muted-foreground)]">
        {t("verificationResent", { email })}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => void resend()}
        disabled={status === "sending"}
        className={textAction()}
      >
        {status === "sending" ? t("sending") : t("resendVerification")}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-center text-[var(--color-destructive)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
