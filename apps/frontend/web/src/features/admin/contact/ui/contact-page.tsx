import { useMemo, useRef, useState, type ComponentType, type ReactNode, type Ref } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, Check, ChevronRight, Mail, MailOpen, MapPin, Reply, RotateCcw, Search } from "lucide-react";
import type { ContactRequestStatus } from "@ntizo/shared";
import type { ContactRequestAdminDTO } from "@ntizo/shared/read-models";
import { Avatar, AvatarFallback, Badge, Skeleton, cn } from "@ntizo/frontend-ui";
import { EmptyCard } from "@/shared/components/empty-card";
import type { StatusTab } from "@/shared/components/status-tabs";
import { initialsFrom } from "@/shared/lib/initials";
import { usePageHeader } from "@/shared/lib/page-header";
import { relativeDayLabel, shortDate } from "@/shared/lib/relative-day";
import {
  AdminFilterBar,
  AdminToolbar,
  TOOLBAR_SEARCH_CLASS,
  AdminListFoot,
  AdminTabs,
  adminDate,
  pageRange,
} from "@/features/admin/shared/ui/admin-list";
import { ADMIN_CONTACT_PAGE_SIZE } from "../data/admin-contact.repository";
import { useAdminContact, useSetContactRequestStatus } from "../viewmodel/use-admin-contact";
import {
  ContactFilterSheet,
  DEFAULT_CONTACT_FILTERS,
  contactFilterCount,
  type ContactFilters,
} from "./contact-filters";

type ContactTab = "all" | ContactRequestStatus;
const TABS: readonly ContactTab[] = ["all", "open", "resolved"];

/** Open is what still needs somebody, so it reads red, as an unread message does. */
const STATUS_TONE: Record<ContactRequestStatus, "danger" | "success"> = {
  open: "danger",
  resolved: "success",
};

/**
 * The contact queue: what people wrote through the two forms, and whether
 * anybody has answered yet.
 *
 * A two-pane inbox, as the October mockup draws it: the requests on the left,
 * the one chosen on the right with who wrote, from where, the whole message
 * and the two things to do about it — "reply by email" (a mailto with the
 * reference in the subject, because the reply happens in the inbox, not here —
 * spec, "What the context deliberately does not do") and resolve/reopen. Below
 * `xl` the panes stack, the chosen request under the list.
 *
 * The status is the tabs; the panel behind Filtrar holds the kind, the one
 * thing the tabs do not pick. Open is the default, because the queue is worked, not browsed. Support with
 * an account is the help center's queue, at `/admin/support`, not this one.
 */
export function AdminContactPage() {
  const { t, i18n } = useTranslation("admin");
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const [filters, setFilters] = useState<ContactFilters>(DEFAULT_CONTACT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const { kind, status } = filters;

  const query = useAdminContact({
    offset,
    ...(kind ? { kind } : {}),
    ...(status ? { status } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  });
  const setRequestStatus = useSetContactRequestStatus();

  usePageHeader(t("contactTitle"), t("contactSubtitle"));

  const rows = useMemo(() => query.data?.items ?? [], [query.data]);
  const total = query.data?.total ?? 0;
  const openCount = query.data?.openCount ?? null;
  // The chosen request, or the first on the page when none is — or when the
  // one chosen has left the page (resolved under an "open" tab, say).
  const selected = rows.find((r) => r.id === chosen) ?? rows[0] ?? null;
  const tab: ContactTab = status ?? "all";
  const narrowed = kind !== undefined || search.trim() !== "";
  const filtered = kind !== undefined || status !== "open" || search.trim() !== "";
  const now = useMemo(() => new Date(query.dataUpdatedAt || Date.now()), [query.dataUpdatedAt]);
  const { from, to } = pageRange(offset, rows.length);

  function change(next: ContactFilters) {
    setFilters(next);
    // Back to the first page: page three of the open list is past the end of
    // a two-row resolved one, which reads as nothing matching.
    setOffset(0);
  }

  function choose(id: string) {
    setChosen(id);
    // Stacked panes put the request under the list; bring it into view.
    if (window.matchMedia?.("(max-width: 1279px)").matches) {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const tabs: StatusTab<ContactTab>[] = TABS.map((key) => ({
    key,
    label: key === "all" ? t("contactStatusAll") : t(`contactStatus.${key}`),
    tone: key === "open" ? "danger" : key === "resolved" ? "success" : "neutral",
    // Open is counted across the whole table on every answer; the tab on
    // screen is counted by its own page, unless something narrows it.
    count: key === "open" ? openCount : key === tab && query.data && !narrowed ? total : null,
  }));

  return (
    <div className="flex w-full max-w-[1400px] flex-col">
      {query.error && <p className="type-body mb-4 text-[var(--color-destructive)]">{t("contactError")}</p>}
      {setRequestStatus.error && (
        <p className="type-body mb-4 text-[var(--color-destructive)]">{t("contactStatusFailed")}</p>
      )}

      <AdminToolbar>
        <AdminTabs
          tabs={tabs}
          value={tab}
          onChange={(next) => change({ ...filters, status: next === "all" ? undefined : next })}
          ariaLabel={t("contactStatusLabel")}
        />
        <AdminFilterBar
          className={cn(TOOLBAR_SEARCH_CLASS, "gap-[13px]")}
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setOffset(0);
          }}
          searchPlaceholder={t("contactSearchPlaceholder")}
          onOpenFilters={() => setFiltersOpen(true)}
          activeFilterCount={contactFilterCount(filters)}
        />
      </AdminToolbar>

      {/* Two panes only when there is a message to open; an empty or loading
          inbox takes the whole width. */}
      <div
        className={cn(
          "mt-[26px] grid items-start gap-[9px]",
          selected && "xl:grid-cols-[minmax(0,697fr)_minmax(0,625fr)]",
        )}
      >
        <div className="min-w-0">
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
            {query.isLoading ? (
              <InboxSkeleton />
            ) : rows.length === 0 ? (
              filtered ? (
                <EmptyCard
                  icon={Search}
                  title={t("contactNoMatchesTitle")}
                  body={t("contactNoMatches")}
                />
              ) : (
                <EmptyCard badge={MailOpen} title={t("contactEmptyTitle")} body={t("contactEmpty")} />
              )
            ) : (
              <ul aria-label={t("contactTitle")} className="m-0 list-none p-0">
                {rows.map((r) => (
                  <li key={r.id} className="border-t border-[var(--color-line-2)] first:border-t-0">
                    <InboxRow
                      request={r}
                      chosen={selected?.id === r.id}
                      onChoose={() => choose(r.id)}
                      now={now}
                      locale={locale}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <AdminListFoot
            label={query.isLoading || rows.length === 0 ? null : t("contactShowing", { from, to, total })}
            offset={offset}
            pageSize={ADMIN_CONTACT_PAGE_SIZE}
            total={total}
            onOffsetChange={setOffset}
          />
        </div>

        {selected && (
          <RequestDetail
            ref={detailRef}
            request={selected}
            locale={locale}
            busy={setRequestStatus.isPending}
            onSetStatus={(next) => setRequestStatus.mutate({ requestId: selected.id, status: next })}
          />
        )}
      </div>

      <ContactFilterSheet open={filtersOpen} onOpenChange={setFiltersOpen} filters={filters} onChange={change} />
    </div>
  );
}

/** What a topic is called, in the forms' own words. */
function useTopicLabel() {
  const { t } = useTranslation("admin");
  return (r: ContactRequestAdminDTO) => t(`topics.${r.kind}.${r.topic}`, { ns: "company", defaultValue: r.topic });
}

/** "Hoje" / "Ontem" within a day, the short date beyond it — the year only in the detail. */
function dayLabel(iso: string, now: Date, locale: string): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const relative = relativeDayLabel(iso, zone, now, locale);
  return relative === shortDate(iso, zone, locale, { year: true }) ? shortDate(iso, zone, locale) : relative;
}

/** One request in the list: who, about what, the start of what they said, when, and where it stands. */
function InboxRow({
  request,
  chosen,
  onChoose,
  now,
  locale,
}: {
  request: ContactRequestAdminDTO;
  chosen: boolean;
  onChoose: () => void;
  now: Date;
  locale: string;
}) {
  const { t } = useTranslation("admin");
  const topicLabel = useTopicLabel();
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(request.createdAt));
  return (
    <button
      type="button"
      onClick={onChoose}
      aria-current={chosen ? "true" : undefined}
      className={cn(
        "grid min-h-[90px] w-full grid-cols-[62px_minmax(0,1fr)_auto] items-center gap-x-4 py-2 pr-4 pl-2.5 text-left leading-tight sm:grid-cols-[62px_minmax(0,1fr)_60px_111px_20px] sm:gap-x-[19px]",
        chosen ? "bg-[var(--color-blue-softer)]" : "hover:bg-[color-mix(in_srgb,var(--color-blue-softer)_60%,transparent)]",
      )}
    >
      <Avatar className="h-[62px] w-[62px]">
        <AvatarFallback className="bg-[var(--color-info-bg)] text-[21px] font-medium text-[var(--color-primary)]">
          {initialsFrom(request.name)}
        </AvatarFallback>
      </Avatar>
      <span className="grid min-w-0">
        <span className="truncate text-base font-bold text-[var(--color-headline)]">{request.name}</span>
        <span className="mt-1 truncate text-[15px] font-medium text-[var(--color-ink-2)]">{topicLabel(request)}</span>
        <span className="mt-[5px] truncate text-sm text-[var(--color-faint)]">{request.message}</span>
      </span>
      <span className="hidden text-[14.5px] leading-[22px] text-[var(--color-muted-foreground)] sm:block">
        {dayLabel(request.createdAt, now, locale)}
        <br />
        {time}
      </span>
      <span>
        <Badge tone={STATUS_TONE[request.status]} className="h-7 min-w-[86px] justify-center">
          {t(`contactRequestStatus.${request.status}`)}
        </Badge>
      </span>
      <ChevronRight aria-hidden="true" className="hidden h-5 w-5 text-[var(--color-muted-foreground)] sm:block" />
    </button>
  );
}

function InboxSkeleton() {
  return (
    <div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex h-[90px] items-center gap-[19px] border-t border-[var(--color-line-2)] pl-2.5 first:border-t-0">
          <Skeleton className="h-[62px] w-[62px] shrink-0 rounded-full" />
          <div className="grid gap-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3.5 w-52" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** The chosen request: who, from where and when, the whole message, and what to do. */
function RequestDetail({
  ref,
  request,
  locale,
  busy,
  onSetStatus,
}: {
  ref: Ref<HTMLElement>;
  request: ContactRequestAdminDTO;
  locale: string;
  busy: boolean;
  onSetStatus: (status: ContactRequestStatus) => void;
}) {
  const { t } = useTranslation("admin");
  const topicLabel = useTopicLabel();
  const [technical, setTechnical] = useState(false);
  const received = new Date(request.createdAt);
  const receivedLabel = t("contactReceivedAt", {
    date: adminDate(request.createdAt, locale),
    time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(received),
  });

  return (
    <section
      ref={ref}
      aria-label={topicLabel(request)}
      className="min-w-0 scroll-mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-5 pt-1 pb-7 sm:px-[30px]"
    >
      <div className="flex min-h-[65px] items-center gap-4 border-b-2 border-[var(--color-line-2)] pt-3 pb-2">
        <h2 className="m-0 min-w-0 flex-1 text-[22.5px] font-bold text-[var(--color-headline)]">{topicLabel(request)}</h2>
        <Badge tone={STATUS_TONE[request.status]} className="h-7 shrink-0">
          {t(`contactRequestStatus.${request.status}`)}
        </Badge>
      </div>

      <div className="flex gap-6 pt-[22px] pb-6 pl-[3px]">
        <Avatar className="h-[79px] w-[79px] shrink-0">
          <AvatarFallback className="bg-[var(--color-info-bg)] text-2xl font-medium text-[var(--color-primary)]">
            {initialsFrom(request.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="m-0 mt-2 flex flex-wrap items-baseline gap-x-2 text-lg font-bold text-[var(--color-headline)]">
            {request.name}
            <span className="type-caption font-mono font-normal text-[var(--color-muted-foreground)]">#{request.reference}</span>
          </p>
          <p className="m-0 mt-[9px] flex min-w-0 items-center gap-[15px] text-[15.5px] text-[var(--color-primary)]">
            <Mail aria-hidden="true" className="h-[19px] w-[19px] shrink-0" />
            <span className="truncate">{request.email ?? t("contactNoEmail")}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-4 border-b-2 border-[var(--color-line-2)] pb-5 sm:grid-cols-[312px_1fr]">
        <Fact icon={MapPin} label={t("contactOriginLabel")}>
          {t(`contactKind.${request.kind}`)}
          {request.originPath ? ` · ${request.originPath}` : ""}
        </Fact>
        <Fact icon={Calendar} label={t("contactReceivedLabel")}>
          {receivedLabel}
        </Fact>
      </div>

      <h3 className="mt-[26px] mb-0 text-[15.5px] font-medium text-[var(--color-headline)]">{t("contactMessage")}</h3>
      <div className="mt-3.5 rounded-[10px] bg-[var(--color-blue-softer)] px-6 py-[19px] text-[15px] leading-normal whitespace-pre-wrap text-[var(--color-muted-foreground)]">
        {request.message}
      </div>

      {technical && (
        <dl className="type-caption mt-3 mb-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[var(--color-muted-foreground)]">
          <dt>{t("contactOrigin")}</dt>
          <dd className="m-0">{request.originPath ?? "—"}</dd>
          <dt>{t("contactIp")}</dt>
          <dd className="m-0">{request.ipAddress ?? "—"}</dd>
          <dt>{t("contactUserAgent")}</dt>
          <dd className="m-0 break-all">{request.userAgent ?? "—"}</dd>
          <dt>{t("contactLocale")}</dt>
          <dd className="m-0">{request.locale}</dd>
        </dl>
      )}
      <button
        type="button"
        onClick={() => setTechnical((v) => !v)}
        className="type-caption mt-2 font-semibold text-[var(--color-primary)]"
      >
        {technical ? t("contactHideDetails") : t("contactShowDetails")}
      </button>

      <div className="mt-[30px] flex flex-wrap gap-[13px] border-t-2 border-[var(--color-line-2)] pt-[26px]">
        {request.email && (
          <a
            href={`mailto:${request.email}?subject=${encodeURIComponent(`[Ntizo #${request.reference}] ${topicLabel(request)}`)}`}
            className="inline-flex h-[49px] items-center justify-center gap-[15px] rounded-md bg-[var(--color-primary)] px-6 text-base font-medium text-[var(--color-primary-foreground)] no-underline hover:opacity-90"
          >
            <Reply aria-hidden="true" className="h-[21px] w-[21px]" />
            {t("contactReply")}
          </a>
        )}
        {request.status === "open" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onSetStatus("resolved")}
            className="inline-flex h-[49px] items-center justify-center gap-[15px] rounded-md border-[1.5px] border-[color-mix(in_srgb,var(--color-ok-fg)_45%,white)] px-6 text-base font-medium text-[var(--color-ok-fg)] hover:bg-[var(--color-ok-bg)] disabled:opacity-50"
          >
            <Check aria-hidden="true" className="h-6 w-6" />
            {t("contactResolve")}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => onSetStatus("open")}
            className="inline-flex h-[49px] items-center justify-center gap-[15px] rounded-md border-[1.5px] border-[var(--color-faint)] px-6 text-base font-medium text-[var(--color-ink-2)] hover:bg-[var(--color-blue-softer)] disabled:opacity-50"
          >
            <RotateCcw aria-hidden="true" className="h-[21px] w-[21px]" />
            {t("contactReopen")}
          </button>
        )}
      </div>
    </section>
  );
}

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 gap-3.5">
      <span className="grid h-[46px] w-[45px] shrink-0 place-items-center rounded-[9px] bg-[var(--color-blue-softer)]">
        <Icon className="h-[21px] w-[21px] text-[var(--color-primary)]" />
      </span>
      <div className="min-w-0">
        <small className="mt-1.5 block text-sm text-[var(--color-faint)]">{label}</small>
        <span className="mt-1.5 block truncate text-[15px] text-[var(--color-muted-foreground)]">{children}</span>
      </div>
    </div>
  );
}
