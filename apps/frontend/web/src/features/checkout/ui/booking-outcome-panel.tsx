import type { ComponentType, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { CalendarX, Check, Smartphone } from "lucide-react";
import { buttonVariants, cn } from "@ntizo/frontend-ui";
import type { CheckoutBooking } from "@/features/checkout/viewmodel/use-checkout";
import type { CheckoutOutcome } from "@/features/checkout/domain/booking-outcome";
import { momentWording } from "@/features/checkout/domain/slot-wording";
import { BookingSummaryCard } from "@/features/checkout/ui/booking-summary-card";
import {
  CHECKOUT_LEDE,
  CHECKOUT_TITLE,
} from "@/features/checkout/ui/checkout-page-frame";

/** Full width and stacked on a phone, side by side from `sm`. */
const ACTION = "h-12 w-full rounded-[10px] px-7 sm:w-auto";

/**
 * Where a customer goes from a page whose errand is finished: their own
 * booking first, browsing second.
 *
 * `/bookings` was a placeholder for as long as this panel existed — see
 * `bookings.$bookingId.tsx` — so every outcome here used to send a customer
 * who had just committed nowhere near the thing they had just done. It reads
 * real rows now, and the booking's own page is the honest answer to "what
 * happens to this one next": the same page whether they arrive from here, a
 * notification, or the list. "Voltar aos serviços" stays, quieter, for
 * somebody who came to book something else and has no interest in the one
 * they just finished.
 */
export function BrowseMoreLink({ bookingId }: { bookingId: string }) {
  const { t } = useTranslation("checkout");
  return (
    <>
      <Link
        to="/bookings/$bookingId"
        params={{ bookingId }}
        className={cn(
          buttonVariants(),
          ACTION,
          "bg-[var(--color-blue-public)]",
        )}
      >
        {t("viewBookingAction")}
      </Link>
      <Link
        to="/services"
        search={{}}
        className={cn(buttonVariants({ variant: "secondary" }), ACTION)}
      >
        {t("browseMoreAction")}
      </Link>
    </>
  );
}

/** Back to step 1, on the package this booking was for, as a choice rather than a redirect. */
function PickAnotherTimeLink({ booking }: { booking: CheckoutBooking }) {
  const { t } = useTranslation("checkout");
  return (
    <Link
      to="/book/$serviceId"
      params={{ serviceId: booking.serviceId }}
      search={{ optionId: booking.serviceOptionId ?? undefined }}
      className={cn(buttonVariants(), ACTION, "bg-[var(--color-blue-public)]")}
    >
      {t("unansweredAction")}
    </Link>
  );
}

type Tone = "success" | "info" | "ended";

const MARK_TONE: Record<Tone, string> = {
  success:
    "bg-[var(--color-ok-bg)] text-[var(--color-ok-fg)] ring-[color-mix(in_srgb,var(--color-ok-bg)_45%,transparent)]",
  info: "bg-[var(--color-info-bg)] text-[var(--color-info-fg)] ring-[color-mix(in_srgb,var(--color-info-bg)_45%,transparent)]",
  ended:
    "bg-[var(--color-surface-raised)] text-[var(--color-ink-2)] ring-[color-mix(in_srgb,var(--color-surface-raised)_45%,transparent)]",
};

/** The booking's own address, as the server holds it once the request is sent. */
function bookedAddress(booking: CheckoutBooking): string | null {
  const line = [booking.addressLine, booking.addressDistrict, booking.addressCity]
    .filter(Boolean)
    .join(", ");
  return line || null;
}

/**
 * Every outcome's page, in one shape: a mark, the sentence that is true of
 * this booking, what happens next where something does, the record of what
 * was asked for, and the way on.
 *
 * The record is on every outcome, not only on the happy one: a customer told
 * "o prestador não aceitou" wants to see *which* request, and it is the same
 * card they would have seen had it gone the other way.
 */
function OutcomeLayout({
  tone,
  icon: Icon,
  title,
  body,
  next,
  booking,
  address,
  actions,
}: {
  tone: Tone;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
  /** What happens next — only where something does. */
  next?: ReactNode;
  booking: CheckoutBooking;
  address: string | null;
  actions?: ReactNode;
}) {
  return (
    <section
      aria-labelledby="outcome-title"
      className="mx-auto grid w-full max-w-[1040px] gap-8 md:gap-10"
    >
      <header className="grid justify-items-center text-center">
        <span
          aria-hidden="true"
          className={cn(
            "grid h-[76px] w-[76px] place-items-center rounded-full ring-[10px] md:h-[88px] md:w-[88px]",
            MARK_TONE[tone],
          )}
        >
          <Icon className="h-9 w-9 md:h-10 md:w-10" strokeWidth={2.4} />
        </span>
        <h1 id="outcome-title" className={cn(CHECKOUT_TITLE, "mt-6")}>
          {title}
        </h1>
        <p className={cn(CHECKOUT_LEDE, "max-w-[56ch]")}>{body}</p>
      </header>

      <div
        className={cn(
          "grid gap-6",
          next
            ? "lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start"
            : "mx-auto w-full max-w-[560px]",
        )}
      >
        {next}
        <BookingSummaryCard booking={booking} address={address} />
      </div>

      {actions && (
        <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          {actions}
        </div>
      )}
    </section>
  );
}

/**
 * The real order of things after a request is sent, as three steps: the
 * provider confirms, the customer pays by M-Pesa when the prompt arrives, the
 * work happens. Nothing is held in between — the platform takes no money
 * until the provider has said yes, and then takes it from the customer's own
 * handset.
 *
 * The first step carries the provider's deadline when there is one. Written
 * without a number of hours otherwise: the window is a live setting, and a
 * figure printed here would go stale silently.
 */
function WhatHappensNext({
  provider,
  by,
}: {
  provider: string;
  by: { date: string; time: string } | null;
}) {
  const { t } = useTranslation("checkout");
  const steps = [
    {
      title: t("outcome.next1Title", { provider }),
      body: by
        ? t("outcome.next1Body", { date: by.date, time: by.time })
        : t("outcome.next1BodyNoDeadline"),
    },
    { title: t("outcome.next2Title"), body: t("outcome.next2Body") },
    { title: t("outcome.next3Title"), body: t("outcome.next3Body", { provider }) },
  ];

  return (
    <section
      aria-labelledby="outcome-next-title"
      className="rounded-[14px] bg-[var(--color-blue-softer)] p-5 sm:p-6"
    >
      <h2
        id="outcome-next-title"
        className="text-lg leading-snug font-bold text-[var(--color-headline)]"
      >
        {t("outcome.nextTitle")}
      </h2>
      {/* An `ol`, so it is announced as three ordered steps; the drawn discs
          replace the browser's own "1." for the eye only. */}
      <ol className="m-0 mt-5 grid list-none gap-5 p-0">
        {steps.map((step, index) => (
          <li key={step.title} className="grid grid-cols-[36px_minmax(0,1fr)] gap-x-4">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-blue-public)] text-[15px] font-bold text-white tabular-nums"
            >
              {index + 1}
            </span>
            <div className="min-w-0 pt-1">
              <p className="m-0 text-base font-bold text-[var(--color-headline)]">
                {step.title}
              </p>
              <p className="m-0 mt-1 text-[14.5px] leading-[1.5] text-[var(--color-ink-2)]">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The request is with the provider — the screen checkout actually ends on.
 *
 * **It ends here rather than navigating**, which is the point: this is the
 * only page that knows what was sent and by when it has to be answered. So
 * the customer reads back the commitment they just made, the deadline the
 * other side is now held to, and what happens after that.
 *
 * **"Enviado", never "confirmado".** The provider has not said yes, and the
 * mark is a tick for the sending, not for the booking: the lede says in so
 * many words that nothing is confirmed and nothing has been charged.
 *
 * `deadline` is nullable because `expiresAt` is — the column is. Every path
 * into `AWAITING_PROVIDER` stamps it (`SubmitBookingCommand` computes it and
 * `Booking.submit` writes it), so this is a shape the type permits and the
 * flow does not produce: the step loses its deadline rather than gaining an
 * invented one.
 *
 * `address` defaults to the booking's own. The page that has just sent the
 * request passes the one it sent, because the booking in its cache is still
 * the draft, which has none.
 */
export function SentPanel({
  booking,
  deadline,
  address = bookedAddress(booking),
}: {
  booking: CheckoutBooking;
  deadline: string | null;
  address?: string | null;
}) {
  const { t, i18n } = useTranslation("checkout");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  // The service's zone, exactly as the slot was rendered in. A deadline in
  // the browser's zone beside a slot in the provider's would put two clocks
  // on one page, and make whichever the customer checked look wrong.
  const by = deadline
    ? momentWording(deadline, locale, booking.timezone)
    : null;

  return (
    <OutcomeLayout
      tone="success"
      icon={Check}
      title={t("sentTitle")}
      body={t("outcome.sentLede", { provider: booking.providerName })}
      next={<WhatHappensNext provider={booking.providerName} by={by} />}
      booking={booking}
      address={address}
      actions={<BrowseMoreLink bookingId={booking.id} />}
    />
  );
}

/**
 * What a checkout page shows for a booking that is no longer its to finish.
 *
 * **One component, because both steps land here and they were telling
 * opposite stories.** Step 3 knew that an `EXPIRED` request means the
 * provider never answered; step 2 fell through to a catch-all and told the
 * same customer, one back-press later, that "the provider will answer as soon
 * as they can". Two panels drawn from one reading of the booking is the fix;
 * a second copy of the branch is how it came back.
 *
 * **Each outcome gets an answer that is true of it**, rather than the eight
 * non-draft statuses sharing one sentence. `awaitingPayment` is the sharp
 * one: an operator hand-accepts a request (the stated mode this phase), the
 * charge sweep pushes an M-Pesa prompt, and the customer has a window in
 * which to do something. Told instead that there is nothing left to do, they
 * do nothing, the window closes, the booking is `CANCELLED`, and the provider
 * is told the customer did not pay.
 *
 * `deadline` is not printed for anything but `awaitingProvider`: `expiresAt`
 * past that status is somebody else's clock, and a countdown or a deadline
 * drawn from it would be checkout counting a window it has no part in.
 */
export function BookingOutcomePanel({
  booking,
  outcome,
}: {
  booking: CheckoutBooking;
  /**
   * Never `"draft"` or `"released"` — both are handled by the page before it
   * gets here, one by rendering its form and the other by navigating away.
   * Excluded in the type so a page that forgets cannot reach a panel with no
   * answer for it.
   */
  outcome: Exclude<CheckoutOutcome, "draft" | "released">;
}) {
  const { t } = useTranslation("checkout");
  const address = bookedAddress(booking);

  switch (outcome) {
    case "awaitingProvider":
      // The deadline comes off `expiresAt`, which on an `AWAITING_PROVIDER`
      // booking *is* the `respondBy` the send answered with —
      // `bookingReadModel` says so — which is how a refresh, or the back
      // button onto step 2, tells the same story as the just-sent screen
      // without keeping anything of its own.
      return <SentPanel booking={booking} deadline={booking.expiresAt} />;

    case "unanswered":
      return (
        <OutcomeLayout
          tone="ended"
          icon={CalendarX}
          title={t("unansweredTitle")}
          body={t("unansweredBody")}
          booking={booking}
          address={address}
          // Offered, not imposed: picking another time is a choice they make.
          actions={<PickAnotherTimeLink booking={booking} />}
        />
      );

    case "declined":
      return (
        <OutcomeLayout
          tone="ended"
          icon={CalendarX}
          title={t("declinedTitle")}
          body={t("declinedBody")}
          booking={booking}
          address={address}
          actions={<PickAnotherTimeLink booking={booking} />}
        />
      );

    case "awaitingPayment":
      return (
        <OutcomeLayout
          tone="info"
          icon={Smartphone}
          title={t("awaitingPaymentTitle")}
          body={t("awaitingPaymentBody")}
          booking={booking}
          address={address}
          // **No action, deliberately.** What this customer has to do is on
          // their handset, and every link this page could offer would lead
          // away from it. A button here would read as the way to finish.
        />
      );

    case "paymentLapsed":
      return (
        <OutcomeLayout
          tone="ended"
          icon={CalendarX}
          title={t("paymentLapsedTitle")}
          body={t("paymentLapsedBody")}
          booking={booking}
          address={address}
          actions={<PickAnotherTimeLink booking={booking} />}
        />
      );

    case "paid":
      return (
        <OutcomeLayout
          tone="success"
          icon={Check}
          title={t("paidTitle")}
          body={t("paidBody")}
          booking={booking}
          address={address}
          actions={<BrowseMoreLink bookingId={booking.id} />}
        />
      );
  }
}
