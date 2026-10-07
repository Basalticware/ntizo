import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CheckoutSteps, type CheckoutStep } from "@/features/checkout/ui/checkout-steps";

/**
 * The top of every checkout page: a bar with only the logo, then a row with
 * the way back on the left and the steps centred.
 *
 * No site navigation. The October mockups put the public header here, and it
 * shipped that way; on 2026-10-07 the user asked for the checkout to be a
 * focused space instead — the steps and the way back, nothing else. So the
 * destinations, the language picker and the account are gone from these
 * pages. The logo stays as the one way home, and a hold that lapses is still
 * handled on step 1 as before.
 *
 * Three columns from `md` — `1fr auto 1fr` — so the steps sit at the true
 * centre of the row whatever the back link's width is. Below `md` the steps
 * take a row of their own under the back link.
 */
export function CheckoutHeader({ current, back }: { current: CheckoutStep; back?: ReactNode }) {
  return (
    <>
      <header className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
        <div className="public-inset flex h-16 items-center md:h-[67px]">
          {/* `max-w-none` undoes preflight's `max-width: 100%` on images, as
              in `SiteHeader`. */}
          <Link to="/" className="inline-flex">
            <img src="/brand/logo-primary.svg" alt="Ntizo" className="h-8 w-auto max-w-none" />
          </Link>
        </div>
      </header>
      <div className="public-inset grid grid-cols-1 items-center gap-y-5 pt-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:pt-8">
        <div className="justify-self-start empty:hidden md:empty:block">{back}</div>
        <div className="w-full md:w-auto md:justify-self-center">
          <CheckoutSteps current={current} />
        </div>
      </div>
    </>
  );
}
