import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Ellipsis } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
} from "@ntizo/frontend-ui";
import type { NotificationDTO } from "@ntizo/shared/read-models";
import {
  presentationFor,
  type NotificationTone,
} from "@/features/notifications/domain/notification-presentation";
import { targetFor, type InboxZone } from "@/features/notifications/domain/notification-target";
import { detailFor } from "@/features/notifications/domain/notification-detail";
import { formatWhen, type InboxGroupKey } from "@/features/notifications/domain/inbox-groups";

/** The icon's round ground, by what the row is about (see `presentationFor`). */
const TONE: Record<NotificationTone, string> = {
  blue: "bg-[var(--color-info-bg)] text-[var(--color-primary)]",
  violet: "bg-[var(--color-violet-bg)] text-[var(--color-violet-fg)]",
  green: "bg-[var(--color-ok-bg)] text-[var(--color-ok-fg)]",
  grey: "bg-[color-mix(in_srgb,var(--color-ink-2)_8%,var(--color-background))] text-[var(--color-ink-2)]",
  amber: "bg-[var(--color-warn-bg)] text-[var(--color-star)]",
};

/**
 * One row.
 *
 * **Unread is a dot and the soft blue ground**, as the mockup draws it. The
 * dot column is present on every row and empty on read ones, so the icons and
 * sentences stay on one vertical line whatever the mix.
 *
 * **The whole row opens the thing it is about.** `targetFor` decides where;
 * when it has nowhere to send the reader the row is a button that only marks
 * itself read. The link itself wraps the sentence only and is stretched over
 * the row with a pseudo-element — the accessible name of a row is therefore
 * its sentence, not the sentence plus the detail plus the time read out as one
 * run. The outlined "Ver reserva" / "Abrir conversa" at the end is the same
 * destination drawn where the mockup puts the row's action, kept out of the
 * tab order so a keyboard meets each destination once.
 *
 * **Mark-as-read lives in the row's "…" menu, a sibling of the link.** An
 * interactive element inside another is invalid, and a control that also
 * opened the booking would defeat its point: it exists for the reader who
 * wants to clear a row without going anywhere. The menu is drawn only on an
 * unread row — on a read one it would hold nothing.
 *
 * `todayIso` and `group` arrive as props rather than being derived here: the
 * day a row belongs to is what `groupByDay`'s tests pin down, and the time it
 * prints depends on that day.
 */
export function NotificationCell({
  notification,
  group,
  zone,
  todayIso,
  onMarkRead,
}: {
  notification: NotificationDTO;
  group: InboxGroupKey;
  zone: InboxZone;
  todayIso: string;
  onMarkRead: (id: string) => void;
}) {
  const { t, i18n } = useTranslation("notifications");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { icon: Icon, key, tone } = presentationFor(notification.type);
  const target = targetFor(notification, zone);
  const unread = !notification.read;

  // The payload is passed as interpolation values via `replace`, not spread
  // into i18next's own options object: `count`, `context`, `lng`, `ns` and
  // `defaultValue` are reserved there, and the read model calls this payload
  // "deliberately unconstrained" — a future handler adding, say, a
  // `defaultValue` key would otherwise silently replace the rendered sentence
  // instead of being read as a value.
  const sentence = t(`type.${key}`, { replace: notification.payload });
  const detail =
    detailFor(notification, locale) ?? (target?.kind === "thread" ? t("openConversation") : null);
  // Only a plain primary click. A cmd/ctrl/shift/middle click hands the
  // target to another tab, and the router honours that — but it still runs
  // this handler, and a row this tab never showed the reader must not be
  // marked read by it.
  const markIfUnread = (event: MouseEvent<HTMLElement>) => {
    if (!unread) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    onMarkRead(notification.id);
  };

  const stretched =
    "text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none";

  return (
    <li
      className={cn(
        "group relative isolate grid min-h-[66px] grid-cols-[24px_58px_minmax(0,1fr)_auto] items-center border-t py-3 pr-4 first:border-t-0 md:grid-cols-[57px_90px_minmax(0,1fr)_140px_145px_90px] md:pr-0",
        unread
          ? "border-[color-mix(in_srgb,var(--color-blue-line)_45%,var(--color-background))] bg-[var(--color-blue-soft)]"
          : "border-[var(--color-border)] hover:bg-[color-mix(in_srgb,var(--color-muted)_70%,transparent)]",
        "focus-within:bg-[color-mix(in_srgb,var(--color-blue-soft)_70%,transparent)]",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-[11px] w-[11px] justify-self-center rounded-full md:ml-0.5",
          unread && "bg-[var(--color-primary)]",
        )}
      />

      <span
        aria-hidden="true"
        className={cn(
          "grid h-11 w-11 place-items-center rounded-full md:h-[50px] md:w-[50px]",
          TONE[tone],
        )}
      >
        <Icon className="h-[21px] w-[21px] md:h-[23px] md:w-[23px]" strokeWidth={2.1} />
      </span>

      <span className="grid min-w-0 pr-4">
        <span className="text-base leading-5 font-bold text-[var(--color-headline)]">
          {target ? (
            <Link
              to={target.to}
              params={target.params}
              search={target.search}
              onClick={markIfUnread}
              className={stretched}
            >
              {sentence}
            </Link>
          ) : (
            <button type="button" onClick={markIfUnread} className={stretched}>
              {sentence}
            </button>
          )}
        </span>
        {/* Two lines on a phone, where a service name and a provider name
            rarely fit on one; a single truncated line from `sm`, where they
            do and a second line would only be the odd overflow. */}
        {detail && (
          <span className="mt-[3px] line-clamp-2 text-[15px] leading-[1.45] text-[var(--color-muted-foreground)] sm:line-clamp-none sm:truncate">
            {detail}
          </span>
        )}
      </span>

      <time
        dateTime={notification.createdAt}
        className="text-sm whitespace-nowrap text-[var(--color-muted-foreground)] tabular-nums md:justify-self-end md:pr-[43px] md:text-[14.5px]"
      >
        {formatWhen(notification.createdAt, group, locale, todayIso)}
      </time>

      {/* The row's action and its menu are a wide screen's. On a phone the
          row itself is the way in, and a tap on it marks it read. */}
      <span className="relative z-10 hidden md:block">
        {target && (
          <Link
            to={target.to}
            params={target.params}
            search={target.search}
            onClick={markIfUnread}
            tabIndex={-1}
            className="inline-flex h-[34px] w-[145px] items-center justify-center rounded-[7px] border border-[var(--color-blue-edge)] bg-[var(--color-card)] text-[14.5px] font-bold text-[var(--color-primary)] hover:bg-[color-mix(in_srgb,var(--color-primary)_6%,var(--color-card))]"
          >
            {t(target.kind === "thread" ? "actionThread" : "actionBooking")}
          </Link>
        )}
      </span>

      <span className="relative z-10 hidden md:block md:pl-10">
        {unread && (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <button
                type="button"
                aria-label={t("rowActions")}
                className="grid h-8 w-8 place-items-center rounded-full text-[var(--color-headline)] hover:bg-[color-mix(in_srgb,var(--color-ink-2)_8%,transparent)]"
              >
                <Ellipsis className="h-[22px] w-[22px]" strokeWidth={3} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onMarkRead(notification.id)}>
                {t("markRead")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </span>
    </li>
  );
}
