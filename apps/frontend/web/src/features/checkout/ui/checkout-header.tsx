import type { ReactNode } from "react";
import { SiteHeader } from "@/shared/components/site-header";
import { CheckoutSteps, type CheckoutStep } from "@/features/checkout/ui/checkout-steps";

/**
 * The top of every checkout page, as `client/reserva.html` draws it: the
 * site's own header, then a row with the way back on the left and the steps
 * centred.
 *
 * The public header rather than a bar of its own. The checkout used to wear a
 * stripped one — the logo, the steps and "Reserva segura" — on the reasoning
 * that the site's navigation is an invitation to wander off with a slot on
 * hold. The October mockups the user approved put the ordinary header here,
 * and a hold that lapses is already handled: the slot is released and the
 * customer is sent back to step 1 with the reason.
 *
 * Three columns from `md` — `1fr auto 1fr` — so the steps sit at the true
 * centre of the row whatever the back link's width is. Below `md` the steps
 * take a row of their own under the back link.
 */
export function CheckoutHeader({ current, back }: { current: CheckoutStep; back?: ReactNode }) {
  return (
    <>
      <SiteHeader current="services" />
      <div className="public-inset grid grid-cols-1 items-center gap-y-5 pt-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:pt-8">
        <div className="justify-self-start empty:hidden md:empty:block">{back}</div>
        <div className="w-full md:w-auto md:justify-self-center">
          <CheckoutSteps current={current} />
        </div>
      </div>
    </>
  );
}
