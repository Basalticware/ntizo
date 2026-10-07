import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  ReceiptText,
  Route as RouteIcon,
  User,
} from "lucide-react";
import { Badge, Button, Skeleton, cn } from "@ntizo/frontend-ui";
import { BrandImage } from "@/shared/components/brand-image";
import { EmptyCard } from "@/shared/components/empty-card";
import { initialsFrom } from "@/shared/lib/initials";
import { slotWording } from "@/features/checkout/domain/slot-wording";
import { formatRating } from "@/shared/domain/rating";
import { formatAmount } from "@/features/directory/services/domain/service-card";
import { MessageProviderButton } from "@/features/directory/ui/provider-rail";
import { useCurrentUser } from "@/features/user/viewmodel/use-current-user";
import {
  BACK_LINK_CLASS,
  CUSTOMER_CARD,
  CardHead,
  DETAIL_GRID,
  DETAIL_TITLE,
  Fact,
  MUTED_SMALL,
} from "@/features/account/ui/customer-page";
import {
  canCancel,
  canPay,
  shortReference,
  timeLeftWording,
  upcomingSteps,
} from "../domain/status";
import { useMyBooking } from "../viewmodel/use-my-bookings";
import { BookingStatusBadge } from "./booking-status-badge";
import { CancelDialog } from "./cancel-dialog";
import { PayDialog } from "./pay-dialog";

/** A red outline, quiet next to a filled primary button — never a filled destructive. */
const DESTRUCTIVE_OUTLINE =
  "border-[color-mix(in_srgb,var(--color-destructive)_35%,transparent)] text-[var(--color-destructive)] hover:border-[var(--color-destructive)] hover:bg-[color-mix(in_srgb,var(--color-destructive)_6%,transparent)]";

/**
 * "4,8 ★", "Verificado", or both joined by " · " — never a stray separator
 * for the half that has nothing to say. An unreviewed provider shows no
 * score rather than a zero, and an unverified one shows no badge rather than
 * a greyed-out promise, the same rule `checkout-rail`'s trust line states in
 * full.
 */
function trustLine(
  rating: number | null,
  verified: boolean,
  locale: string,
  verifiedLabel: string,
): string {
  const bits: string[] = [];
  if (rating !== null) bits.push(`${formatRating(rating, locale)} ★`);
  if (verified) bits.push(`✓ ${verifiedLabel}`);
  return bits.join(" · ");
}

/** "1 de Setembro, 14:07" — the reader's own long date beside their own short time. */
function paidOnWording(iso: string, locale: string): string {
  const at = new Date(iso);
  const date = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
  }).format(at);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(at);
  return `${date}, ${time}`;
}

/**
 * One booking, the story of it: what was booked, with whom, where, the total
 * with no split, and a timeline that says where it stands and what it is
 * waiting for.
 *
 * Laid out as the provider's booking detail — the loading/error/not-found
 * ladder, the `timeLeftWording` countdown, the timeline's dot and
 * `defaultValue` fallback, one 14px card per section and a rail with the
 * money and the timeline — but answers a different question. The provider's
 * header is a decision (Aceitar/Recusar, live only while undecided); this one
 * is a status report. Both Cancelar and Pagar open their own dialog
 * (`CancelDialog`, `PayDialog`) rather than acting directly off this header —
 * neither button is safe to fire from a stale row, and both dialogs re-check
 * the booking themselves before doing anything irreversible.
 *
 * **No reveal-gating.** The provider's page hides the customer's contact and
 * exact address until payment lands, because it is being shown someone
 * else's details. This page shows the caller their own booking, in full,
 * whatever its status — there is nothing here for the customer to be
 * protected from.
 *
 * **The not-found card cannot say more than it knows.** `bookingById`
 * answers `null` for a booking that does not exist and for one that exists
 * but belongs to someone else, alike (`GetMyBookingProjection` never learns
 * which) — so this page reads one null and shows one card, rather than
 * inventing a "not yours" message the read has no way to back up.
 */
export function BookingPage() {
  const { t, i18n } = useTranslation("bookings");
  const { t: td } = useTranslation("directory");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { bookingId } = useParams({ strict: false }) as { bookingId: string };
  const query = useMyBooking(bookingId);
  const b = query.data;
  // Same reason `bookings-page.tsx` reads it: `bookingById` carries no
  // phone field, and the profile is the one place this page has it.
  const { data: currentUser } = useCurrentUser();
  // Measured from the moment the page was answered, not from whenever React
  // last re-rendered — the same bargain the list and the provider's own
  // detail page make, for the same reason: a re-render for an unrelated
  // cause must not move a countdown that nothing about the data changed.
  const now = useMemo(
    () => new Date(query.dataUpdatedAt || Date.now()),
    [query.dataUpdatedAt],
  );
  // Declared before the loading/error/not-found ladder below, with every
  // other hook — a booking that later turns out not to exist must not have
  // skipped a hook the render after it does.
  const [cancelling, setCancelling] = useState(false);
  const [paying, setPaying] = useState(false);

  const back = (
    <Link to="/bookings" className={BACK_LINK_CLASS}>
      <ArrowLeft aria-hidden="true" />
      {t("title")}
    </Link>
  );

  if (query.isLoading) {
    return (
      <div className="grid w-full max-w-[1400px] gap-4">
        {back}
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-48 w-full rounded-[14px]" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="grid w-full max-w-[1400px] gap-4">
        {back}
        <p role="alert" className="type-body text-[var(--color-destructive)]">
          {t("loadError")}
        </p>
      </div>
    );
  }

  // **A draft is not a booking this page may draw, and the guard belongs
  // here rather than in the query.** `findForCustomer` deliberately has no
  // `<> 'DRAFT'` clause — unlike `findForProvider` — because checkout's steps
  // 2 and 3 read the customer's own draft through that very read, and adding
  // one would break the flow this page is the destination of. So the refusal
  // is the caller's: reached by URL, `/bookings/<a draft's id>` used to draw
  // a pill reading the literal `status.DRAFT` (there is no such key, in any
  // locale, correctly) over a timeline claiming a request was sent and an
  // address block that is empty because a draft never reached step 2.
  //
  // The same card a stranger's booking gets, and for the same reason the
  // card exists at all: a draft is a checkout half-finished, and the branch
  // rule is that `DRAFT` appears in no tab and on no customer page.
  if (!b || b.status === "DRAFT") {
    return (
      <div className="grid w-full max-w-[1400px] gap-4">
        {back}
        <EmptyCard framed title={t("notFoundTitle")} body={t("notFoundBody")} />
      </div>
    );
  }

  const when = slotWording(b.startsAt, b.endsAt, locale, b.timezone);
  const address = [b.addressLine, b.addressDistrict, b.addressCity]
    .filter(Boolean)
    .join(", ");
  const trust = trustLine(
    b.providerRatingAverage,
    b.providerVerified,
    locale,
    t("verified"),
  );
  // For the booking waiting to be paid, both live at once — the list's own
  // row shows one action because it has room for one; this page shows both,
  // Pagar primary and Cancelar a quiet destructive outline, as the mockup
  // draws it. Every other cancellable status (only AWAITING_PROVIDER, since
  // `canPay` already claimed PENDING_PAYMENT) gets Cancelar alone.
  const showBoth = canPay(b.status);
  const showCancelOnly = !showBoth && canCancel(b.status);

  return (
    <div className="w-full max-w-[1400px]">
      {back}

      <header className="mt-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-5">
        <div className="flex min-w-0 items-start gap-4 sm:gap-5">
          {/* The picture of what was booked, at the top of the record it
              belongs to — same component and same reasons as the list's own
              thumbnail, a size up. */}
          <span className="h-16 w-16 shrink-0 overflow-hidden rounded-[14px] sm:h-[88px] sm:w-[88px]">
            <BrandImage
              src={b.serviceImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </span>
          <div className="min-w-0">
            <h1 className={DETAIL_TITLE}>
              {b.serviceName}
              {b.optionName ? ` · ${b.optionName}` : ""}
            </h1>
            <p className="m-0 mt-2 text-base text-[var(--color-muted-foreground)]">
              {b.providerName}
              {trust ? ` · ${trust}` : null}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <BookingStatusBadge status={b.status} />
              <Badge tone="neutral" className="tabular-nums">
                {t("reference", { ref: shortReference(b.id) })}
              </Badge>
            </div>
          </div>
        </div>

        {/* Header actions: both while payment is what is being waited for,
            Cancelar alone while the provider is still deciding, a pointer to
            support once the booking is paid, and nothing for every other
            (terminal) status — there is no live action left to offer.

            **Full width and stacked on a phone, inline from `sm` up.** They
            used to wrap under the header at whatever width their words gave
            them, which on a 360px screen left Pagar as a half-width button
            beside Cancelar — neither an easy target, and the destructive one
            exactly as prominent as the action actually being waited for.
            Stacked in their written order, Pagar lands at the bottom of the
            pair, which is where a thumb already is. No `flex-col-reverse` to
            arrange that: reading order and tab order would then disagree with
            what is on the screen.

            They stay where the eye lands rather than at the foot of the page:
            a Pagar that has to be scrolled to is a Pagar that gets put off. */}
        {showBoth ? (
          <div
            role="group"
            aria-label={t("actionsLabel")}
            className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row"
          >
            <Button
              type="button"
              variant="outline"
              className={cn(DESTRUCTIVE_OUTLINE, "w-full sm:w-auto")}
              onClick={() => setCancelling(true)}
            >
              {t("cancelBooking")}
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => setPaying(true)}
            >
              {/* `formatAmount`, not `formatHeadlinePrice`: the button
                  names the amount this press will debit, and the headline
                  formatter rounds to whole units. */}
              {t("payAmount", {
                amount: formatAmount(b.priceMinor, b.currency, locale),
              })}
            </Button>
          </div>
        ) : showCancelOnly ? (
          <Button
            type="button"
            variant="outline"
            className={cn(DESTRUCTIVE_OUTLINE, "w-full sm:w-auto")}
            onClick={() => setCancelling(true)}
          >
            {t("cancelBooking")}
          </Button>
        ) : b.status === "CONFIRMED" ? (
          <div className="max-w-[260px] sm:text-right">
            <p className={cn("m-0", MUTED_SMALL)}>{t("supportPrompt")}</p>
            <Link
              to="/contact"
              className="text-[15px] font-semibold text-[var(--color-primary)] hover:underline"
            >
              {t("supportCta")}
            </Link>
          </div>
        ) : null}
      </header>

      <div className={cn("mt-7", DETAIL_GRID)}>
        {/* **Second on a phone, first on a laptop.** One column stacks in
            source order, and the source order is the two-column layout's: the
            record on the left, the money and the timeline in the rail on the
            right. Stacked, that put "quanto pago" and "onde é que isto está"
            below the address, the duration and the customer's own note —
            three blocks the reader already knows, since they wrote them. The
            `order` pair moves the rail above them under `lg` and puts it back
            beside them above it. */}
        <div className="order-2 grid min-w-0 gap-6 lg:order-1">
          <section className={CUSTOMER_CARD}>
            <CardHead
              icon={CalendarDays}
              title={t("section.appointment")}
              hint={t("section.appointmentBlurb")}
            />
            <dl className="m-0 mt-5 grid gap-5 sm:grid-cols-2">
              <Fact label={t("when")}>
                <span className="block font-semibold text-[var(--color-headline)]">
                  {when.date}
                </span>
                <span className="tabular-nums">
                  {when.start} – {when.end}
                </span>
              </Fact>
              <Fact label={t("duration")}>
                {t("minutes", { count: b.durationMinutes })}
              </Fact>
              <Fact label={t("where")}>
                {b.locationType
                  ? td(`filterWhereOption.${b.locationType}`, {
                      defaultValue: "",
                    })
                  : null}
                {address && (
                  <>
                    <br />
                    {address}
                  </>
                )}
              </Fact>
              {b.addressDirections && (
                <Fact label={t("directions")}>{b.addressDirections}</Fact>
              )}
            </dl>
          </section>

          <section className={CUSTOMER_CARD}>
            <CardHead
              icon={User}
              title={t("section.provider")}
              hint={t("section.providerBlurb")}
            />
            <div className="mt-5 flex flex-wrap items-center gap-4">
              {/* The logo when there is one, initials when there is not —
                  **not** `BrandImage`'s mark, which is right for a missing
                  photograph and wrong for a missing face: the Ntizo mark
                  where a business's own avatar goes reads as "booked with
                  Ntizo". Initials say who, and say it in the business's own
                  name. `BrandImage` still covers the logo that exists in the
                  data but no longer at its URL, which is most seeded ones on
                  dev. */}
              {b.providerLogoUrl ? (
                <span className="h-[58px] w-[58px] shrink-0 overflow-hidden rounded-full">
                  <BrandImage
                    src={b.providerLogoUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] text-sm font-semibold text-[var(--color-primary)]"
                >
                  {initialsFrom(b.providerName)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="m-0 text-base font-bold text-[var(--color-headline)]">
                  {b.providerName}
                </p>
                {trust && (
                  <p className={cn("m-0 mt-0.5", MUTED_SMALL)}>{trust}</p>
                )}
              </div>
              {/* The slug has been on this read since checkout needed it; the
                  page it addresses is public and carries the reviews, the
                  other services and the trading hours — everything a customer
                  might want to check that a booking's own record has no
                  business repeating. */}
              <Link
                to="/providers/$slug"
                params={{ slug: b.providerSlug }}
                className="shrink-0 text-[15px] font-semibold text-[var(--color-primary)] hover:underline"
              >
                {t("viewProfile")}
              </Link>
            </div>

            {/* Under the name rather than in the header: talking to the
                provider is not one of the booking's own actions — it is
                available on every status, including the ones where there is
                nothing left to cancel or pay. Outline, because on this page
                the filled button is Pagar. */}
            <div className="mt-5 border-t border-[var(--color-line-2)] pt-5">
              <MessageProviderButton
                providerId={b.providerId}
                variant="outline"
                label={t("message")}
              />
            </div>
          </section>

          {b.description && b.description.trim() !== "" && (
            <section className={CUSTOMER_CARD}>
              <CardHead
                icon={FileText}
                title={t("section.note")}
                hint={t("section.noteBlurb")}
              />
              <p className="m-0 mt-5 rounded-[10px] bg-[var(--color-blue-softer)] p-4 text-[15px] whitespace-pre-line text-[var(--color-ink-2)]">
                {b.description.trim()}
              </p>
            </section>
          )}
        </div>

        <aside className="order-1 grid gap-6 lg:order-2 lg:sticky lg:top-6">
          {/* The total the customer pays, the sentence saying it carries no
              markup, and — once paid — when. No split, ever: the commission
              is the provider's payout being reduced, not a charge this
              customer's screen has any business showing. */}
          <section className={CUSTOMER_CARD}>
            <CardHead icon={ReceiptText} title={t("moneyCaption")} />
            <div className="mt-5 flex items-baseline justify-between gap-3">
              <span className="text-[15px] text-[var(--color-ink-2)]">
                {b.paidAt ? t("totalPaid") : t("totalDue")}
              </span>
              {/* A total, never a headline — "Total a pagar" is what the
                  customer owes and "Total pago" is a receipt, and neither may
                  be rounded to whole units. */}
              <span className="text-[22px] font-extrabold text-[var(--color-headline)] tabular-nums">
                {formatAmount(b.priceMinor, b.currency, locale)}
              </span>
            </div>
            {b.paidAt && (
              <p className="m-0 mt-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-ok-fg)]">
                ✓ {t("paidOn", { date: paidOnWording(b.paidAt, locale) })}
              </p>
            )}
            <p className={cn("m-0 mt-3", MUTED_SMALL)}>{t("moneyNote")}</p>
          </section>

          <section className={CUSTOMER_CARD}>
            <CardHead icon={RouteIcon} title={t("timelineCaption")} />
            <ol className="m-0 mt-5 grid list-none gap-4 p-0">
              {b.timeline.map((e, i) => {
                // A reason this locale has no word for still gets a line —
                // `defaultValue` falls back to a hop rather than a raw
                // token, the same rule the provider's own timeline follows.
                const label = t(`timeline.${e.reason}`, {
                  defaultValue: t("timeline.unknown"),
                });
                const left = e.pending ? timeLeftWording(e.at, now) : null;
                // A pending deadline reads as a countdown, in the same words
                // the list's own row uses for the same clock; anything
                // already behind us — every settled hop, and a pending one
                // whose deadline has since passed — reads as the instant it
                // happened.
                const caption =
                  left && e.reason === "pay_by"
                    ? t("payIn", { time: left })
                    : left && e.reason === "respond_by"
                      ? t("respondIn", { time: left })
                      : new Intl.DateTimeFormat(locale, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: b.timezone,
                        }).format(new Date(e.at));
                return (
                  <li
                    key={`${e.at}-${e.reason}-${i}`}
                    aria-label={label}
                    className="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3"
                  >
                    {/* Hollow for a deadline still ahead, filled for
                        something that already happened — the same shape the
                        provider's own timeline draws. */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-1.5 h-2.5 w-2.5 rounded-full",
                        e.pending
                          ? "border-2 border-[var(--color-primary)]"
                          : "bg-[var(--color-primary)]",
                      )}
                    />
                    <div>
                      <p
                        className={cn(
                          "m-0 text-[15px]",
                          e.pending
                            ? "text-[var(--color-muted-foreground)]"
                            : "font-semibold text-[var(--color-headline)]",
                        )}
                      >
                        {label}
                      </p>
                      <p className={cn("m-0 tabular-nums", MUTED_SMALL)}>
                        {caption}
                      </p>
                    </div>
                  </li>
                );
              })}

              {/* What has not happened yet — greyed, and with no date under
                  it, because there is none to give. The server's timeline is
                  a history: it answers "what happened to my request" and
                  leaves a first-time customer to guess "and then what?".
                  These are the hops still to come, read off the state machine
                  by `upcomingSteps` so the page can only ever name a step
                  this booking can actually reach — nothing after CONFIRMED,
                  because nothing after CONFIRMED has a transition. */}
              {upcomingSteps(b.status).map((step) => (
                <li
                  key={`ahead-${step}`}
                  aria-label={t(`timeline.ahead.${step}`)}
                  className="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3"
                >
                  {/* Filled, but in the muted grey rather than the brand blue
                      — a hollow ring is already spent on the deadline that is
                      running, and these are a step further off than that. */}
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[var(--color-border)]"
                  />
                  <p className="m-0 text-[15px] text-[var(--color-muted-foreground)]">
                    {t(`timeline.ahead.${step}`)}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      {cancelling && (
        <CancelDialog booking={b} onClose={() => setCancelling(false)} />
      )}
      {paying && (
        <PayDialog
          booking={b}
          phone={currentUser?.phoneNumber ?? null}
          onClose={() => setPaying(false)}
        />
      )}
    </div>
  );
}
