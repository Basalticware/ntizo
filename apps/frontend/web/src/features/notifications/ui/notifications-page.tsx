import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@ntizo/frontend-ui";
import { EmptyCard } from "@/shared/components/empty-card";
import { SegmentedTabs } from "@/shared/components/segmented-tabs";
import type { StatusTab } from "@/shared/components/status-tabs";
import {
  useInbox,
  type InboxScope,
} from "@/features/notifications/viewmodel/use-inbox";
import { useMarkRead } from "@/features/notifications/viewmodel/use-mark-read";
import { useUnreadCount } from "@/features/notifications/viewmodel/use-unread-count";
import { InboxList } from "@/features/notifications/ui/inbox-list";
import { InboxSkeleton } from "@/features/notifications/ui/inbox-skeleton";
import type { InboxZone } from "@/features/notifications/domain/notification-target";

/**
 * See `notification-cell.tsx` for why this is the headline colour with a
 * fallback, and why it is written out in full rather than interpolated.
 */
const HEADLINE_TEXT = "text-[var(--color-headline,var(--color-foreground))]";

/**
 * A text action in the headline colour: the words and an underline that
 * appears on hover. The page's two actions — mark all, load more — are both
 * this rather than outlined buttons, because an outlined button beside the
 * heading competed with it, and one at the foot of the list looked like the
 * page's primary action when it is the least important thing on it.
 */
const TEXT_ACTION = cn(
  "type-body-medium inline-flex items-center gap-2 border-b border-transparent pb-0.5 font-semibold",
  HEADLINE_TEXT,
  "hover:border-current",
  "disabled:cursor-default disabled:opacity-60 disabled:hover:border-transparent",
);

/**
 * "Marcar todas como lidas", outlined in the blue the console's Filtrar wears:
 * it sits on the toolbar row now, beside the tabs, where the mockup puts its
 * one button.
 */
const MARK_ALL = cn(
  "inline-flex h-[47px] items-center gap-2.5 rounded-[10px] border border-[var(--color-blue-outline)] bg-[var(--color-card)] px-5 text-[15px] font-semibold text-[var(--color-primary)]",
  "hover:bg-[color-mix(in_srgb,var(--color-primary)_6%,transparent)] disabled:cursor-default disabled:opacity-60",
);

/**
 * One inbox, whichever scope asks for it.
 *
 * The personal inbox and a workspace's inbox differ only in which query feeds
 * them — `useInbox` and `useMarkRead` already branch on `scope` — so one page
 * serves both routes rather than two copies that would drift the moment one
 * of them changes. `scope` also decides the heading: "Notifications" for a
 * person, "Workspace notifications" for an organization, because the same
 * word means a different inbox depending on who is reading it. `zone` is the
 * other half of the same fact: which routes the rows link into, see
 * `targetFor`.
 *
 * No zone-specific chrome here on purpose. The customer route renders this
 * directly with nothing around it; the provider route wraps it in the same
 * width constraint its sibling pages use and feeds the workspace's own title
 * to the shell's header. Neither wrapper belongs inside a component the other
 * zone also renders.
 *
 * **The unread count drives the head, not the rows on screen.** "Mark all as
 * read" used to appear only when one of the *loaded* rows was unread, so
 * three unread rows on page two lit the badge with no way to clear them from
 * here. `useUnreadCount` is the same query the bell polls; it is the number
 * the badge shows, so it is the number this head shows and the condition the
 * action is under.
 *
 * **Notifications and nothing else.** A 320px "recent activity" column stood
 * beside this list in both zones until 2026-09-04, fed by `useMyActivity()`.
 * All three zones already have a page of their own for exactly that feed —
 * `/activity`, `/provider/$slug/activity`, `/admin/activity` — so the column
 * was a second copy of a whole page, glued to an unrelated one. The dedicated
 * pages keep it; this one is the inbox.
 *
 * **Two tabs, because the server answers two questions.** "Todas" is the
 * inbox's own total and "Não lidas" the badge's count. The unread tab filters
 * the rows already fetched and keeps paging underneath — the end-of-list
 * sentinel stays on screen while the filtered list is short, so it fetches on
 * until the unread rows are all there. The mockup's Reservas / Mensagens /
 * Sistema tabs, the search box and the Filtros button are left out: the inbox
 * can neither count nor search by kind, and a tab whose number is only the
 * rows that happen to be loaded is a guess.
 *
 * `ownHeading` is off where the zone's shell already prints the page's title
 * (the provider console); the customer route has no such shell and keeps the
 * heading here.
 */
export function NotificationsPage({
  scope,
  zone,
  ownHeading = true,
}: {
  scope: InboxScope;
  zone: InboxZone;
  ownHeading?: boolean;
}) {
  const { t } = useTranslation("notifications");
  const { page, isPending, isError, hasMore, isLoadingMore, loadMore } = useInbox(scope);
  const { markOne, markAll, isMarkingAll } = useMarkRead(scope);
  const unread = useUnreadCount(scope);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const items = tab === "unread" ? page.items.filter((n) => !n.read) : page.items;
  const tabs: StatusTab<"all" | "unread">[] = [
    { key: "all", label: t("tabAll"), count: isPending ? null : page.total },
    { key: "unread", label: t("tabUnread"), count: isPending ? null : unread, tone: "danger" },
  ];

  // Armed only when there is a page to get and none already on its way, so a
  // sentinel that stays on screen while the fetch lands does not ask twice.
  const sentinel = useLoadOnScroll(hasMore && !isLoadingMore, loadMore);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* The page's own h1 where nothing above prints one; in the customer's
          account area the shell prints the area's h1, so this is the
          section's h2, the way every other account section heads its card. */}
      {(ownHeading || zone.kind === "customer") && (
        <div>
          {ownHeading ? (
            <h1 className={cn("type-h1", HEADLINE_TEXT)}>
              {scope.kind === "provider" ? t("providerTitle") : t("title")}
            </h1>
          ) : (
            <h2 className="text-lg leading-tight font-bold text-[var(--color-headline)]">{t("title")}</h2>
          )}
          {/* Only while there is something unread. "0 unread of 27" is a
              sentence about nothing; the rows already say they are read. */}
          {unread > 0 && page.total > 0 && (
            <p className="type-body mt-1 text-[var(--color-muted-foreground)]">
              {t("unreadOfTotal", { count: unread, total: page.total })}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} ariaLabel={t("tabsLabel")} className="h-[47px]" />
        {/* Rendered only when it can do something. An action over a list it
            cannot change is a button that lies. */}
        {unread > 0 && (
          <button
            type="button"
            disabled={isMarkingAll}
            onClick={() => markAll()}
            className={MARK_ALL}
          >
            <CheckCheck aria-hidden="true" className="h-[19px] w-[19px]" strokeWidth={2.2} />
            {t("markAllRead")}
          </button>
        )}
      </div>

      {isError ? (
        <p className="type-body text-[var(--color-destructive)]">{t("loadError")}</p>
      ) : isPending ? (
        <InboxSkeleton />
      ) : page.total === 0 ? (
        // Unframed: the dashed outline earned its place when the card was
        // the only box on an otherwise blank page. There are no boxes on
        // this page any more, so the outline would be the one that is left.
        <EmptyCard badge={Bell} title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <>
          {items.length > 0 ? (
            <InboxList
              items={items}
              todayIso={new Date().toISOString()}
              zone={zone}
              onMarkRead={markOne}
              complete={!hasMore}
            />
          ) : (
            !hasMore && <EmptyCard badge={Bell} title={t("unreadEmptyTitle")} body={t("unreadEmptyBody")} />
          )}
          {/* The list stops at twenty and grows from the bottom as the reader
              reaches it. The button is the same element the observer watches,
              so scrolling here loads the next page and a keyboard or a screen
              reader gets there too. It is also what happens if the observer
              never fires at all, which a background tab is enough to cause. */}
          {hasMore && (
            <div
              ref={sentinel}
              className="flex items-center justify-center gap-3.5 border-t border-[var(--color-border)] pt-[18px]"
            >
              <p className="type-caption text-[13px] text-[var(--color-muted-foreground)]">
                {t("showingCount", { shown: page.items.length, total: page.total })}
              </p>
              <button
                type="button"
                disabled={isLoadingMore}
                onClick={() => loadMore()}
                className={TEXT_ACTION}
              >
                {t("loadMore")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Ask for the next page when the end of the list comes into view.
 *
 * `rootMargin: "300px"` fires before the reader actually hits the bottom, so
 * the rows are usually there by the time they arrive — roughly four cells of
 * warning at this list's density.
 *
 * `armed` is a plain boolean rather than a check inside the callback because
 * it belongs in the dependency list: when there is nothing left to fetch the
 * observer is torn down instead of firing into a no-op on every scroll.
 * `loadMore` is stable (`useInbox` wraps it), so this effect runs when the
 * answer changes and not on every render.
 *
 * No `typeof IntersectionObserver` guard. It exists in every browser this
 * ships to; the one environment without it is jsdom, and `src/test/setup.ts`
 * stubs it there for the same reason it stubs `scrollIntoView` — test-only
 * scaffolding does not belong in the component.
 */
function useLoadOnScroll(armed: boolean, loadMore: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !armed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [armed, loadMore]);

  return ref;
}
