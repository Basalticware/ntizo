import { useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useForm } from "@tanstack/react-form";
import { emailConfirmedCallbackURL } from "@/features/auth/viewmodel/email-callback";
import { Eye, EyeOff, UserPlus, MailCheck } from "lucide-react";
import { isValidPhoneNumber } from "libphonenumber-js";
import {
  Button,
  Checkbox,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  Label,
  PhoneInput,
  Separator,
} from "@ntizo/frontend-ui";
import { authClient } from "@/shared/lib/api/auth-client";
import { AuthSplitLayout } from "@/features/auth/components/auth-split-layout";
import { GoogleIcon } from "@/shared/components/icons";
import { authErrorMessage } from "@/features/auth/viewmodel/auth-error";
import { ResendVerification } from "@/features/auth/components/resend-verification";
import {
  AUTH_DIVIDER_TEXT,
  AUTH_ERROR,
  AUTH_FIELD,
  AUTH_FORM,
  AUTH_HINT,
  AUTH_ICON_DISC,
  AUTH_INPUT_GROUP_BUTTON,
  AUTH_LEDE,
  AUTH_LINK,
  AUTH_TITLE,
} from "@/features/auth/components/auth-styles";

export function SignUp() {
  const { t, i18n } = useTranslation("auth");
  const { t: tc } = useTranslation("common");
  // Where to go once the address is verified. `strict: false` so this works
  // whether or not the route declares the param.
  const { next } = useSearch({ strict: false }) as { next?: string };
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      acceptTerms: false,
    },
    validators: {
      onSubmitAsync: async ({ value }) => {
        // Checked here as well as via the input's `required`: the native
        // attribute gives fast feedback, this is the one that cannot be
        // removed with devtools.
        if (!value.acceptTerms) return { form: t("mustAcceptTerms") };
        // Re-checked against the same library the server validates with, so
        // a number that passes here cannot be rejected there. `value.phone`
        // is already E.164 — PhoneInput emits nothing else.
        if (!isValidPhoneNumber(value.phone))
          return { form: t("invalidPhone") };
        try {
          const { error } = await authClient.signUp.email({
            email: value.email,
            password: value.password,
            name: `${value.firstName} ${value.lastName}`.trim(),
            firstName: value.firstName,
            lastName: value.lastName,
            phoneNumber: value.phone,
            // Absolute, and pointing at this app. better-auth builds the
            // verification link off its own baseURL (the API origin) and
            // redirects here afterwards — without this the user lands on the
            // API's JSON root instead of the app. Origin-checked server-side
            // against trustedOrigins, which already includes this origin.
            //
            // The path carries the intent through verification. Someone who
            // arrived from "become a provider" comes back to `/onboarding`
            // rather than the customer home — which is where the chain used to
            // break: they registered, landed on `/`, and the thing they came to
            // do was never offered again.
            //
            // It lands on the phone invite first (/verify-phone?next=…),
            // which steps aside when there is nothing to confirm.
            callbackURL: emailConfirmedCallbackURL(
              window.location.origin,
              next,
            ),
            // The language on screen, not the browser's own. Someone reading
            // the app in Portuguese with an English-configured browser gets
            // Portuguese email, which is the whole point — and this is the
            // only request that can say so, because the profile is created
            // from it and nothing afterwards knows what was on the screen.
            fetchOptions: {
              headers: {
                "Accept-Language": i18n.language,
                // So a new profile is born in the reader's own timezone
                // instead of UTC. `resolvedOptions().timeZone` is an IANA
                // name in every browser this app supports.
                "X-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
              },
            },
          } as Parameters<typeof authClient.signUp.email>[0]);
          if (error) return { form: authErrorMessage(t, error) };
          setSubmitted(value.email);
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

  const panel = {
    pitch: t("pitchSignUp"),
    pointsAsList: true as const,
    points: [t("proofVerified"), t("proofEscrow"), t("proofRealReviews")],
  };

  if (submitted) {
    return (
      <AuthSplitLayout {...panel}>
        <div className="flex flex-col items-center gap-6 text-center">
          <span aria-hidden="true" className={AUTH_ICON_DISC}>
            <MailCheck />
          </span>
          <div>
            <h1 className={AUTH_TITLE}>{t("checkYourEmail")}</h1>
            <p className={AUTH_LEDE}>
              {t("verificationSent", { email: submitted })}
            </p>
          </div>
          {/* For the mail that went to spam, or the link that expired
                before anyone got to it — an hour is not long. */}
          <ResendVerification
            email={submitted}
            callbackURL={emailConfirmedCallbackURL(
              window.location.origin,
              next,
            )}
          />
          <Link to="/sign-in" className={`text-[15px] ${AUTH_LINK}`}>
            {t("backToSignIn")}
          </Link>
        </div>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout {...panel}>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className={AUTH_TITLE}>{t("createYourAccount")}</h1>
          <p className={AUTH_LEDE}>{t("fastAndFree")}</p>
        </div>

        <form
          className={AUTH_FORM}
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Subscribe selector={(s) => s.errorMap.onSubmit}>
            {(err) =>
              err ? (
                <div role="alert" className={AUTH_ERROR}>
                  {err.form}
                </div>
              ) : null
            }
          </form.Subscribe>

          {/* Two fields, not one "full name". A single field forces a guess
                at where the surname begins, and the profile stores them
                separately — the mockup shows one field, but the data model and
                Mozambican naming both argue against it. */}
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="firstName">
              {(field) => (
                <div className={AUTH_FIELD}>
                  <Label htmlFor={field.name}>{t("firstName")}</Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    required
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="lastName">
              {(field) => (
                <div className={AUTH_FIELD}>
                  <Label htmlFor={field.name}>{t("lastName")}</Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    required
                  />
                </div>
              )}
            </form.Field>
          </div>

          <form.Field name="email">
            {(field) => (
              <div className={AUTH_FIELD}>
                <Label htmlFor={field.name}>{t("email")}</Label>
                <Input
                  id={field.name}
                  type="email"
                  placeholder={t("emailPlaceholder")}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  required
                />
              </div>
            )}
          </form.Field>

          <form.Field name="phone">
            {(field) => (
              <div className={AUTH_FIELD}>
                <Label htmlFor={field.name}>{t("phone")}</Label>
                <PhoneInput
                  id={field.name}
                  value={field.state.value}
                  onChange={(next) => field.handleChange(next)}
                  onBlur={field.handleBlur}
                  // Mozambique is the launch market, so it is the sensible
                  // first guess — but every country is one search away.
                  defaultCountry="MZ"
                  locale={i18n.language}
                  placeholder={t("phonePlaceholder")}
                  searchPlaceholder={t("countrySearchPlaceholder")}
                  noResultsText={t("countryNoResults")}
                  countrySelectLabel={t("countrySelectLabel")}
                  required
                />
                <p className={AUTH_HINT}>{t("phoneHint")}</p>
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
                    placeholder={t("createPassword")}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    required
                    minLength={8}
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
                <p className={AUTH_HINT}>{t("passwordHint")}</p>
              </div>
            )}
          </form.Field>

          <form.Field name="acceptTerms">
            {(field) => (
              <label className="flex items-start gap-3 text-[14.5px] leading-[1.45]">
                <Checkbox
                  id={field.name}
                  checked={field.state.value}
                  onChange={(e) => field.handleChange(e.target.checked)}
                  className="mt-0.5"
                  required
                />
                {/* The two documents, reachable from the checkbox that asks
                      you to accept them. It read as a plain sentence before,
                      naming things a person had no way to go and read. */}
                <span className="text-[var(--color-muted-foreground)]">
                  {t("acceptTerms")}{" "}
                  <Link to="/terms" target="_blank" className={AUTH_LINK}>
                    {tc("footer.terms", { ns: "landing" })}
                  </Link>
                  {" · "}
                  <Link to="/privacy" target="_blank" className={AUTH_LINK}>
                    {tc("footer.privacy", { ns: "landing" })}
                  </Link>
                </span>
              </label>
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
                <UserPlus />
                {isSubmitting ? t("creatingAccount") : t("createAccount")}
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
          {t("alreadyHaveAccount")}{" "}
          <Link to="/sign-in" className={AUTH_LINK}>
            {t("signIn")}
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}
