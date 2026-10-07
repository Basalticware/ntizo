import { Hero } from "@/features/landing/ui/hero";
import { CategoryGrid } from "@/features/landing/ui/category-grid";
import { PopularServices } from "@/features/landing/ui/popular-services";
import { VerifiedProviders } from "@/features/landing/ui/verified-providers";
import { HomeBanner } from "@/features/landing/ui/home-banner";
import { TrustBand } from "@/features/landing/ui/trust-band";
import { CustomerReviews } from "@/features/landing/ui/customer-reviews";
import { ProviderBand } from "@/features/landing/ui/provider-band";
import { Footer } from "@/features/landing/ui/footer";
import { PUBLIC_PAGE_CLASS } from "@/features/landing/ui/public-page";

/**
 * The customer home page.
 *
 * White, on the design system's own tokens. It carried its palette to its
 * sections as local custom properties because it painted itself a tinted blue
 * nothing else on the site used; every colour here is now a token every other
 * page shares, so there is nothing to carry.
 *
 * The order is the October 2026 home mockup's: the offer and the search on a
 * photograph, what you can get done, what it costs, the household trades,
 * who does it, why it is safe to book, what customers said, and then — once
 * — the offer to the person who might do the work. "How it works" stays
 * gone; the client asked for it removed outright once the page went live.
 *
 * `PUBLIC_PAGE_CLASS` is `/services`' inset, so the header, every section
 * and the footer start on the line the listings start on.
 */
export function LandingPage() {
  return (
    <main
      className={`min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)] ${PUBLIC_PAGE_CLASS}`}
    >
      <Hero />
      <CategoryGrid />
      <PopularServices />
      <HomeBanner />
      <VerifiedProviders />
      <TrustBand />
      <CustomerReviews />
      <ProviderBand />
      <Footer flush />
    </main>
  );
}
