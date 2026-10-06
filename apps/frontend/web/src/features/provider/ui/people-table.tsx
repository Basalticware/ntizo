import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Ellipsis, UserRound } from "lucide-react";
import { CollectionCard } from "@/shared/components/collection-card";
import { initialsFrom } from "@/shared/lib/initials";
import {
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
} from "@ntizo/frontend-ui";
import type { PeopleFilters, PersonRow, PersonStatus } from "../domain/people";
import type { ProviderRole } from "../domain/types";

/**
 * The role pill's ground and ink. The mockup's four job titles are not roles
 * this workspace has — it has three — so the three take the mockup's tones in
 * order of reach: the owner the violet "Administrador" wears, staff the
 * lightest blue.
 */
const ROLE_PILL: Record<ProviderRole, string> = {
  owner: "bg-[var(--color-violet-bg)] text-[var(--color-violet-fg)]",
  admin: "bg-[var(--color-info-bg)] text-[var(--color-info-fg)]",
  staff: "bg-[var(--color-blue-soft)] text-[var(--color-primary)]",
};

/** The state pill: a dot in front, in the colour of the words. */
const STATE_PILL: Record<PersonStatus, string> = {
  active: "bg-[var(--color-ok-bg)] text-[var(--color-ok-fg)] before:bg-current",
  invited: "bg-[var(--color-warn-bg)] text-[var(--color-warn-fg)] before:bg-current",
  expired: "bg-[var(--color-bad-bg)] text-[var(--color-bad-fg)] before:bg-current",
};

const PILL = "inline-flex h-[30px] items-center rounded-full px-3 text-[13px] font-medium whitespace-nowrap";

/**
 * Everyone on the workspace, in one table.
 *
 * Members and invitations share the table because they answer the same
 * question — who is on this team — and differ only in a badge. Two tables made
 * the same person appear twice when an invitation was accepted, and made the
 * count at the top meaningless because there were two of them.
 *
 * The row's actions differ by kind, and that is the only place the distinction
 * survives: a member's role can change and a member can be removed; an
 * invitation can only be revoked, because there is nobody to demote.
 *
 * The mockup's "Serviços" and "Acesso" columns and the phone under the email
 * are not drawn: a member carries a name, an email, a role and a date, and
 * nothing else the server sends would fill them.
 */
export function PeopleTable({
  rows,
  total,
  loading,
  tabs,
  filters,
  onFiltersChange,
  onOpenFilters,
  activeFilterCount,
  canManage,
  currentUserId,
  onChangeRole,
  onRemove,
  onRevoke,
}: {
  rows: readonly PersonRow[];
  /** Before filtering, for the "n of m" line. */
  total: number;
  loading: boolean;
  /** The tab row drawn where the card's heading would be. */
  tabs?: ReactNode;
  filters: PeopleFilters;
  onFiltersChange: (next: PeopleFilters) => void;
  onOpenFilters: () => void;
  activeFilterCount: number;
  canManage: boolean;
  /** Whose row says "Você". */
  currentUserId?: string | null;
  onChangeRole: (row: PersonRow, role: ProviderRole) => void;
  onRemove: (row: PersonRow) => void;
  onRevoke: (row: PersonRow) => void;
}) {
  const { t, i18n } = useTranslation("provider");

  const dateFormat = new Intl.DateTimeFormat(
    i18n.resolvedLanguage ?? i18n.language,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  );

  return (
    <CollectionCard
      title={t("peopleTitle")}
      tabs={tabs}
      shown={rows.length}
      total={total}
      loading={loading}
      search={filters.query}
      onSearchChange={(query) => onFiltersChange({ ...filters, query })}
      searchPlaceholder={t("peopleSearchPlaceholder")}
      onOpenFilters={onOpenFilters}
      activeFilterCount={activeFilterCount}
      columns={[
        { key: "person", label: t("membersPage.col.name"), className: "w-[260px] pl-4" },
        {
          key: "role",
          label: t("peopleRole"),
          skeletonWidth: "w-24",
          skeletonShape: "badge",
          className: "w-[170px]",
        },
        { key: "contact", label: t("membersPage.col.contact"), skeletonWidth: "w-40" },
        {
          key: "status",
          label: t("peopleStatusLabel"),
          skeletonWidth: "w-24",
          skeletonShape: "badge",
          className: "w-[200px]",
        },
        { key: "date", label: t("peopleDate"), skeletonWidth: "w-24", className: "w-[150px]" },
        {
          key: "actions",
          label: "",
          className: "w-[60px] pr-5",
          hideOnCard: true,
        },
      ]}
      emptyText={t("peopleEmpty")}
      emptyTitle={t("peopleEmptyTitle")}
      emptyBadge={UserRound}
      noMatchesText={t("peopleNoMatches")}
      noMatchesTitle={t("peopleNoMatchesTitle")}
      filtered={total > 0 && rows.length !== total}
      rows={rows.map((row) => ({
        key: row.key,
        primary: <Person row={row} isYou={row.kind === "member" && row.key === currentUserId} />,
        cells: {
          role: <span className={cn(PILL, ROLE_PILL[row.role])}>{t(`peopleRoles.${row.role}`)}</span>,
          contact: (
            // Whole here, where the name column may have cut an invitation's
            // address short to fit.
            <span className="block max-w-full min-w-0 truncate text-[15px] text-[var(--color-headline)]">
              {row.email}
            </span>
          ),
          status: (
            <span
              className={cn(
                PILL,
                "gap-[7px] before:h-2 before:w-2 before:rounded-full before:content-['']",
                STATE_PILL[row.status],
              )}
            >
              {t(`membersPage.state.${row.status}`)}
            </span>
          ),
          date: (
            <span className="text-sm whitespace-nowrap text-[var(--color-muted-foreground)] tabular-nums">
              {row.date ? dateFormat.format(new Date(row.date)) : "—"}
            </span>
          ),
        },
        actions: (
          <RowActions
            row={row}
            canManage={canManage}
            onChangeRole={onChangeRole}
            onRemove={onRemove}
            onRevoke={onRevoke}
          />
        ),
      }))}
    />
  );
}

/**
 * Who the row is about. An invitation has no name, so its address stands in —
 * the state pill already says it is waiting. The member reading the page is
 * told which row is theirs.
 */
function Person({ row, isYou }: { row: PersonRow; isYou: boolean }) {
  const { t } = useTranslation("provider");
  return (
    <div className="flex min-w-0 items-center gap-[15px]">
      <Avatar className="h-[50px] w-[50px] shrink-0">
        <AvatarFallback className="bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] text-sm font-semibold text-[var(--color-primary)]">
          {initialsFrom(row.name ?? row.email)}
        </AvatarFallback>
      </Avatar>
      <div className="grid min-w-0 justify-items-start">
        <p
          title={row.name ? undefined : row.email}
          className="w-full truncate text-[15px] leading-5 font-bold text-[var(--color-headline)]"
        >
          {row.name ?? row.email}
        </p>
        {isYou && (
          <span className="mt-1.5 inline-flex h-[22px] items-center rounded-md bg-[var(--color-blue-soft)] px-[9px] text-[13px] font-semibold text-[var(--color-primary)]">
            {t("membersPage.you")}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * What can be done to this row.
 *
 * An owner has no menu at all: the role cannot be changed and the seat cannot
 * be removed, because a workspace with no owner is a workspace nobody can
 * administer. Offering the control and refusing it afterwards is worse than
 * not offering it.
 */
function RowActions({
  row,
  canManage,
  onChangeRole,
  onRemove,
  onRevoke,
}: {
  row: PersonRow;
  canManage: boolean;
  onChangeRole: (row: PersonRow, role: ProviderRole) => void;
  onRemove: (row: PersonRow) => void;
  onRevoke: (row: PersonRow) => void;
}) {
  const { t } = useTranslation("provider");

  if (!canManage || row.role === "owner") return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button
          type="button"
          aria-label={t("peopleActions")}
          className="grid h-9 w-9 place-items-center rounded-full text-[var(--color-ink-2)] hover:bg-[var(--color-muted)]"
        >
          <Ellipsis className="h-6 w-6" strokeWidth={2.6} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {row.kind === "member" ? (
          <>
            <DropdownMenuItem
              onSelect={() =>
                onChangeRole(row, row.role === "admin" ? "staff" : "admin")
              }
            >
              {row.role === "admin"
                ? t("peopleMakeStaff")
                : t("peopleMakeAdmin")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onRemove(row)}>
              {t("peopleRemove")}
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onSelect={() => onRevoke(row)}>
            {t("peopleRevoke")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
