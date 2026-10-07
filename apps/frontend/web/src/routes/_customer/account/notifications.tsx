import { createFileRoute } from "@tanstack/react-router";
import { NotificationsPage } from "@/features/notifications/ui/notifications-page";

/**
 * The redirect this replaces existed because the page did not. It does now.
 *
 * Client-rendered like every other session-dependent route: an inbox is the
 * most personal thing on the site and has no business in a prerendered
 * document.
 *
 * `ownHeading` off: `AccountShell` prints the area's title over the section
 * nav, and the nav's lit entry already says this is the inbox — a second
 * page title under the first would be the page saying its name twice.
 */
export const Route = createFileRoute("/_customer/account/notifications")({
  component: () => (
    <NotificationsPage
      scope={{ kind: "mine" }}
      zone={{ kind: "customer" }}
      ownHeading={false}
    />
  ),
});
