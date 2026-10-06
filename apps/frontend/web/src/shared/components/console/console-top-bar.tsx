import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { SidebarTrigger } from "@ntizo/frontend-ui";
import { LanguageSwitcher } from "@/shared/components/language-switcher";
import { ConsoleUserMenu } from "./console-user-menu";

/**
 * The bar across the top of both consoles, as the mockups draw it: the
 * wordmark over the sidebar's column, a search field, then the bell and the
 * person.
 *
 * The search is the site's service search and nothing else — it takes the
 * term to `/services`. A console-wide search over bookings, people and
 * messages does not exist on the server, and a field that pretends to search
 * them is the control this bar once carried and had to lose.
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
  /** The zone's own entries for the account menu (the workspace switcher). */
  accountMenu?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-[76px] shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-background)] pr-4 pl-4 md:pr-6 md:pl-0">
      {/* Exactly the sidebar's width from `md` up, so the search starts where
          the page does. */}
      <div className="flex shrink-0 items-center gap-2 md:w-[var(--sidebar-width)] md:pl-6">
        <Link to={homeUrl} params={{ slug: slug ?? "" }} className="grid leading-none" aria-label="Ntizo">
          <img src="/brand/logo-primary.svg" alt="" className="h-8 w-auto max-w-none" />
          {zoneTag && (
            <span className="mt-0.5 text-[13px] font-medium text-[var(--color-primary)]">{zoneTag}</span>
          )}
        </Link>
      </div>

      <SidebarTrigger className="hidden md:inline-flex lg:hidden" />
      <ConsoleSearch className="hidden min-w-0 flex-1 md:block md:max-w-[760px]" />
      <div className="flex-1 md:hidden" />

      <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-3">
        <LanguageSwitcher />
        {bell}
        <span aria-hidden="true" className="hidden h-8 w-px bg-[var(--color-border)] md:block" />
        <ConsoleUserMenu ns={ns} roleLabel={roleLabel}>
          {accountMenu}
        </ConsoleUserMenu>
      </div>
    </header>
  );
}

function ConsoleSearch({ className }: { className?: string }) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  return (
    <form
      role="search"
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        void navigate({ to: "/services", search: q ? { q } : {} });
      }}
    >
      <label className="relative block">
        <span className="sr-only">{t("consoleSearch")}</span>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-[var(--color-primary)]"
        />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("consoleSearch")}
          className="h-12 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] pr-4 pl-12 text-[15px] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_20%,transparent)]"
        />
      </label>
    </form>
  );
}
