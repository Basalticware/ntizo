import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronLeft, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, cn } from "@ntizo/frontend-ui";
import { initialsFrom } from "@/shared/lib/initials";
import { EmptyCard } from "@/shared/components/empty-card";
import { useCurrentUser } from "@/features/user/viewmodel/use-current-user";
import { useActiveProvider } from "@/features/provider/viewmodel/use-active-provider";
import { usePageHeader } from "@/shared/lib/page-header";
import { useProviderThreads } from "@/features/messaging/viewmodel/use-provider-threads";
import { useThread } from "@/features/messaging/viewmodel/use-thread";
import { useSendMessage } from "@/features/messaging/viewmodel/use-send-message";
import { useMarkRead } from "@/features/messaging/viewmodel/use-mark-read";
import { ThreadList } from "@/features/messaging/ui/thread-list";
import { ThreadView } from "@/features/messaging/ui/thread-view";
import { MessageComposer } from "@/features/messaging/ui/message-composer";

/**
 * A workspace's inbox: every customer who has messaged this provider, and
 * the open conversation beside it.
 *
 * The provider-zone mirror of `customer-messages-page.tsx`, not a second
 * copy of the pieces underneath it — `ThreadList`, `ThreadView` and
 * `MessageComposer` are the exact same components Task 10 built, already
 * tested, already escaping message bodies as plain JSX text, already
 * capping a send at `MESSAGE_BODY_MAX_LENGTH`. What differs here is only
 * which query feeds the list (`useProviderThreads(providerId)` instead of
 * `useThreads()`) and the zone chrome around it (`usePageHeader` +
 * `useActiveProvider`, the same pair every sibling provider page uses —
 * see `ProviderWalletPage`, `ProviderActivityPage`).
 *
 * **A conversation belongs to the workspace, not to whichever staff member
 * opened it.** `useMarkRead` marks every unread message in a thread read
 * for the whole team, not just for the signed-in viewer — that is the
 * backend's own design (`MessageRepositoryPort.markReadForViewer`'s doc
 * comment) and is not worked around here.
 *
 * **The list and the header name the customer, not this workspace.**
 * `Thread.providerName` is this *workspace's own* name — identical on every
 * row of a provider's own inbox, since every row belongs to the one
 * provider whose inbox this is — so both the row and the open conversation's
 * header read `thread.customerName` instead (`ThreadList`'s `nameOf` prop;
 * see `Thread`'s own doc comment for why both fields exist on one shape).
 *
 * **Known, deliberate gap, not fixed here — labelling *which* teammate sent
 * a reply.** `ThreadView`'s `viewerUserId` decides which bubble renders as
 * "mine" by exact `senderUserId` match against the signed-in staff member's
 * own id, not against "anybody on this provider's team". `messageReadModel`
 * carries `senderUserId` and no name, so a second staff member's earlier
 * reply in the same thread renders as if it came from the customer rather
 * than a colleague. Invisible in the common single-owner workspace (the
 * only shape this phase's e2e exercises); a real multi-staff workspace
 * deserves its own naming decision, not one rushed in alongside
 * `customerName`.
 *
 * **Drawn as the October mockup draws it** — the tabs over two panes, the
 * conversation's head, the bubbles with faces, the one-row composer — less
 * what nothing here knows: who is online, a call or a video button, the
 * booking a conversation is about (an inquiry carries none), the "Equipa"
 * tab (there is no team chat), and the search and "Filtrar" (the server
 * takes no text to search by, and the list is paged).
 */
type InboxTab = "all" | "unread" | "customers";
export function ProviderMessagesPage() {
  const { t: tProvider } = useTranslation("provider");
  const { t, i18n } = useTranslation("messaging");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { thread?: string };
  const selectedThreadId = search.thread ?? null;

  const { activeProvider } = useActiveProvider();
  const providerId = activeProvider?.id ?? "";

  usePageHeader(tProvider("nav.messages"), t("providerSubtitle"));
  const [tab, setTab] = useState<InboxTab>("all");

  const { data: me } = useCurrentUser();
  const {
    threads,
    loading: threadsLoading,
    hasMore: threadsHaveMore,
    loadMore: loadMoreThreads,
    errorCode: threadsErrorCode,
  } = useProviderThreads(providerId);
  const {
    messages,
    loading: messagesLoading,
    hasMore: messagesHaveMore,
    loadMore: loadMoreMessages,
  } = useThread(selectedThreadId ?? "");
  const { send, sending, errorCode: sendErrorCode } = useSendMessage();
  const { markRead } = useMarkRead();

  // The newest message the other side sent, if any — same reasoning
  // `customer-messages-page.tsx`'s identical constant documents: `messages`
  // is newest-first, so this is what makes an already-open thread mark a
  // reply read the moment the 5s poll lands it, not only when the thread is
  // first opened.
  const newestInboundMessageId = messages.find(
    (message) => message.senderUserId !== me?.id,
  )?.id;

  // Marking a thread read is a side effect of opening it, or of a new
  // message from the other side landing while it is open — same trade, same
  // reasoning `customer-messages-page.tsx`'s identical effect documents:
  // `markRead` is a fresh function identity every render (`useMarkRead`
  // does not memoise it), so it stays out of the dependency array on
  // purpose.
  useEffect(() => {
    if (selectedThreadId) markRead(selectedThreadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThreadId, newestInboundMessageId]);

  if (!activeProvider) return null;

  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) ?? null;
  const shownThreads =
    tab === "unread"
      ? threads.filter((thread) => thread.unreadCount > 0)
      : tab === "customers"
        ? threads.filter((thread) => thread.type === "inquiry")
        : threads;
  /**
   * A tab's number only once every conversation is loaded: the list is paged
   * and the server counts nothing, so before the last page a count would be
   * a count of the first twenty.
   */
  const countOf = (key: InboxTab) =>
    threadsLoading || threadsHaveMore
      ? null
      : key === "unread"
        ? threads.filter((thread) => thread.unreadCount > 0).length
        : key === "customers"
          ? threads.filter((thread) => thread.type === "inquiry").length
          : threads.length;

  const selectThread = (threadId: string) =>
    void navigate({
      to: "/provider/$slug/messages",
      params: { slug: activeProvider.slug },
      search: { thread: threadId },
    });
  const backToList = () =>
    void navigate({
      to: "/provider/$slug/messages",
      params: { slug: activeProvider.slug },
      search: {},
    });

  const otherName = selectedThread?.support
    ? selectedThread.support.subject
    : selectedThread?.customerName || t("conversationFallbackTitle");
  const myName = me?.displayName || me?.name || "";

  return (
    <div className="w-full max-w-[1400px]">
      <InboxTabs
        value={tab}
        onChange={setTab}
        ariaLabel={t("title")}
        tabs={(["all", "unread", "customers"] as const).map((key) => ({
          key,
          label: t(`providerTab.${key}`),
          count: countOf(key),
        }))}
      />

      <div className="mt-[21px] grid gap-[17px] lg:h-[max(560px,calc(100dvh-300px))] lg:grid-cols-[minmax(300px,441px)_minmax(0,1fr)]">
        <div className={cn("min-h-0 lg:overflow-y-auto", selectedThreadId ? "hidden lg:block" : "block")}>
          {threadsErrorCode ? (
            <p className="type-body text-[var(--color-destructive)]">{t("loadError")}</p>
          ) : (
            <ThreadList
              heading={false}
              className="min-h-full"
              threads={shownThreads}
              loading={threadsLoading}
              selectedThreadId={selectedThreadId}
              onSelect={selectThread}
              hasMore={threadsHaveMore}
              onLoadMore={loadMoreThreads}
              locale={locale}
              emptyTitle={tab === "all" ? t("emptyTitle") : t("providerTabEmptyTitle")}
              emptyBody={tab === "all" ? t("providerEmptyBody") : t("providerTabEmptyBody")}
              nameOf={(thread) => thread.customerName}
              fallbackName={t("unknownCustomer")}
            />
          )}
        </div>

        <div
          className={cn(
            "min-h-[28rem] flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-card)] lg:min-h-0",
            selectedThreadId ? "flex" : "hidden lg:flex",
          )}
        >
          {selectedThreadId ? (
            <>
              <div className="flex h-[89px] shrink-0 items-center gap-3.5 px-4 sm:pr-[21px] sm:pl-[30px]">
                <button
                  type="button"
                  onClick={backToList}
                  aria-label={t("back")}
                  className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] lg:hidden"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <Avatar className="h-[62px] w-[62px] shrink-0">
                  <AvatarFallback className="bg-[var(--color-info-bg)] text-base font-semibold text-[var(--color-primary)]">
                    {selectedThread?.support ? <MessageSquare aria-hidden="true" className="h-6 w-6" /> : initialsFrom(otherName)}
                  </AvatarFallback>
                </Avatar>
                {/* A support thread's header names the request, not a person —
                    `support.subject`, the same choice `customer-messages-page.tsx`
                    makes. Otherwise `customerName`, never `providerName` — on
                    this side that is this workspace's own name. A neutral
                    "Conversation" covers the thread not yet resolved in the
                    loaded page, or the name lookup missing. */}
                <p className="m-0 min-w-0 truncate text-lg font-bold text-[var(--color-headline)]">{otherName}</p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-6 pb-7 sm:pr-[30px] sm:pl-6">
                <ThreadView
                  messages={messages}
                  viewerUserId={me?.id}
                  platformLabel={t("supportSender")}
                  loading={messagesLoading}
                  hasMore={messagesHaveMore}
                  onLoadMore={loadMoreMessages}
                  theirs={{ name: otherName }}
                  mine={{ name: myName, avatarUrl: me?.avatarUrl ?? null }}
                />
              </div>

              <div className="mx-[18px] shrink-0 border-t border-[var(--color-line-2)] pt-3.5 pb-4">
                <MessageComposer
                  onSend={(body, attachments) => send(selectedThreadId, body, attachments)}
                  sending={sending}
                  errorCode={sendErrorCode}
                  checkContact={selectedThread?.support === null || selectedThread?.support === undefined}
                />
              </div>
            </>
          ) : (
            <EmptyCard
              className="flex-1"
              icon={MessageSquare}
              title={t("selectPrompt")}
              body={t("selectPromptBody")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The inbox's tabs as the mockup draws them: bare words split by hairlines,
 * the chosen one boxed on the soft blue ground. The unread count is the one
 * chip in red — it is the one number that is work.
 */
function InboxTabs({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: readonly { key: InboxTab; label: string; count: number | null }[];
  value: InboxTab;
  onChange: (key: InboxTab) => void;
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="-ml-px flex w-full max-w-full items-center overflow-x-auto [scrollbar-width:none]">
      {tabs.map((tab, i) => {
        const selected = tab.key === value;
        return (
          <span key={tab.key} className="flex shrink-0 items-center">
            {i > 0 && <span aria-hidden="true" className="h-[26px] w-px bg-[var(--color-border)]" />}
            <button
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.key)}
              className={cn(
                "inline-flex h-11 items-center justify-center gap-3 rounded-[10px] border text-[15.5px] whitespace-nowrap",
                selected
                  ? "min-w-[134px] border-[var(--color-blue-line)] bg-[var(--color-blue-soft)] px-5 text-[color-mix(in_srgb,var(--color-primary)_80%,var(--color-headline))] dark:border-[var(--color-blue-line)] dark:bg-[var(--color-blue-soft)]"
                  : "border-transparent px-[30px] text-[var(--color-ink-2)] hover:text-[var(--color-headline)]",
              )}
            >
              {tab.label}
              {tab.count !== null && (
                <span
                  className={cn(
                    "grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-sm font-semibold tabular-nums",
                    selected
                      ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                      : tab.key === "unread" && tab.count > 0
                        ? "bg-[var(--color-alert)] text-white"
                        : "bg-[var(--color-info-bg)] text-[var(--color-ink-2)] dark:bg-[var(--color-muted)]",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          </span>
        );
      })}
    </div>
  );
}
