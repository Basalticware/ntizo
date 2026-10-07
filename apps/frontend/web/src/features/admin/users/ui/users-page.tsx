import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@ntizo/frontend-ui";
import { USER_ROLES } from "@ntizo/shared";
import type { StatusTab } from "@/shared/components/status-tabs";
import { DETAILS_BUTTON_CLASS } from "@/shared/components/list-cells";
import { usePageHeader } from "@/shared/lib/page-header";
import {
  AdminFilterBar,
  AdminListFoot,
  AdminPerson,
  AdminTable,
  AdminTabs,
  adminDate,
  pageRange,
} from "@/features/admin/shared/ui/admin-list";
import { ADMIN_USERS_PAGE_SIZE } from "../data/admin-user.repository";
import { UsersFilterSheet } from "./users-filters";
import { useAdminUsersPage } from "../viewmodel/use-admin-users";
import { displayName, type AdminUser } from "../domain/types";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info"> = {
  active: "success",
  pending: "warning",
  suspended: "danger",
};

/** The role pill's colour: customers blue, providers amber, admins violet. */
const ROLE_TONE: Record<string, "info" | "warning" | "violet"> = {
  customer: "info",
  individual_provider: "warning",
  organization_owner: "warning",
  admin: "violet",
};

/** `""` is everyone; the rest are the platform's roles, one tab each. */
const TABS = ["", ...USER_ROLES] as const;
type UserTab = (typeof TABS)[number];

/**
 * Everyone on the platform.
 *
 * The rows are `CollectionCard`'s at the admin measurements, as on the
 * provider queue. The role is a tab here and a filter in the panel — one
 * value behind both. The tabs carry no counts: the list read does not count,
 * and a number on a tab nobody can check is worse than none. For the same
 * reason the pager steps rather than numbering pages.
 */
export function AdminUsersPage() {
  const { t, i18n } = useTranslation("admin");
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const [search, setSearch] = useState("");
  const [role, setRoleState] = useState<UserTab>("");
  const [offset, setOffset] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const needle = search.trim();
  const query = useAdminUsersPage({
    ...(needle ? { search: needle } : {}),
    ...(role ? { role } : {}),
    offset,
  });

  usePageHeader(t("usersTitle"), t("usersSubtitle"));

  const setRole = (next: string) => {
    setRoleState(next as UserTab);
    setOffset(0);
  };

  const rows = useMemo(() => query.data?.items ?? [], [query.data]);
  const { from, to } = pageRange(offset, rows.length);

  const tabs: StatusTab<UserTab>[] = TABS.map((key) => ({
    key,
    label: key ? t(`usersTab.${key}`) : t("usersTab.all"),
  }));

  return (
    <div className="flex w-full max-w-[1400px] flex-col">
      {query.error && (
        <p className="type-body mb-4 text-[var(--color-destructive)]">{t("usersError")}</p>
      )}

      <AdminTabs tabs={tabs} value={role} onChange={setRole} ariaLabel={t("usersRole")} />

      <AdminFilterBar
        className="mt-[27px]"
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setOffset(0);
        }}
        searchPlaceholder={t("usersSearchPlaceholder")}
        onOpenFilters={() => setFiltersOpen(true)}
        activeFilterCount={role ? 1 : 0}
      />

      <div className="mt-[27px]">
        <AdminTable
          title={t("usersTitle")}
          shown={rows.length}
          total={rows.length}
          loading={query.isLoading}
          tableFrom="lg"
          columns={[
            { key: "person", label: t("usersPerson"), className: "w-[329px] pl-[22px]" },
            { key: "role", label: t("usersRole"), skeletonWidth: "w-24", skeletonShape: "badge", className: "w-[210px] pl-0" },
            { key: "contact", label: t("usersContact"), skeletonWidth: "w-28", className: "w-[200px] pl-0" },
            { key: "joined", label: t("usersJoined"), skeletonWidth: "w-28", className: "w-[220px] pl-0" },
            {
              key: "status",
              label: t("usersStatus"),
              skeletonWidth: "w-20",
              skeletonShape: "badge",
              className: "w-[133px] pl-0",
            },
            { key: "actions", label: t("common:colActions"), className: "pl-0", hideOnCard: true },
          ]}
          emptyText={t("usersEmpty")}
          emptyTitle={t("usersEmptyTitle")}
          emptyBadge={Users}
          noMatchesText={t("usersNoMatches")}
          noMatchesTitle={t("usersNoMatchesTitle")}
          filtered={needle !== "" || role !== ""}
          rows={rows.map((user) => userRow(user, { t, locale }))}
        />
      </div>

      <AdminListFoot
        label={query.isLoading || rows.length === 0 ? null : t("listShowingRange", { from, to })}
        offset={offset}
        pageSize={ADMIN_USERS_PAGE_SIZE}
        total={null}
        hasNext={query.data?.hasMore ?? false}
        onOffsetChange={setOffset}
      />

      <UsersFilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        role={role}
        onRoleChange={setRole}
      />
    </div>
  );
}

function userRow(
  user: AdminUser,
  ctx: { t: ReturnType<typeof useTranslation<"admin">>["t"]; locale: string },
) {
  const { t, locale } = ctx;
  const name = displayName(user);
  const href = { to: "/admin/users/$userId", params: { userId: user.id } } as const;
  return {
    key: user.id,
    primary: (
      <AdminPerson
        name={name}
        // The column's width, so a long email truncates rather than running
        // under the role beside it.
        className="max-w-[296px]"
        title={
          <Link {...href} className="hover:underline">
            {name}
          </Link>
        }
        // The email under the name, unless it is already the name — somebody
        // with no display name would otherwise get the same string twice.
        sub={name === user.email ? null : <span className="truncate">{user.email}</span>}
      />
    ),
    cells: {
      role: (
        <Badge tone={ROLE_TONE[user.role] ?? "info"} className="min-w-[93px] justify-center">
          {t(`userRole.${user.role}`, { defaultValue: user.role })}
        </Badge>
      ),
      contact: user.phoneNumber ? (
        <span className="text-[15px] font-medium whitespace-nowrap text-[var(--color-headline)] tabular-nums">
          {user.phoneNumber}
        </span>
      ) : (
        "—"
      ),
      joined: (
        <span className="flex items-center gap-[11px] text-[15px] font-medium whitespace-nowrap text-[var(--color-headline)] tabular-nums">
          <Calendar aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--color-primary)]" />
          {adminDate(user.createdAt, locale)}
        </span>
      ),
      status: (
        <Badge tone={STATUS_TONE[user.status] ?? "info"} className="min-w-[96px] justify-center">
          {t(`userStatus.${user.status}`, { defaultValue: user.status })}
        </Badge>
      ),
    },
    actions: (
      <Link {...href} className={`${DETAILS_BUTTON_CLASS} h-[38px] w-[137px] rounded-md px-0`} tabIndex={-1}>
        {t("usersViewProfile")}
      </Link>
    ),
  };
}
