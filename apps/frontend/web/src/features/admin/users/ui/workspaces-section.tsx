import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage, Badge } from "@ntizo/frontend-ui";
import { ProviderStatus } from "@ntizo/shared";
import { initialsFrom } from "@/shared/lib/initials";
import type { AdminUserWorkspace } from "../domain/types";
import { USER_CARD, UserCardHead, UserCardNote } from "./user-card";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info"> = {
  [ProviderStatus.Active]: "success",
  [ProviderStatus.Pending]: "warning",
  [ProviderStatus.Rejected]: "danger",
  [ProviderStatus.Suspended]: "danger",
  [ProviderStatus.Archived]: "info",
};

/**
 * The businesses this person belongs to.
 *
 * The same rows the list's "Espaços" count counts, so the number there and
 * the rows here agree. The role words come from the `provider` namespace,
 * where the workspace's own people list reads them.
 */
export function WorkspacesSection({
  workspaces,
  loading,
}: {
  workspaces: readonly AdminUserWorkspace[];
  loading: boolean;
}) {
  const { t, i18n } = useTranslation("admin");
  const { t: tp } = useTranslation("provider");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(
      new Date(iso),
    );

  return (
    <section className={USER_CARD}>
      <UserCardHead title={t("userDetailWorkspaces")} hint={t("userDetailWorkspacesHint")} />

      {loading ? (
        <UserCardNote>{t("userDetailWorkspacesLoading")}</UserCardNote>
      ) : (
        <ul className="mt-3 mb-0 grid list-none gap-0 p-0">
          {workspaces.map((w) => (
            <li key={w.providerId} className="border-t border-[var(--color-line-2)] first:border-t-0">
              <Link
                to="/admin/providers/$providerId"
                params={{ providerId: w.providerId }}
                className="group -mx-2.5 flex items-center justify-between gap-4 rounded-[10px] px-2.5 py-3.5 hover:bg-[var(--color-blue-softer)]"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <Avatar className="h-11 w-11 shrink-0 rounded-[10px]">
                    {w.logoUrl && <AvatarImage src={w.logoUrl} alt="" />}
                    <AvatarFallback className="rounded-[10px] bg-[var(--color-blue-soft)] text-[13px] font-semibold text-[var(--color-primary)]">
                      {initialsFrom(w.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="m-0 truncate text-[15px] font-bold text-[var(--color-headline)] group-hover:underline">{w.name}</p>
                    <p className="m-0 mt-0.5 truncate text-[13px] text-[var(--color-muted-foreground)]">
                      {t("userDetailWorkspaceLine", {
                        role: tp(`peopleRoles.${w.memberRole}`, { defaultValue: w.memberRole }),
                        date: date(w.joinedAt),
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge tone={STATUS_TONE[w.providerStatus] ?? "info"} className="h-[26px] px-3 text-[13px]">
                    {t(`providerStatus.${w.providerStatus}`, { defaultValue: w.providerStatus })}
                  </Badge>
                  <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] text-[var(--color-ink-2)]" />
                </div>
              </Link>
            </li>
          ))}
          {workspaces.length === 0 && (
            <li>
              <UserCardNote>{t("userDetailNoWorkspaces")}</UserCardNote>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
