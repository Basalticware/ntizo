import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Calendar, LifeBuoy } from "lucide-react";
import { Badge, Button } from "@ntizo/frontend-ui";
import { usePageHeader } from "@/shared/lib/page-header";
import { AdminFilterBar, AdminTable } from "@/features/admin/shared/ui/admin-list";
import { useAdminSupport, useSupportOpenCount } from "@/features/admin/support/viewmodel/use-admin-support";
import type { AdminSupportSearch } from "@/features/admin/support/data/admin-support.repository";
import {
  DEFAULT_SUPPORT_FILTERS,
  SupportFilterSheet,
  supportFilterCount,
  type SupportFilters,
} from "./support-filters";

/**
 * The support queue: what people asked the platform, and what is still open.
 *
 * Open by default — the queue is worked, not browsed — the same posture
 * `/admin/contact` takes. The two queues are deliberately separate: contact
 * requests arrive from anonymous forms and are answered by email; these are
 * threads with signed-in people and are answered here.
 *
 * The same admin list layout and filter panel as every other admin list —
 * search and Filtrar above, `AdminTable` under them, the count below. No
 * tabs and no numbered pager: the October mockups draw no support screen,
 * and this read is cursor-paged without a total, so "Mais" stays. The
 * search is over the subject, on the server, which is what a request is
 * found by in a list of open ones.
 */
export function AdminSupportPage() {
  const { t, i18n } = useTranslation("admin");
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const [filters, setFilters] = useState<SupportFilters>(DEFAULT_SUPPORT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { status, audience } = filters;

  const input: AdminSupportSearch = {
    ...(status ? { status } : {}),
    ...(audience ? { audience } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  };
  const { requests, loading, hasMore, loadMore, errorCode } = useAdminSupport(input);
  const openCount = useSupportOpenCount();

  usePageHeader(t("supportTitle"), t("supportSubtitle"));

  /**
   * The whole the card's "N of M shown" counts against.
   *
   * `supportRequests` is cursor-paged and never returns a count, so the list
   * cannot say how long it is. While the queue is on open requests, though,
   * the platform's open count *is* that whole — before the audience or the
   * search narrows it — and it is the number this screen exists to bring
   * down. Off "open" there is no such number, and the card says "N shown"
   * rather than claim one.
   */
  const whole = status === "open" ? openCount.data : undefined;

  const when = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex w-full max-w-[1400px] flex-col">
      {errorCode && <p className="type-body mb-4 text-[var(--color-destructive)]">{t("supportError")}</p>}

      <AdminFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t("supportSearchPlaceholder")}
        onOpenFilters={() => setFiltersOpen(true)}
        activeFilterCount={supportFilterCount(filters)}
      />

      <div className="mt-[27px]">
        <AdminTable
          title={t("supportTitle")}
          shown={requests.length}
          total={whole ?? requests.length}
          totalUnknown={whole === undefined && hasMore}
          loading={loading}
          columns={[
            { key: "request", label: t("supportRequest"), className: "w-[420px] pl-[21px]" },
            { key: "who", label: t("supportWho"), skeletonWidth: "w-28", className: "w-[260px] pl-0" },
            { key: "unread", label: t("supportUnread"), skeletonWidth: "w-10", className: "w-[120px] pl-0" },
            {
              key: "status",
              label: t("supportStatusColumn"),
              skeletonWidth: "w-20",
              skeletonShape: "badge",
              className: "w-[168px] pl-0",
            },
            { key: "last", label: t("supportLastMessage"), skeletonWidth: "w-28", className: "pr-5 pl-0" },
          ]}
          emptyText={t("supportEmpty")}
          emptyTitle={t("supportEmptyTitle")}
          emptyBadge={LifeBuoy}
          noMatchesText={t("supportNoMatches")}
          noMatchesTitle={t("supportNoMatchesTitle")}
          filtered={supportFilterCount(filters) > 0 || search.trim() !== ""}
          rows={requests.map((request) => ({
            key: request.threadId,
            primary: (
              <Link
                to="/admin/support/$threadId"
                params={{ threadId: request.threadId }}
                className="grid max-w-[400px] min-w-0 leading-[18px] no-underline"
              >
                <span className="truncate text-[15.5px] font-bold text-[var(--color-headline)] hover:underline">
                  {request.subject}
                </span>
                <span className="mt-[5px] truncate text-sm text-[var(--color-muted-foreground)]">
                  {request.lastMessagePreview}
                </span>
              </Link>
            ),
            cells: {
              who: (
                <span className="text-[15px] font-medium text-[var(--color-headline)]">
                  {request.audience === "provider" ? (
                    request.providerId ? (
                      <Link
                        to="/admin/providers/$providerId"
                        params={{ providerId: request.providerId }}
                        className="hover:underline"
                      >
                        {request.providerName}
                      </Link>
                    ) : (
                      // An orphaned provider request — the provider it named no
                      // longer resolves to an id. Falling back to the requester's
                      // name would misattribute the row to the wrong person, so
                      // this shows the provider's own (unlinked) name, or a dash
                      // if even that degraded to empty.
                      <span>{request.providerName || "—"}</span>
                    )
                  ) : (
                    <span>{request.requesterName}</span>
                  )}
                </span>
              ),
              // Blank, not "0": an unread count of none reads faster as an
              // empty cell than as a zero sitting among genuine counts.
              unread: request.unreadForAdmin ? (
                <span className="inline-grid h-[26px] min-w-[26px] place-items-center rounded-full bg-[var(--color-bad-bg)] px-[7px] text-sm font-semibold text-[var(--color-bad-fg)] tabular-nums">
                  {request.unreadForAdmin}
                </span>
              ) : (
                ""
              ),
              status: (
                <Badge
                  tone={request.status === "open" ? "info" : "neutral"}
                  className="min-w-[103px] justify-center"
                >
                  {t(`supportStatus.${request.status}`)}
                </Badge>
              ),
              last: (
                <span className="flex items-center gap-2.5 text-sm whitespace-nowrap text-[var(--color-muted-foreground)] tabular-nums">
                  <Calendar aria-hidden="true" className="h-[17px] w-[17px] shrink-0 text-[var(--color-primary)]" />
                  {when.format(new Date(request.lastMessageAt))}
                </span>
              ),
            },
          }))}
        />
      </div>

      {!loading && requests.length > 0 && (
        <p className="mt-2.5 mb-0 flex min-h-[46px] items-center text-[15.5px] text-[var(--color-muted-foreground)]">
          {whole === undefined && hasMore
            ? t("supportShowingPartial", { shown: requests.length })
            : t("supportShowing", { shown: requests.length, total: whole ?? requests.length })}
        </p>
      )}

      <SupportFilterSheet open={filtersOpen} onOpenChange={setFiltersOpen} filters={filters} onChange={setFilters} />

      {/* Cursor-paged: there is no page number to go to, only the next ones. */}
      {hasMore && (
        <Button variant="outline" size="sm" className="mt-2 self-center" onClick={loadMore}>
          {t("supportLoadMore")}
        </Button>
      )}
    </div>
  );
}
