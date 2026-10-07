import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearch } from "@tanstack/react-router";
import { Calendar, MapPin, Store } from "lucide-react";
import { Badge } from "@ntizo/frontend-ui";
import { ProviderStatus } from "@ntizo/shared";
import type { StatusTab } from "@/shared/components/status-tabs";
import { DETAILS_BUTTON_CLASS } from "@/shared/components/list-cells";
import { usePageHeader } from "@/shared/lib/page-header";
import { formatCommission } from "@/shared/domain/commission-format";
import {
  AdminFilterBar,
  AdminListFoot,
  AdminPerson,
  AdminTable,
  AdminTabs,
  adminDate,
  pageRange,
} from "@/features/admin/shared/ui/admin-list";
import { ADMIN_PROVIDERS_PAGE_SIZE } from "../data/admin-provider.repository";
import { PROVIDER_STATUS_TONE } from "./provider-row";
import { useAdminProvidersPage, useProviderStatusCounts } from "../viewmodel/use-admin-providers";

/** The tabs over the queue, in the order an admin works it. `""` is every status. */
const TABS = [
  "",
  ProviderStatus.Pending,
  ProviderStatus.Active,
  ProviderStatus.Rejected,
  ProviderStatus.Suspended,
  ProviderStatus.Archived,
] as const;
type ProviderTab = (typeof TABS)[number];

const TAB_TONE: Record<ProviderTab, StatusTab<ProviderTab>["tone"]> = {
  "": "neutral",
  [ProviderStatus.Pending]: "warning",
  [ProviderStatus.Active]: "success",
  [ProviderStatus.Rejected]: "danger",
  [ProviderStatus.Suspended]: "danger",
  [ProviderStatus.Archived]: "neutral",
};

/**
 * Every business on the platform.
 *
 * The rows are `CollectionCard`'s, drawn at the admin measurements by
 * `AdminTable`; the tabs, the search and the pager around them are the admin
 * mockups'. The status is the tabs, and only the tabs: a Filtrar panel
 * holding the same status picker was a second control for one value, and a
 * button that opens nothing new reads as broken.
 *
 * Search and status go to the server rather than filtering an array here. This
 * is the one list with no ceiling on its size, and "which fifty of ten thousand
 * to draw" is not a decision the browser can make. The per-status counts come
 * from their own read, so the tabs carry real numbers and the pager can be
 * numbered — except while a search is typed, which the counts know nothing
 * about; the pager then only steps.
 */
export function AdminProvidersPage() {
  const { t, i18n } = useTranslation("admin");
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const [search, setSearch] = useState("");
  // `strict: false`: this is a `ui` file and may not import the route to name
  // it. Only the arrival value — the tabs keep their own state after.
  const arrived = useSearch({ strict: false }) as { status?: string };
  const [status, setStatusState] = useState<ProviderTab>(() => {
    const value = arrived.status ?? "";
    return (TABS as readonly string[]).includes(value) ? (value as ProviderTab) : "";
  });
  const [offset, setOffset] = useState(0);
  const needle = search.trim();
  const query = useAdminProvidersPage({
    ...(needle ? { search: needle } : {}),
    ...(status ? { status } : {}),
    offset,
  });
  const counts = useProviderStatusCounts();

  usePageHeader(t("providersTitle"), t("providersSubtitle"));

  // A new filter is a new list; page three of the old one is past its end.
  const setStatus = (next: string) => {
    setStatusState(next as ProviderTab);
    setOffset(0);
  };

  const rows = useMemo(() => query.data?.items ?? [], [query.data]);
  const c = counts.data;
  const countOf = (tab: ProviderTab): number | null =>
    c ? (tab === "" ? c.pending + c.active + c.rejected + c.suspended + c.archived : c[tab]) : null;
  // The whole the pager numbers against: known for a tab, not for a search.
  const total = needle ? null : countOf(status);
  const { from, to } = pageRange(offset, rows.length);

  const tabs: StatusTab<ProviderTab>[] = TABS.map((key) => ({
    key,
    label: key ? t(`providersTab.${key}`) : t("providersTab.all"),
    tone: TAB_TONE[key],
    count: countOf(key),
  }));

  return (
    <div className="flex w-full max-w-[1400px] flex-col">
      {query.error && (
        <p className="type-body mb-4 text-[var(--color-destructive)]">{t("providersError")}</p>
      )}

      <AdminTabs tabs={tabs} value={status} onChange={setStatus} ariaLabel={t("providersStatus")} />

      <AdminFilterBar
        className="mt-[27px]"
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setOffset(0);
        }}
        searchPlaceholder={t("providersSearchPlaceholder")}
      />

      <div className="mt-[27px]">
        <AdminTable
          title={t("providersTitle")}
          shown={rows.length}
          total={rows.length}
          loading={query.isLoading}
          tableFrom="lg"
          columns={[
            { key: "business", label: t("providersBusiness"), className: "w-[333px] pl-[21px]" },
            { key: "place", label: t("providersPlace"), skeletonWidth: "w-36", className: "w-[239px] pl-0" },
            { key: "applied", label: t("providersApplied"), skeletonWidth: "w-28", className: "w-[200px] pl-0" },
            { key: "commission", label: t("providersCommission"), skeletonWidth: "w-12", className: "w-[155px] pl-0" },
            {
              key: "status",
              label: t("providersStatus"),
              skeletonWidth: "w-20",
              skeletonShape: "badge",
              className: "w-[168px] pl-0",
            },
            { key: "actions", label: t("common:colActions"), className: "pl-0", hideOnCard: true },
          ]}
          emptyText={t("providersEmpty")}
          emptyTitle={t("providersEmptyTitle")}
          emptyBadge={Store}
          noMatchesText={t("providersNoMatches")}
          noMatchesTitle={t("providersNoMatchesTitle")}
          filtered={needle !== "" || status !== ""}
          rows={rows.map((provider) => {
            const href = { to: "/admin/providers/$providerId", params: { providerId: provider.id } } as const;
            const place = [provider.city, provider.country].filter(Boolean).join(", ");
            return {
              key: provider.id,
              // The name is the way in, as on every list; "Ver detalhes" is the
              // same link drawn where the mockups put the row's action.
              primary: (
                <AdminPerson
                  name={provider.name}
                  // The column's width, so a long email truncates rather than
                  // running under the place beside it.
                  className="max-w-[300px]"
                  title={
                    <Link {...href} className="hover:underline">
                      {provider.name}
                    </Link>
                  }
                  sub={<span className="truncate">{provider.ownerEmail ?? provider.slug}</span>}
                />
              ),
              cells: {
                place: place ? (
                  <span className="flex items-center gap-2.5 text-sm whitespace-nowrap text-[var(--color-muted-foreground)]">
                    <MapPin aria-hidden="true" className="h-[17px] w-[17px] shrink-0" />
                    {place}
                  </span>
                ) : (
                  "—"
                ),
                applied: (
                  <span className="flex items-center gap-2.5 text-sm whitespace-nowrap text-[var(--color-muted-foreground)] tabular-nums">
                    <Calendar aria-hidden="true" className="h-[17px] w-[17px] shrink-0 text-[var(--color-primary)]" />
                    {adminDate(provider.createdAt, locale)}
                  </span>
                ),
                commission: (
                  <span className="text-[15.5px] font-semibold text-[var(--color-headline)] tabular-nums">
                    {formatCommission(provider.commissionBps, locale)}
                  </span>
                ),
                status: (
                  <Badge
                    tone={PROVIDER_STATUS_TONE[provider.status] ?? "info"}
                    className="min-w-[113px] justify-center text-[14.5px]"
                  >
                    {t(`providerStatus.${provider.status}`)}
                  </Badge>
                ),
              },
              actions: (
                <Link {...href} className={`${DETAILS_BUTTON_CLASS} h-[37px] w-[135px] rounded-md px-0 text-[15.5px]`} tabIndex={-1}>
                  {t("common:viewDetails")}
                </Link>
              ),
            };
          })}
        />
      </div>

      <AdminListFoot
        label={
          query.isLoading || rows.length === 0
            ? null
            : total !== null
              ? t("providersShowing", { from, to, total })
              : t("listShowingRange", { from, to })
        }
        offset={offset}
        pageSize={ADMIN_PROVIDERS_PAGE_SIZE}
        total={total}
        hasNext={query.data?.hasMore ?? false}
        onOffsetChange={setOffset}
      />
    </div>
  );
}
