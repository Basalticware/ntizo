import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { FileQuestion } from "lucide-react";
import { Button, cn } from "@ntizo/frontend-ui";
import { PROVIDER_QUOTE_TABS, type ProviderQuoteTab } from "@ntizo/shared";
import { CollectionCard } from "@/shared/components/collection-card";
import { usePageHeader } from "@/shared/lib/page-header";
import { useActiveProvider } from "@/features/provider/viewmodel/use-active-provider";
import { useProviderDetail } from "@/features/provider/viewmodel/use-providers";
import { QUOTES_PAGE_SIZE } from "@/features/quotes/domain/status";
import {
  useProviderQuotes,
  type ProviderQuoteDTO,
  type ProviderQuotePageDTO,
} from "../viewmodel/use-provider-quotes";
import { quoteColumns, quoteRow } from "./quote-row";

/**
 * The workspace's quote queue, one tab at a time — the page the sidebar's
 * amber badge points at.
 *
 * Follows `provider/bookings/ui/bookings-page.tsx` step for step: the tab
 * from `useSearch`, the render-time reset keyed on `` `${providerId}|${tab}` ``,
 * the accumulating `loaded`/`page` pair, one `now`. Three things differ:
 *
 * 1. **The pager is `hasMore`, not `nextOffset`**, and the header count comes
 *    from `counts[tab]` rather than a wire `total` — the same two
 *    differences the customer's own `quotes-page.tsx` carries against the
 *    same booking-page original, for the same reason: `quoteForProvider`
 *    never returns a cursor or a total, only whether another page exists.
 * 2. **Three visible tabs, not a filter sheet.** The queue is three tabs and
 *    at most a page or two — nothing here to search or filter, so the tabs
 *    are drawn directly, the way the customer's `quotes-page.tsx` draws its
 *    own two.
 * 3. **The page draws its own heading** — the mockup's eyebrow over the
 *    title. The urgency the header used to spell out in a sentence is in
 *    the rows now: every request carries its own "Prazo".
 *
 * The mockup's search box and "Filtros" are left out: the server takes no
 * text to search by, and a filter over one page of a paged queue would say
 * "nothing found" about rows on the next.
 */
export function ProviderQuotesPage() {
  const { t, i18n } = useTranslation("quotes");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { activeProvider } = useActiveProvider();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { tab?: ProviderQuoteTab };
  const tab: ProviderQuoteTab = search.tab ?? PROVIDER_QUOTE_TABS[0];

  const providerId = activeProvider?.id ?? "";

  // The price cell's "recebe" line needs the workspace's own commission
  // rate, which lives on the provider *detail*, not on `ProviderQuoteDTO` —
  // see `quote-row.tsx`. `ConsoleShell`'s own strip already runs this exact
  // query on every console screen, so this call costs nothing extra: it is
  // the same cache entry, not a second request.
  const { data: providerDetail } = useProviderDetail(activeProvider?.id);
  const commissionBps = providerDetail?.commissionBps;

  const [offset, setOffset] = useState(0);
  /**
   * The rows on screen, and the last answer beside them — exactly as
   * `bookings-page.tsx` keeps them, for the reasons spelled out there.
   */
  const [loaded, setLoaded] = useState<ProviderQuoteDTO[]>([]);
  const [page, setPage] = useState<ProviderQuotePageDTO | null>(null);

  /**
   * Switching tab or workspace is a new list, emptied **during the render
   * that switches it** rather than in an effect — see `bookings-page.tsx`'s
   * identical note for why a passive effect would draw the previous tab's
   * rows under the new tab's heading for a frame first.
   */
  const filterKey = `${providerId}|${tab}`;
  const [appliedKey, setAppliedKey] = useState(filterKey);
  if (appliedKey !== filterKey) {
    setAppliedKey(filterKey);
    setOffset(0);
    setLoaded([]);
    setPage(null);
  }

  const query = useProviderQuotes({ providerId, tab, offset });
  useEffect(() => {
    const answer = query.data;
    if (!answer) return;
    setPage(answer);
    setLoaded((current) => {
      if (offset === 0) return answer.items;
      const seen = new Set(current.map((quote) => quote.id));
      return [...current, ...answer.items.filter((quote) => !seen.has(quote.id))];
    });
  }, [query.data, offset]);

  // The answer the count and the pager read off — the one in hand, falling
  // back to the previous page while the next is in flight, so neither blinks
  // out for the length of a request meant to extend the list.
  const answered = query.data ?? page;
  const total = answered?.counts[tab] ?? 0;
  const canLoadMore = answered?.hasMore === true;

  // Measured from the moment the page was answered, not from whenever React
  // last re-rendered — see `bookings-page.tsx`'s identical `now`.
  const now = useMemo(
    () => new Date(query.dataUpdatedAt || Date.now()),
    [query.dataUpdatedAt],
  );

  // At offset zero the answer *is* the list, read straight through rather
  // than waited for — see `bookings-page.tsx`'s identical note. From the
  // second page on, `loaded` is the only thing that remembers the rows above
  // the one the server has just sent.
  const items = offset === 0 ? (query.data?.items ?? []) : loaded;

  // The page draws its own heading, because the mockup puts an eyebrow over it.
  usePageHeader(t("provider.title"), t("provider.subtitle"), { ownHeading: true });

  if (!activeProvider) return null;
  const slug = activeProvider.slug;

  const setTab = (next: ProviderQuoteTab) =>
    void navigate({ to: "/provider/$slug/quotes", params: { slug }, search: { tab: next } });

  return (
    <div className="grid w-full max-w-[1400px] gap-4">
      {query.isError && (
        <p role="alert" className="type-body text-[var(--color-destructive)]">
          {t("provider.loadError")}
        </p>
      )}

      <div className="mb-6">
        <p className="text-[13px] font-semibold tracking-[0.09em] text-[var(--color-muted-foreground)] uppercase">
          {t("provider.eyebrow")}
        </p>
        <h1 className="font-display mt-[9px] text-[30px] leading-[1.05] font-extrabold tracking-[-0.02em] text-[var(--color-headline)] md:text-[47.6px]">
          {t("provider.heading")}
        </h1>
        <p className="mt-2.5 text-base text-[var(--color-muted-foreground)] md:text-[17.9px]">
          {t("provider.subtitle")}
        </p>
      </div>

      <CollectionCard
        title={t(`provider.tab.${tab}`)}
        tabs={
          <QuoteTabs
            ariaLabel={t("provider.title")}
            value={tab}
            onChange={setTab}
            counts={answered?.counts ?? null}
            label={(key) => t(`provider.tab.${key}`)}
          />
        }
        shown={items.length}
        total={total}
        loading={query.isLoading && offset === 0}
        columns={quoteColumns(t)}
        emptyTitle={t("provider.emptyTitle")}
        emptyText={t("provider.emptyText")}
        emptyBadge={FileQuestion}
        noMatchesTitle={t("provider.noMatchesTitle")}
        noMatchesText={t("provider.noMatchesText")}
        // Unreachable: no search box and no filter button, so nothing could
        // ever hide a row — see `quotes-page.tsx`'s (the customer's)
        // identical note.
        filtered={false}
        rows={items.map((quote) => quoteRow(quote, { slug, locale, now, t, commissionBps }))}
      />

      {answered && canLoadMore && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={query.isFetching}
            onClick={() => setOffset(offset + QUOTES_PAGE_SIZE)}
          >
            {t("provider.more")}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * The queue's three tabs as the mockup draws them: one bordered strip, the
 * chosen tab filled soft blue with its count on white. Every count is the
 * server's — `quoteForProvider` answers all three on every page.
 */
function QuoteTabs({
  value,
  onChange,
  counts,
  label,
  ariaLabel,
}: {
  value: ProviderQuoteTab;
  onChange: (key: ProviderQuoteTab) => void;
  counts: Record<ProviderQuoteTab, number> | null;
  label: (key: ProviderQuoteTab) => string;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex h-[49px] w-full max-w-full shrink-0 overflow-x-auto max-lg:[contain:inline-size] rounded-[10px] border border-[var(--color-border)] bg-[var(--color-card)] [scrollbar-width:none] lg:w-[726px]"
    >
      {PROVIDER_QUOTE_TABS.map((key, i) => {
        const selected = key === value;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(key)}
            className={cn(
              "relative flex shrink-0 items-center justify-center gap-[11px] px-6 text-base whitespace-nowrap lg:flex-1",
              selected
                ? "-my-px -ml-px rounded-[9px] bg-[var(--color-info-bg)] pl-10 font-semibold text-[var(--color-primary)] dark:bg-[var(--color-blue-soft)]"
                : "font-medium text-[var(--color-headline)] hover:text-[var(--color-primary)]",
              // A hairline between the two plain tabs; the chosen one is its own edge.
              !selected &&
                i > 0 &&
                PROVIDER_QUOTE_TABS[i - 1] !== value &&
                "before:absolute before:top-3 before:left-0 before:h-[26px] before:w-px before:bg-[var(--color-border)]",
            )}
          >
            {label(key)}
            {counts && (
              <span
                className={cn(
                  "grid h-[29px] min-w-[29px] place-items-center rounded-full px-1.5 text-[15px] font-semibold tabular-nums",
                  selected
                    ? "bg-[var(--color-card)] text-[var(--color-primary)]"
                    : "bg-[var(--color-blue-soft)] text-[var(--color-ink-2)] dark:bg-[var(--color-muted)]",
                )}
              >
                {counts[key]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
