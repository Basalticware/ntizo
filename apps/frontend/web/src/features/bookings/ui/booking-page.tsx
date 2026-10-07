import { useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  FileText,
  Hourglass,
  Headset,
  Info,
  MapPin,
  Navigation,
  ShieldCheck,
  Star,
  Timer,
} from "lucide-react";
import type { CustomerBookingDetailDTO } from "@ntizo/shared/read-models";
import { Badge, Button, Skeleton, buttonVariants, cn } from "@ntizo/frontend-ui";
import { BrandImage } from "@/shared/components/brand-image";
import { EmptyCard } from "@/shared/components/empty-card";
import { initialsFrom } from "@/shared/lib/initials";
import { momentWording, slotWording } from "@/features/checkout/domain/slot-wording";
import { formatRating } from "@/shared/domain/rating";
import { formatAmount } from "@/features/directory/services/domain/service-card";
import { MessageProviderButton } from "@/features/directory/ui/provider-rail";
import { useCurrentUser } from "@/features/user/viewmodel/use-current-user";
import {
  BACK_LINK_CLASS,
  CUSTOMER_CARD,
  DETAIL_TITLE,
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

/** A card's own heading: navy, 18px, the size every customer detail card uses. */
const CARD_TITLE = "m-0 text-lg leading-snug font-bold text-[var(--color-headline)]";

/**
 * The rail's buttons: one under the other in the 360px rail and on a phone,
 * side by side in the single column between them, where a full-width Pagar
 * would be a 900px bar.
 */
const RAIL_BUTTON = "w-full sm:w-auto xl:w-full";

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
 * One booking, the story of it: where it stands and how it got there, what
 * was booked and where, with whom, the total with no split, and what the
 * customer can do about it now.
 *
 * Laid out as the October 2026 customer pages are: a breadcrumb, the service
 * name with its status beside it, a main column of 14px bordered cards, and
 * — from `xl` — a rail with the actions this status allows and the way to
 * support. Below `xl` the actions come first, straight under the header: a
 * Pagar that has to be scrolled to is a Pagar that gets put off.
 *
 * Both Cancelar and Pagar open their own dialog (`CancelDialog`,
 * `PayDialog`) rather than acting directly — neither button is safe to fire
 * from a stale row, and both dialogs re-check the booking themselves before
 * doing anything irreversible.
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
  const { t } = useTranslation("bookings");
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
      <div className="grid w-full gap-4">
        {back}
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-48 w-full rounded-[14px]" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="grid w-full gap-4">
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
      <div className="grid w-full gap-4">
        {back}
        <EmptyCard framed title={t("notFoundTitle")} body={t("notFoundBody")} />
      </div>
    );
  }

  return (
    <div className="w-full">
      <Breadcrumb current={b.serviceName} />
      <Header booking={b} />

      {/* Three areas, placed by the grid rather than drawn twice: the actions
          (first in source order, so a phone and the single column reach them
          before anything else), the record, and the way to support. From
          `xl` the record takes the left column across both rows and the two
          small cards stack in the rail beside it. */}
      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:grid-rows-[auto_1fr] xl:items-start">
        <ActionsCard
          booking={b}
          onCancel={() => setCancelling(true)}
          onPay={() => setPaying(true)}
        />

        <div className="grid min-w-0 gap-6 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          <StatusCard booking={b} now={now} />
          <DetailsCard booking={b} />
          <div className="grid gap-6 md:grid-cols-2 md:items-start">
            <ProviderCard booking={b} />
            <PriceCard booking={b} />
          </div>
        </div>

        <HelpCard confirmed={b.status === "CONFIRMED"} />
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

/** Início › Minhas reservas › the service. The last crumb is text, not a link to this page. */
function Breadcrumb({ current }: { current: string }) {
  const { t } = useTranslation("bookings");
  const link = "hover:text-[var(--color-headline)] hover:underline";
  const sep = (
    <li aria-hidden="true">
      <ChevronRight className="mx-2 h-3.5 w-3.5" strokeWidth={2} />
    </li>
  );
  return (
    <nav aria-label={t("detail.breadcrumbLabel")} className="text-sm leading-[1.2]">
      <ol className="m-0 flex list-none flex-wrap items-center p-0 text-[var(--color-faint)]">
        <li>
          <Link to="/" className={link}>
            {t("detail.home")}
          </Link>
        </li>
        {sep}
        <li>
          <Link to="/bookings" className={link}>
            {t("title")}
          </Link>
        </li>
        {sep}
        <li className="min-w-0 font-semibold [overflow-wrap:anywhere] text-[var(--color-ink-2)]">
          {current}
        </li>
      </ol>
    </nav>
  );
}

function Header({ booking: b }: { booking: CustomerBookingDetailDTO }) {
  const { t, i18n } = useTranslation("bookings");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const requested = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: b.timezone,
  }).format(new Date(b.createdAt));

  return (
    <header className="mt-5 flex min-w-0 items-start gap-4 sm:gap-5">
      {/* The picture of what was booked, at the top of the record it belongs
          to — same component and same reasons as the list's own thumbnail. */}
      <span className="h-16 w-16 shrink-0 overflow-hidden rounded-[14px] sm:h-[84px] sm:w-[84px]">
        <BrandImage
          src={b.serviceImageUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className={DETAIL_TITLE}>{b.serviceName}</h1>
          <BookingStatusBadge status={b.status} />
        </div>
        <p className="m-0 mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[15px] text-[var(--color-muted-foreground)]">
          {b.optionName && (
            <span className="text-[var(--color-ink-2)]">{b.optionName}</span>
          )}
          <Badge tone="neutral" className="tabular-nums">
            {t("reference", { ref: shortReference(b.id) })}
          </Badge>
          <span>{t("detail.requestedOn", { date: requested })}</span>
        </p>
      </div>
    </header>
  );
}

/**
 * The one sentence that says where this booking stands and what that means
 * for the customer — the money above all. Nothing is held by the platform at
 * any point: before the provider accepts nothing has been charged, and after
 * that the customer pays from their own handset.
 */
function statusExplanation(
  b: CustomerBookingDetailDTO,
  t: (key: string, options?: Record<string, unknown>) => string,
  locale: string,
): string {
  // `momentWording`, not `slotWording`: the date sits mid-sentence here, so
  // it keeps the locale's own lower-case weekday.
  const when = momentWording(b.startsAt, locale, b.timezone);
  const sentence = t(`detail.explain.${b.status}`, {
    provider: b.providerName,
    date: when.date,
    time: when.time,
    defaultValue: "",
  });
  // A booking that ended before any money moved says so. Said only where it
  // is true: `paidAt` is the receipt, and a cancelled booking that has one
  // is a support case, not a sentence this page may guess at.
  const ended = b.status === "CANCELLED" || b.status === "EXPIRED";
  return ended && !b.paidAt ? `${sentence} ${t("detail.notCharged")}` : sentence;
}

function StatusCard({
  booking: b,
  now,
}: {
  booking: CustomerBookingDetailDTO;
  now: Date;
}) {
  const { t, i18n } = useTranslation("bookings");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const explanation = statusExplanation(b, t, locale);
  const ahead = upcomingSteps(b.status);

  return (
    <section aria-labelledby="booking-status-title" className={CUSTOMER_CARD}>
      <h2 id="booking-status-title" className={CARD_TITLE}>
        {t("detail.statusTitle")}
      </h2>

      {explanation && (
        <p className="m-0 mt-4 flex items-start gap-3 rounded-[12px] bg-[var(--color-blue-softer)] px-4 py-3.5 text-[15px] leading-[1.5] text-[var(--color-ink-2)]">
          <Info
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-blue-public)]"
          />
          {explanation}
        </p>
      )}

      {/* The server's timeline is a history — every recorded change, plus the
          one deadline currently running — and the hops still to come are
          drawn under it, greyed and dateless, read off the state machine by
          `upcomingSteps` so the page can only name a step this booking can
          actually reach. */}
      <ol
        aria-label={t("timelineCaption")}
        className="m-0 mt-6 grid list-none gap-0 p-0"
      >
        {b.timeline.map((e, i) => {
          // A reason this locale has no word for still gets a line —
          // `defaultValue` falls back to a hop rather than a raw token, the
          // same rule the provider's own timeline follows.
          const label = t(`timeline.${e.reason}`, {
            defaultValue: t("timeline.unknown"),
          });
          const left = e.pending ? timeLeftWording(e.at, now) : null;
          // A pending deadline reads as a countdown, in the same words the
          // list's own row uses for the same clock; anything already behind
          // us — every settled hop, and a pending one whose deadline has
          // since passed — reads as the instant it happened.
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
          const last = i === b.timeline.length - 1 && ahead.length === 0;
          return (
            <TimelineStep
              key={`${e.at}-${e.reason}-${i}`}
              label={label}
              state={e.pending ? "running" : "done"}
              last={last}
            >
              <p
                className={cn(
                  "m-0 text-[15px]",
                  e.pending
                    ? "font-semibold text-[var(--color-ink-2)]"
                    : "font-semibold text-[var(--color-headline)]",
                )}
              >
                {label}
              </p>
              <p className={cn("m-0 tabular-nums", MUTED_SMALL)}>{caption}</p>
            </TimelineStep>
          );
        })}

        {ahead.map((step, i) => (
          <TimelineStep
            key={`ahead-${step}`}
            label={t(`timeline.ahead.${step}`)}
            state="ahead"
            last={i === ahead.length - 1}
          >
            <p className="m-0 text-[15px] text-[var(--color-muted-foreground)]">
              {t(`timeline.ahead.${step}`)}
            </p>
          </TimelineStep>
        ))}
      </ol>
    </section>
  );
}

/**
 * One hop: a marker, a line down to the next one, and what happened.
 *
 * A filled blue tick for something that happened, a ringed hourglass for the
 * deadline still running, a grey ring for a step still ahead. The markers
 * carry no text, so a hop reads aloud as its own words and nothing else.
 */
function TimelineStep({
  label,
  state,
  last,
  children,
}: {
  label: string;
  state: "done" | "running" | "ahead";
  last: boolean;
  children: ReactNode;
}) {
  return (
    <li
      aria-label={label}
      className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-x-3.5 pb-5 last:pb-0"
    >
      {!last && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-8 bottom-1 left-[13px] w-0.5 rounded-full",
            state === "done"
              ? "bg-[var(--color-blue-line)]"
              : "bg-[var(--color-border)]",
          )}
        />
      )}
      <span
        aria-hidden="true"
        className={cn(
          "grid h-7 w-7 place-items-center rounded-full",
          state === "done" && "bg-[var(--color-blue-public)] text-white",
          state === "running" &&
            "border-2 border-[var(--color-blue-public)] bg-[var(--color-card)] text-[var(--color-blue-public)]",
          state === "ahead" &&
            "border-2 border-[var(--color-border)] bg-[var(--color-card)]",
        )}
      >
        {state === "done" && <Check className="h-4 w-4" strokeWidth={3} />}
        {state === "running" && <Hourglass className="h-3.5 w-3.5" strokeWidth={2.4} />}
      </span>
      <div className="min-w-0 pt-0.5">{children}</div>
    </li>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
  wide = false,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-[20px_minmax(0,1fr)] gap-x-3",
        wide && "sm:col-span-2",
      )}
    >
      <Icon
        aria-hidden="true"
        className="mt-0.5 h-5 w-5 text-[var(--color-blue-public)]"
      />
      <div className="min-w-0">
        <dt className="text-sm text-[var(--color-muted-foreground)]">{label}</dt>
        <dd className="m-0 mt-1 text-[15px] leading-normal [overflow-wrap:anywhere] text-[var(--color-ink-2)]">
          {children}
        </dd>
      </div>
    </div>
  );
}

function DetailsCard({ booking: b }: { booking: CustomerBookingDetailDTO }) {
  const { t, i18n } = useTranslation("bookings");
  const { t: td } = useTranslation("directory");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const when = slotWording(b.startsAt, b.endsAt, locale, b.timezone);
  const phrase = b.locationType
    ? td(`filterWhereOption.${b.locationType}`, { defaultValue: "" })
    : "";
  const address = [b.addressLine, b.addressDistrict, b.addressCity]
    .filter(Boolean)
    .join(", ");
  // The customer's address only where the work happens at it. Step 2 asks
  // every customer for one, but on an `at_provider` or `remote` service it
  // is not the place of the appointment, and printing it under "Local" would
  // send them to wait at home for a job that is somewhere else.
  const atCustomer =
    b.locationType === null ||
    b.locationType === "at_customer" ||
    b.locationType === "flexible";
  const showAddress = Boolean(address) && atCustomer;
  const note = b.description?.trim() ?? "";

  return (
    <section aria-labelledby="booking-details-title" className={CUSTOMER_CARD}>
      <h2 id="booking-details-title" className={CARD_TITLE}>
        {t("detail.detailsTitle")}
      </h2>
      <dl className="m-0 mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
        <DetailRow icon={CalendarDays} label={t("detail.date")}>
          <span className="font-semibold text-[var(--color-headline)]">
            {when.date}
          </span>
        </DetailRow>
        <DetailRow icon={Clock} label={t("detail.time")}>
          <span className="tabular-nums">
            {when.start} – {when.end}
          </span>
        </DetailRow>
        <DetailRow icon={Timer} label={t("duration")}>
          {t("minutes", { count: b.durationMinutes })}
        </DetailRow>
        {(phrase || showAddress) && (
          <DetailRow icon={MapPin} label={t("detail.place")}>
            {phrase && (
              <span className="block font-semibold text-[var(--color-headline)]">
                {phrase}
              </span>
            )}
            {showAddress && <span className="block">{address}</span>}
          </DetailRow>
        )}
        {showAddress && b.addressDirections && (
          <DetailRow icon={Navigation} label={t("directions")} wide>
            {b.addressDirections}
          </DetailRow>
        )}
        {note && (
          <DetailRow icon={FileText} label={t("detail.notes")} wide>
            <span className="whitespace-pre-line">{note}</span>
          </DetailRow>
        )}
      </dl>
    </section>
  );
}

function ProviderCard({ booking: b }: { booking: CustomerBookingDetailDTO }) {
  const { t, i18n } = useTranslation("bookings");
  const locale = i18n.resolvedLanguage ?? i18n.language;

  return (
    <section aria-labelledby="booking-provider-title" className={CUSTOMER_CARD}>
      <h2 id="booking-provider-title" className={CARD_TITLE}>
        {t("detail.providerTitle")}
      </h2>
      <div className="mt-5 flex items-center gap-4">
        {/* The logo when there is one, initials when there is not — **not**
            `BrandImage`'s mark, which is right for a missing photograph and
            wrong for a missing face: the Ntizo mark where a business's own
            avatar goes reads as "booked with Ntizo". `BrandImage` still
            covers the logo that exists in the data but no longer at its URL,
            which is most seeded ones on dev. */}
        {b.providerLogoUrl ? (
          <span className="h-14 w-14 shrink-0 overflow-hidden rounded-full">
            <BrandImage
              src={b.providerLogoUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--color-blue-soft)] text-[15px] font-semibold text-[var(--color-blue-public)]"
          >
            {initialsFrom(b.providerName)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="m-0 text-base font-bold [overflow-wrap:anywhere] text-[var(--color-headline)]">
            {b.providerName}
          </p>
          {/* An unreviewed provider shows no score rather than a zero, and
              an unverified one no badge rather than a greyed-out promise. */}
          {(b.providerVerified || b.providerRatingAverage !== null) && (
            <p className="m-0 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-[var(--color-ink-2)]">
              {b.providerVerified && (
                <span className="inline-flex items-center gap-1 font-medium text-[var(--color-blue-public)]">
                  <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                  {t("verified")}
                </span>
              )}
              {b.providerRatingAverage !== null && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Star
                    aria-hidden="true"
                    className="h-3.5 w-3.5 fill-[var(--color-star)] text-[var(--color-star)]"
                  />
                  {formatRating(b.providerRatingAverage, locale)}
                </span>
              )}
            </p>
          )}
        </div>
      </div>
      {/* The slug has been on this read since checkout needed it; the page it
          addresses is public and carries the reviews, the other services and
          the trading hours — everything a customer might want to check that
          a booking's own record has no business repeating. */}
      <Link
        to="/providers/$slug"
        params={{ slug: b.providerSlug }}
        className="mt-4 inline-block text-[15px] font-semibold text-[var(--color-blue-public)] hover:underline"
      >
        {t("viewProfile")}
      </Link>
    </section>
  );
}

/**
 * The total the customer pays, the sentence saying it carries no markup,
 * and — once paid — when. No split, ever: the commission is the provider's
 * payout being reduced, not a charge this customer's screen has any
 * business showing.
 */
function PriceCard({ booking: b }: { booking: CustomerBookingDetailDTO }) {
  const { t, i18n } = useTranslation("bookings");
  const locale = i18n.resolvedLanguage ?? i18n.language;

  return (
    <section aria-labelledby="booking-price-title" className={CUSTOMER_CARD}>
      <h2 id="booking-price-title" className={CARD_TITLE}>
        {t("detail.priceTitle")}
      </h2>
      <div className="mt-5 flex items-baseline justify-between gap-3">
        <span className="text-[15px] text-[var(--color-ink-2)]">
          {/* "Total a pagar" only while something is still owed: on a
              declined, expired or cancelled request nobody is going to pay. */}
          {b.paidAt
            ? t("totalPaid")
            : canCancel(b.status)
              ? t("totalDue")
              : t("detail.priceTitle")}
        </span>
        {/* A total, never a headline — "Total a pagar" is what the customer
            owes and "Total pago" is a receipt, and neither may be rounded to
            whole units. */}
        <span className="text-[22px] font-extrabold text-[var(--color-headline)] tabular-nums">
          {formatAmount(b.priceMinor, b.currency, locale)}
        </span>
      </div>
      {b.paidAt && (
        <p className="m-0 mt-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-ok-fg)]">
          <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
          {t("paidOn", { date: paidOnWording(b.paidAt, locale) })}
        </p>
      )}
      <p className={cn("m-0 mt-3", MUTED_SMALL)}>{t("moneyNote")}</p>
    </section>
  );
}

/**
 * What the customer can do about this booking now: Pagar while payment is
 * what is being waited for, Cancelar while it can still be called off, and a
 * message to the provider on every status — a question about a declined job
 * is still a question.
 *
 * Pagar is the one filled button, so the message is an outline beside it;
 * written in their real order, so reading order and tab order agree with
 * what is on the screen.
 */
function ActionsCard({
  booking: b,
  onCancel,
  onPay,
}: {
  booking: CustomerBookingDetailDTO;
  onCancel: () => void;
  onPay: () => void;
}) {
  const { t, i18n } = useTranslation("bookings");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const pay = canPay(b.status);
  const cancel = canCancel(b.status);

  return (
    <section
      aria-labelledby="booking-actions-title"
      className={cn(CUSTOMER_CARD, "xl:col-start-2 xl:row-start-1")}
    >
      <h2 id="booking-actions-title" className={CARD_TITLE}>
        {t("detail.actionsTitle")}
      </h2>
      <div
        role="group"
        aria-label={t("actionsLabel")}
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap xl:flex-col"
      >
        {pay && (
          <Button
            type="button"
            className={cn(RAIL_BUTTON, "bg-[var(--color-blue-public)]")}
            onClick={onPay}
          >
            {/* `formatAmount`, not `formatHeadlinePrice`: the button names
                the amount this press will debit, and the headline formatter
                rounds to whole units. */}
            {t("payAmount", {
              amount: formatAmount(b.priceMinor, b.currency, locale),
            })}
          </Button>
        )}
        <div className={RAIL_BUTTON}>
          <MessageProviderButton
            providerId={b.providerId}
            variant={pay ? "outline" : "default"}
            label={t("detail.message")}
            className={pay ? undefined : "bg-[var(--color-blue-public)]"}
          />
        </div>
        {cancel && (
          <Button
            type="button"
            variant="outline"
            className={cn(DESTRUCTIVE_OUTLINE, RAIL_BUTTON)}
            onClick={onCancel}
          >
            {t("cancelBooking")}
          </Button>
        )}
      </div>
    </section>
  );
}

function HelpCard({ confirmed }: { confirmed: boolean }) {
  const { t } = useTranslation("bookings");
  return (
    <section
      aria-labelledby="booking-help-title"
      className={cn(CUSTOMER_CARD, "flex items-start gap-4 xl:col-start-2 xl:row-start-2")}
    >
      <span
        aria-hidden="true"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--color-blue-soft)] text-[var(--color-blue-public)]"
      >
        <Headset className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h2 id="booking-help-title" className="m-0 text-base font-bold text-[var(--color-headline)]">
          {t("detail.helpTitle")}
        </h2>
        {/* A confirmed booking has no Cancelar — the money has moved — so
            support is the way to change or call it off, and the card says so
            on that status in particular. */}
        <p className={cn("m-0 mt-1", MUTED_SMALL)}>
          {confirmed ? t("detail.helpBodyConfirmed") : t("detail.helpBody")}
        </p>
        <Link
          to="/contact"
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "mt-4 rounded-[10px]",
          )}
        >
          {t("supportCta")}
        </Link>
      </div>
    </section>
  );
}
