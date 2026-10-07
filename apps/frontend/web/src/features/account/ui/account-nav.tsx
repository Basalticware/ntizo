import { useEffect, useRef, type ComponentType } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Bell,
  CreditCard,
  FileText,
  MapPin,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { cn } from "@ntizo/frontend-ui";
import { accountSections } from "@/shared/lib/account-sections";

/** Each section's glyph, by its translation key — the list itself lives in `account-sections`. */
const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  navProfile: UserRound,
  navNotifications: Bell,
  navAddresses: MapPin,
  navSecurity: ShieldCheck,
  navPreferences: SlidersHorizontal,
  navPaymentMethods: CreditCard,
  navLegal: FileText,
};

export function AccountNav() {
  const { t } = useTranslation("account");
  const sections = accountSections();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const strip = useRef<HTMLUListElement>(null);

  // On a phone the row scrolls, and an entry past its right edge — Segurança,
  // Preferências — opened its page with the lit box out of sight. Scrolled
  // on the row itself rather than with `scrollIntoView`, which would move the
  // page too. A no-op from `lg`, where the rail does not scroll.
  useEffect(() => {
    const row = strip.current;
    const active = row?.querySelector<HTMLElement>('[data-status="active"]');
    if (!row || !active || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft +=
      active.getBoundingClientRect().left - row.getBoundingClientRect().left;
  }, [pathname]);

  return (
    /* The provider settings' section rail from `lg` — one white box, the
       current entry on the soft blue ground with the brand bar on its left
       edge — and a scrolling row of the same boxes `StatusTabs` draws below
       it. Stacked vertically on a phone, the entries filled the whole screen:
       every settings page opened on a menu, with the thing you came to read
       below the fold.

       Routes rather than the provider rail's anchors, so the current entry is
       the router's to know: `Link` marks it `data-status="active"`, and the
       classes below read that rather than a second copy of the match.

       No bleed to the screen edge: a negative inline margin here escapes the
       viewport, not a padding box, and the whole page gains a horizontal
       scrollbar. */
    <nav aria-label={t("navLabel")} className="min-w-0 lg:sticky lg:top-6">
      <ul
        ref={strip}
        className="m-0 flex list-none gap-2.5 overflow-x-auto p-0 py-px [scrollbar-width:none] lg:grid lg:gap-1 lg:overflow-visible lg:rounded-[14px] lg:border lg:border-[var(--color-border)] lg:bg-[var(--color-card)] lg:px-3 lg:pt-2.5 lg:pb-3"
      >
        {sections.map((section) => {
          const Icon = ICONS[section.key] ?? UserRound;
          return (
            // `min-w-0` because a grid item defaults to `min-width: auto`,
            // which refuses to shrink below its content.
            <li key={section.to} className="relative min-w-0 shrink-0">
              <Link
                to={section.to}
                activeOptions={{ exact: section.exact }}
                className={cn(
                  "group flex h-11 items-center gap-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-card)] px-4 text-[15px] font-medium whitespace-nowrap text-[var(--color-headline)] transition-colors",
                  "hover:border-[var(--color-blue-line)]",
                  "data-[status=active]:border-[var(--color-blue-line)] data-[status=active]:bg-[var(--color-blue-soft)] data-[status=active]:text-[var(--color-primary)]",
                  "lg:h-auto lg:gap-4 lg:rounded-[9px] lg:border-0 lg:bg-transparent lg:py-3 lg:pr-2 lg:pl-2.5 lg:text-[14.5px]",
                  "lg:hover:bg-[color-mix(in_srgb,var(--color-blue-soft)_50%,transparent)] lg:data-[status=active]:bg-[var(--color-blue-soft)]",
                )}
              >
                {/* The brand bar on the rail's left edge, only where there is a rail. */}
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 -left-3 hidden h-[50px] w-[3px] -translate-y-1/2 rounded-r-sm bg-[var(--color-primary)] lg:group-data-[status=active]:block"
                />
                <span aria-hidden="true" className="shrink-0">
                  <Icon className="h-[19px] w-[19px] lg:h-[21px] lg:w-[21px]" />
                </span>
                <span className="truncate">{t(section.key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
