import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AccountNav } from "@/features/account/ui/account-nav";
import { CustomerPageHeading } from "@/features/account/ui/customer-page";

/**
 * Layout for `/account/*` — the settings, and only those.
 *
 * Nested inside `CustomerShell` rather than replacing it, so the header is
 * rendered once and the section nav appears only where it belongs. Bookings,
 * messages and favourites are destinations, not settings; giving them this
 * nav would say they are.
 *
 * Laid out as the provider's settings page: the area's title across the top,
 * the section rail on the left, and each section's cards beside it. The title
 * is the area's, so every section page opens with a card heading of its own
 * rather than a second page title.
 */
export function AccountShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation("account");
  return (
    <div className="w-full max-w-[1400px]">
      <CustomerPageHeading
        title={t("accountTitle")}
        subtitle={t("accountSubtitle")}
      />
      {/* Side by side from `lg`; below it the nav is a scrolling row over the
          content rather than a stacked list. */}
      <div className="mt-[30px] grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[250px_minmax(0,1fr)] lg:items-start">
        <AccountNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
