import { useTranslation } from "react-i18next";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  cn,
} from "@ntizo/frontend-ui";
import { allItems, resolveUrl, type ConsoleNav, type ConsoleNavItem } from "@/shared/lib/console-nav";
import { CONSOLE_BADGE } from "./console-badge";
import { useConsoleCounts } from "./console-counts";

/**
 * The menu, as one column: home, then Work, then Manage, with no headings
 * between them — the mockups draw a single list, and the order alone carries
 * the grouping.
 *
 * Every rendering of the console's navigation — this sidebar, the phone's
 * tab bar, the phone's menu sheet — reads the same `ConsoleNav`. This one
 * draws all of it; the other two draw subsets. None of them decides anything.
 */
export function ConsoleNavItems({ nav, slug }: { nav: ConsoleNav; slug: string | undefined }) {
  const { t } = useTranslation(nav.ns);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const counts = useConsoleCounts();

  function row(item: ConsoleNavItem) {
    const Icon = item.icon;
    // The template is what the router matches on; the resolved path is what
    // the current location is compared against.
    const href = resolveUrl(item.url, slug);
    const isActive = href !== null && (pathname === href || pathname.startsWith(href + "/"));
    return (
      <SidebarMenuItem key={item.key}>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          tooltip={t(item.titleKey)}
          className={cn(
            "relative h-[46px] gap-6 rounded-[10px] px-5 text-[17px] font-medium text-[var(--color-headline)] [&>svg]:size-6",
            "hover:bg-[color-mix(in_srgb,var(--color-primary)_6%,transparent)]",
            "data-[active=true]:bg-[var(--color-primary)] data-[active=true]:text-[var(--color-primary-foreground)]",
            "hover:data-[active=true]:bg-[var(--color-primary)] hover:data-[active=true]:text-[var(--color-primary-foreground)]",
            "group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:h-11 group-data-[collapsible=icon]:w-11 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
          )}
        >
          <Link to={item.url} params={{ slug: slug ?? "" }}>
            <Icon />
            <span className="min-w-0 truncate">{t(item.titleKey)}</span>
            {item.count && counts[item.count] ? (
              // A number beside the label; a dot when the rail collapses to icons, where
              // two digits in 48px are unreadable and a wrong number is worse than none.
              // The tooltip carries the label; the dot says only that something waits.
              <span
                className={cn(
                  "ml-auto",
                  CONSOLE_BADGE,
                  "group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:right-1 group-data-[collapsible=icon]:top-1",
                  "group-data-[collapsible=icon]:h-2 group-data-[collapsible=icon]:w-2 group-data-[collapsible=icon]:min-w-0",
                  "group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:text-[0px]",
                )}
              >
                {counts[item.count]}
              </span>
            ) : null}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">{allItems(nav).map(row)}</SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
