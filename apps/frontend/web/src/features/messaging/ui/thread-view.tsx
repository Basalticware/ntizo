import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Check, CheckCheck, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage, Skeleton, cn } from "@ntizo/frontend-ui";
import { EmptyCard } from "@/shared/components/empty-card";
import { initialsFrom } from "@/shared/lib/initials";
import { AttachmentList } from "@/features/messaging/ui/attachment-list";
import type { Message } from "@/features/messaging/domain/types";
import { dayDividerLabel, messageDay } from "@/features/messaging/viewmodel/when";

/** Who a face beside a bubble belongs to. */
export interface ThreadParty {
  name: string;
  avatarUrl?: string | null;
}

/**
 * One conversation's messages.
 *
 * `useThread` hands back messages newest-first — the order the wire sends
 * them in, and deliberately not re-sorted there (see that hook's own doc
 * comment: "a display that wants oldest-first is that display's choice to
 * make"). This is that display: a conversation reads top-to-bottom oldest
 * first, so the re-sort happens here, once, rather than asking every caller
 * of `useThread` to remember it.
 *
 * `body` renders through an ordinary JSX text child — `{message.body}` — and
 * nowhere else. That is the entire security property this component owns:
 * `shared/lib/i18n.ts` sets `interpolation: { escapeValue: false }` for
 * i18next's own sake, which means nothing upstream of this component is
 * escaping a message body for us. React escapes a JSX text child by
 * construction; a `dangerouslySetInnerHTML` here would not, and the message
 * a customer or provider reads was typed by the *other* party at the
 * keyboard, not by the party viewing it. See `__tests__/thread-view.test.tsx`
 * for the render-path check this claim has to survive.
 *
 * `message.attachments` carries the identical risk one field over —
 * `fileName` is also the other party's own input, chosen by them at upload
 * time, not by whoever is reading it here — and `AttachmentList` makes the
 * same commitment for it: every file name renders through an ordinary JSX
 * text child, never `dangerouslySetInnerHTML`. See that component's own doc
 * comment.
 *
 * Drawn as the October mockup draws a conversation: a line for each day, the
 * other side's bubbles grey on the left with the time beside them, the
 * reader's own pale blue on the right with the time and its read ticks under
 * them — two ticks once the other side has read it, one until then. A face
 * opens each run of messages from one side when the caller says whose faces
 * they are.
 */
export function ThreadView({
  messages,
  viewerUserId,
  platformLabel,
  loading = false,
  hasMore = false,
  onLoadMore,
  theirs,
  mine,
}: {
  messages: readonly Message[];
  /** The signed-in reader's own user id — decides which bubbles render as "mine". Undefined renders every bubble as "theirs", never as "mine". */
  viewerUserId?: string;
  /** The name a `platform` message is captioned with — "Suporte Ntizo". Undefined on an inquiry, where no message is ever from the platform. */
  platformLabel?: string;
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  /** The other party's face, drawn beside their runs. Omitted, no faces are drawn on either side. */
  theirs?: ThreadParty;
  /** The reader's own face, beside their runs. */
  mine?: ThreadParty;
}) {
  const { t, i18n } = useTranslation("messaging");
  const locale = i18n.resolvedLanguage ?? i18n.language;

  if (loading) {
    return (
      <ul className="grid list-none gap-3 p-0">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
            <Skeleton className="h-12 w-2/3 rounded-xl" />
          </li>
        ))}
      </ul>
    );
  }

  if (messages.length === 0) {
    return (
      <EmptyCard
        badge={MessageSquare}
        title={t("conversationEmptyTitle")}
        body={t("conversationEmptyBody")}
      />
    );
  }

  // Oldest first for display — see the doc comment above. `createdAt` is
  // ISO 8601, so lexical order is chronological order; no `Date` parse
  // needed to sort correctly.
  const ordered = [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const now = new Date();
  const isMine = (m: Message) => m.senderSide !== "platform" && m.senderUserId === viewerUserId;
  const withFaces = Boolean(theirs && mine);

  return (
    <div className="grid gap-3">
      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          className="type-body-medium mx-auto text-[var(--color-primary)] hover:underline"
        >
          {t("loadEarlier")}
        </button>
      )}

      <ul className="m-0 flex list-none flex-col p-0">
        {ordered.map((message, i) => {
          const previous = ordered[i - 1];
          const newDay = !previous || messageDay(previous.createdAt) !== messageDay(message.createdAt);
          const mineNow = isMine(message);
          // A run is consecutive messages from one side on one day.
          const opensRun =
            newDay || !previous || isMine(previous) !== mineNow || previous.senderSide !== message.senderSide;
          return (
            <Fragment key={message.id}>
              {newDay && (
                <li role="presentation" className={cn("mb-1.5 text-center text-[13px] leading-[1.45] text-[var(--color-muted-foreground)]", i > 0 && "mt-4")}>
                  {dayDividerLabel(message.createdAt, now, locale)}
                </li>
              )}
              <MessageBubble
                message={message}
                mine={mineNow}
                platformLabel={platformLabel}
                locale={locale}
                face={withFaces ? (opensRun ? (mineNow ? mine! : theirs!) : null) : undefined}
                className={i === 0 || newDay ? undefined : opensRun ? "mt-4" : "mt-2.5"}
              />
            </Fragment>
          );
        })}
      </ul>
    </div>
  );
}

function MessageBubble({
  message,
  mine,
  platformLabel,
  locale,
  face,
  className,
}: {
  message: Message;
  mine: boolean;
  platformLabel?: string;
  locale: string;
  /** The face beside this bubble; `null` holds its place inside a run; `undefined` draws no column at all. */
  face: ThreadParty | null | undefined;
  className?: string;
}) {
  const { t } = useTranslation("messaging");
  const when = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(message.createdAt));
  const Ticks = message.readAt ? CheckCheck : Check;

  const faceNode =
    face === undefined ? null : face === null ? (
      <span aria-hidden="true" className="w-[42px] shrink-0" />
    ) : (
      <Avatar className="h-[42px] w-[42px] shrink-0">
        {face.avatarUrl ? <AvatarImage src={face.avatarUrl} alt="" /> : null}
        <AvatarFallback className="bg-[var(--color-info-bg)] text-[13px] font-semibold text-[var(--color-primary)]">
          {initialsFrom(face.name)}
        </AvatarFallback>
      </Avatar>
    );

  const time = (
    <time
      dateTime={message.createdAt}
      className="inline-flex shrink-0 items-center gap-1.5 text-[13px] leading-[1.45] whitespace-nowrap text-[var(--color-muted-foreground)]"
    >
      {when}
      {mine && (
        <Ticks
          aria-label={message.readAt ? t("read") : t("sent")}
          className="h-4 w-4 text-[var(--color-primary)]"
        />
      )}
    </time>
  );

  return (
    <li className={cn("flex items-start gap-3", mine ? "justify-end" : "justify-start", className)}>
      {!mine && faceNode}
      <div className={cn("flex min-w-0 max-w-[85%] gap-3 sm:max-w-[600px]", mine ? "flex-col items-end gap-2.5" : "items-end")}>
        <div
          className={cn(
            "min-w-0 rounded-xl px-[19px] py-[11px] text-[15px] leading-[1.45] text-[var(--color-headline)]",
            mine ? "bg-[#e1effe] dark:bg-[var(--color-blue-soft)]" : "bg-[#f0f3f8] dark:bg-[var(--color-muted)]",
          )}
        >
          {message.senderSide === "platform" && platformLabel && (
            <p className="type-caption mb-1 font-semibold text-[var(--color-muted-foreground)]">
              {platformLabel}
            </p>
          )}
          {/* An ordinary text child. React escapes this by construction — see
              this file's own doc comment for why that is load-bearing here. */}
          {message.body && <p className="m-0 whitespace-pre-wrap break-words">{message.body}</p>}
          <AttachmentList attachments={message.attachments} />
        </div>
        {time}
      </div>
      {mine && faceNode}
    </li>
  );
}
