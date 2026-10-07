import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Calendar, CirclePlus, Wallet } from "lucide-react";
import { Avatar, AvatarFallback, Skeleton, cn } from "@ntizo/frontend-ui";
import { initialsFrom } from "@/shared/lib/initials";
import { useProviderThreads } from "@/features/messaging/viewmodel/use-provider-threads";
import { lastMessageWhen } from "@/features/messaging/viewmodel/when";
import { useWallet } from "@/features/wallet/viewmodel/use-wallet";
import { formatMoneyShort } from "@/features/wallet/domain/money";
import { useAvailabilityConfig } from "../availability/viewmodel/use-availability";
import { nowInZone } from "../availability/domain/clock";
import { mergeWeeks, previewWeek } from "../availability/domain/preview";
import { minutesToLabel } from "../availability/domain/week";
import { MORE_LINK } from "./overview-link";

/** How many conversations the side card lists — the mockup's three. */
const THREADS_SHOWN = 3;

/** The frame every side card shares: a heading, its "→" link, and the body. */
function SideCard({ title, link, children }: { title: string; link: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] pt-[22px] pr-[17px] pb-6 pl-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] leading-[1.1] font-extrabold text-[var(--color-headline)]">{title}</h2>
        {link}
      </div>
      {children}
    </section>
  );
}

function Tile({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "grid h-[45px] w-[45px] shrink-0 place-items-center rounded-[10px] bg-[var(--color-blue-softer)] text-[var(--color-primary)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Today's working hours, as the availability screen computes them — the same
 * `previewWeek` the configurator draws, for every member, merged: when the
 * business can be booked at all today. Resolved on the workspace's own
 * calendar, not the reader's laptop's.
 *
 * Drawn only once the configuration has loaded. A member without the right to
 * read it gets no card rather than one that says "unavailable" about a day
 * they simply cannot see.
 */
export function AvailabilityTodayCard({
  providerId,
  slug,
  locale,
}: {
  providerId: string;
  slug: string;
  locale: string;
}) {
  const { t } = useTranslation("provider");
  const config = useAvailabilityConfig(providerId);
  if (!config.data) return null;

  const zoned = nowInZone(config.data.timezone);
  const today = zoned?.date ?? new Date().toISOString().slice(0, 10);
  const day = mergeWeeks(
    config.data.members.map((m) =>
      previewWeek({ dates: [today], weekly: m.weekly, exceptions: m.exceptions, closures: config.data.closures }),
    ),
  )[0];
  const intervals = day?.intervals ?? [];
  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${today}T12:00:00Z`));
  const edit = { to: "/provider/$slug/availability", params: { slug } } as const;

  return (
    <SideCard
      title={t("overview.availabilityTitle")}
      link={
        <Link {...edit} className={MORE_LINK}>
          {t("overview.availabilityEdit")}
          <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
        </Link>
      }
    >
      <div className="mt-4 flex items-center gap-3.5">
        <Tile>
          <Calendar className="h-[22px] w-[22px]" />
        </Tile>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--color-headline)]">
            {dateLabel.charAt(0).toLocaleUpperCase(locale) + dateLabel.slice(1)}
          </p>
          <p className="mt-1.5 flex items-center text-sm">
            {intervals.length > 0 ? (
              <>
                <span className="flex h-[18px] items-center gap-1.5 border-r border-[var(--color-border)] pr-3.5 text-[var(--color-ok-fg)]">
                  <i aria-hidden="true" className="h-2 w-2 rounded-full bg-[var(--color-ok-fg)]" />
                  {t("overview.available")}
                </span>
                <span className="pl-3.5 text-[var(--color-ink-2)] tabular-nums">
                  {intervals.map((i) => `${minutesToLabel(i.start)} – ${minutesToLabel(i.end)}`).join(", ")}
                </span>
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-[var(--color-muted-foreground)]">
                <i aria-hidden="true" className="h-2 w-2 rounded-full bg-[var(--color-faint)]" />
                {t("overview.unavailable")}
              </span>
            )}
          </p>
        </div>
      </div>
      {/* The availability screen is where a period is closed — its closures panel. */}
      <Link
        {...edit}
        className="mt-4 flex h-10 items-center justify-center gap-[11px] rounded-[7px] bg-[var(--color-primary)] text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-deep)]"
      >
        <CirclePlus aria-hidden="true" className="h-[18px] w-[18px]" />
        {t("overview.blockPeriod")}
      </Link>
    </SideCard>
  );
}

/** The three newest conversations, the customer named on each, and a dot on the unread. */
export function MessagesCard({
  providerId,
  slug,
  locale,
}: {
  providerId: string;
  slug: string;
  locale: string;
}) {
  const { t } = useTranslation("provider");
  const { threads, loading } = useProviderThreads(providerId);
  const shown = threads.slice(0, THREADS_SHOWN);
  const now = new Date();

  return (
    <SideCard
      title={t("overview.messagesTitle")}
      link={
        <Link to="/provider/$slug/messages" params={{ slug }} className={MORE_LINK}>
          {t("overview.messagesAll")}
          <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
        </Link>
      }
    >
      {loading ? (
        <div className="mt-3.5 grid gap-3">
          {Array.from({ length: THREADS_SHOWN }, (_, i) => (
            <div key={i} className="flex items-center gap-[15px]">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="grid flex-1 gap-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3.5 w-44 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="mt-3.5 text-sm text-[var(--color-muted-foreground)]">{t("overview.messagesEmpty")}</p>
      ) : (
        <ul className="m-0 mt-3.5 grid list-none gap-3 p-0">
          {shown.map((thread) => {
            const name = thread.support ? thread.support.subject : thread.customerName;
            const when = lastMessageWhen(thread.lastMessageAt, now, locale);
            return (
              <li key={thread.id}>
                <Link
                  to="/provider/$slug/messages"
                  params={{ slug }}
                  search={{ thread: thread.id }}
                  className="relative grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-[15px]"
                >
                  <Avatar className="h-11 w-11">
                    <AvatarFallback className="bg-[var(--color-info-bg)] text-[13px] font-semibold text-[var(--color-primary)]">
                      {initialsFrom(name || "?")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0">
                    <b className="block truncate text-sm font-bold text-[var(--color-headline)]">{name}</b>
                    <span className="mt-[3px] block truncate text-[13px] text-[var(--color-muted-foreground)]">
                      {thread.lastMessagePreview}
                    </span>
                  </span>
                  <time
                    dateTime={thread.lastMessageAt}
                    className={cn(
                      "mt-[3px] self-start text-[13px] text-[var(--color-muted-foreground)]",
                      thread.unreadCount > 0 && "mr-3.5",
                    )}
                  >
                    {when}
                  </time>
                  {thread.unreadCount > 0 && (
                    <i
                      aria-label={t("overview.messagesUnread", { count: thread.unreadCount })}
                      className="absolute top-[22px] -right-1 h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SideCard>
  );
}

/**
 * What can be taken out today — the wallet's "available" balance, and the
 * way to the ledger. No "Levantar fundos": the platform has no withdrawal to
 * start yet, and a button that leads nowhere is a promise.
 */
export function WalletCard({
  providerId,
  slug,
  locale,
}: {
  providerId: string;
  slug: string;
  locale: string;
}) {
  const { t } = useTranslation("provider");
  const query = useWallet(providerId);
  const wallet = query.data?.pages[0]?.wallet;

  return (
    <SideCard
      title={t("overview.walletTitle")}
      link={
        <Link to="/provider/$slug/wallet" params={{ slug }} className={MORE_LINK}>
          {t("overview.walletAll")}
          <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
        </Link>
      }
    >
      <div className="mt-4 flex items-center gap-3.5">
        <Tile className="h-[41px] w-[41px]">
          <Wallet className="h-[22px] w-[22px]" />
        </Tile>
        <div>
          {query.isLoading ? (
            <Skeleton className="h-6 w-28" />
          ) : (
            <p className="text-[18.5px] font-extrabold whitespace-nowrap text-[var(--color-headline)] tabular-nums">
              {wallet ? formatMoneyShort(wallet.availableMinor, wallet.currency, locale) : "—"}
            </p>
          )}
          <p className="mt-[3px] text-[13px] text-[var(--color-muted-foreground)]">{t("overview.walletAvailable")}</p>
        </div>
      </div>
    </SideCard>
  );
}
