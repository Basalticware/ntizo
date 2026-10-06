import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, LogOut, Monitor, Moon, Palette, Sun, User as UserIcon } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@ntizo/frontend-ui";
import { useCurrentUser } from "@/features/user/viewmodel/use-current-user";
import { useSignOut } from "@/features/user/viewmodel/use-sign-out";
import { initialsFrom } from "@/shared/lib/initials";
import { applyThemePreference } from "@/shared/lib/theme";

/**
 * The signed-in person's menu, at the right of the console's top bar: their
 * photo, their name, and what they are in this zone.
 *
 * One component for both zones. What differs between them — the workspace
 * switcher, which belongs to a business rather than a person — arrives as
 * `children` from the zone that has one, so this file never asks which zone
 * it is in. It opens downwards and aligned to its right edge, because the
 * trigger is the last thing in a bar that ends at the window's edge.
 *
 * Both "My account" and "Back to Ntizo" leave the zone, and that is the
 * point: an account belongs to a person, a zone belongs to an organization
 * or the platform. Keeping them here is what keeps the sidebar about the
 * business.
 */
export function ConsoleUserMenu({
  ns,
  roleLabel,
  children,
}: {
  ns: "provider" | "admin";
  roleLabel: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation(ns);
  const { t: ta } = useTranslation("auth");
  const { t: tc } = useTranslation("common");
  const { data: user } = useCurrentUser();
  const nav = useNavigate();
  const signOut = useSignOut();

  async function handleSignOut() {
    const { serverRevokeFailed } = await signOut();
    if (serverRevokeFailed) toast.error(ta("signOutOffline"));
  }

  const initials = initialsFrom(user?.name ?? user?.email ?? "?");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button
          type="button"
          data-slot="console-account"
          aria-label={user?.name ?? user?.email ?? ""}
          className="flex items-center gap-3 rounded-xl px-1.5 py-1 text-left hover:bg-[var(--color-muted)]"
        >
          <Avatar className="h-11 w-11">
            {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-sm">{initials}</AvatarFallback>
          </Avatar>
          {/* Name and role from `lg`: below that the bar has the search to
              keep, and the photo alone still opens the menu. */}
          <span className="hidden max-w-[180px] leading-tight lg:grid">
            <span className="truncate text-[15px] font-semibold text-[var(--color-headline)]">{user?.name ?? ""}</span>
            <span className="truncate text-[13px] text-[var(--color-muted-foreground)]">{roleLabel}</span>
          </span>
          <ChevronDown aria-hidden="true" className="hidden size-4 text-[var(--color-headline)] lg:block" />
        </button>
      </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="end">
              <DropdownMenuLabel className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name ?? ""} /> : null}
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid leading-tight">
                    <span className="text-sm font-semibold text-foreground">{user?.name ?? ""}</span>
                    <span className="text-[11px] font-normal text-muted-foreground">{user?.email ?? ""}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {/* The workspace section, when the zone has one. First, because
                  this menu sits inside a workspace and switching is the thing
                  most often wanted here. */}
              {children}

              <DropdownMenuItem onSelect={() => nav({ to: "/account" })}>
                <UserIcon className="h-4 w-4" />
                {t("nav.myAccount")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => nav({ to: "/" })}>
                <ArrowLeft className="h-4 w-4" />
                {t("backToApp")}
              </DropdownMenuItem>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Palette className="h-4 w-4" />
                  {tc("appearance")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44">
                  <DropdownMenuItem onSelect={() => applyThemePreference("light")}>
                    <Sun className="h-4 w-4" />
                    {tc("themeLight")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => applyThemePreference("dark")}>
                    <Moon className="h-4 w-4" />
                    {tc("themeDark")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => applyThemePreference("system")}>
                    <Monitor className="h-4 w-4" />
                    {tc("themeSystem")}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" />
                {ta("signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
    </DropdownMenu>
  );
}
