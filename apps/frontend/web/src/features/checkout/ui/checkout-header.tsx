import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CheckoutSteps, type CheckoutStep } from "@/features/checkout/ui/checkout-steps";

/**
 * The top of every checkout page: one bar with the logo, the steps and the
 * way back — nothing else.
 *
 * No site navigation. The October mockups put the public header here, and it
 * shipped that way; on 2026-10-07 the user asked for the checkout to be a
 * focused space — the steps and the way back — and then for those to sit in
 * the bar itself rather than in a row under it. The logo stays as the one way
 * home, and a hold that lapses is still handled on step 1 as before.
 *
 * From `lg`, one row: `1fr auto 1fr`, so the steps sit at the true centre
 * whatever the logo and the back link measure. Below `lg` the steps (about
 * 700px wide with their labels) do not fit beside the other two, so they
 * take a second row inside the same bar. One `CheckoutSteps` either way —
 * placed by the grid, not drawn twice — so there is one steps landmark.
 */
export function CheckoutHeader({ current, back }: { current: CheckoutStep; back?: ReactNode }) {
  return (
    <>
      <header className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
        <div className="public-inset grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-4 py-3.5 lg:h-[76px] lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:py-0">
          {/* `max-w-none` undoes preflight's `max-width: 100%` on images, as
              in `SiteHeader`. */}
          <Link to="/" className="inline-flex justify-self-start">
            <img src="/brand/logo-primary.svg" alt="Ntizo" className="h-8 w-auto max-w-none" />
          </Link>
          <div className="flex items-center justify-self-end empty:hidden lg:col-start-3 lg:row-start-1 lg:empty:flex">{back}</div>
          <div className="col-span-2 pb-1 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:pb-0">
            <CheckoutSteps current={current} />
          </div>
        </div>
      </header>
      {/* The gap the steps row used to give the page under it. */}
      <div aria-hidden="true" className="h-6 md:h-8" />
    </>
  );
}
