import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SplitBrandLayout } from "@ntizo/frontend-ui";

interface AuthSplitLayoutProps {
  pitch: string;
  points: readonly string[];
  pointsAsList?: boolean;
  children: ReactNode;
}

/**
 * Thin adapter: supplies the logo, the footnote and the translations to the
 * package's `SplitBrandLayout`.
 *
 * The layout itself is i18n-agnostic on purpose — `useTranslation` lives here,
 * in the app, so the UI package stays free of a react-i18next dependency.
 *
 * The logo is the site header's own artwork and goes home, as it does there:
 * white on the navy panel, the primary one above the form on a phone.
 */
export function AuthSplitLayout({
  pitch,
  points,
  pointsAsList,
  children,
}: AuthSplitLayoutProps) {
  const { t } = useTranslation("common");
  return (
    <SplitBrandLayout
      wordmark={<Logo src="/brand/logo-white.svg" />}
      compactWordmark={<Logo src="/brand/logo-primary.svg" />}
      pitch={pitch}
      points={points}
      pointsAsList={pointsAsList}
      footnote={t("copyright", { year: new Date().getFullYear() })}
    >
      {children}
    </SplitBrandLayout>
  );
}

function Logo({ src }: { src: string }) {
  return (
    <Link
      to="/"
      className="inline-flex rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2"
    >
      <img src={src} alt="Ntizo" className="h-8 w-auto max-w-none" />
    </Link>
  );
}
