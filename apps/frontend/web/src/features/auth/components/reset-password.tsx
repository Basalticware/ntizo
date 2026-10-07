import { useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useForm } from "@tanstack/react-form";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import {
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  Input,
  Label,
} from "@ntizo/frontend-ui";
import { authClient } from "@/shared/lib/api/auth-client";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import {
  AUTH_ERROR,
  AUTH_FIELD,
  AUTH_FORM,
  AUTH_HINT,
  AUTH_INPUT_GROUP_BUTTON,
  AUTH_LINK,
} from "@/features/auth/components/auth-styles";
import { authErrorMessage } from "@/features/auth/viewmodel/auth-error";

/**
 * Where the emailed link lands.
 *
 * This page is what makes the reset flow real — without it the message that
 * better-auth already sends today points at a 404. The token arrives as a
 * query parameter; better-auth validates it server-side, so nothing here
 * inspects or trusts it beyond passing it back.
 */
export function ResetPassword() {
  const { t } = useTranslation("auth");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { token } = useSearch({ strict: false }) as { token?: string };

  const form = useForm({
    defaultValues: { password: "", confirm: "" },
    validators: {
      onSubmitAsync: async ({ value }) => {
        if (!token) return { form: t("resetTokenMissing") };
        if (value.password !== value.confirm)
          return { form: t("passwordsDoNotMatch") };
        try {
          const { error } = await authClient.resetPassword({
            newPassword: value.password,
            token,
          });
          if (error) return { form: authErrorMessage(t, error) };
          navigate({ to: "/sign-in" });
          return null;
        } catch (err) {
          return {
            form: authErrorMessage(t, err),
          };
        }
      },
    },
  });

  return (
    <AuthLayout
      title={t("newPasswordTitle")}
      subtitle={t("newPasswordSubtitle")}
      footer={
        <Link to="/sign-in" className={AUTH_LINK}>
          {t("backToSignInArrow")}
        </Link>
      }
    >
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

        <form.Field name="password">
          {(field) => (
            <div className={AUTH_FIELD}>
              <Label htmlFor={field.name}>{t("newPassword")}</Label>
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

        <form.Field name="confirm">
          {(field) => (
            <div className={AUTH_FIELD}>
              <Label htmlFor={field.name}>{t("confirmPassword")}</Label>
              {/* A bare input with the field's own frame — it was an
                  `InputGroupInput` outside any group, which drew no border. */}
              <Input
                id={field.name}
                type={showPassword ? "text" : "password"}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                required
                minLength={8}
              />
            </div>
          )}
        </form.Field>

        <form.Subscribe
          selector={(s) => [s.canSubmit, s.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" className="w-full" disabled={!canSubmit}>
              <KeyRound />
              {isSubmitting ? t("saving") : t("setNewPassword")}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </AuthLayout>
  );
}
