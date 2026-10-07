import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SidebarTrigger } from "@ntizo/frontend-ui";
import { ConsoleUserMenu } from "./console-user-menu";

/**
 * The bar across the top of both consoles: the wordmark over the sidebar's
 * 297px column, then the bell and the person on the right. No search and no
 * city: the user removed both on 7 October 2026.
 */
export function ConsoleTopBar({
  homeUrl,
  slug,
  zoneTag,
  roleLabel,
  ns,
  bell,
  accountMenu,
}: {
  homeUrl: string;
  slug: string | undefined;
  /** Written under the wordmark — "Admin" on the platform, nothing in a workspace. */
  zoneTag?: string;
  /** Written under the person's name: what they are in this zone. */
  roleLabel: string;
  ns: "provider" | "admin";
  bell: ReactNode;
  /** The zone's own entries for the account menu. */
  accountMenu?: ReactNode;
}) {

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center border-b border-[var(--color-border)] bg-[var(--color-background)] px-5 md:h-[91px] md:px-0">
      {/* The sidebar's width from `md` up, so the wordmark sits over its column. */}
      <div className="flex shrink-0 items-center md:w-[var(--sidebar-width)] md:pl-[43px]">
        <Link to={homeUrl} params={{ slug: slug ?? "" }} className="flex flex-col items-start leading-none" aria-label="Ntizo">
          <img src="/brand/logo-primary.svg" alt="" className="h-7 w-auto max-w-none md:h-[34px]" />
          {zoneTag && (
            <span className="mt-0.5 text-[14.5px] font-medium text-[var(--color-muted-foreground)]">{zoneTag}</span>
          )}
        </Link>
      </div>

      <SidebarTrigger className="ml-2 hidden md:inline-flex xl:hidden" />
      {/* No search and no city here (the user removed both on 7 October
          2026): the bar is the logo, then the bell and the person. */}
      <div className="flex-1" />

      <div className="ml-auto flex shrink-0 items-center md:pl-6 md:pr-12">
        <div className="md:px-7">{bell}</div>
        <Hairline />
        <div className="md:pl-[22px]">
          <ConsoleUserMenu ns={ns} roleLabel={roleLabel}>
            {accountMenu}
          </ConsoleUserMenu>
        </div>
      </div>
    </header>
  );
}

function Hairline() {
  return <span aria-hidden="true" className="hidden h-11 w-px bg-[var(--color-border)] md:block" />;
}

