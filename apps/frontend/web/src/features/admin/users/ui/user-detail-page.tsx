import { useTranslation } from "react-i18next";
import { Link, useParams } from "@tanstack/react-router";
import {
  Briefcase,
  Calendar,
  ChevronRight,
  Fingerprint,
  Globe,
  Mail,
  Phone,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage, Badge, Skeleton, cn } from "@ntizo/frontend-ui";
import { localeName } from "@/shared/components/language-switcher";
import { initialsFrom } from "@/shared/lib/initials";
import { usePageHeader } from "@/shared/lib/page-header";
import { displayName } from "../domain/types";
import { useAdminUserDetail } from "../viewmodel/use-admin-users";
import { RoleSection } from "./role-section";
import { USER_CARD, UserCardHead } from "./user-card";
import { WorkspacesSection } from "./workspaces-section";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info"> = {
  active: "success",
  pending: "warning",
  suspended: "danger",
};

/**
 * One person, and whether they administer the platform.
 *
 * Laid out as the admin provider detail page is: the crumb, a hero with the
 * face, the name and its status, and the facts the read carries beside it;
 * then the person's data and their workspaces on the left and the one
 * decision on the right. An administrator who has learned one of the two
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

  usePageHeader(name ?? t("userDetailTitle"), detail?.email, { ownHeading: true });

  const notFound = (query.error as { code?: string } | null)?.code === "USER_NOT_FOUND";
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(
      new Date(iso),
    );
  const verification = (verified: boolean) => ({
    text: t(verified ? "userDetailVerified" : "userDetailUnverified"),
    verified,
  });

  // A failed read with nothing to show: no identity card, no role section, no
  // workspace list. Those three all draw *something* even from `undefined`
  // (a skeleton, a permanently-loading skeleton, an empty-workspaces
  // sentence) — none of them true here, and "doesn't belong to any
  // workspace" is actively wrong for a user who no longer exists.
  const failed = Boolean(query.error) && !detail;
  const ready = !query.isLoading && detail && name;

  return (
    <div className="flex w-full max-w-[1400px] flex-col">
      <nav
        aria-label={t("usersTitle")}
        className="flex min-w-0 items-center gap-2 text-[15px] text-[var(--color-muted-foreground)]"
      >
        <Link to="/admin/users" className="shrink-0 text-[var(--color-primary)] hover:underline">
          {t("usersTitle")}
        </Link>
        <ChevronRight aria-hidden="true" className="mx-1.5 h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{name ?? t("userDetailTitle")}</span>
      </nav>

      {query.error && (
        <p className="type-body mt-4 text-[var(--color-destructive)]">
          {t(notFound ? "userDetailNotFound" : "userDetailError")}
        </p>
      )}

      {!failed && (
        <>
          {/* ── Who this is ──────────────────────────────────────────────── */}
          {ready ? (
            <section className="mt-[22px] grid items-start gap-[26px] md:grid-cols-[120px_minmax(0,1fr)] 2xl:grid-cols-[120px_minmax(0,1fr)_auto]">
              <Avatar className="h-24 w-24 md:h-[120px] md:w-[120px]">
                {detail.avatarUrl && <AvatarImage src={detail.avatarUrl} alt="" />}
                <AvatarFallback className="bg-[var(--color-blue-soft)] text-3xl font-semibold text-[var(--color-primary)]">
                  {initialsFrom(name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                {/* The status beside the heading rather than inside it: the
                    heading is the person's name, and nothing else. */}
                <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2">
                  <h1 className="m-0 min-w-0 font-display text-[28px] leading-tight font-extrabold tracking-[-0.01em] break-words text-[var(--color-headline)] md:text-[35.5px]">
                    {name}
                  </h1>
                  <Badge
                    tone={STATUS_TONE[detail.status] ?? "info"}
                    className="h-[30px] px-[17px] text-[14.5px] tracking-normal"
                  >
                    {t(`userStatus.${detail.status}`, { defaultValue: detail.status })}
                  </Badge>
                </div>
                <div className="mt-2.5 flex min-w-0 items-center text-base text-[var(--color-muted-foreground)]">
                  <Mail aria-hidden="true" className="mr-[11px] h-[19px] w-[19px] shrink-0" />
                  <span className="truncate">{detail.email}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-y-3 md:col-span-2 2xl:col-span-1 2xl:mt-6">
                <Kpi
                  icon={Briefcase}
                  iconClass="text-[var(--color-primary)]"
                  value={String(detail.workspaces.length)}
                  label={t("userDetailWorkspaces")}
                />
                <Kpi
                  icon={Calendar}
                  iconClass="text-[var(--color-success)]"
                  value={date(detail.createdAt)}
                  label={t("userDetailJoined")}
                />
              </div>
            </section>
          ) : (
            <div className="mt-[22px] flex items-start gap-[26px]">
              <Skeleton className="h-24 w-24 shrink-0 rounded-full md:h-[120px] md:w-[120px]" />
              <div className="grid gap-3 pt-2">
                <Skeleton className="h-9 w-72 max-w-full" />
                <Skeleton className="h-5 w-48" />
              </div>
            </div>
          )}

          <div className="mt-[30px] grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="grid min-w-0 gap-6">
              <section className={USER_CARD}>
                <UserCardHead title={t("userDetailData")} />
                {ready ? (
                  <dl className="mt-5 mb-0 grid gap-x-8 gap-y-5 md:grid-cols-2">
                    <Pair
                      icon={Mail}
                      label={t("userDetailEmail")}
                      value={detail.email}
                      note={verification(detail.emailVerified)}
                    />
                    <Pair
                      icon={Phone}
                      label={t("userDetailPhone")}
                      value={detail.phoneNumber}
                      note={detail.phoneNumber ? verification(detail.phoneVerified) : undefined}
                    />
                    <Pair
                      icon={ShieldCheck}
                      label={t("userDetailRole")}
                      value={t(`userRole.${detail.role}`, { defaultValue: detail.role })}
                    />
                    <Pair icon={Globe} label={t("userDetailLanguage")} value={localeName(detail.language)} />
                    {/* Shown because support quotes it. */}
                    <Pair icon={Fingerprint} label={t("userDetailId")} value={detail.id} mono />
                  </dl>
                ) : (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {[0, 1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))}
                  </div>
                )}
              </section>

              <WorkspacesSection workspaces={detail?.workspaces ?? []} loading={query.isLoading} />
            </div>

            <div className="grid min-w-0 gap-6">
              <RoleSection detail={detail} name={name} loading={query.isLoading} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, iconClass, value, label }: { icon: LucideIcon; iconClass: string; value: string; label: string }) {
  return (
    <div className="grid grid-cols-[auto_auto] items-center gap-x-[13px] gap-y-[7px] border-l border-[var(--color-border)] py-1 pr-[22px] pl-5 first:border-l-0 first:pl-0 2xl:first:border-l 2xl:first:pl-5">
      <Icon aria-hidden="true" className={cn("h-[22px] w-[22px]", iconClass)} />
      <b className="text-[18.5px] font-bold whitespace-nowrap text-[var(--color-headline)]">{value}</b>
      <span className="col-start-2 text-[13px] whitespace-nowrap text-[var(--color-muted-foreground)]">{label}</span>
    </div>
  );
}

function Pair({
  icon: Icon,
  label,
  value,
  note,
  mono,
}: {
  icon: LucideIcon;
  label: string;
  value: string | null;
  /** A state that belongs beside the value — whether an email or phone is confirmed. */
  note?: { text: string; verified: boolean } | undefined;
  mono?: boolean;
}) {
  const shown = value?.trim();
  return (
    <div className="grid min-w-0 grid-cols-[21px_minmax(0,1fr)] gap-x-4">
      <Icon aria-hidden="true" className="row-span-2 mt-0.5 h-[21px] w-[21px] text-[var(--color-ink-2)]" />
      <dt className="text-sm text-[var(--color-muted-foreground)]">{label}</dt>
      <dd
        className={cn(
          "m-0 mt-1 flex min-w-0 items-center gap-2.5 text-[15px] text-[var(--color-ink-2)]",
          mono && "font-mono text-[13px]",
        )}
      >
        <span className="truncate">{shown || "—"}</span>
        {note && shown && (
          <Badge tone={note.verified ? "success" : "warning"} className="h-[26px] shrink-0 px-3 text-[13px]">
            {note.text}
          </Badge>
        )}
      </dd>
    </div>
  );
}
