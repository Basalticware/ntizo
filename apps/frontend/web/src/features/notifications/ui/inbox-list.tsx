import { useTranslation } from "react-i18next";
import type { NotificationDTO } from "@ntizo/shared/read-models";
import {
  groupByDay,
  type InboxGroupKey,
} from "@/features/notifications/domain/inbox-groups";
import type { InboxZone } from "@/features/notifications/domain/notification-target";
import { NotificationCell } from "@/features/notifications/ui/notification-cell";

const HEADING_KEY: Record<InboxGroupKey, string> = {
  today: "groupToday",
  yesterday: "groupYesterday",
  earlier: "groupEarlier",
};

/**
 * An inbox's items, split into the day headings `groupByDay` decided.
 *
 * Each day is a grey bar with the day on the left and how many rows it holds
 * on the right, over one outlined box of rows — the mockup's shape. The row
 * draws its own top rule (and drops it when it is first in its group), so
 * `NotificationCell` stays agnostic of what it is inside.
 *
 * **The count is of rows on screen, and is said only when that is the whole
 * day.** The inbox arrives twenty at a time, so the last group on screen may
 * be cut short by the page boundary; `complete` is false while another page
 * waits, and the last group then shows no number rather than one the next
 * page would contradict. Every group above it is whole — newer rows come
 * first, so a day the list has already moved past cannot grow.
 *
 * `todayIso` arrives as a prop rather than being read here with `new Date()`:
 * the day boundary is exactly what `groupByDay`'s own tests pin down, and a
 * component that reaches for the clock itself cannot be pinned the same way.
 */
export function InboxList({
  items,
  todayIso,
  zone,
  onMarkRead,
  complete = true,
}: {
  items: NotificationDTO[];
  todayIso: string;
  zone: InboxZone;
  onMarkRead: (id: string) => void;
  /** Whether every row the inbox holds is in `items`. */
  complete?: boolean;
}) {
  const { t } = useTranslation("notifications");
  const groups = groupByDay(items, todayIso);

  return (
    <div className="grid gap-6">
      {groups.map((group, i) => {
        const counted = complete || i < groups.length - 1;
        return (
          <section key={group.key} className="grid gap-2">
            <h2 className="flex h-10 items-center justify-between rounded-[10px] bg-[color-mix(in_srgb,var(--color-ink-2)_4%,var(--color-muted))] pr-[22px] pl-5 text-base font-bold text-[var(--color-headline)]">
              {t(HEADING_KEY[group.key])}
              {counted && (
                <span className="text-[14.5px] font-normal text-[var(--color-muted-foreground)]">
                  {t("groupCount", { count: group.items.length })}
                </span>
              )}
            </h2>
            <ul className="grid list-none overflow-hidden rounded-[10px] border border-[var(--color-border)] bg-[var(--color-card)] p-0">
              {group.items.map((item) => (
                <NotificationCell
                  key={item.id}
                  notification={item}
                  group={group.key}
                  zone={zone}
                  todayIso={todayIso}
                  onMarkRead={onMarkRead}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
