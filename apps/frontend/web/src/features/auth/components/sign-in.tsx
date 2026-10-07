import { useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useForm } from "@tanstack/react-form";
import { Eye, EyeOff, LogIn } from "lucide-react";
import {
  Button,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  Label,
  Separator,
} from "@ntizo/frontend-ui";
import { authClient } from "@/shared/lib/api/auth-client";
import { useClearSessionQueryCache } from "@/features/user/viewmodel/use-current-user";
import { resolveDestinationForSession } from "@/features/provider/viewmodel/post-login";
import { AuthSplitLayout } from "@/features/auth/components/auth-split-layout";
import { GoogleIcon } from "@/shared/components/icons";
import { authErrorMessage } from "@/features/auth/viewmodel/auth-error";
import { EMAIL_NOT_VERIFIED_CODE } from "@/features/auth/domain/errors";
import { ResendVerification } from "@/features/auth/components/resend-verification";
import { emailConfirmedCallbackURL } from "@/features/auth/viewmodel/email-callback";
import {
  AUTH_DIVIDER_TEXT,
  AUTH_ERROR,
  AUTH_FIELD,
  AUTH_FORM,
  AUTH_INPUT_GROUP_BUTTON,
  AUTH_LEDE,
  AUTH_LINK,
  AUTH_TITLE,
} from "@/features/auth/components/auth-styles";

export function SignIn() {
  const { t } = useTranslation("auth");
  const { t: tc } = useTranslation("common");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { next, error: socialError } = useSearch({ strict: false }) as {
    next?: string;
    error?: string;
  };
  const clearSessionQueryCache = useClearSessionQueryCache();
  // The address that just proved its password but was never confirmed. Held
  // apart from the form's error so the offer of a new link belongs to that
  // answer only, and goes away with the next attempt.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: {
      onSubmitAsync: async ({ value }) => {
        setUnverifiedEmail(null);
        try {
          const { error } = await authClient.signIn.email({
            email: value.email,
            password: value.password,
          });
          if (error) {
            if (error.code === EMAIL_NOT_VERIFIED_CODE)
              setUnverifiedEmail(value.email);
            return { form: authErrorMessage(t, error) };
          }
          // Clear before navigating, for the same reason sign-out does.
          //
          // The sign-in page is itself signed out, so any session-scoped
          // query mounted on it — `user.me` among them, now that the mobile
          // bar reads it on every page — resolves to "not signed in" and
          // that answer sits in the cache. Navigating without clearing hands
          // the authenticated shell the signed-out result, and it renders an
          // account menu with no account in it.
          clearSessionQueryCache();
          navigate({ to: await resolveDestinationForSession(next ?? null) });
          return null;
        } catch (err) {
          // authClient doesn't set throw:true/catchAllError, so a
          // network-level failure rejects instead of resolving {error} —
          // normalize it the same way so the form always has a message to
          // show, instead of `.form` being undefined on a bare thrown value.
          return { form: authErrorMessage(t, err) };
        }
      },
    },
  });

  return (
    <AuthSplitLayout
      pitch={t("pitchSignIn")}
      points={[
        t("proofVerified"),
        t("proofSecurePayment"),
        t("proofRealReviews"),
      ]}
      pointsAsList
    >
      <div className="flex flex-col gap-8">
        <div>
          <h1 className={AUTH_TITLE}>{t("welcomeBack")}</h1>
          <p className={AUTH_LEDE}>{t("signInToAccount")}</p>
        </div>

        <form
          className={AUTH_FORM}
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          {/* A social sign-in that failed comes back here with ?error=...
                rather than dying on the API's JSON root. better-auth writes
                the code in lower snake case; the map is keyed the way the
                API returns codes elsewhere, so it is upper-cased here — at
                the one place that knows about the URL. */}
          {socialError ? (
            <div role="alert" className={AUTH_ERROR}>
              {authErrorMessage(t, { code: socialError.toUpperCase() })}
            </div>
          ) : null}

          <form.Subscribe selector={(s) => s.errorMap.onSubmit}>
            {(error) =>
              error ? (
                <div role="alert" className={AUTH_ERROR}>
                  {error.form}
                </div>
              ) : null
            }
          </form.Subscribe>

          {unverifiedEmail ? (
            <ResendVerification
              key={unverifiedEmail}
              email={unverifiedEmail}
              // Where the new link lands once clicked — the same place the
              // sign-in would have gone, when that is a path of this app.
              callbackURL={emailConfirmedCallbackURL(
                window.location.origin,
                next,
              )}
            />
          ) : null}

          <form.Field name="email">
            {(field) => (
              <div className={AUTH_FIELD}>
                <Label htmlFor={field.name}>{t("email")}</Label>
                <Input
                  id={field.name}
                  type="email"
                  placeholder={t("emailPlaceholder")}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  required
                />
              </div>
            )}
          </form.Field>

          <form.Field name="password">
            {(field) => (
              <div className={AUTH_FIELD}>
                <Label htmlFor={field.name}>{t("password")}</Label>
                <InputGroup>
                  <InputGroupInput
                    id={field.name}
                    type={showPassword ? "text" : "password"}
                    placeholder={t("passwordPlaceholder")}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    required
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      className={AUTH_INPUT_GROUP_BUTTON}
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword ? t("hidePassword") : t("showPassword")
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <Link
                  to="/forgot-password"
                  className={`self-end text-[14px] ${AUTH_LINK}`}
                >
                  {t("forgotPassword")}
                </Link>
              </div>
            )}
          </form.Field>

          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                className="mt-1 w-full"
                disabled={!canSubmit}
              >
                <LogIn />
                {isSubmitting ? t("signingIn") : t("signIn")}
              </Button>
            )}
          </form.Subscribe>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className={AUTH_DIVIDER_TEXT}>{tc("orContinueWith")}</span>
            <Separator className="flex-1" />
          </div>

          {/* One column: Microsoft is gone and a lone button in a
                two-column grid sits at half width beside a hole. */}
          <div className="grid grid-cols-1">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                authClient.signIn.social({
                  provider: "google",
                  // Absolute, and pointing at THIS app. A relative path is
                  // resolved against better-auth's own baseURL, which is the
                  // API origin — a successful sign-in landed on the API's
                  // JSON root instead of the app.
                  callbackURL: `${window.location.origin}/`,
                  // And the failure needs its own destination, or the error
                  // goes to that same JSON root: a person who tried to sign
                  // in read `{"status":"ok"}` and an error code in the URL
                  // bar. Sent back to the form, which knows how to say it.
                  errorCallbackURL: `${window.location.origin}/sign-in`,
                })
              }
            >
              <GoogleIcon className="h-5 w-5" />
              {tc("google")}
            </Button>
          </div>
        </form>

        <p className="text-center text-[15px] text-[var(--color-muted-foreground)]">
          {t("dontHaveAccount")}{" "}
          <Link to="/sign-up" className={AUTH_LINK}>
            {t("signUp")}
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}
