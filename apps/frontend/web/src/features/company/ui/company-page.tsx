import type { ReactNode } from "react";
import { Footer } from "@/features/landing/ui/footer";
import { SiteHeader } from "@/shared/components/site-header";
import { PUBLIC_PAGE_CLASS } from "@/features/landing/ui/public-page";

/**
 * The frame every company page wears: the header, the page, the footer.
 *
 * **Nothing else since October 2026.** It used to draw each page's opening
 * (`PageIntro`) and end on a "see also" strip of three cards. The strip
 * repeated the footer right under it, and one opening for five pages is what
 * made them read as a template — so each page now brings its own, on the
 * home page's pieces (`shared/components/photo-sections.tsx`).
 */
export function CompanyPage({ children }: { children: ReactNode }) {
  return (
    <main className={PUBLIC_PAGE_CLASS}>
      <SiteHeader current="none" />
      {children}
      <Footer />
    </main>
  );
}
