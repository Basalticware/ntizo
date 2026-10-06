import { Link } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { Badge, cn } from "@ntizo/frontend-ui";
import type { QuoteStatus } from "@ntizo/shared";
import type {
  CollectionColumn,
  CollectionRow,
} from "@/shared/components/collection-card";
import { DETAILS_BUTTON_CLASS, PersonCell, WhenCell } from "@/shared/components/list-cells";
import { relativeDayLabel, shortDate } from "@/shared/lib/relative-day";
import { formatMoneyShort } from "@/features/wallet/domain/money";
import { payoutMinorOf } from "@/features/quotes/domain/money-split";
import { canPropose, clockOf, coarseDuration } from "@/features/quotes/domain/status";
import type { ProviderQuoteDTO } from "../viewmodel/use-provider-quotes";

/**
 * The queue's columns, in the mockup's order. Pure functions rather than
 * components, for the reasons `bookingColumns` gives: a row is data the card
 * can lay out two ways rather than a `<tr>` it is stuck with.
 */
export function quoteColumns(t: TFunction<"quotes">): CollectionColumn[] {
  return [
    { key: "customer", label: t("provider.column.customer"), className: "w-[250px] pl-5" },
    { key: "service", label: t("provider.column.service"), skeletonWidth: "w-32", className: "w-[167px]" },
    { key: "description", label: t("provider.column.description"), skeletonWidth: "w-48", className: "w-[257px]" },
    { key: "deadline", label: t("provider.column.deadline"), skeletonWidth: "w-24", className: "w-[149px]" },
    { key: "price", label: t("provider.column.price"), skeletonWidth: "w-20", className: "w-[144px]" },
    {
      key: "status",
      label: t("provider.column.status"),
      skeletonWidth: "w-28",
      skeletonShape: "badge",
      className: "w-[151px]",
    },
    { key: "actions", label: t("common:colActions"), className: "pr-5", hideOnCard: true },
  ];
}

/** The pill's colour, from the provider's side: whose turn it is. */
const STATUS_TONE: Record<QuoteStatus, "warning" | "info" | "success" | "danger" | "neutral"> = {
  REQUESTED: "warning",
  PROPOSED: "info",
  ACCEPTED: "success",
  DECLINED: "danger",
  REJECTED: "danger",
  WITHDRAWN: "neutral",
  EXPIRED: "danger",
};

/**
 * One row of the queue.
 *
 * `primary` is the customer, and their name is the row's way in — the same
 * link "Responder" / "Ver detalhes" draws at the end. The "Prazo" column is the
 * one clock that matters to the provider on that row: the time left to answer
 * while it is theirs, the proposal's validity while it is the customer's, and
 * when it lapsed once it has.
 */
export function quoteRow(
  q: ProviderQuoteDTO,
  ctx: {
    slug: string;
    locale: string;
    now: Date;
    t: TFunction<"quotes">;
    /**
     * The workspace's own rate, read by the page from the console shell's
     * provider detail — not on `ProviderQuoteDTO`, only on the detail. While
     * it has not loaded yet, the "recebe" line is omitted rather than
     * guessed at.
     */
    commissionBps: number | undefined;
  },
): CollectionRow {
  const { slug, locale, now, t, commissionBps } = ctx;
  const href = { to: "/provider/$slug/quotes/$quoteId", params: { slug, quoteId: q.id } } as const;
  const place = [q.addressDistrict, q.addressCity].filter(Boolean).join(", ");
  const answer = q.status === "REQUESTED" && canPropose(q);

  return {
    key: q.id,
    primary: (
      <PersonCell
        name={q.customerFirstName}
        place={place || null}
        title={
          <Link {...href} className="hover:underline">
            {q.customerFirstName}
          </Link>
        }
      />
    ),
    cells: {
      service: (
        <span className="line-clamp-2 text-[15px] leading-[22px] font-semibold text-[var(--color-headline)]">
          {q.serviceName}
        </span>
      ),
      description: (
        <span className="line-clamp-3 pr-3.5 text-sm leading-[21px] text-[var(--color-muted-foreground)]">
          {q.descriptionSnippet}
        </span>
      ),
      deadline: deadlineCell(q, { locale, now, t }),
      price: q.proposal ? (
        <span className="inline-flex flex-col items-start gap-0.5">
          <span className="text-lg font-bold whitespace-nowrap text-[var(--color-headline)] tabular-nums">
            {formatMoneyShort(q.proposal.priceMinor, q.proposal.currency, locale)}
          </span>
          {commissionBps !== undefined && (
            <span className="text-[13px] whitespace-nowrap text-[var(--color-muted-foreground)] tabular-nums">
              {t("provider.receives", {
                amount: formatMoneyShort(
                  payoutMinorOf(q.proposal.priceMinor, commissionBps),
                  q.proposal.currency,
                  locale,
                ),
              })}
            </span>
          )}
        </span>
      ) : (
        <span aria-hidden="true" className="ml-1 block h-[1.6px] w-[13px] bg-[var(--color-ink-2)]" />
      ),
      status: <Badge tone={STATUS_TONE[q.status]}>{t(`status.provider.${q.status}`)}</Badge>,
    },
    actions: (
      <Link
        {...href}
        tabIndex={-1}
        className={cn(
          DETAILS_BUTTON_CLASS,
          "w-[137px] border-[var(--color-primary)] px-0",
          answer &&
            "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-deep)]",
        )}
      >
        {answer ? t("provider.answer") : t("common:viewDetails")}
      </Link>
    ),
  };
}

/**
 * "Hoje / até 18:00", "15 Out / daqui a 3 dias", "09 Out / Expirou" — the
 * day the clock runs out on, and how it stands. A row whose clock has
 * stopped for good (accepted, refused, withdrawn) has no deadline left to
 * show and draws a dash.
 */
function deadlineCell(
  q: ProviderQuoteDTO,
  ctx: { locale: string; now: Date; t: TFunction<"quotes"> },
) {
  const { locale, now, t } = ctx;
  const clock = clockOf(q);
  const at =
    clock.kind === "respondBy" || clock.kind === "decideBy" || clock.kind === "expired" ? clock.at : null;
  if (!at) return <span aria-hidden="true" className="ml-1 block h-[1.6px] w-[13px] bg-[var(--color-ink-2)]" />;

  const day = relativeDayLabel(at, q.timezone, now, locale);
  const near = day !== shortDate(at, q.timezone, locale, { year: true });
  const left = coarseDuration(new Date(at).getTime() - now.getTime());
  const sub =
    clock.kind === "expired" || left === null
      ? t("provider.deadlinePassed")
      : near
        ? t("provider.deadlineUntil", {
            time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: q.timezone }).format(
              new Date(at),
            ),
          })
        : t("provider.deadlineIn", { left: t(`unit.${left.unit}`, { count: left.count }) });
  return (
    <WhenCell
      day={near ? day : shortDate(at, q.timezone, locale)}
      time={
        <span className={cn("whitespace-nowrap", (clock.kind === "expired" || left === null) && "text-[var(--color-bad-fg)]")}>{sub}</span>
      }
    />
  );
}
