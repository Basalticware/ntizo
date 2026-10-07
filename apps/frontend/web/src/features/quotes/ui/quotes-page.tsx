import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { FileQuestion } from "lucide-react";
import { Button, buttonVariants } from "@ntizo/frontend-ui";
import { CUSTOMER_QUOTE_TABS, type CustomerQuoteTab } from "@ntizo/shared";
import { CollectionCard } from "@/shared/components/collection-card";
import {
  DETAILS_BUTTON_CLASS,
  TwoLineCell,
} from "@/shared/components/list-cells";
import { StatusTabs } from "@/shared/components/status-tabs";
import { CustomerPageHeading } from "@/features/account/ui/customer-page";
import { formatMoney } from "@/features/wallet/domain/money";
import { QUOTES_PAGE_SIZE } from "@/features/quotes/domain/status";
import {
  useMyQuotes,
  type CustomerQuoteDTO,
  type CustomerQuotePageDTO,
} from "@/features/quotes/viewmodel/use-my-quotes";
import { QuoteStatusLine } from "./quote-status";

/**
 * The customer's own quotes, one tab at a time.
 *
 * Follows `bookings/ui/bookings-page.tsx` step for step — the tabs, the
 * reset-during-render on a tab switch, the accumulating `loaded`/`page` pair,
 * one `CollectionCard`, no search box (a client-side filter over a paged list
 * would tell a customer "no matches" about a quote sitting on the next page).
 * Three things differ, and only three:
 *
 * 1. **The pager is `hasMore`, not `nextOffset`.** `quoteMine` never returns
 *    a cursor to jump back to, only whether another page exists; "Mais"
 *    still only ever *extends* the list, exactly as bookings' own does.
 * 2. **There is no `total` on the wire.** The card's own header count comes
 *    from the tab's own `counts[tab]` instead — an honest total for *this*
 *    tab, not a promise about the other one.
 * 3. **One clock for every row on screen**, taken from the moment the page
 *    answered rather than from whenever React last rendered — see
 *    `bookings-page.tsx`'s identical `now`.
 */
export function QuotesPage() {
  const { t, i18n } = useTranslation("quotes");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { tab?: CustomerQuoteTab };
  const tab: CustomerQuoteTab = search.tab ?? CUSTOMER_QUOTE_TABS[0];

  const [offset, setOffset] = useState(0);
  /**
   * The rows on screen, and the last answer beside them — exactly as
   * `bookings-page.tsx` keeps them, for the reasons spelled out there.
   */
  const [loaded, setLoaded] = useState<CustomerQuoteDTO[]>([]);
  const [page, setPage] = useState<CustomerQuotePageDTO | null>(null);

  /**
   * Switching tab is a new list, and it is emptied **during the render that
   * switches it** rather than in an effect — see `bookings-page.tsx`'s
   * identical note for why a passive effect would draw the previous tab's
   * rows under the new tab's heading for a frame first.
   */
  const [appliedTab, setAppliedTab] = useState(tab);
  if (appliedTab !== tab) {
    setAppliedTab(tab);
    setOffset(0);
    setLoaded([]);
    setPage(null);
  }

  const query = useMyQuotes({ tab, offset });
  useEffect(() => {
    const answer = query.data;
    if (!answer) return;
    setPage(answer);
    setLoaded((current) => {
      if (offset === 0) return answer.items;
      const seen = new Set(current.map((q) => q.id));
      return [...current, ...answer.items.filter((q) => !seen.has(q.id))];
    });
  }, [query.data, offset]);

  // The answer the counts and the pager are read off: the one in hand,
  // falling back to the previous page while the next is in flight, so
  // neither blinks out for the length of a request meant to extend the list.
  const answered = query.data ?? page;
  const total = answered?.counts[tab] ?? 0;
  const canLoadMore = answered?.hasMore === true;

  // Measured from the moment the page was answered, not from whenever React
  // last re-rendered — see `bookings-page.tsx`'s identical `now`.
  const now = useMemo(
    () => new Date(query.dataUpdatedAt || Date.now()),
    [query.dataUpdatedAt],
  );

  const setTab = (next: CustomerQuoteTab) =>
    void navigate({ to: "/quotes", search: { tab: next } });

  // At offset zero the answer *is* the list, read straight through rather
  // than waited for — see `bookings-page.tsx`'s identical note. From the
  // second page on, `loaded` is the only thing that remembers the rows above
  // the one the server has just sent.
  const items = offset === 0 ? (query.data?.items ?? []) : loaded;

  return (
    <div className="w-full max-w-[1400px]">
      <CustomerPageHeading title={t("list.title")} subtitle={t("list.blurb")} />

      {query.isError && (
        <p
          role="alert"
          className="type-body mt-4 text-[var(--color-destructive)]"
        >
          {t("list.loadError")}
        </p>
      )}

      <div className="mt-[30px]">
        <CollectionCard
          tabs={
            // The bookings list's tab row; `quoteMine` counts every tab.
            <div className="w-full [contain:inline-size]">
              {/* `contain` so the row is measured by the card, not by its boxes:
                  `CollectionCard` sizes its toolbar to its widest child, and three
                  boxes wider than a phone pushed the whole page sideways. Inside
                  the card's width they scroll, as `StatusTabs` means them to. */}
              <StatusTabs
                tabs={CUSTOMER_QUOTE_TABS.map((key) => ({
                  key,
                  label: t(`list.tab.${key}`),
                  count: answered ? answered.counts[key] : null,
                }))}
                value={tab}
                onChange={setTab}
                ariaLabel={t("list.title")}
              />
            </div>
          }
          title={t(`list.tab.${tab}`)}
          shown={items.length}
          total={total}
          loading={query.isLoading && offset === 0}
          columns={[
            { key: "service", label: t("list.column.service") },
            {
              key: "status",
              label: t("list.column.status"),
              skeletonWidth: "w-32",
              skeletonShape: "badge",
              hideOnCard: true,
            },
            {
              key: "price",
              label: t("list.column.price"),
              align: "right",
              skeletonWidth: "w-24",
              hideOnCard: true,
            },
            {
              key: "actions",
              label: "",
              className: "pr-6 text-right",
              hideOnCard: true,
            },
          ]}
          emptyTitle={t("list.emptyTitle")}
          emptyText={t("list.emptyText")}
          emptyBadge={FileQuestion}
          emptyAction={
            <Link to="/services" className={buttonVariants({ size: "sm" })}>
              {t("list.emptyAction")}
            </Link>
          }
          // Unreachable: with no search box and no filter button there is
          // nothing that could hide a row — see `bookings-page.tsx`'s
          // identical note.
          noMatchesText={t("list.emptyText")}
          filtered={false}
          rows={items.map((q) => {
            // Built once and read from both the table's cell and the card's
            // own line — the rule `cardBody` states for anyone using it.
            const priceNode = q.proposal ? (
              <span className="inline-flex flex-col items-end gap-0.5">
                <span className="text-lg font-bold whitespace-nowrap text-[var(--color-headline)] tabular-nums">
                  {formatMoney(
                    q.proposal.priceMinor,
                    q.proposal.currency,
                    locale,
                  )}
                </span>
                {/* A rejected quote's proposal is never superseded — the
                    write side leaves it live so this row can still show the
                    price the customer turned down, with the one line that
                    says they did. */}
                {q.status === "REJECTED" && (
                  <span className="type-caption text-[var(--color-muted-foreground)]">
                    {t("list.notAccepted")}
                  </span>
                )}
              </span>
            ) : (
              <span className="type-caption text-[var(--color-muted-foreground)]">
                {q.status === "REQUESTED"
                  ? t("list.noPriceYet")
                  : t("list.noProposal")}
              </span>
            );

            return {
              key: q.id,
              primary: (
                <TwoLineCell
                  title={
                    <Link
                      to="/quotes/$quoteId"
                      params={{ quoteId: q.id }}
                      className="hover:underline"
                    >
                      {q.serviceName}
                    </Link>
                  }
                  sub={q.providerName}
                />
              ),
              cells: {
                status: <QuoteStatusLine quote={q} side="customer" now={now} />,
                price: priceNode,
              },
              // The same three facts as the cells above, arranged for one
              // column instead of labelled in a list — see
              // `bookings-page.tsx`'s identical `cardBody` note: status and
              // its clock on one line, the price on its own underneath.
              cardBody: (
                <div className="grid gap-3">
                  <QuoteStatusLine quote={q} side="customer" now={now} />
                  <div className="text-right">{priceNode}</div>
                </div>
              ),
              // The provider lists' row action: the title's own link again,
              // where the mockups put the row's way in — so out of the tab
              // order and the accessibility tree, or every row is met twice.
              // Table only: on the phone the whole title is the target.
              actions: (
                <Link
                  to="/quotes/$quoteId"
                  params={{ quoteId: q.id }}
                  className={`${DETAILS_BUTTON_CLASS} hidden md:inline-flex`}
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  {t("common:viewDetails")}
                </Link>
              ),
            };
          })}
        />
      </div>

      {answered && canLoadMore && (
        <div className="mt-4 flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={query.isFetching}
            onClick={() => setOffset(offset + QUOTES_PAGE_SIZE)}
          >
            {t("list.more")}
          </Button>
        </div>
      )}
    </div>
  );
}
