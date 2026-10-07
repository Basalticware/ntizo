import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SiteHeader } from "@/shared/components/site-header";
import {
  AUTH_ICON_DISC,
  AUTH_LEDE,
  AUTH_TITLE,
} from "@/features/auth/components/auth-styles";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  /**
   * A page-specific glyph in a tinted disc above the title — a padlock for
   * password reset, an envelope once the link is sent. On these screens the
   * icon says what is about to happen.
   */
  icon?: ReactNode;
}

/**
 * The frame of the account pages that are not sign-in or sign-up — the
 * password pages and the invitation: the public site's header, then one
 * centred column on the white page, as the public pages draw their content.
 *
 * Not the split brand panel: these are errands someone arrives at from an
 * email, mid-task, and the site's own header is what tells them they are on
 * Ntizo and gives them a way back to it.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  icon,
}: AuthLayoutProps) {
  const { t } = useTranslation("common");
  return (
    <div className="flex min-h-svh flex-col bg-[var(--color-background)]">
      <SiteHeader current="none" />
      <main className="flex flex-1 flex-col items-center px-5 pt-12 pb-10 md:px-4 md:pt-20">
        <div className="flex w-full max-w-[560px] flex-col gap-8 [&_h1]:text-balance">
          <div className="flex flex-col items-start gap-6">
            {icon ? (
              <span aria-hidden="true" className={AUTH_ICON_DISC}>
                {icon}
              </span>
            ) : null}
            <div>
              <h1 className={AUTH_TITLE}>{title}</h1>
              {subtitle ? <p className={AUTH_LEDE}>{subtitle}</p> : null}
            </div>
          </div>
          {children}
          {footer ? (
            <p className="text-center text-[15px] text-[var(--color-muted-foreground)]">
              {footer}
            </p>
          ) : null}
        </div>
        <p className="mt-auto pt-16 text-[13px] text-[var(--color-muted-foreground)] opacity-80">
          {t("copyright", { year: new Date().getFullYear() })}
        </p>
      </main>
    </div>
  );
}
