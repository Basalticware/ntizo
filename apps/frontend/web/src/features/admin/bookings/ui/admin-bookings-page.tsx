import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { CalendarCheck, MessageSquareWarning } from "lucide-react";
import { ADMIN_BOOKING_TABS, type AdminBookingTab } from "@ntizo/shared/read-models";
import { Button } from "@ntizo/frontend-ui";
import type { CollectionRow } from "@/shared/components/collection-card";
import { WhenCell } from "@/shared/components/list-cells";
import type { StatusTab } from "@/shared/components/status-tabs";
import { usePageHeader } from "@/shared/lib/page-header";
import { shortDate } from "@/shared/lib/relative-day";
import { compactSlotWording } from "@/features/checkout/domain/slot-wording";
import { BookingStatusBadge } from "@/features/provider/bookings/ui/booking-status-badge";
import { formatMoneyShort } from "@/features/wallet/domain/money";
import { useAdminStats } from "@/features/admin/dashboard/viewmodel/use-admin-dashboard";
import {
  AdminFilterBar,
  AdminListFoot,
  AdminPerson,
  AdminTable,
  AdminTabs,
  pageRange,
} from "@/features/admin/shared/ui/admin-list";
import {
  ADMIN_BOOKINGS_PAGE_SIZE,
  type AdminBookingRowDTO,
} from "../data/admin-booking.repository";
import type { AdminQueueSearch } from "../domain/queue-search";
import { lastPageOffset, waitedWording, waitingSince } from "../domain/waiting";
import {
  useAdminBookingActions,
  useAdminBookings,
  type AdminBookingAction,
} from "../viewmodel/use-admin-bookings";
import { BookingsFilterSheet, DEFAULT_BOOKING_TAB } from "./bookings-filters";

/** A row's action at the mockups' "Ver detalhes" size: outlined blue, 39px. */
const ACTION_CLASS =
  "h-[39px] rounded-md border-[var(--color-blue-edge)] text-[14.5px] font-medium text-[var(--color-primary)]";

/** The chip's colour per queue: owed a close is amber, a complaint is red. */
const TAB_TONE: Record<AdminBookingTab, StatusTab<AdminBookingTab>["tone"]> = {
  unclosed: "warning",
  in_window: "info",
  disputed: "danger",
};

/**
 * The bookings an administrator has to look at, in the three tabs the queue
 * has: ones nobody closed, ones inside the customer's window, and complaints
 * waiting on a decision.
 *
 * The admin list layout every admin list shares (`AdminTabs`, `AdminFilterBar`,
 * `AdminTable`, `AdminListFoot`). The three queues are tabs again, as the
 * October mockups draw them — `bookingNeedsAttentionForAdmin` answers a
 * different result set per queue, not the same one narrowed — and the same
 * pick stays in the panel behind Filtrar, so either control moves the other.
 *
 * **The queue and the page are both in the URL**, so a refresh keeps your
 * place and a link to "the second page of the disputes" is a link. The page
 * used to be component state while the tab was not, which made a refresh keep
 * half of where you were; the asymmetry bought nothing. Changing queue simply
 * omits the offset, so a new list starts at its own first page with no reset
 * to write. The search is component state, as it is on every other list: a
 * keystroke is not a place somebody wants Back to return to.
 *
 * **Nothing on this screen is written optimistically, and nothing here
 * announces that an action worked.** All three mutations answer `{ bookingId }`
 * whether they moved the booking or lost the compare-and-swap to the
 * platform's own sweep — which is working through this very queue from the
 * other side, row by row. The refetch is the only witness of who won, so the
 * page waits for it: a row that moved leaves its tab, and a row that lost
 * stays exactly as it was. A cheerful sentence in between would be a claim
 * the wire never made.
 */
export function AdminBookingsPage() {
  const { t, i18n } = useTranslation("admin");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as AdminQueueSearch;
  const tab: AdminBookingTab = search.tab ?? DEFAULT_BOOKING_TAB;
  const offset = search.offset ?? 0;
  const [needle, setNeedle] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  usePageHeader(t("bookingsTitle"), t("bookingsSubtitle"));

  /**
   * Where the queue goes next.
   *
   * `replace` for a correction the reader did not ask for, a push for a move
   * they did. Everything here pushes except the empty-page correction below:
   * that one *replaces* the address it is correcting, because a pushed
   * correction puts an entry in the history for a page the reader never chose
   * and Back walks straight back into it — arriving from the dashboard on an
   * empty second page, four presses of Back never left the queue.
   */
  const go = (next: { tab: AdminBookingTab; offset?: number; replace?: boolean }) =>
    void navigate({
      to: "/admin/bookings",
      // A zero offset is the absence of one: `/admin/bookings?tab=disputed`
      // rather than `…&offset=0`, so the first page of a tab has exactly one
      // address.
      search: { tab: next.tab, offset: next.offset ? next.offset : undefined },
      replace: next.replace ?? false,
    });

  const query = useAdminBookings({ tab, offset, ...(needle.trim() ? { search: needle.trim() } : {}) });
  const actions = useAdminBookingActions();

  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const stats = useAdminStats();

  /**
   * The instant every wait on screen is measured from: the moment the page was
   * answered, not whenever React last re-rendered. All the rows then count from
   * one clock, and a re-render for an unrelated reason cannot age the queue by
   * an hour while nothing about the data changed.
   */
  const now = useMemo(
    () => new Date(query.dataUpdatedAt || Date.now()),
    [query.dataUpdatedAt],
  );

  /**
   * The row whose button was last pressed, held until the queue has been read
   * again.
   *
   * Not cosmetic: the write lands before the refetch replaces the list, so a
   * second press in that gap sends a transition the booking has already made,
   * and the platform refuses it — which would put "não foi possível" on screen
   * about a booking that in fact moved. Every button on the queue is disabled
   * while a write is in flight; this one row stays disabled until the read
   * that follows says what actually happened.
   *
   * **Released by an answer of either kind.** `answeredAt` takes the later of
   * the query's success and failure stamps rather than `dataUpdatedAt` alone:
   * a refusal now invalidates too (`onSettled`, see `useAdminBookingActions`),
   * and if that refetch itself fails there is still an answer — the page draws
   * `bookingsError` with a retry — so the row must not stay locked behind it.
   * Tied to `dataUpdatedAt` only, a refused action left the one control that
   * could repeat it disabled until a reload.
   */
  const answeredAt = Math.max(query.dataUpdatedAt, query.errorUpdatedAt);
  const [actedOn, setActedOn] = useState<string | null>(null);
  const [seenAnswer, setSeenAnswer] = useState(answeredAt);
  if (seenAnswer !== answeredAt) {
    setSeenAnswer(answeredAt);
    setActedOn(null);
  }

  /**
   * A page that emptied under the reader goes back to one that has not.
   *
   * An administrator working this queue empties it, and emptying the page they
   * are standing on is how that normally ends: close the twenty-first booking
   * and page two has nothing on it, while the count above still says twenty
   * need attention. `lastPageOffset` answers with the last offset that can
   * hold a row, so the correction is one hop from anywhere — including a
   * nonsense offset typed into the address bar.
   *
   * In an effect rather than during render, because the correction is a
   * navigation and a render may not have side effects. The frame it replaces
   * is not a lie the page invented: it is exactly what the server answered for
   * that offset.
   *
   * `replace`, so the address it corrects leaves no entry behind. Pushed, the
   * reader's next Back went to the empty page, which corrected itself forward
   * again — a queue you could arrive at from the dashboard and not leave.
   */
  useEffect(() => {
    if (!query.data || query.data.items.length > 0 || offset === 0) return;
    const back = lastPageOffset(query.data.total, ADMIN_BOOKINGS_PAGE_SIZE);
    if (back !== offset) go({ tab, offset: back, replace: true });
    // `go` and `tab` are stable for a given URL; re-running on the answer and
    // the offset is the whole of what this watches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, offset, tab]);

  function act(action: AdminBookingAction) {
    setActedOn(action.bookingId);
    actions.run(action);
  }

  /**
   * The tabs above the queue. Two numbers are known without a guess: the size
   * of the tab on screen (while nothing is typed) and the platform's open
   * disputes, which the dashboard's stats read already counts. The third tab
   * shows none rather than an invented one.
   */
  const tabs: StatusTab<AdminBookingTab>[] = ADMIN_BOOKING_TABS.map((key) => ({
    key,
    label: t(`bookingsTab.${key}`),
    tone: TAB_TONE[key],
    count:
      key === tab && query.data && !needle.trim()
        ? query.data.total
        : key === "disputed"
          ? (stats.data?.disputed ?? null)
          : null,
  }));
  const { from, to } = pageRange(offset, rows.length);

  return (
    <div className="flex w-full max-w-[1400px] flex-col">
      {query.isError && (
        <p role="alert" className="type-body mb-4 text-[var(--color-destructive)]">
          {t("bookingsError")}{" "}
          <button type="button" className="underline" onClick={() => void query.refetch()}>
            {t("bookingsRetry")}
          </button>
        </p>
      )}

      <AdminTabs
        tabs={tabs}
        value={tab}
        onChange={(next) => go({ tab: next })}
        ariaLabel={t("bookingsQueueLabel")}
      />

      <AdminFilterBar
        className="mt-[27px]"
        search={needle}
        onSearchChange={(value) => {
          setNeedle(value);
          // A search is a new list, and page three of the old one is past
          // the end of it. `replace`, because the reader did not choose the
          // page they are being moved off — see `go`.
          if (offset > 0) go({ tab, replace: true });
        }}
        searchPlaceholder={t("bookingsSearchPlaceholder")}
        onOpenFilters={() => setFiltersOpen(true)}
        activeFilterCount={tab === DEFAULT_BOOKING_TAB ? 0 : 1}
      />

      <div className="mt-[27px]">
        <AdminTable
          title={t(`bookingsTab.${tab}`)}
          shown={rows.length}
          total={total}
          loading={query.isLoading}
          columns={[
            { key: "customer", label: t("bookingsCol.customer"), className: "w-[230px] pl-[18px]" },
            { key: "provider", label: t("bookingsCol.provider"), skeletonWidth: "w-32", className: "w-[230px] pl-0" },
            { key: "service", label: t("bookingsCol.service"), skeletonWidth: "w-36", className: "w-[200px] pl-0" },
            { key: "when", label: t("bookingsCol.when"), skeletonWidth: "w-32", className: "w-[175px] pl-0" },
            { key: "price", label: t("bookingsCol.price"), skeletonWidth: "w-20", className: "w-[110px] pl-0" },
            {
              key: "status",
              label: t("bookingsCol.status"),
              skeletonWidth: "w-28",
              skeletonShape: "badge",
              className: "w-[160px] pl-0",
            },
            {
              key: "actions",
              label: t("bookingsCol.actions"),
              className: "pr-5 pl-0",
              skeletonWidth: "w-40",
            },
          ]}
          emptyTitle={t(`bookingsEmpty.${tab}.title`)}
          emptyText={t(`bookingsEmpty.${tab}.body`)}
          emptyBadge={CalendarCheck}
          // Only the search narrows: a queue is a different question, not a
          // narrowing of one, so an empty queue with nothing typed is genuinely
          // empty and says so in that queue's own words.
          noMatchesTitle={t("bookingsNoMatchesTitle")}
          noMatchesText={t("bookingsNoMatches")}
          filtered={needle.trim() !== ""}
          /**
           * Cards until a 1280px viewport. Seven columns, the last of them
           * buttons, need the ~1300px the admin shell leaves at the mockups'
           * width; at 1024 the box is about 718 and the row is a stacked card,
           * which shows all of it rather than pushing the actions off the
           * right edge.
           */
          tableFrom="xl"
          rows={rows.map((b) =>
            queueRow(b, { locale, now, t, act, actedOn, pending: actions.pending, failure: actions.failure }),
          )}
        />
      </div>

      {/* Shown whenever there is anywhere to go, which is not the same
          question as whether the queue is longer than a page — see
          `AdminListFoot`. */}
      <AdminListFoot
        label={query.isLoading || rows.length === 0 ? null : t("bookingsShowing", { from, to, total })}
        offset={offset}
        pageSize={ADMIN_BOOKINGS_PAGE_SIZE}
        total={total}
        onOffsetChange={(next) => go({ tab, offset: next })}
      />

      <BookingsFilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        tab={tab}
        onTabChange={(next) => go({ tab: next })}
      />
    </div>
  );
}

interface RowContext {
  locale: string;
  now: Date;
  t: ReturnType<typeof useTranslation<"admin">>["t"];
  act: (action: AdminBookingAction) => void;
  actedOn: string | null;
  pending: boolean;
  failure: AdminBookingAction | null;
}

/**
 * One row of the queue: whose booking, whose workspace, what was sold, when
 * it was, for how much, and how long it has been waiting for somebody here.
 *
 * The workspace is a link to that workspace, because "who is this" is the
 * first question a queue row raises about a provider. The customer is not —
 * there is no admin page for one booking's customer to go to.
 */
function queueRow(b: AdminBookingRowDTO, ctx: RowContext): CollectionRow {
  const { locale, now, t } = ctx;
  const slot = compactSlotWording(b.startsAt, b.endsAt, locale, b.timezone);
  const waited = waitedWording(waitingSince(b), now, locale);
  return {
    key: b.id,
    primary: <AdminPerson name={b.customerFirstName} title={b.customerFirstName} className="gap-[22px]" />,
    cells: {
      provider: (
        <AdminPerson
          name={b.providerName}
          className="gap-[15px]"
          title={
            <Link
              to="/admin/providers/$providerId"
              params={{ providerId: b.providerId }}
              className="hover:underline"
            >
              {b.providerName}
            </Link>
          }
        />
      ),
      service: (
        <span className="block truncate pr-3 text-[15px] font-bold text-[var(--color-headline)]">
          {b.serviceName}
        </span>
      ),
      when: (
        <WhenCell
          day={shortDate(b.startsAt, b.timezone, locale, { year: true })}
          time={`${slot.start} – ${slot.end}`}
        />
      ),
      price: (
        <span className="text-[15.5px] font-semibold whitespace-nowrap text-[var(--color-headline)] tabular-nums">
          {formatMoneyShort(b.priceMinor, b.currency, locale)}
        </span>
      ),
      /**
       * The badge, and under it how long the row has waited and — on a
       * dispute — the way into the complaint. Only a disputed row carries a
       * thread, and the read model makes that structural: `threadId` is null
       * on every other status precisely so this link cannot point somewhere
       * wrong.
       */
      status: (
        <span className="inline-grid justify-items-end gap-1 xl:justify-items-start">
          <BookingStatusBadge status={b.status} />
          {waited && (
            <span className="type-caption text-[var(--color-muted-foreground)]">
              {t("bookingsWaiting", { duration: waited })}
            </span>
          )}
          {b.threadId && (
            <Link
              to="/admin/support/$threadId"
              params={{ threadId: b.threadId }}
              className="type-caption inline-flex items-center gap-1 font-semibold text-[var(--color-primary)] no-underline"
            >
              <MessageSquareWarning className="h-3.5 w-3.5" aria-hidden="true" />
              {t("bookingsOpenDispute")}
            </Link>
          )}
        </span>
      ),
    },
    actions: <RowActions booking={b} ctx={ctx} />,
  };
}

/**
 * What an administrator may do to this row, decided by its status rather than
 * by the tab it was found in.
 *
 * The status is the fact the backend will check: `booking.adminMarkDone`
 * reaches `Booking.markDone`, which only leaves `CONFIRMED`, and
 * `booking.adminComplete` reaches `Booking.complete`, whose only door is
 * `MARKED_DONE`. Offering a button the row's own status cannot honour would be
 * offering a refusal.
 */
function RowActions({ booking, ctx }: { booking: AdminBookingRowDTO; ctx: RowContext }) {
  const { t, act, actedOn, pending, failure } = ctx;
  // Every button on the queue while a write is in flight, and this row's until
  // the read that follows has said what the write actually did.
  const disabled = pending || actedOn === booking.id;

  /**
   * The refusal, on the row it happened to and naming what was refused.
   *
   * A page-level banner said neither. It could not name the row, and because
   * each of the three actions used to carry its own `useMutation`, a refused
   * mark-done went on saying so while a *successful* completion landed on
   * another row — the one kind of false sentence this screen is built to avoid.
   *
   * Two sentences, not one: `bookingsActionFailed` says the booking could not
   * be completed, which is what a refused mark-done or complete is. A refused
   * dispute decision is not that — when it succeeds it may *cancel* the
   * booking rather than complete it — so it says the dispute could not be
   * decided, which is true of either outcome.
   */
  const refused = failure?.bookingId === booking.id ? failure : null;
  const notice = refused && (
    <span role="alert" className="type-caption block max-w-[24ch] text-[var(--color-destructive)]">
      {t(refused.kind === "resolveDispute" ? "bookingsDisputeFailed" : "bookingsActionFailed")}
    </span>
  );

  if (booking.status === "DISPUTED") {
    return (
      <span className="grid justify-items-stretch gap-2 xl:justify-items-start">
        {/* Two long labels, and three widths to keep them honest at, because
            Tailwind's breakpoints are viewport widths and this row's box is
            the viewport minus the sidebar.

            Stacked on a phone, where `CollectionCard` gives the actions
            whatever the card's primary block does not need and side by side
            would leave the customer's name thirty pixels. Side by side once
            the card is wide (`sm`, and still no sidebar). Stacked again from
            `md`, where the sidebar appears and the card narrows — and in the
            table from `xl`, whose last column is the narrowest of the seven. */}
        <span className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end md:flex-col md:items-stretch">
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className={ACTION_CLASS}
            onClick={() => act({ kind: "resolveDispute", bookingId: booking.id, upheld: true })}
          >
            {t("bookingsDisputeAction.upheld")}
          </Button>
          <Button
            size="sm"
            disabled={disabled}
            className="h-[39px] rounded-md text-[14.5px] font-medium"
            onClick={() => act({ kind: "resolveDispute", bookingId: booking.id, upheld: false })}
          >
            {t("bookingsDisputeAction.rejected")}
          </Button>
        </span>
        {notice}
      </span>
    );
  }

  const kind = booking.status === "MARKED_DONE" ? "complete" : "markDone";
  return (
    <span className="grid justify-items-stretch gap-2 xl:justify-items-start">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        className={ACTION_CLASS}
        onClick={() => act({ kind, bookingId: booking.id })}
      >
        {t(kind === "complete" ? "bookingsAction.completeNow" : "bookingsAction.markDone")}
      </Button>
      {notice}
    </span>
  );
}
