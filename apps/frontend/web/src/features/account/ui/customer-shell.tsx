import type { ReactNode } from "react";
import { SiteHeader } from "@/shared/components/site-header";

/**
 * Layout for the signed-in customer pages that are not account settings —
 * bookings, messages, favourites.
 *
 * Deliberately not the provider or admin shell: those are workspaces with a
 * sidebar full of tools. These are three destinations reached from the
 * account menu, so a header over the content is the whole navigation.
 *
 * The account settings nest one level deeper and add their own sidebar; see
 * `AccountShell`.
 */
export function CustomerShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-[var(--color-background)]">
      <SiteHeader current="none" />
      {/* The public frame's inset rather than `page-shell`: the header above
          is drawn through `.public-inset`, and a page in a different column
          started its title a few pixels off the logo at every width. Full
          column otherwise — pages that want a narrower measure set their
          own; constraining here squeezed the account settings' nav and
          content together into a third of the page. */}
      <main className="public-inset pt-7 pb-16 md:pt-10">{children}</main>
    </div>
  );
}
