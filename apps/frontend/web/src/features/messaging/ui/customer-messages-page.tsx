import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronLeft, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, cn } from "@ntizo/frontend-ui";
import { initialsFrom } from "@/shared/lib/initials";
import { EmptyCard } from "@/shared/components/empty-card";
import { CustomerPageHeading } from "@/features/account/ui/customer-page";
import { useCurrentUser } from "@/features/user/viewmodel/use-current-user";
import { useThreads } from "@/features/messaging/viewmodel/use-threads";
import { useThread } from "@/features/messaging/viewmodel/use-thread";
import { useSendMessage } from "@/features/messaging/viewmodel/use-send-message";
import { useMarkRead } from "@/features/messaging/viewmodel/use-mark-read";
import { ThreadList } from "@/features/messaging/ui/thread-list";
import { ThreadView } from "@/features/messaging/ui/thread-view";
import { MessageComposer } from "@/features/messaging/ui/message-composer";

/**
 * The customer's inbox: every provider they have messaged, and the open
 * conversation beside it.
 *
 * `?thread=<id>` in the URL, not component state, carries which conversation
 * is open — the way `providers.index`'s filters live in the URL rather than
 * in a `useState` nobody can link to or reload. It is also how the
 * "message this provider" button on a provider's page hands off: it starts
 * (or resumes) a thread and navigates straight to `/messages?thread=<id>`,
 * and this page has nothing more to do than read that id back out.
 *
 * Laid out as the provider's inbox — the list in its own column, the open
 * conversation in a 14px card beside it with the other party's face in its
 * header, both the height of the window from `lg` so each scrolls on its own
 * — and built from the same `ThreadList`, `ThreadView` and `MessageComposer`.
 * No tabs: the provider's split by customer and by unread is a workspace's
 * question, and a customer's inbox is a handful of businesses.
 *
 * No centred measure of its own: `CustomerShell` already gives the column,
 * and commit `6480a31` removed exactly a `mx-auto max-w-3xl` because it
 * started the content 276px right of the logo.
 */
export function CustomerMessagesPage() {
  const { t, i18n } = useTranslation("messaging");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { thread?: string };
  const selectedThreadId = search.thread ?? null;

  const { data: me } = useCurrentUser();
  const {
    threads,
    loading: threadsLoading,
    hasMore: threadsHaveMore,
    loadMore: loadMoreThreads,
    errorCode: threadsErrorCode,
  } = useThreads();
  const {
    messages,
    loading: messagesLoading,
    hasMore: messagesHaveMore,
    loadMore: loadMoreMessages,
  } = useThread(selectedThreadId ?? "");
  const { send, sending, errorCode: sendErrorCode } = useSendMessage();
  const { markRead } = useMarkRead();

  // The newest message the other side sent, if any — `messages` is
  // newest-first (see `useThread`'s doc comment), so the first entry whose
  // sender is not the viewer is it. Bringing this into the effect below is
  // what makes an already-open thread mark a message read when it *arrives*
  // (the 5s poll lands it), not only when the thread is first opened: without
  // it, a reply that shows up while the customer is sitting on this exact
  // thread sits `read_at IS NULL` until they navigate away and back, and the
  // sweep two minutes later emails them about a message already on their
  // screen — see the spec's "a fast back-and-forth produces no email at all"
  // guarantee.
  const newestInboundMessageId = messages.find(
    (message) => message.senderUserId !== me?.id,
  )?.id;

  // Marking a thread read is a side effect of opening it, or of a new
  // message from the other side landing while it is open — not of every
  // render this page happens to do. `markRead` is a fresh function identity
  // each render (`useMarkRead` does not memoise it), so it stays out of the
  // dependency array on purpose. Same trade `page-header.tsx`'s
  // `usePageAction` documents for the same reason.
  useEffect(() => {
    if (selectedThreadId) markRead(selectedThreadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThreadId, newestInboundMessageId]);

  const selectedThread =
    threads.find((thread) => thread.id === selectedThreadId) ?? null;

  const selectThread = (threadId: string) =>
    void navigate({ to: "/messages", search: { thread: threadId } });
  const backToList = () => void navigate({ to: "/messages", search: {} });

  // A support thread names the request, not a person; otherwise the
  // business. A neutral "Conversation" covers the thread not yet resolved in
  // the loaded page, or the name lookup missing.
  const otherName = selectedThread?.support
    ? selectedThread.support.subject
    : selectedThread?.providerName || t("conversationFallbackTitle");
  const myName = me?.displayName || me?.name || "";

  return (
    <div className="w-full max-w-[1400px]">
      <CustomerPageHeading title={t("title")} />

      <div className="mt-[30px] grid grid-cols-[minmax(0,1fr)] gap-[17px] lg:h-[max(560px,calc(100dvh-280px))] lg:grid-cols-[minmax(300px,441px)_minmax(0,1fr)]">
        <div
          className={cn(
            "min-h-0 lg:overflow-y-auto",
            selectedThreadId ? "hidden lg:block" : "block",
          )}
        >
          {threadsErrorCode ? (
            <p className="type-body text-[var(--color-destructive)]">
              {t("loadError")}
            </p>
          ) : (
            <ThreadList
              heading={false}
              className="min-h-full"
              threads={threads}
              loading={threadsLoading}
              selectedThreadId={selectedThreadId}
              onSelect={selectThread}
              hasMore={threadsHaveMore}
              onLoadMore={loadMoreThreads}
              locale={locale}
            />
          )}
        </div>

        <div
          className={cn(
            "min-h-[28rem] flex-col overflow-hidden rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card)] lg:min-h-0",
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
                <Avatar className="h-[52px] w-[52px] shrink-0 sm:h-[62px] sm:w-[62px]">
                  <AvatarFallback className="bg-[var(--color-info-bg)] text-base font-semibold text-[var(--color-primary)]">
                    {selectedThread?.support ? (
                      <MessageSquare aria-hidden="true" className="h-6 w-6" />
                    ) : (
                      initialsFrom(otherName)
                    )}
                  </AvatarFallback>
                </Avatar>
                <p className="m-0 min-w-0 truncate text-lg font-bold text-[var(--color-headline)]">
                  {otherName}
                </p>
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
                  onSend={(body, attachments) =>
                    send(selectedThreadId, body, attachments)
                  }
                  sending={sending}
                  errorCode={sendErrorCode}
                  checkContact={
                    selectedThread?.support === null ||
                    selectedThread?.support === undefined
                  }
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
