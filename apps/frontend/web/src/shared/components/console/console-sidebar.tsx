import type { ReactNode } from "react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from "@ntizo/frontend-ui";
import type { ConsoleNav } from "@/shared/lib/console-nav";
import { ConsoleNavItems } from "./console-nav-items";

/**
 * The console's sidebar, under the top bar: the business (in a workspace),
 * the menu, and whatever the zone puts at its foot.
 *
 * The wordmark and the person moved to the top bar with the mockups; this
 * column is now only about where to go. `header` and `footer` are the zone's
 * — the workspace card and the profile nudge for a provider, nothing for the
 * platform — so this component still never asks which zone it is in.
 */
export function ConsoleSidebar({
  nav,
  slug,
  header,
  footer,
}: {
  nav: ConsoleNav;
  slug: string | undefined;
  header?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    // Under the 91px top bar; the measures are
    // docs/design/2026-10-mockups/provider/reservas.html's rail.
    <Sidebar collapsible="icon" className="top-[91px] h-[calc(100svh-91px)] border-r-[var(--color-border)] [&_[data-slot=sidebar-inner]]:bg-[var(--color-rail)]">
      {header && (
        <SidebarHeader className="px-4 pt-[22px] pb-[22px] pl-[22px] group-data-[collapsible=icon]:px-2">{header}</SidebarHeader>
      )}
      <SidebarContent className="pr-4 pl-5 group-data-[collapsible=icon]:px-0">
        <ConsoleNavItems nav={nav} slug={slug} />
      </SidebarContent>
      {footer && (
        <SidebarFooter className="pt-0 pr-4 pb-0 pl-5 group-data-[collapsible=icon]:hidden">{footer}</SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  );
}
