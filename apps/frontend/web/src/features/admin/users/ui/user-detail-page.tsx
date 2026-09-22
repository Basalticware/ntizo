import { useTranslation } from "react-i18next";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage, Badge, Skeleton } from "@ntizo/frontend-ui";
import { localeName } from "@/shared/components/language-switcher";
import { initialsFrom } from "@/shared/lib/initials";
import { usePageHeader } from "@/shared/lib/page-header";
import { displayName } from "../domain/types";
import { useAdminUserDetail } from "../viewmodel/use-admin-users";
import { RoleSection } from "./role-section";
import { WorkspacesSection } from "./workspaces-section";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info"> = {
  active: "success",
  pending: "warning",
  suspended: "danger",
};

/**
 * One person, and whether they administer the platform.
 *
 * The provider detail page's skeleton on purpose: back link, who this is, the
 * decision, then a list. An administrator who has learned one of the two
 * pages has learned both.
 *
 * What is left out is deliberate and matches the list: no bio, no date of
 * birth, no gender, no timezone. Nothing on this page needs them.
 */
export function AdminUserDetailPage() {
  const { t, i18n } = useTranslation("admin");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { userId } = useParams({ strict: false }) as { userId: string };

  const query = useAdminUserDetail(userId);
  const detail = query.data;
  const name = detail ? displayName(detail) : null;

  usePageHeader(name ?? t("userDetailTitle"), detail?.email);

  const notFound = (query.error as { code?: string } | null)?.code === "USER_NOT_FOUND";
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(
      new Date(iso),
    );
  const verification = (verified: boolean) => ({
    text: t(verified ? "userDetailVerified" : "userDetailUnverified"),
    verified,
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link
        to="/admin/users"
        className="type-body inline-flex items-center gap-1.5 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("usersTitle")}
      </Link>

      {query.error && (
        <p className="type-body text-[var(--color-destructive)]">
          {t(notFound ? "userDetailNotFound" : "userDetailError")}
        </p>
      )}

      {/* ── Who this is ──────────────────────────────────────────────────── */}
      <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] p-5">
        {query.isLoading || !detail || !name ? (
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
            <div className="grid gap-2">
              <Skeleton className="h-[24px] w-56" />
              <Skeleton className="h-[19px] w-40" />
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <Avatar className="h-14 w-14 shrink-0">
                  {detail.avatarUrl && <AvatarImage src={detail.avatarUrl} alt="" />}
                  <AvatarFallback>{initialsFrom(name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h2 className="type-h3 truncate font-semibold">{name}</h2>
                  <p className="type-body truncate text-[var(--color-muted-foreground)]">{detail.email}</p>
                </div>
              </div>
              <Badge tone={STATUS_TONE[detail.status] ?? "info"}>
                {t(`userStatus.${detail.status}`, { defaultValue: detail.status })}
              </Badge>
            </div>

            <dl className="mt-5 grid gap-x-8 gap-y-3 border-t border-[var(--color-border)] pt-5 sm:grid-cols-2">
              <Pair label={t("userDetailEmail")} value={detail.email} note={verification(detail.emailVerified)} />
              <Pair
                label={t("userDetailPhone")}
                value={detail.phoneNumber}
                note={detail.phoneNumber ? verification(detail.phoneVerified) : undefined}
              />
              <Pair label={t("userDetailRole")} value={t(`userRole.${detail.role}`, { defaultValue: detail.role })} />
              <Pair label={t("userDetailLanguage")} value={localeName(detail.language)} />
              <Pair label={t("userDetailJoined")} value={date(detail.createdAt)} />
              {/* Shown because support quotes it. */}
              <Pair label={t("userDetailId")} value={detail.id} mono />
            </dl>
          </>
        )}
      </section>

      <RoleSection detail={detail} name={name} loading={query.isLoading} />
      <WorkspacesSection workspaces={detail?.workspaces ?? []} loading={query.isLoading} />
    </div>
  );
}

function Pair({
  label,
  value,
  note,
  mono,
}: {
  label: string;
  value: string | null;
  /** A state that belongs beside the value — whether an email or phone is confirmed. */
  note?: { text: string; verified: boolean } | undefined;
  mono?: boolean;
}) {
  const shown = value?.trim();
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="type-caption text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className={mono ? "type-caption m-0 truncate font-mono" : "type-body m-0 flex min-w-0 items-center gap-2"}>
        <span className="truncate">{shown || "—"}</span>
        {note && shown && (
          <Badge tone={note.verified ? "success" : "warning"} className="shrink-0">
            {note.text}
          </Badge>
        )}
      </dd>
    </div>
  );
}
