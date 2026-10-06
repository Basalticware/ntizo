import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, Banknote, Coins, LockKeyhole, Wallet as WalletIcon } from "lucide-react";
import { Button, Skeleton, cn } from "@ntizo/frontend-ui";
import type { WalletEntryDTO } from "@ntizo/shared/read-models";
import { EmptyCard } from "@/shared/components/empty-card";
import { shortDate } from "@/shared/lib/relative-day";
import { useWallet } from "../viewmodel/use-wallet";
import {
  formatMoneyShort,
  movedNothing,
  movementMinor,
  movementTone,
} from "../domain/money";

/**
 * A workspace's money: the two balances, and the entries behind them.
 *
 * One component for both zones. What the provider sees on their own wallet and
 * what an administrator sees looking at theirs is the same thing — the money
 * does not change depending on who reads it — and building two would be two
 * places for the same currency formatting to drift.
 *
 * Two balances rather than one total, because they answer different questions.
 * "Available" is what can be withdrawn today. "Pending" is earned and held —
 * a completed booking that has not passed its hold period. Adding them would
 * produce a number that is true of nothing: not what is owed, not what can be
 * taken out.
 *
 * Drawn as the October mockup's Carteira: the balances on tiles with their
 * glyphs, the ledger as a table — date, a glyph for which way the money
 * went, what it was, the booking it belongs to, the amount. Two things of the
 * mockup are not drawn because nothing provides them: "Levantar fundos" (no
 * withdrawal exists to start) and the "Estado" column (a ledger entry is a
 * fact that happened, it has no state). Its search and filter are left out
 * too: the ledger is paged and the server takes neither.
 */
export function WalletPanel({
  providerId,
  /** Fewer rows and no heading, for a detail page that has its own. */
  compact = false,
  /**
   * Which half to draw.
   *
   * The balance and the ledger answer different questions with different
   * urgencies, and on the administrator's file they belong in different
   * places. How much a business holds is a fact about it and sits with its
   * name; why it holds that is a list, and a list between a reviewer and the
   * decision they came to make is a list in the way.
   */
  show = "all",
}: {
  providerId: string | undefined;
  compact?: boolean;
  show?: "all" | "balances" | "history";
}) {
  const { t, i18n } = useTranslation("provider");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const query = useWallet(providerId);

  const first = query.data?.pages[0];
  const wallet = first?.wallet;
  const entries = query.data?.pages.flatMap((p) => p.entries) ?? [];
  const money = (minor: number) => formatMoneyShort(minor, wallet?.currency ?? "MZN", locale);

  return (
    <div className="grid gap-6">
      {show !== "history" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,632fr)_minmax(0,624fr)]">
          <BalanceCard
            icon={Coins}
            label={t("walletAvailable")}
            hint={t("walletAvailableHint")}
            loading={query.isLoading}
            value={wallet ? money(wallet.availableMinor) : null}
            emphasis
          />
          <BalanceCard
            icon={LockKeyhole}
            label={t("walletPending")}
            hint={t("walletPendingHint")}
            loading={query.isLoading}
            value={wallet ? money(wallet.pendingMinor) : null}
          />
        </div>
      )}

      {show !== "balances" && (
        <div className="overflow-hidden rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card)]">
          {!compact && (
            <div className="px-5 pt-[26px] pb-[22px] sm:px-[26px]">
              <h2 className="m-0 text-[23.5px] font-bold text-[var(--color-headline)]">{t("walletHistory")}</h2>
              <p className="mt-1 text-base text-[var(--color-muted-foreground)] md:text-[17.7px]">
                {t("walletHistoryHint")}
              </p>
            </div>
          )}

          {query.isLoading ? (
            <ul className="m-0 grid list-none gap-0 p-0">
              {Array.from({ length: compact ? 3 : 5 }, (_, i) => (
                <li key={i} className="flex items-center gap-6 border-t border-[var(--color-line-2)] px-5 py-4 sm:px-8">
                  <Skeleton className="h-[38px] w-24" />
                  <Skeleton className="h-[43px] w-[43px] rounded-[10px]" />
                  <div className="grid flex-1 gap-1.5">
                    <Skeleton className="h-[17px] w-44" />
                    <Skeleton className="h-[15px] w-64 max-w-full" />
                  </div>
                  <Skeleton className="h-[19px] w-24" />
                </li>
              ))}
            </ul>
          ) : entries.length === 0 ? (
            // Said plainly rather than dressed up. Nothing writes ledger entries
            // yet — payments are not built — and an empty state that implied the
            // provider had simply earned nothing would be a different claim.
            <EmptyCard badge={WalletIcon} title={t("walletEmptyTitle")} body={t("walletEmpty")} compact={compact} />
          ) : (
            <div role="table" aria-label={t("walletHistory")}>
              <div
                role="row"
                className={cn(
                  LEDGER_GRID,
                  "hidden h-10 items-center border-t border-[var(--color-line-2)] bg-[var(--color-thead)] text-[13px] font-semibold tracking-[0.05em] text-[var(--color-ink-2)] uppercase md:grid",
                )}
              >
                <span role="columnheader" className="pl-8">{t("walletColDate")}</span>
                <span role="columnheader" aria-label={t("walletColKind")} />
                <span role="columnheader">{t("walletColDescription")}</span>
                <span role="columnheader">{t("walletColReference")}</span>
                <span role="columnheader" className="pr-8 text-right">{t("walletColAmount")}</span>
              </div>
              {entries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  locale={locale}
                  money={money}
                  typeLabel={t(`walletType.${entry.type}`, { defaultValue: entry.type })}
                  balanceLabel={(amount) => t("walletBalanceAfter", { amount })}
                />
              ))}
            </div>
          )}

          {query.hasNextPage && !compact && (
            <div className="flex justify-center border-t border-[var(--color-line-2)] p-4">
              <Button
                type="button"
                variant="outline"
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                {t("walletLoadMore")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The ledger's five columns, as fractions of the mockup's widths so a narrow detail page keeps them in proportion. */
const LEDGER_GRID =
  "md:grid md:grid-cols-[minmax(120px,187fr)_minmax(56px,73fr)_minmax(0,419fr)_minmax(0,206fr)_minmax(110px,227fr)]";

function BalanceCard({
  icon: Icon,
  label,
  hint,
  value,
  loading,
  emphasis,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  value: string | null;
  loading: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="flex min-h-[125px] items-start gap-[37px] rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card)] py-6 pr-6 pl-[26px]">
      <span className="grid h-[58px] w-[59px] shrink-0 place-items-center rounded-xl bg-[#e5f3fe] text-[#0051fe] dark:bg-[var(--color-info-bg)] dark:text-[var(--color-primary)]">
        <Icon className="h-7 w-7" />
      </span>
      <div className="min-w-0">
        <p className="m-0 text-[13.5px] font-semibold tracking-[0.08em] text-[var(--color-ink-2)] uppercase">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-[40px] w-40" />
        ) : (
          <p
            className={cn(
              "m-0 font-extrabold tracking-[-0.01em] whitespace-nowrap text-[var(--color-headline)] tabular-nums",
              emphasis ? "text-[33px] leading-[1.2]" : "text-[30px] leading-[1.25]",
            )}
          >
            {value}
          </p>
        )}
        <p className={cn("m-0 mt-0.5 text-[var(--color-muted-foreground)]", emphasis ? "text-[15px]" : "text-sm")}>
          {hint}
        </p>
      </div>
    </div>
  );
}

const TONE_TILE: Record<"up" | "down" | "flat", string> = {
  up: "bg-[#defbe4] text-[#02a91a] dark:bg-[var(--color-ok-bg)] dark:text-[var(--color-ok-fg)]",
  down: "bg-[#fef0ce] text-[#fcab00] dark:bg-[var(--color-warn-bg)] dark:text-[var(--color-warn-fg)]",
  flat: "bg-[#e3f2fe] text-[#0058fd] dark:bg-[var(--color-info-bg)] dark:text-[var(--color-primary)]",
};

/** One line of the ledger: when, which way, what it was, the booking behind it, and what it moved. */
function EntryRow({
  entry,
  locale,
  money,
  typeLabel,
  balanceLabel,
}: {
  entry: WalletEntryDTO;
  locale: string;
  money: (minor: number) => string;
  typeLabel: string;
  balanceLabel: (amount: string) => string;
}) {
  // A hold or a release moves the pending side only; the available side
  // reads zero for it, and "− 0 MTn" would say nothing happened.
  const pendingOnly = entry.availableDeltaMinor === 0 && entry.pendingDeltaMinor !== 0;
  const tone = pendingOnly ? "flat" : movementTone(entry);
  const at = new Date(entry.createdAt);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const day = shortDate(entry.createdAt, zone, locale, { year: true });
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(at);
  const Glyph = pendingOnly ? LockKeyhole : tone === "up" ? ArrowDown : tone === "down" ? ArrowUp : Banknote;
  const description = entry.description?.trim() || null;

  return (
    <div
      role="row"
      className={cn(
        LEDGER_GRID,
        "grid grid-cols-[43px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-t border-[var(--color-line-2)] px-5 py-[18px] md:min-h-[77px] md:gap-x-0 md:px-0 md:py-3",
      )}
    >
      <span role="cell" className="order-4 col-span-3 text-[13px] text-[var(--color-muted-foreground)] md:order-none md:col-span-1 md:pl-8">
        <b className="block text-sm font-medium text-[var(--color-headline)] max-md:inline">{day}</b>
        <span className="mt-1 block text-sm max-md:ml-2 max-md:inline">{time}</span>
      </span>
      <span role="cell" className="md:order-none">
        <span className={cn("grid h-[43px] w-[43px] place-items-center rounded-[10px]", TONE_TILE[tone])}>
          <Glyph aria-hidden="true" className="h-5 w-5" strokeWidth={2.6} />
        </span>
      </span>
      <span role="cell" className="min-w-0 md:pl-0.5">
        <b className="mb-0.5 block truncate text-[14.4px] font-bold text-[var(--color-headline)]">{typeLabel}</b>
        {description && (
          <span className="block text-[13px] leading-[1.45] text-[var(--color-muted-foreground)]">{description}</span>
        )}
      </span>
      <span role="cell" className="hidden text-[13.6px] text-[var(--color-muted-foreground)] md:block">
        {entry.bookingId ? entry.bookingId.slice(0, 8).toUpperCase() : "—"}
      </span>
      <span role="cell" className="text-right md:pr-8">
        {/* An entry that moved nothing shows its amount without a sign. Cash
            settled outside the platform is the case: "+0 MTn" beside a
            1 500 MTn job reads as a bug, and the amount alone is what
            happened. */}
        <span
          className={cn(
            "block text-lg font-bold whitespace-nowrap tabular-nums",
            tone === "up" && "text-[#069f12] dark:text-[var(--color-ok-fg)]",
            tone === "down" && "text-[#f80a0a] dark:text-[var(--color-bad-fg)]",
            tone === "flat" && "text-[var(--color-headline)]",
          )}
        >
          {movedNothing(entry)
            ? money(entry.amountMinor)
            : pendingOnly
              ? `${entry.pendingDeltaMinor > 0 ? "+ " : "− "}${money(Math.abs(entry.pendingDeltaMinor))}`
              : `${movementMinor(entry) > 0 ? "+ " : "− "}${money(Math.abs(movementMinor(entry)))}`}
        </span>
        <span className="block text-[13px] whitespace-nowrap text-[var(--color-muted-foreground)] tabular-nums">
          {balanceLabel(money(entry.balanceAfterMinor))}
        </span>
      </span>
    </div>
  );
}
