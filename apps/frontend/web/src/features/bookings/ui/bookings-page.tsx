import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { CalendarDays, ChevronRight } from "lucide-react";
import { Button, buttonVariants, cn } from "@ntizo/frontend-ui";
import type {
  BookingDTO,
  CustomerBookingPageDTO,
} from "@ntizo/shared/read-models";
import { StatusTabs } from "@/shared/components/status-tabs";
import { CustomerPageHeading } from "@/features/account/ui/customer-page";
import { MessageProviderButton } from "@/features/directory/ui/provider-rail";
import { useCurrentUser } from "@/features/user/viewmodel/use-current-user";
import {
  CUSTOMER_BOOKING_TABS,
  CUSTOMER_BOOKINGS_PAGE_SIZE,
  canCancel,
  canPay,
  deadlineOf,
  timeLeftWording,
  type CustomerBookingTab,
} from "../domain/status";
import { nextBooking } from "../domain/list-row";
import { useMyBookings } from "../viewmodel/use-my-bookings";
import { BOOKINGS_CARD, BookingRow, BookingRowSkeleton } from "./booking-row";
import { HelpCard, NextBookingCard } from "./bookings-rail";
import { CancelDialog } from "./cancel-dialog";
import { PayDialog } from "./pay-dialog";

/**
 * "Minhas reservas" — the customer's own bookings, one tab at a time, as the
 * October 2026 mockup draws it: a breadcrumb and the title, the tabs with
 * their counts, a bordered card per booking, and a rail with the next
 * booking and a way to the help centre.
 *
 * **Three tabs, not the mockup's six.** By what is still open, what is coming
 * up, and what is over — the server's own split (`CUSTOMER_BOOKING_TABS`),
 * and the only one it counts. Six tabs by status would need six totals the
 * read model does not have, and a count off the page in hand would call
 * twenty rows "all of them".
 *
 * **No search box and no sort.** `bookingMine` carries no `q` and no order:
 * each tab has its own fixed order (requests newest first, upcoming soonest
 * first, history most recent first). A client-side filter over a paged list
 * would tell a customer "no matches" about a booking merely on the next page.
 *
 * **No "Resumo das suas reservas".** It is a total per status, and the server
 * counts three tabs, not nine statuses; the tab row already prints the three
 * numbers it does have.
 *
 * **Paging is the provider list's own shape: "Mais" *adds* the next page
 * under the rows already there.** It was a URL offset (`?offset=`) that
 * replaced the page instead, which broke three ways at once — the rows the
 * reader was looking at vanished, the count misreported, and there was no
 * control that went back. See the provider list's `loaded`/`page` pair, which
 * this mirrors down to why both are needed.
 */
export function BookingsPage() {
  const { t } = useTranslation("bookings");
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { tab?: CustomerBookingTab };
  const tab: CustomerBookingTab = search.tab ?? CUSTOMER_BOOKING_TABS[0];

  const [offset, setOffset] = useState(0);
  /**
   * The rows on screen, which are not the rows the last request returned —
   * and the last answer beside them. Both exactly as
   * `provider/bookings/ui/bookings-page.tsx` keeps them, for the reasons
   * spelled out there: `useQuery` has no data for an offset it has not
   * fetched yet, so reading the count and the "Mais" button straight off it
   * would make them vanish for exactly the length of the request meant to
   * extend the list.
   */
  const [loaded, setLoaded] = useState<BookingDTO[]>([]);
  const [page, setPage] = useState<CustomerBookingPageDTO | null>(null);

  /**
   * Switching tab is a new list, and it is emptied **during the render that
   * switches it** rather than in an effect — passive effects run after the
   * browser paints, so a reset living in one would draw the previous tab's
   * rows under the new tab's heading for a frame first. The app's query
   * client holds data fresh for 30s, so returning to a tab visited seconds
   * ago has `isLoading` false and `data` present on the very render the tab
   * changes in, which makes that frame reachable rather than theoretical.
   * Same mechanism, and same reasoning, as the provider list's `filterKey`.
   */
  const [appliedTab, setAppliedTab] = useState(tab);
  if (appliedTab !== tab) {
    setAppliedTab(tab);
    setOffset(0);
    setLoaded([]);
    setPage(null);
  }

  const query = useMyBookings({ tab, offset });
  // Offset zero is a fresh list and replaces; anything else extends. Ids
  // already on screen are skipped rather than trusted to be disjoint: a
  // booking that changed tab between the two requests shifts every row after
  // it by one, and the same id arriving twice would otherwise render twice.
  useEffect(() => {
    const answer = query.data;
    if (!answer) return;
    setPage(answer);
    setLoaded((current) => {
      if (offset === 0) return answer.items;
      const seen = new Set(current.map((b) => b.id));
      return [...current, ...answer.items.filter((b) => !seen.has(b.id))];
    });
  }, [query.data, offset]);

  // The answer the count, the chips and the pager are read off: the one in
  // hand, falling back to the previous page while the next is in flight, so
  // none of the three blinks out for the length of a request meant to extend
  // the list.
  const data = query.data ?? page;
  // Measured from the moment the page was answered, not from whenever React
  // last re-rendered — see the provider list's own `now`, which this mirrors.
  const now = useMemo(
    () => new Date(query.dataUpdatedAt || Date.now()),
    [query.dataUpdatedAt],
  );

  const setTab = (next: CustomerBookingTab) =>
    void navigate({ to: "/bookings", search: { tab: next } });

  // At offset zero the answer *is* the list, read straight through rather
  // than waited for — the accumulator above only catches up after the paint,
  // so a cached tab would otherwise draw an empty card for one frame. From
  // the second page on, `loaded` is the only thing that remembers the rows
  // above the one the server has just sent.
  //
  // The `DRAFT` filter is belt to `customerWhere`'s braces: the repository
  // already excludes drafts from every tab, and the branch rule is that a
  // draft appears in no tab and on no customer page. Filtering here means a
  // read that ever disagreed would drop a row rather than offer to cancel a
  // checkout the customer does not believe exists.
  const items = (offset === 0 ? (query.data?.items ?? []) : loaded).filter(
    (b) => b.status !== "DRAFT",
  );
  // The whole row rather than an id: the dialog needs the slot's date and
  // the provider's name, and `items` is already the answer this render has
  // — a second lookup by id would only reintroduce the chance of it missing.
  const [cancelling, setCancelling] = useState<BookingDTO | null>(null);
  const [paying, setPaying] = useState<BookingDTO | null>(null);
  // The phone `PayDialog` shows masked in its waiting state, and the reason
  // it comes from here rather than from the row: `bookingMine` deliberately
  // carries no phone field (a booking's own snapshot has no reason to hold
  // one), so the one place this page has it is the signed-in user's own
  // profile.
  const { data: currentUser } = useCurrentUser();

  // The two answers "Próxima reserva" is read off — see `nextBooking`. Both
  // share their cache entry with the tab of the same name at offset zero, so
  // on those tabs this is the list's own request, not a second one.
  const upcoming = useMyBookings({ tab: "upcoming", offset: 0 });
  const waiting = useMyBookings({ tab: "waiting", offset: 0 });
  const next = useMemo(
    () =>
      nextBooking(
        upcoming.data?.items ?? [],
        waiting.data && waiting.data.nextOffset === null
          ? waiting.data.items
          : null,
        now,
      ),
    [upcoming.data, waiting.data, now],
  );

  const tabLabel = t(`tab.${tab}`);
  const total = data?.total ?? 0;
  const loadingFirst = query.isLoading && offset === 0;

  return (
    <div className="w-full max-w-[1400px]">
      <nav aria-label={t("list.breadcrumbLabel")} className="mb-4 text-sm">
        <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0 text-[var(--color-muted-foreground)]">
          <li>
            <Link to="/" className="hover:text-[var(--color-headline)] hover:underline">
              {t("list.home")}
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.4} />
          </li>
          <li aria-current="page" className="text-[var(--color-headline)]">
            {t("title")}
          </li>
        </ol>
      </nav>

      <CustomerPageHeading title={t("title")} subtitle={t("lede")} />

      {/* The rail beside the list from `xl`; under it before then, two
          cards side by side from `md` so a laptop at 1100px does not end the
          page on two half-empty full-width boxes. */}
      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <section aria-label={tabLabel} className="min-w-0">
          {/* `contain` so the row is measured by its column, not by its
              boxes: three tabs wider than a phone would otherwise push the
              page sideways. Inside the column they scroll, as `StatusTabs`
              means them to. Every number is the server's — `bookingMine`
              counts all three tabs whatever tab is open. */}
          <div className="w-full [contain:inline-size]">
            <StatusTabs
              tabs={CUSTOMER_BOOKING_TABS.map((key) => ({
                key,
                label: t(`tab.${key}`),
                count: data ? data.counts[key] : null,
                tone: key === "waiting" ? "warning" : "neutral",
              }))}
              value={tab}
              onChange={setTab}
              ariaLabel={t("title")}
            />
          </div>

          {loadingFirst ? (
            <ul aria-hidden="true" className="m-0 mt-5 grid list-none gap-3 p-0">
              <BookingRowSkeleton />
              <BookingRowSkeleton />
              <BookingRowSkeleton />
            </ul>
          ) : items.length === 0 ? (
            <div className={cn(BOOKINGS_CARD, "mt-5 grid justify-items-center px-6 py-12 text-center")}>
              <span
                aria-hidden="true"
                className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-blue-soft)] text-[var(--color-primary)]"
              >
                <CalendarDays className="h-6 w-6" />
              </span>
              <p className="m-0 mt-4 text-lg font-bold text-[var(--color-headline)]">
                {t("emptyTitle")}
              </p>
              <p className="m-0 mt-1.5 max-w-[46ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
                {t("emptyBody")}
              </p>
              <Link to="/services" className={cn(buttonVariants({ size: "sm" }), "mt-5")}>
                {t("emptyAction")}
              </Link>
            </div>
          ) : (
            <ul aria-label={tabLabel} className="m-0 mt-5 grid list-none gap-3 p-0">
              {items.map((b) => {
                const deadline = deadlineOf(b);
                const left = deadline ? timeLeftWording(deadline, now) : null;
                // `canCancel` and `canPay` are the domain's answer, and both
                // are true for `PENDING_PAYMENT` — the detail page shows both
                // at once. A row offers the one actually being waited on:
                // paying, or, while the provider has not answered, cancelling.
                const showPay = canPay(b.status);
                const showCancel = canCancel(b.status) && !showPay;
                return (
                  <BookingRow
                    key={b.id}
                    booking={b}
                    countdown={
                      left
                        ? b.status === "PENDING_PAYMENT"
                          ? t("payIn", { time: left })
                          : t("respondIn", { time: left })
                        : null
                    }
                    primaryAction={
                      showPay ? (
                        <Button
                          type="button"
                          className="h-10 flex-1 md:w-full md:flex-none"
                          onClick={() => setPaying(b)}
                        >
                          {t("pay")}
                        </Button>
                      ) : undefined
                    }
                    quietActions={
                      <>
                        {/* The provider is one press away from every row,
                            whatever the booking's status: a question about
                            a job that is over is as fair as one about a job
                            still waiting to be paid for. */}
                        <MessageProviderButton
                          providerId={b.providerId}
                          compact
                          label={t("message")}
                        />
                        {/* A `<button>`, not a link: it opens a dialog. */}
                        {showCancel && (
                          <button
                            type="button"
                            onClick={() => setCancelling(b)}
                            className="type-caption font-semibold text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)] hover:underline"
                          >
                            {t("cancel")}
                          </button>
                        )}
                      </>
                    }
                  />
                );
              })}
            </ul>
          )}

          {/* No "anterior": nothing was taken away to go back to. The count
              grows with the list instead of restarting at twenty. */}
          {!loadingFirst && items.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
              <span className="text-sm text-[var(--color-muted-foreground)] tabular-nums">
                {t("list.shown", { shown: items.length, total })}
              </span>
              {data && data.nextOffset !== null && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={query.isFetching}
                  onClick={() =>
                    setOffset(data.nextOffset ?? offset + CUSTOMER_BOOKINGS_PAGE_SIZE)
                  }
                >
                  {t("loadMore")}
                </Button>
              )}
            </div>
          )}
        </section>

        <aside className="grid min-w-0 gap-6 md:grid-cols-2 md:items-start xl:grid-cols-1">
          <NextBookingCard booking={next} loading={upcoming.isLoading} />
          <HelpCard />
        </aside>
      </div>

      {cancelling && (
        <CancelDialog
          booking={cancelling}
          onClose={() => setCancelling(null)}
        />
      )}
      {paying && (
        <PayDialog
          booking={paying}
          phone={currentUser?.phoneNumber ?? null}
          onClose={() => setPaying(null)}
        />
      )}
    </div>
  );
}
