import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage, Badge } from "@ntizo/frontend-ui";
import { ProviderStatus } from "@ntizo/shared";
import { initialsFrom } from "@/shared/lib/initials";
import type { AdminUserWorkspace } from "../domain/types";

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
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)]">
      <div className="px-5 py-4">
        <p className="type-caption font-bold tracking-[0.14em] text-[var(--color-muted-foreground)] uppercase">
          {t("userDetailWorkspaces")}
        </p>
        <p className="type-body mt-0.5 text-[var(--color-muted-foreground)]">
          {t("userDetailWorkspacesHint")}
        </p>
      </div>

      {loading ? (
        <p className="type-body border-t border-[var(--color-border)] px-5 py-8 text-center text-[var(--color-muted-foreground)]">
          {t("providerDetailDocumentsLoading")}
        </p>
      ) : (
        <ul className="grid list-none gap-0 p-0">
          {workspaces.map((w) => (
            <li key={w.providerId} className="border-t border-[var(--color-border)]">
              <Link
                to="/admin/providers/$providerId"
                params={{ providerId: w.providerId }}
                className="group flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-[var(--color-muted)]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-9 w-9 shrink-0 rounded-[10px]">
                    {w.logoUrl && <AvatarImage src={w.logoUrl} alt="" />}
                    <AvatarFallback className="rounded-[10px] text-xs">{initialsFrom(w.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="type-body-medium truncate font-semibold group-hover:underline">{w.name}</p>
                    <p className="type-caption truncate text-[var(--color-muted-foreground)]">
                      {t("userDetailWorkspaceLine", {
                        role: tp(`peopleRoles.${w.memberRole}`, { defaultValue: w.memberRole }),
                        date: date(w.joinedAt),
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge tone={STATUS_TONE[w.providerStatus] ?? "info"}>
                    {t(`providerStatus.${w.providerStatus}`, { defaultValue: w.providerStatus })}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                </div>
              </Link>
            </li>
          ))}
          {workspaces.length === 0 && (
            <li className="type-body border-t border-[var(--color-border)] px-5 py-8 text-center text-[var(--color-muted-foreground)]">
              {t("userDetailNoWorkspaces")}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
