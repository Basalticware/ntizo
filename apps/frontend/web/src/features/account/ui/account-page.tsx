import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Pencil, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@ntizo/frontend-ui";
import { useCurrentUser } from "@/features/user/viewmodel/use-current-user";
import { useMyProviders } from "@/features/provider/viewmodel/use-providers";
import { canAccessProvider } from "@/shared/lib/zones";
import { ProfileForm } from "@/features/account/ui/profile-form";
import { ProfileHeader } from "@/features/account/ui/profile-header";
import { CUSTOMER_CARD, Fact } from "@/features/account/ui/customer-page";

/**
 * One personal detail: a muted label with its value directly under it.
 *
 * Label above value, not label-left value-right. The old layout put the two in
 * opposite corners of a wide column, so reading "date of birth" meant crossing
 * empty space to find the date.
 */
function Detail({ label, value }: { label: string; value: string | null }) {
  const { t } = useTranslation("account");
  return (
    <Fact label={label}>
      <span
        className={
          value
            ? "font-semibold text-[var(--color-headline)]"
            : "text-[var(--color-muted-foreground)]"
        }
      >
        {value || t("notSet")}
      </span>
    </Fact>
  );
}

/**
 * The profile: who this is, how to reach them, and the few facts they chose
 * to tell us — one card, the way every section of the account is one card.
 *
 * Reading and editing are the same card: the identity block stays where it is
 * and only what sits under the row line changes — the three details, or the
 * fields that set them. `ProfileForm` draws that header itself so the photo
 * can be edited on the avatar already on screen; see `ProfileHeader`.
 *
 * Two things left on 2026-09-07. The three figures under the details —
 * bookings completed, average rating given, customer since — were a zero, a
 * dash and a date for nearly everyone; the date is the only one that means
 * something to a customer, so it is a sentence under the name now. And the
 * language, which Preferences already sets, no longer appears here as a fact:
 * one place to read it, one place to change it.
 */
export function AccountPage() {
  const { t, i18n } = useTranslation("account");
  const { data: user } = useCurrentUser();
  const { data: providers = [] } = useMyProviders();
  const [editing, setEditing] = useState(false);

  if (!user) return null;

  const locale = i18n.resolvedLanguage ?? i18n.language;
  const isProvider = canAccessProvider(user, providers.length);
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="grid gap-6">
      <section className={CUSTOMER_CARD}>
        {editing ? (
          <ProfileForm user={user} onDone={() => setEditing(false)} />
        ) : (
          <>
            <ProfileHeader
              user={user}
              action={
                // basis-full below `sm`: beside the avatar and the name there
                // is no room for a third thing on a phone, and sharing the row
                // squeezed the name into two lines. Its own line under the
                // header is where it fits.
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditing(true)}
                  className="basis-full sm:basis-auto"
                >
                  <Pencil />
                  {t("editProfile")}
                </Button>
              }
            />

            <dl className="m-0 mt-6 grid gap-6 border-t border-[var(--color-line-2)] pt-6 sm:grid-cols-3">
              <Detail
                label={t("fieldDateOfBirth")}
                value={
                  user.dateOfBirth
                    ? dateFmt.format(new Date(user.dateOfBirth))
                    : null
                }
              />
              <Detail
                label={t("fieldGender")}
                value={user.gender ? t(`gender.${user.gender}`) : null}
              />
              <Detail label={t("fieldTimezone")} value={user.timezone} />
            </dl>
          </>
        )}
      </section>

      {/* Only for someone who is not one yet. A provider who already has a
          workspace does not need to be invited into it. An info panel on the
          soft blue ground, with the page's one filled button, because it is
          the one thing here that asks for a decision. */}
      {!isProvider ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-4 rounded-[14px] bg-[var(--color-blue-softer)] p-5 sm:p-6">
          <span
            aria-hidden="true"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--color-blue-soft)] text-[var(--color-primary)]"
          >
            <Sparkles className="h-[22px] w-[22px]" />
          </span>
          <span className="min-w-0 flex-1 basis-[calc(100%-4.25rem)] sm:basis-0">
            <span className="block text-lg font-bold text-[var(--color-headline)]">
              {t("becomeProviderTitle")}
            </span>
            <span className="mt-0.5 block text-[15px] text-[var(--color-muted-foreground)]">
              {t("becomeProviderBody")}
            </span>
          </span>
          {/* Its own line on a phone, inline from `sm`. Sharing the row, it
              left the pitch three words wide — the sentence that is supposed
              to do the persuading. */}
          <Link
            to="/become-provider"
            className={`${buttonVariants()} basis-full sm:basis-auto`}
          >
            {t("becomeProviderCta")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
