import { useTranslation } from "react-i18next";
import { MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, Badge, Skeleton, cn } from "@ntizo/frontend-ui";
import { EmptyCard } from "@/shared/components/empty-card";
import { initialsFrom } from "@/shared/lib/initials";
import type { Thread } from "@/features/messaging/domain/types";
import { lastMessageWhen } from "@/features/messaging/viewmodel/when";

/**
 * A conversation list — a customer's own inbox (every provider they have
 * messaged) or a provider's own inbox (every customer who has messaged
 * them), newest last message first (the order `useThreads`/
 * `useProviderThreads` already hand back; this component does not re-sort).
 * `nameOf` decides which of a `Thread`'s two names each row labels itself
 * with — see that prop's own doc comment below.
 *
 * A dumb list, the same split `ActivityList` and `InboxList` make: this
 * component takes `threads` + `loading` as props rather than calling a query
 * hook itself, so the page rendering it (`customer-messages-page.tsx` or
 * `provider-messages-page.tsx`) is the one place that owns the query and
 * `selectedThreadId` can live beside it.
 *
 * The rows are the October mockup's: the person's monogram at 62px, their
 * name over the last line said, the time and the unread count in the corner,
 * and the open conversation on the soft blue ground. The mockup's presence
 * dot is not drawn — nothing knows who is online.
 */
export function ThreadList({
  threads,
  loading,
  selectedThreadId,
  onSelect,
  hasMore,
  onLoadMore,
  locale,
  emptyTitle,
  emptyBody,
  nameOf,
  fallbackName,
  heading = true,
  className,
}: {
  threads: readonly Thread[];
  loading: boolean;
  selectedThreadId: string | null;
  onSelect: (threadId: string) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  locale: string;
  /**
   * Overrides the empty-state copy. Defaults to the customer's own
   * ("start one from any provider's page…") — a provider's inbox means
   * something different by "no conversations yet" (nobody on this side
   * starts one; a customer does), so `provider-messages-page.tsx` passes
   * its own pair rather than reusing text that would be false for it.
   */
  emptyTitle?: string;
  emptyBody?: string;
  /**
   * Which of a `Thread`'s two names each row labels itself with. Defaults
   * to `providerName` — the customer's own inbox reading "who am I talking
   * to" off the provider side of the row. `provider-messages-page.tsx`
   * passes `(t) => t.customerName` instead: on that side `providerName` is
   * this *workspace's own* name, identical on every row (see `Thread`'s own
   * doc comment), so reusing the default would repeat the workspace's name
   * atop every conversation rather than say who it's with.
   */
  nameOf?: (thread: Thread) => string;
  /** The word shown in place of a name the lookup missed. Defaults to `t("unknownProvider")`, matching `nameOf`'s default. */
  fallbackName?: string;
  /** The "Conversas" caption over the rows. The console's inbox has tabs above it instead. */
  heading?: boolean;
  className?: string;
}) {
  const { t } = useTranslation("messaging");
  const resolvedNameOf = nameOf ?? ((thread: Thread) => thread.providerName);
  const resolvedFallbackName = fallbackName ?? t("unknownProvider");
  const now = new Date();

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-card)]",
        className,
      )}
    >
      {heading && (
        <div className="border-b border-[var(--color-border)] px-4 py-4 sm:px-5">
          <p className="type-caption font-bold tracking-[0.14em] text-[var(--color-muted-foreground)] uppercase">
            {t("listTitle")}
          </p>
        </div>
      )}

      <div className="flex-1">
        {loading ? (
          <ThreadListSkeleton />
        ) : threads.length === 0 ? (
          <EmptyCard
            badge={MessageSquare}
            title={emptyTitle ?? t("emptyTitle")}
            body={emptyBody ?? t("emptyBody")}
          />
        ) : (
          <ul className="m-0 grid list-none gap-0 px-[7px] py-5">
            {threads.map((thread, i) => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                selected={thread.id === selectedThreadId}
                // The hairline above a row, except where the chosen row's own
                // ground already marks the edge.
                divided={i > 0 && thread.id !== selectedThreadId && threads[i - 1]!.id !== selectedThreadId}
                when={lastMessageWhen(thread.lastMessageAt, now, locale)}
                onSelect={onSelect}
                name={resolvedNameOf(thread) || resolvedFallbackName}
              />
            ))}
          </ul>
        )}
      </div>

      {!loading && hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          className="type-body-medium w-full border-t border-[var(--color-border)] px-4 py-3 text-center text-[var(--color-primary)] hover:bg-[var(--color-secondary)] sm:px-5"
        >
          {t("loadMore")}
        </button>
      )}
    </div>
  );
}

function ThreadRow({
  thread,
  selected,
  divided,
  when,
  onSelect,
  name,
}: {
  thread: Thread;
  selected: boolean;
  divided: boolean;
  when: string;
  onSelect: (threadId: string) => void;
  /** Already resolved (which field, and the fallback) by `ThreadList` — this component draws it, it does not decide it. */
  name: string;
}) {
  const { t } = useTranslation("messaging");
  const unread = thread.unreadCount > 0;

  return (
    <li className="relative">
      {divided && (
        <span aria-hidden="true" className="absolute top-0 right-[18px] left-[105px] h-px bg-[var(--color-line-2)]" />
      )}
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        onClick={() => onSelect(thread.id)}
        className={cn(
          "relative flex min-h-[85px] w-full items-center rounded-xl py-3 pr-[21px] pl-[22px] text-left transition-colors",
          selected ? "bg-[var(--color-blue-soft)]" : "hover:bg-[var(--color-muted)]",
        )}
      >
        <Avatar className="h-[62px] w-[62px] shrink-0">
          <AvatarFallback className="bg-[var(--color-info-bg)] text-base font-semibold text-[var(--color-primary)]">
            {thread.support ? <MessageSquare aria-hidden="true" className="h-6 w-6" /> : initialsFrom(name)}
          </AvatarFallback>
        </Avatar>

        <span className="ml-[21px] min-w-0 flex-1 pr-[58px]">
          {thread.support ? (
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate text-[17px] font-bold text-[var(--color-headline)]">{thread.support.subject}</span>
              <span className="type-caption shrink-0 text-[var(--color-muted-foreground)]">{t("supportSender")}</span>
              <Badge tone={thread.support.status === "open" ? "info" : "neutral"} className="h-6 px-2.5 text-xs">
                {t(`supportStatus.${thread.support.status}`)}
              </Badge>
            </span>
          ) : (
            <span className="block truncate text-[17px] font-bold text-[var(--color-headline)]">{name}</span>
          )}
          <span
            className={cn(
              "mt-[7px] block truncate text-sm text-[var(--color-muted-foreground)]",
              unread && "font-medium text-[var(--color-ink-2)]",
            )}
          >
            {thread.lastMessagePreview ||
              (thread.lastMessageHasAttachment ? t("attachmentPreview") : t("noPreview"))}
          </span>
        </span>

        <span className="absolute top-[18px] right-[21px] text-right text-[14.5px] text-[var(--color-muted-foreground)]">
          <time dateTime={thread.lastMessageAt}>{when}</time>
          {unread && (
            <span
              aria-label={t("unreadBadge", { count: thread.unreadCount })}
              className="absolute top-7 right-0 grid h-6 min-w-6 place-items-center rounded-full bg-[var(--color-primary)] px-1.5 text-[13px] font-semibold text-[var(--color-primary-foreground)]"
            >
              {thread.unreadCount}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

/**
 * Sized to the row it stands in for — two lines of text beside a 62px disc —
 * so the list does not change height the moment the first page lands.
 */
function ThreadListSkeleton() {
  return (
    <ul className="m-0 grid list-none gap-0 px-[7px] py-5">
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="flex min-h-[85px] items-center gap-[21px] pr-[21px] pl-[22px]">
          <Skeleton className="h-[62px] w-[62px] shrink-0 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-[17px] w-36 max-w-full" />
            <Skeleton className="h-[14px] w-52 max-w-full" />
          </div>
        </li>
      ))}
    </ul>
  );
}
