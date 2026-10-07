import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronLeft,
  CircleCheck,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, Badge, Button, Skeleton } from "@ntizo/frontend-ui";
import { initialsFrom } from "@/shared/lib/initials";
import { usePageHeader } from "@/shared/lib/page-header";
import { ThreadView } from "@/features/messaging/ui/thread-view";
import { MessageComposer } from "@/features/messaging/ui/message-composer";
import {
  useAdminSupportMessages,
  useAdminSupportRequest,
  useMarkSupportRequestRead,
  useReplyToSupportRequest,
  useResolveSupportRequest,
} from "@/features/admin/support/viewmodel/use-admin-support";
import { messagingErrorCode } from "@/features/messaging/viewmodel/messaging-error";

/**
 * One support request, read and answered by the platform.
 *
 * Laid out as the Mensagens page's thread pane — the person's face and name
 * over the conversation, the composer in its foot — with the request's
 * subject and status as the page title above it, and a rail beside it with
 * who the request is from, what it is about and the resolve button.
 *
 * The same `ThreadView` and `MessageComposer` the participants use — with
 * `checkContact={false}`, because the platform giving out a number to call
 * back is the point, and `viewerUserId` deliberately unset: an admin's
 * bubbles align left like everyone else's here, and what names the platform
 * is `platformLabel`, not whose id matches.
 *
 * Opening the page marks it read for the platform (`supportMarkRead`), the
 * same act `/messages` performs for a participant, so the queue's unread
 * count means "nobody has looked at this".
 *
 * The back link stays mounted through every state — loading, errored,
 * missing, or found — on `provider-detail-page.tsx`'s model: a page that
 * drops its own chrome while it works loses the one way out an administrator
 * had, right when something has already gone wrong. `error` is read
 * separately from `data`/`isPending` for the same reason that page's own
 * `query.error` check exists: a request that failed to load and a thread id
 * that genuinely does not exist both settle to `isPending === false` and
 * `data === undefined`, and conflating them would tell an administrator
 * "no such request" about a request the backend never actually answered
 * for.
 *
 * `request` is checked BEFORE `error` in the branch below, not after — on
 * purpose, and for a reason that only shows up once something else on the
 * page triggers a background refetch. Marking the request read invalidates
 * `["admin","support"]` on success (`useSupportMutation`'s own doc comment),
 * which includes this very query; if that refetch then fails, React Query
 * keeps the last-good `request` in `data` while setting `error` alongside
 * it. Gating on `error` first would swap a request an administrator is
 * actively reading — resolve button, conversation and all — out for
 * "The request could not be loaded." on a transient hiccup that has nothing
 * to do with what is already on screen. `data` wins whenever it exists,
 * exactly as `provider-detail-page.tsx` shows `detail` regardless of
 * `query.error`; `supportLoadError` is reserved for when `request` was
 * never loaded at all.
 *
 * `supportRequest` never actually resolves `null` for a missing id — it
 * throws `SUPPORT_REQUEST_NOT_FOUND` (see the communication BC's own
 * `SupportRequestNotFoundError`) — so `error` alone cannot mean "failed to
 * load" here: `messagingErrorCode(error)` is checked for that specific code
 * first, and only an error that is NOT that code falls through to
 * `supportLoadError`. `adminSupportQueries.one` also turns retry off for
 * this query specifically — a retry only ever runs once the tab is
 * foregrounded again, so a request opened in a background tab (exactly what
 * a clicked notification does) could pause its one retry forever, and
 * `isPending` stays true — the same skeleton, permanently — for as long as
 * nobody is looking at the tab to refocus it.
 */
export function AdminSupportRequestPage() {
  const { t } = useTranslation("admin");
  const { t: tCommon } = useTranslation("common");
  const { threadId } = useParams({ from: "/admin/support/$threadId" });
  const { data: request, isPending, error } = useAdminSupportRequest(threadId);
  // See the doc comment above: the backend answers a missing thread id with
  // this code, never with `data: null`, so it is what tells "no such
  // request" apart from "this failed to load".
  const requestNotFound = messagingErrorCode(error) === "SUPPORT_REQUEST_NOT_FOUND";
  const {
    messages,
    loading,
    hasMore,
    loadMore,
    failed: messagesFailed,
  } = useAdminSupportMessages(threadId);
  const { reply, replying, errorCode } = useReplyToSupportRequest();
  const { resolve, resolving, failed: resolveFailed, errorCode: resolveErrorCode } =
    useResolveSupportRequest();
  const { markRead } = useMarkSupportRequestRead();

  usePageHeader(request?.subject ?? t("supportTitle"), request?.requesterName, { ownHeading: true });

  const newestRequesterMessageId = messages.find((message) => message.senderSide !== "platform")?.id;

  // Same shape and same reasoning as the participant pages': marking read is
  // a side effect of opening the request, and of a new message landing while
  // it is open (the 5s poll brings it). `markRead` is a fresh identity each
  // render, so it stays out of the dependency array on purpose.
  useEffect(() => {
    if (threadId) markRead(threadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, newestRequesterMessageId]);

  return (
    <div className="flex w-full max-w-[1400px] flex-col">
      <Link
        to="/admin/support"
        className="inline-flex items-center gap-1.5 self-start text-[15px] text-[var(--color-primary)] no-underline hover:underline"
      >
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        {t("supportBackToQueue")}
      </Link>

      {request ? (
        <>
          <header className="mt-[18px] flex flex-wrap items-center gap-x-[18px] gap-y-2.5">
            <h1 className="m-0 min-w-0 font-display text-[28px] leading-tight font-extrabold tracking-[-0.01em] break-words text-[var(--color-headline)] md:text-[35.5px]">
              {request.subject}
            </h1>
            <Badge
              tone={request.status === "open" ? "info" : "neutral"}
              className="h-[30px] px-[17px] text-[14.5px]"
            >
              {t(`supportStatus.${request.status}`)}
            </Badge>
          </header>

          {/* The Mensagens page's thread pane beside a rail with the request's
              facts and its one decision — the conversation is what an
              administrator came here to read, so it takes the width. */}
          <div className="mt-[22px] grid items-start gap-[17px] lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="flex min-h-[28rem] min-w-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-card)] lg:h-[max(560px,calc(100dvh-300px))]">
              <div className="flex h-[89px] shrink-0 items-center gap-3.5 px-4 sm:pr-[21px] sm:pl-[30px]">
                <Avatar className="h-[62px] w-[62px] shrink-0">
                  <AvatarFallback className="bg-[var(--color-info-bg)] text-base font-semibold text-[var(--color-primary)]">
                    {initialsFrom(request.requesterName)}
                  </AvatarFallback>
                </Avatar>
                <p className="m-0 min-w-0 truncate text-lg font-bold text-[var(--color-headline)]">
                  {request.requesterName}
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--color-line-2)] px-4 pt-6 pb-7 sm:pr-[30px] sm:pl-6">
                {messagesFailed ? (
                  // Said out loud, because the alternative is worse than an
                  // error: an empty `ThreadView` under a header that loaded
                  // fine, with a composer and a resolve button beside it — an
                  // administrator answering a request whose content they were
                  // never shown.
                  <p role="alert" className="type-body text-[var(--color-destructive)]">
                    {t("supportConversationError")}
                  </p>
                ) : (
                  <ThreadView
                    messages={messages}
                    platformLabel={t("supportPlatformSender")}
                    loading={loading}
                    hasMore={hasMore}
                    onLoadMore={loadMore}
                  />
                )}
              </div>

              <div className="mx-[18px] shrink-0 border-t border-[var(--color-line-2)] pt-3.5 pb-4">
                <MessageComposer
                  onSend={(body, attachments) => reply(request.threadId, body, attachments)}
                  sending={replying}
                  errorCode={errorCode}
                  checkContact={false}
                />
              </div>
            </section>

            <aside className="grid min-w-0 gap-[17px] lg:sticky lg:top-6">
              <section className={CARD}>
                <h2 className="m-0 text-lg font-bold text-[var(--color-headline)]">{t("supportRequest")}</h2>
                <dl className="mt-5 mb-0 grid gap-4">
                  <Fact icon={Users} label={t("supportAudienceLabel")}>
                    {t(`supportAudience.${request.audience}`)}
                  </Fact>
                  {request.providerId && (
                    <Fact icon={Store} label={t("supportProvider")}>
                      <Link
                        to="/admin/providers/$providerId"
                        params={{ providerId: request.providerId }}
                        className="text-[var(--color-primary)] hover:underline"
                      >
                        {request.providerName}
                      </Link>
                    </Fact>
                  )}
                  {request.bookingId && (
                    // An id, not a link: there is no admin page for a booking
                    // to point at. It is here so somebody can find the row.
                    <Fact icon={CalendarDays} label={t("supportBooking")}>
                      <span className="font-mono text-[13px] break-all">{request.bookingId}</span>
                    </Fact>
                  )}
                </dl>

                {request.status === "open" && (
                  <Button
                    className="mt-6 w-full"
                    disabled={resolving}
                    onClick={() => resolve(request.threadId)}
                  >
                    <CircleCheck aria-hidden="true" />
                    {t("supportResolve")}
                  </Button>
                )}

                {resolveFailed && (
                  // Losing this race is the ordinary case, not the exotic one:
                  // two administrators working the same queue, and the second
                  // click answered `SUPPORT_ALREADY_RESOLVED`. Without a line
                  // here the button simply stopped spinning and the badge went
                  // on saying "open".
                  <p role="alert" className="mt-4 mb-0 text-sm text-[var(--color-destructive)]">
                    {resolveErrorCode === "SUPPORT_ALREADY_RESOLVED"
                      ? t("supportAlreadyResolved")
                      : t("supportResolveError")}
                  </p>
                )}

                {request.status === "resolved" && (
                  <p className="mt-5 mb-0 rounded-[14px] bg-[var(--color-blue-softer)] p-4 text-[14.5px] leading-[1.45] text-[var(--color-ink-2)]">
                    {t("supportResolvedNotice")}
                  </p>
                )}
              </section>
            </aside>
          </div>
        </>
      ) : (
        <section className={`${CARD} mt-[18px]`}>
          {isPending ? (
            <div role="status" aria-label={tCommon("loading")} className="grid gap-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-4 h-16 w-full" />
            </div>
          ) : error && !requestNotFound ? (
            <p className="type-body m-0 text-[var(--color-destructive)]">{t("supportLoadError")}</p>
          ) : (
            <p className="type-body m-0 text-[var(--color-destructive)]">{t("supportNotFound")}</p>
          )}
        </section>
      )}
    </div>
  );
}

/** The request's cards, as the other admin detail pages draw theirs. */
const CARD = "min-w-0 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card)] p-5 md:p-6";

function Fact({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-4">
      <Icon aria-hidden="true" className="row-span-2 mt-0.5 h-5 w-5 text-[var(--color-ink-2)]" />
      <dt className="text-sm text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className="m-0 mt-0.5 min-w-0 text-[15px] text-[var(--color-ink-2)]">{children}</dd>
    </div>
  );
}
