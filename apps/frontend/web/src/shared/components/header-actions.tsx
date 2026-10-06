import type { ReactNode } from "react";
import { useCurrentUser } from "@/features/user/viewmodel/use-current-user";
import { NotificationBellLink } from "@/shared/components/notification-bell-link";
import { LanguageSwitcher } from "@/shared/components/language-switcher";
import { UserMenu } from "@/shared/components/user-menu";

interface HeaderActionsProps {
  /**
   * Rendered in place of the account cluster when nobody is signed in —
   * "Entrar" and "Criar conta" on the public bar.
   *
   * Passed in rather than built here so the bar decides the visitor's two
   * links, styled against its own ground, rather than this cluster.
   */
  signedOutAction?: ReactNode;
  /**
   * Whether to render the bell and the account avatar.
   *
   * False in the provider and admin zones, where the shell already carries a
   * notifications button and the sidebar footer already carries an account
   * menu — one that also switches the active provider, which this one does
   * not. Rendering both would put two bells and two avatars on one screen.
   */
  showAccount?: boolean;
  /**
   * Renders for a dark ground. Only the two bare icon controls need it; the
   * account chip carries its own colours either way.
   */
  onDark?: boolean;
}

/** The public bar's own styling for the shared bell link — a bare icon, not
 * the provider shell's bordered square. `NotificationBellLink` fetches the
 * count and composes the accessible name; this only supplies the look. */
function headerBellClassName(onDark: boolean): string {
  return onDark
    ? "rounded-full p-1.5 text-white/90 hover:bg-white/15"
    : "rounded-full p-1.5 text-[#2b3a66] hover:bg-[var(--color-muted)]";
}

/**
 * The right-hand end of the public bar: the language, then the account.
 *
 * 18px apart, the mockups' `.ph-search .tools` gap — "PT ▾", "Entrar",
 * "Criar conta" for a visitor; "PT ▾", the bell and the avatar for somebody
 * signed in.
 *
 * The signed-out action shows until a session is known, rather than the
 * header staying empty while the query is in flight. That order matters on
 * the landing page: it is public, server-rendered, and the server has no
 * session either — so waiting would blank the primary call to action for
 * every visitor on every cold load, to spare signed-in users one frame of
 * "Entrar" before their avatar arrives.
 */
export function HeaderActions({
  signedOutAction,
  showAccount = true,
  onDark = false,
}: HeaderActionsProps) {
  const { data: user } = useCurrentUser();

  return (
    <div className="flex items-center gap-[18px]">
      <LanguageSwitcher
        className={onDark ? "text-white/90 hover:bg-white/15" : "text-[#2b3a66]"}
      />
      {!showAccount ? null : user ? (
        <>
          <NotificationBellLink
            scope={{ kind: "mine" }}
            to="/account/notifications"
            className={headerBellClassName(onDark)}
          />
          <UserMenu />
        </>
      ) : (
        signedOutAction
      )}
    </div>
  );
}
