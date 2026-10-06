import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "@tanstack/react-form";
import { CirclePlus, Crown, Send, UserRound, X } from "lucide-react";
import { Button, Input, Sheet, SheetContent, cn } from "@ntizo/frontend-ui";
import { SegmentedTabs } from "@/shared/components/segmented-tabs";
import type { StatusTab } from "@/shared/components/status-tabs";
import { useSession } from "@/shared/hooks/use-session";
import { usePageHeader } from "@/shared/lib/page-header";
import { providerErrorMessage } from "../viewmodel/error-message";
import { useActiveProvider } from "../viewmodel/use-active-provider";
import { useProviderDetail } from "../viewmodel/use-providers";
import {
  useInviteMember,
  useRemoveMember,
  useRevokeInvite,
  useUpdateMemberRole,
} from "../viewmodel/use-member-mutations";
import {
  EMPTY_FILTERS,
  filterPeople,
  toPeopleRows,
  type PeopleFilters,
  type PersonRow,
  type PersonStatus,
} from "../domain/people";
import { PeopleFilterSheet, filterCount } from "./people-filters";
import { PeopleTable } from "./people-table";
import type { ProviderRole, UnpublishedService } from "../domain/types";

/** The tab row's keys: every row, then one per status. */
type PeopleTab = "all" | PersonStatus;

/**
 * The two roles an invitation can carry. Owner is not one of them. Each
 * says what the role may do in the words the server enforces — owners and
 * admins manage the team, staff can look — and nothing finer: the mockup's
 * permission checkboxes are permissions this workspace does not have.
 */
const INVITE_ROLES: { value: Exclude<ProviderRole, "owner">; icon: typeof Crown }[] = [
  { value: "admin", icon: Crown },
  { value: "staff", icon: UserRound },
];

/**
 * Who is on this workspace.
 *
 * One table, not two. Members and pending invitations were separate lists, and
 * the split described how the data is stored rather than the question being
 * asked — an invitation sent yesterday is part of the answer to "who is on my
 * team", just with "waiting" attached. It also let one person appear twice the
 * moment an invitation was accepted, and made the counts at the top ambiguous
 * because there were two of them.
 *
 * The tabs count the rows the page already holds — the whole roster arrives
 * in one answer, so "Ativos 4" is a count and not a guess. "Expirados" is
 * offered only while there is an expired invitation to show.
 */
export function MembersPage() {
  const { t } = useTranslation("provider");
  const { activeProvider } = useActiveProvider();
  const { data: session } = useSession();
  const {
    data: detail,
    isLoading,
    error,
  } = useProviderDetail(activeProvider?.id);
  const removeMut = useRemoveMember(activeProvider?.id ?? "");
  const roleMut = useUpdateMemberRole(activeProvider?.id ?? "");
  const revokeMut = useRevokeInvite(activeProvider?.id ?? "");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<PeopleFilters>(EMPTY_FILTERS);
  const [actionError, setActionError] = useState<string | null>(null);
  // Services a removal just unpublished because nobody was left to perform
  // them — named back by `providerMembersRemove` and held here until the
  // owner dismisses it, deliberately not a toast: a toast vanishes on its
  // own, and this is exactly the kind of change a provider must not miss.
  const [unpublishedNotice, setUnpublishedNotice] = useState<
    UnpublishedService[] | null
  >(null);

  // The page draws its own heading: the mockup puts the "Equipa" eyebrow over
  // the title, which the shell's heading has no slot for.
  usePageHeader(t("membersPage.title"), t("membersPage.subtitle"), { ownHeading: true });

  const rows = useMemo(
    () => toPeopleRows(detail?.members ?? [], detail?.invites ?? []),
    [detail?.members, detail?.invites],
  );
  const visible = useMemo(() => filterPeople(rows, filters), [rows, filters]);

  if (!activeProvider) return null;
  if (error) {
    return (
      <p className="type-body text-[var(--color-destructive)]">
        {providerErrorMessage(t, error)}
      </p>
    );
  }

  /** Every mutation reports the same way, so the page has one error line. */
  async function run(work: Promise<unknown>) {
    setActionError(null);
    try {
      await work;
    } catch (e) {
      setActionError(providerErrorMessage(t, e));
    }
  }

  /**
   * Removal is the one action whose response carries more than pass/fail:
   * when the person removed was a service's last performer, the catalogue
   * unpublished it and named it back. Surfaced here rather than folded into
   * `run` because nothing else this page calls returns anything worth
   * showing on success.
   */
  async function handleRemove(row: PersonRow) {
    setActionError(null);
    setUnpublishedNotice(null);
    try {
      const result = await removeMut.mutateAsync(row.key);
      if (result.unpublishedServices.length > 0) {
        setUnpublishedNotice(result.unpublishedServices);
      }
    } catch (e) {
      setActionError(providerErrorMessage(t, e));
    }
  }

  // Owners and admins manage the team; staff can look. Checked again on the
  // server — this only decides whether to offer the control.
  const canManage =
    activeProvider.role === "owner" || activeProvider.role === "admin";

  // Matched by address: the session's user and the roster's member are the
  // same person under one email, whichever id each side keys them by.
  const myEmail = session?.user?.email?.toLowerCase() ?? null;
  const currentUserId =
    rows.find((r) => r.kind === "member" && r.email.toLowerCase() === myEmail)?.key ?? null;

  const countOf = (status: PersonStatus) => rows.filter((r) => r.status === status).length;
  const tab: PeopleTab = filters.status ?? "all";
  const tabs: StatusTab<PeopleTab>[] = [
    { key: "all", label: t("membersPage.tab.all"), count: isLoading ? null : rows.length },
    { key: "active", label: t("membersPage.tab.active"), count: isLoading ? null : countOf("active") },
    { key: "invited", label: t("membersPage.tab.invited"), count: isLoading ? null : countOf("invited") },
    ...(countOf("expired") > 0 || tab === "expired"
      ? [{ key: "expired" as const, label: t("membersPage.tab.expired"), count: countOf("expired") }]
      : []),
  ];

  return (
    <div className="flex w-full max-w-[1400px] flex-col">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] leading-4 font-semibold tracking-[0.1em] text-[var(--color-muted-foreground)] uppercase">
            {t("membersPage.eyebrow")}
          </p>
          <h1 className="font-display mt-3 text-[30px] leading-[1.1] font-extrabold tracking-[-0.02em] text-[var(--color-headline)] md:text-[44px] md:leading-[50px]">
            {t("membersPage.title")}
          </h1>
          <p className="mt-1.5 text-base text-[var(--color-muted-foreground)] md:text-[16.5px]">
            {t("membersPage.subtitle")}
          </p>
        </div>
        <Button
          onClick={() => setInviteOpen(true)}
          className="h-12 gap-3 rounded-[9px] px-6 text-[15.5px] font-semibold md:mt-[29px]"
        >
          <CirclePlus className="h-6 w-6" />
          {t("membersPage.invite")}
        </Button>
      </div>

      <div className="mt-8 grid gap-4 md:mt-[43px]">
        {actionError && (
          <p className="type-body text-[var(--color-destructive)]">
            {actionError}
          </p>
        )}

        {unpublishedNotice && unpublishedNotice.length > 0 && (
          <div className="flex flex-col gap-3 rounded-[var(--radius-card-sm)] border border-[var(--color-warning)] bg-[var(--color-card)] p-4">
            <div className="flex items-start justify-between gap-4">
              <p className="type-body font-medium">
                {t("membersUnpublishedTitle")}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setUnpublishedNotice(null)}
              >
                {t("close")}
              </Button>
            </div>
            <ul className="list-disc pl-5">
              {unpublishedNotice.map((service) => (
                <li key={service.serviceId} className="type-body">
                  {service.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        <PeopleTable
          rows={visible}
          total={rows.length}
          loading={isLoading}
          tabs={
            <SegmentedTabs
              tabs={tabs}
              value={tab}
              onChange={(next) =>
                setFilters({ ...filters, status: next === "all" ? null : next })
              }
              ariaLabel={t("peopleStatusLabel")}
            />
          }
          filters={filters}
          onFiltersChange={setFilters}
          onOpenFilters={() => setFiltersOpen(true)}
          activeFilterCount={filterCount(filters)}
          canManage={canManage}
          currentUserId={currentUserId}
          onChangeRole={(row: PersonRow, role: ProviderRole) =>
            void run(roleMut.mutateAsync({ userId: row.key, role }))
          }
          onRemove={(row: PersonRow) => void handleRemove(row)}
          onRevoke={(row: PersonRow) => void run(revokeMut.mutateAsync(row.key))}
        />
      </div>

      <PeopleFilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        onChange={setFilters}
      />

      <InviteDrawer
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        providerId={activeProvider.id}
        providerName={activeProvider.name}
      />
    </div>
  );
}

/**
 * The invitation, in the drawer the mockup slides in from the right.
 *
 * Two fields, because the invitation carries two: the address it goes to and
 * the role it grants. The mockup's name field, WhatsApp channel and
 * permission checkboxes are left out — the server takes none of them, and a
 * field that is silently dropped on send is a promise the page cannot keep.
 */
function InviteDrawer({
  open,
  onOpenChange,
  providerId,
  providerName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  providerName: string;
}) {
  const { t } = useTranslation("provider");
  const headingId = useId();
  const emailId = useId();
  const inviteMut = useInviteMember(providerId);

  const form = useForm({
    defaultValues: { email: "", role: "staff" as ProviderRole },
    validators: {
      onSubmitAsync: async ({ value }) => {
        try {
          await inviteMut.mutateAsync({ email: value.email, role: value.role });
          form.reset();
          onOpenChange(false);
          return null;
        } catch (e) {
          return { form: providerErrorMessage(t, e) };
        }
      },
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        labelledBy={headingId}
        className="flex w-full max-w-[423px] flex-col rounded-l-[14px] border-l border-[var(--color-border)]"
      >
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-6 pb-6 pl-[26px]">
            <div className="flex items-center justify-between gap-4">
              <h2
                id={headingId}
                className="text-[23.5px] leading-[30px] font-extrabold text-[var(--color-headline)]"
              >
                {t("membersPage.invite")}
              </h2>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label={t("close")}
                className="grid h-8 w-8 place-items-center rounded-full text-[var(--color-ink-2)] hover:bg-[var(--color-muted)]"
              >
                <X className="h-[22px] w-[22px]" />
              </button>
            </div>
            <p className="mt-3.5 text-[14.5px] leading-normal text-[var(--color-muted-foreground)]">
              {t("membersPage.inviteLead", { name: providerName })}
            </p>

            <form.Field name="email">
              {(field) => (
                <div className="mt-6">
                  <label
                    htmlFor={emailId}
                    className="block text-[14.5px] leading-5 font-bold text-[var(--color-headline)]"
                  >
                    {t("membersPage.inviteEmail")}
                  </label>
                  <Input
                    id={emailId}
                    name={field.name}
                    type="email"
                    required
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t("membersPage.inviteEmailPlaceholder")}
                    className="mt-2 h-[46px] rounded-[9px] px-4 text-[14.5px] placeholder:text-[var(--color-faint)]"
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="role">
              {(field) => (
                <fieldset className="mt-6">
                  <legend className="text-[14.5px] leading-5 font-bold text-[var(--color-headline)]">
                    {t("membersPage.inviteRole")}
                  </legend>
                  <div className="mt-2.5 grid grid-cols-2 gap-3">
                    {INVITE_ROLES.map(({ value, icon: Icon }) => {
                      const on = field.state.value === value;
                      return (
                        <label
                          key={value}
                          className={cn(
                            "relative cursor-pointer rounded-[10px] border px-3 py-4 pl-[15px] transition-colors",
                            on
                              ? "border-[1.5px] border-[var(--color-blue-edge)] bg-[var(--color-blue-soft)]"
                              : "border-[var(--color-border)] hover:border-[var(--color-blue-line)]",
                          )}
                        >
                          <input
                            type="radio"
                            name="invite-role"
                            value={value}
                            checked={on}
                            onChange={() => field.handleChange(value)}
                            className="peer sr-only"
                          />
                          <span
                            aria-hidden="true"
                            className={cn(
                              "absolute top-3 right-2.5 h-[18px] w-[18px] rounded-full",
                              on
                                ? "border-[5px] border-[var(--color-primary)] bg-[var(--color-card)]"
                                : "border-[1.5px] border-[var(--color-faint)] bg-[var(--color-card)]",
                            )}
                          />
                          <span className="flex items-center gap-2 pr-5 text-sm font-bold text-[var(--color-headline)]">
                            <Icon className="h-[22px] w-[22px] text-[var(--color-primary)]" />
                            {t(`peopleRoles.${value}`)}
                          </span>
                          <span className="mt-2 block text-[13px] leading-[1.45] text-[var(--color-muted-foreground)]">
                            {t(`membersPage.roleHint.${value}`)}
                          </span>
                          {/* The radio is visually hidden; the card shows its focus. */}
                          <span className="pointer-events-none absolute inset-0 rounded-[10px] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-primary)]" />
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            </form.Field>

            <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
              {(err) =>
                err ? (
                  <p role="alert" className="mt-5 text-sm text-[var(--color-destructive)]">
                    {err.form}
                  </p>
                ) : null
              }
            </form.Subscribe>
          </div>

          <div className="flex gap-4 border-t border-[var(--color-line-2)] px-6 py-5 pl-[26px]">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-12 flex-1 rounded-[9px] border-[var(--color-blue-outline)] text-[15.5px] font-semibold text-[var(--color-primary)]"
            >
              {t("membersPage.cancel")}
            </Button>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 flex-1 gap-3.5 rounded-[9px] text-[15.5px] font-semibold"
                >
                  <Send className="h-[22px] w-[22px]" />
                  {isSubmitting ? t("sending") : t("sendInvite")}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
