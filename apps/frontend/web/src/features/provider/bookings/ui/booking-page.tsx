import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  Banknote,
  Briefcase,
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheck,
  Clock,
  FileText,
  Hourglass,
  Lock,
  Mail,
  MapPin,
  Percent,
  Phone,
  User,
  Wallet,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, Badge, Button, Skeleton, cn } from "@ntizo/frontend-ui";
import { EmptyCard } from "@/shared/components/empty-card";
import { initialsFrom } from "@/shared/lib/initials";
import { usePageHeader } from "@/shared/lib/page-header";
import {
  CardHead,
  DataRow,
  DETAIL_BACK_CLASS,
  DETAIL_CARD,
  DETAIL_COLUMNS,
  DETAIL_CRUMB_LINK_CLASS,
  DetailCrumb,
  DetailHead,
  IconLine,
  InfoBox,
  MetaLine,
  MONEY_TILES,
  MoneyTile,
  TITLE_PILL_CLASS,
  Timeline,
} from "@/features/provider/ui/detail-kit";
import { useActiveProvider } from "@/features/provider/viewmodel/use-active-provider";
import { slotWording } from "@/features/checkout/domain/slot-wording";
import { formatMoney } from "@/features/wallet/domain/money";
import {
  STATUS_TONE,
  commissionRate,
  payoutMinor,
  shortReference,
  timeLeftWording,
} from "../domain/status";
import {
  useAnswerBooking,
  useCloseBooking,
  useProviderBooking,
} from "../viewmodel/use-provider-bookings";
import { DeclineDialog } from "./decline-dialog";

/**
 * The statuses whose copy may name the customer's contact and the exact
 * address.
 *
 * It chooses *which block to draw*, not what the page is allowed to know:
 * the reveal is the backend mapper's rule and those four fields arrive null
 * until the booking is paid. Deciding it twice would let a client-side
 * mistake read as a leak; deciding it here alone would let a mapper mistake
 * read as none.
 */
const REVEALED = new Set(["CONFIRMED", "MARKED_DONE", "COMPLETED", "DISPUTED"]);

/** What the strip above the page can be saying, and the sentence for each. */
type Notice =
  | "accepted"
  | "declined"
  | "already"
  | "error"
  | "markedDone"
  | "stillOngoing"
  | "closeError";

const NOTICE_KEY: Record<Notice, string> = {
  accepted: "bookings.accepted",
  declined: "bookings.declined",
  already: "bookings.alreadyAnswered",
  error: "bookings.actionError",
  markedDone: "bookings.markedDone",
  stillOngoing: "bookings.stillOngoingDone",
  closeError: "bookings.closeError",
};

/** The two that report a failure; the rest report something that worked. */
const FAILED: ReadonlySet<Notice> = new Set<Notice>(["error", "closeError"]);

/** The hop the platform records when it asks a provider to close a booking. */
const CLOSE_REMINDER = "close_reminder";

/**
 * One booking, for the page that decides it, laid out as the October
 * mockup's booking file (`admin/reserva-detalhe.html`): the customer's name
 * with the status and reference pills, a meta line with the appointment's
 * facts, cards for the customer, the appointment and the money on the left,
 * and a rail with the decision and the timeline on the right. While the
 * booking waits, the rail's status card carries the two actions and the
 * deadline; after the decision the actions leave and the card keeps the
 * record.
 */
export function BookingPage() {
  const { t, i18n } = useTranslation("provider");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { activeProvider } = useActiveProvider();
  const { bookingId } = useParams({ strict: false }) as { bookingId: string };
  const providerId = activeProvider?.id ?? "";
  const query = useProviderBooking(providerId, bookingId);
  const { accept, decline } = useAnswerBooking(providerId);
  const { markDone, stillOngoing } = useCloseBooking(providerId);
  const [declining, setDeclining] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const b = query.data;

  // `optionName` is null on a booking born from a quote, which has no
  // catalogue option — the same guard the customer's pages make.
  usePageHeader(
    b ? b.customerFirstName : t("bookings.title"),
    b ? `${b.serviceName}${b.optionName ? ` · ${b.optionName}` : ""}` : undefined,
    { ownHeading: true },
  );
  // The countdown is measured from the moment the booking was answered for,
  // not from whenever React last re-rendered: a re-render for an unrelated
  // reason must not move the clock a minute while nothing about the data
  // changed. The same bargain the list makes.
  const now = useMemo(
    () => new Date(query.dataUpdatedAt || Date.now()),
    [query.dataUpdatedAt],
  );

  if (!activeProvider) return null;
  const slug = activeProvider.slug;

  const crumbLink = (
    <Link to="/provider/$slug/bookings" params={{ slug }} className={DETAIL_CRUMB_LINK_CLASS}>
      {t("bookings.back")}
    </Link>
  );
  const backSquare = (
    <Link
      to="/provider/$slug/bookings"
      params={{ slug }}
      aria-label={t("bookings.back")}
      className={DETAIL_BACK_CLASS}
    >
      <ArrowLeft className="h-[22px] w-[22px]" aria-hidden="true" />
    </Link>
  );
  const crumb = (current: string) => (
    <DetailCrumb label={t("bookings.title")} link={crumbLink} current={current} />
  );

  if (query.isLoading) {
    return (
      <div className="grid w-full max-w-[1400px] gap-4">
        {crumb(t("bookings.title"))}
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-48 w-full rounded-[14px]" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="grid w-full max-w-[1400px] gap-4">
        {crumb(t("bookings.title"))}
        <p role="alert" className="type-body text-[var(--color-destructive)]">
          {t("bookings.loadError")}
        </p>
      </div>
    );
  }
  if (!b) {
    return (
      <div className="grid w-full max-w-[1400px] gap-4">
        {crumb(t("bookings.title"))}
        <EmptyCard
          framed
          title={t("bookings.notFoundTitle")}
          body={t("bookings.notFoundBody")}
        />
      </div>
    );
  }

  const waiting = b.status === "AWAITING_PROVIDER";
  const revealed = REVEALED.has(b.status);
  const left = b.respondBy ? timeLeftWording(b.respondBy, now) : null;
  const when = slotWording(b.startsAt, b.endsAt, locale, b.timezone);
  const busy = accept.isPending || decline.isPending;
  const coarse = [b.addressDistrict, b.addressCity].filter(Boolean);

  /**
   * A booking can only be closed after the work it was sold for is over —
   * `Booking.markDone` and `Booking.keepOpen` both refuse anything else, which
   * is why one gate governs the pair — so neither button is offered
   * while the appointment is still ahead. `now` is the moment of the last
   * read, not this render's, which is the same bargain the countdown makes:
   * the two buttons appear on the next refetch after the appointment ends
   * rather than materialising mid-sentence.
   */
  const ended = new Date(b.endsAt).getTime() <= now.getTime();
  const closable = b.status === "CONFIRMED" && ended;
  /**
   * The platform has already asked for this one. `close_reminder` is that
   * question, recorded on the booking's own history — the only place this
   * read model carries it — and it is worth repeating on the page: seven days
   * of silence and the platform closes the booking itself.
   */
  const asked = closable && b.timeline.some((e) => e.reason === CLOSE_REMINDER);
  // The window the customer is standing in, while they are standing in it.
  const feedbackBy = b.status === "MARKED_DONE" ? b.expiresAt : null;
  // A refetch is running behind the press that caused it: the buttons are
  // pointed at data already known to be stale, and pressing again would send
  // a second mutation the backend will refuse.
  const closing = markDone.isPending || stillOngoing.isPending || query.isFetching;

  /** The timeline's format, shared with the two deadline lines above it. */
  const stamp = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: b.timezone,
    }).format(new Date(iso));

  /**
   * A refused answer is nearly always a race — the customer cancelled, or the
   * deadline passed, while this page sat open — so the failure is reported as
   * the state it actually is and the page is re-read rather than left saying
   * something that is no longer true.
   *
   * **Both sentences are per-action, because both differ by action.**
   * `BOOKING_INVALID_TRANSITION` is the race, and it is the *only* refusal a
   * closing button can realistically produce: the pair is drawn only over a
   * `CONFIRMED` booking, and `CONFIRMED` has exactly one exit — somebody else
   * marked this one done. "Este pedido já foi respondido" is the answer to
   * that at the other end of the booking's life; here the true thing to say
   * is that it is closed and the customer's window is open, which is
   * `markedDone` — the same sentence the silent-loss repair below settles on,
   * because it is the same event seen through a different door. `fallback`
   * covers everything else: an infrastructure failure while closing must not
   * borrow "não foi possível *responder*" a day after the appointment.
   */
  const failed = (race: Notice, fallback: Notice) => (error: unknown) => {
    const code = (error as { code?: string } | null)?.code;
    // Closed on the way out, not only on success. A decline that came back
    // refused otherwise leaves its dialog sitting over the notice explaining
    // why it failed, with "Recusar pedido" still pressable — an invitation to
    // send the same refused mutation again, over a page the refetch below has
    // already taken the header's own actions off. Closing a dialog that was
    // never open (the accept path) is a no-op, so the one handler covers both.
    setDeclining(false);
    setNotice(code === "BOOKING_INVALID_TRANSITION" ? race : fallback);
    void query.refetch();
  };
  const onError = failed("already", "error");
  const onCloseError = failed("markedDone", "closeError");

  /**
   * What the strip is allowed to say, given what the page now knows.
   *
   * "Voltamos a perguntar daqui a uma semana" is a promise about a booking
   * that is still open, and `stillOngoing` is the one press here that can
   * lose its race without being told: the platform's sweep marks the same
   * booking done from the other side, the compare-and-swap drops the write,
   * and the mutation answers `{ bookingId }` all the same (see
   * `MarkBookingDoneCommand` — its own `execute` returns null for this, and
   * the GraphQL field has nowhere to put it). The read that follows is the
   * only witness, so a booking that came back no longer `CONFIRMED` replaces
   * the acknowledgement with what actually happened.
   *
   * `markedDone` needs no such repair: whoever won that race, the booking is
   * marked done and the customer has their three days, which is exactly what
   * the sentence says.
   */
  const shown: Notice | null =
    notice === "stillOngoing" && b.status !== "CONFIRMED"
      ? b.status === "MARKED_DONE"
        ? "markedDone"
        : "already"
      : notice;

  const option = b.optionName ? ` · ${b.optionName}` : "";
  const member = b.memberFirstName ?? t("bookings.memberAnyone");
  const place = [
    b.locationType ? t(`bookings.location.${b.locationType}`) : null,
    coarse.length > 0 ? coarse.join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  // The rail's status card is drawn only when it has something to say: a
  // decision to make, a clock running, or the reason a button is missing.
  const confirmedAhead = b.status === "CONFIRMED" && !ended;
  const hasStatusCard = waiting || closable || confirmedAhead || feedbackBy !== null;

  return (
    <div className="flex w-full max-w-[1400px] flex-col">
      {crumb(b.customerFirstName)}

      <DetailHead
        back={backSquare}
        title={b.customerFirstName}
        pills={
          <>
            <Badge tone={STATUS_TONE[b.status]} className={TITLE_PILL_CLASS}>
              {t(`bookings.status.${b.status}`)}
            </Badge>
            <Badge tone="neutral" className={cn(TITLE_PILL_CLASS, "font-semibold tabular-nums")}>
              {t("bookings.reference", { ref: shortReference(b.id) })}
            </Badge>
          </>
        }
      >
        <MetaLine
          items={[
            { key: "service", icon: Briefcase, text: `${b.serviceName}${option}` },
            { key: "member", icon: User, text: member },
            { key: "date", icon: CalendarDays, text: when.date },
            {
              key: "time",
              icon: Clock,
              text: (
                <span className="tabular-nums">
                  {when.start} – {when.end} ({t("bookings.minutes", { count: b.durationMinutes })})
                </span>
              ),
            },
            ...(place ? [{ key: "place", icon: MapPin, text: place }] : []),
          ]}
        />
      </DetailHead>

      {shown && (
        <p
          role="status"
          className={cn(
            "type-body mt-6 mb-0 rounded-[14px] px-[18px] py-3.5",
            FAILED.has(shown)
              ? "bg-[color-mix(in_srgb,var(--color-destructive)_8%,transparent)] text-[var(--color-bad-fg)]"
              : "bg-[var(--color-blue-softer)] text-[var(--color-ink-2)]",
          )}
        >
          {t(NOTICE_KEY[shown])}
        </p>
      )}

      <div className={DETAIL_COLUMNS}>
        <div className="grid min-w-0 gap-6">
          <section className={DETAIL_CARD}>
            <CardHead title={t("bookings.section.customer")} />
            <div className="mt-4 flex items-center gap-[18px]">
              <Avatar className="h-[64px] w-[64px] shrink-0">
                <AvatarFallback className="bg-[var(--color-blue-soft)] text-xl font-semibold text-[var(--color-primary)]">
                  {initialsFrom(b.customerFirstName)}
                </AvatarFallback>
              </Avatar>
              <p className="m-0 min-w-0 truncate text-base font-bold text-[var(--color-headline)]">
                {b.customerFirstName}
              </p>
            </div>
            {revealed ? (
              <dl className="mt-5 mb-0 grid gap-3.5 sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="sr-only">{t("bookings.phone")}</dt>
                  <dd className="m-0">
                    <IconLine icon={Phone}>
                      <span className="tabular-nums">{b.customerPhone ?? t("bookings.none")}</span>
                    </IconLine>
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="sr-only">{t("bookings.email")}</dt>
                  <dd className="m-0">
                    <IconLine icon={Mail}>{b.customerEmail ?? t("bookings.none")}</IconLine>
                  </dd>
                </div>
              </dl>
            ) : (
              <InfoBox icon={Lock}>{t("bookings.hiddenUntilPaid")}</InfoBox>
            )}
          </section>

          <section className={DETAIL_CARD}>
            <CardHead title={t("bookings.section.appointment")} />
            <dl className="mt-[18px] mb-0 grid gap-4">
              <DataRow icon={Briefcase} label={t("bookings.col.service")}>
                <span className="font-semibold text-[var(--color-headline)]">
                  {b.serviceName}
                  {option}
                </span>
              </DataRow>
              <DataRow icon={CalendarDays} label={t("bookings.when")}>
                {when.date}, <span className="tabular-nums">{when.start} – {when.end}</span>
              </DataRow>
              <DataRow icon={Clock} label={t("bookings.duration")}>
                {t("bookings.minutes", { count: b.durationMinutes })}
              </DataRow>
              <DataRow icon={MapPin} label={t("bookings.where")}>
                {place || t("bookings.none")}
                {revealed && b.addressLine && (
                  <span className="block">
                    {[b.addressLabel, b.addressLine].filter(Boolean).join(" · ")}
                  </span>
                )}
                {revealed && b.addressDirections && (
                  <span className="block text-sm text-[var(--color-muted-foreground)]">
                    {b.addressDirections}
                  </span>
                )}
              </DataRow>
              <DataRow icon={User} label={t("bookings.with")}>
                {member}
              </DataRow>
              {b.description && b.description.trim() !== "" && (
                <DataRow icon={FileText} label={t("bookings.section.note")}>
                  <span className="whitespace-pre-line">{b.description.trim()}</span>
                </DataRow>
              )}
            </dl>
          </section>

          {/* The arithmetic in the order the provider does it: what the
              customer pays, what the platform takes out of it, and the number
              that actually arrives. */}
          <section className={DETAIL_CARD}>
            <CardHead title={t("bookings.money")} />
            <dl className={MONEY_TILES}>
              <MoneyTile
                icon={Banknote}
                tone="ok"
                label={t("bookings.price")}
                value={formatMoney(b.priceMinor, b.currency, locale)}
              />
              <MoneyTile
                icon={Percent}
                tone="violet"
                label={t("bookings.commission", { rate: commissionRate(b.commissionBps, locale) })}
                value={`−${formatMoney(b.commissionMinor, b.currency, locale)}`}
              />
              <MoneyTile
                icon={Wallet}
                tone="info"
                label={t("bookings.payout")}
                value={formatMoney(payoutMinor(b), b.currency, locale)}
              />
            </dl>
          </section>
        </div>

        {/* `contents` below `lg`, so the rail's cards join the page's own
            column and the decision can be lifted above the record: on a
            phone "Aceitar" is the first thing under the title, not the last
            thing under the money. */}
        <aside className="contents lg:sticky lg:top-6 lg:grid lg:min-w-0 lg:gap-6">
          {hasStatusCard && (
            <section className={cn(DETAIL_CARD, "order-first lg:order-none")}>
              <CardHead title={t("bookings.col.status")} />
              {waiting && (
                <InfoBox icon={Hourglass} title={left ? t("bookings.respondIn", { time: left }) : undefined} />
              )}
              {/* Said before the press, not after it. Marking a job done
                  starts a clock the provider cannot take back, and "Concluído.
                  O cliente tem três dias" arriving only once it is running is
                  the news a press late. */}
              {closable && (
                <InfoBox icon={CircleCheck} title={asked ? t("bookings.askedToClose") : undefined}>
                  <p className="m-0">{t("bookings.markDoneConfirm")}</p>
                </InfoBox>
              )}
              {/* Confirmed, but the appointment has not happened yet. Saying
                  why the button is not there beats leaving a provider hunting
                  for it. */}
              {confirmedAhead && (
                <InfoBox icon={CalendarDays}>
                  <p className="m-0">{t("bookings.markDoneHint")}</p>
                </InfoBox>
              )}
              {feedbackBy && (
                <InfoBox icon={Hourglass} title={t("bookings.feedbackBy", { time: stamp(feedbackBy) })} />
              )}

              {/* The two actions exist only while the booking is waiting for
                  them. After the decision the card is a record, and a live
                  "Aceitar" over a booking already accepted is an invitation to
                  an error the backend would refuse. */}
              {waiting && (
                <div className="mt-5 grid gap-3">
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      accept.mutate(b.id, { onSuccess: () => setNotice("accepted"), onError })
                    }
                  >
                    <Check aria-hidden="true" />
                    {t("bookings.accept")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setDeclining(true)}
                  >
                    <X aria-hidden="true" />
                    {t("bookings.decline")}
                  </Button>
                </div>
              )}
              {/* The same two-button shape one stage later: the job is over
                  and the platform wants to know whether it is finished. */}
              {closable && (
                <div className="mt-5 grid gap-3">
                  <Button
                    type="button"
                    disabled={closing}
                    onClick={() =>
                      markDone.mutate(b.id, {
                        onSuccess: () => setNotice("markedDone"),
                        onError: onCloseError,
                      })
                    }
                  >
                    <Check aria-hidden="true" />
                    {t("bookings.markDone")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={closing}
                    onClick={() =>
                      stillOngoing.mutate(b.id, {
                        onSuccess: () => setNotice("stillOngoing"),
                        onError: onCloseError,
                      })
                    }
                  >
                    <Clock aria-hidden="true" />
                    {t("bookings.stillOngoing")}
                  </Button>
                </div>
              )}
            </section>
          )}

          <section className={DETAIL_CARD}>
            <CardHead title={t("bookings.timeline")} />
            <Timeline
              entries={b.timeline.map((e, i) => ({
                key: `${e.at}-${e.reason}-${i}`,
                // A token the locale file has no word for still gets a line:
                // "Estado alterado" over the timestamp says less than the
                // truth but never says something false, and a gap in the
                // history would be worse than a vague entry in it.
                label: t(`bookings.timelineReason.${e.reason}`, {
                  defaultValue: t("bookings.timelineReason.unknown"),
                }),
                lines: [stamp(e.at)],
                pending: e.pending,
              }))}
            />
          </section>

          {/* Closed by default and never opened by accident: these are the
              ids support asks for, and they are worth nothing to the person
              running the workspace. */}
          <details className={cn(DETAIL_CARD, "group")}>
            <summary className="flex cursor-pointer list-none items-center justify-between text-lg font-bold text-[var(--color-headline)]">
              {t("bookings.technical")}
              <ChevronDown
                className="h-[18px] w-[18px] text-[var(--color-ink-2)] transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <dl className="mt-4 mb-0 grid gap-3 break-all">
              {(
                [
                  ["bookings.bookingId", b.id],
                  ["bookings.serviceOptionId", b.serviceOptionId],
                  ["bookings.memberId", b.providerMemberId],
                  ["bookings.paymentRef", b.paymentRef],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-[var(--color-muted-foreground)]">{t(label)}</dt>
                  <dd className="m-0 mt-0.5 font-mono text-[13px] text-[var(--color-ink-2)]">
                    {value ?? t("bookings.none")}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </aside>
      </div>

      <DeclineDialog
        open={declining}
        onOpenChange={setDeclining}
        busy={decline.isPending}
        onConfirm={(reason) =>
          decline.mutate(
            { bookingId: b.id, reason },
            {
              onSuccess: () => {
                setDeclining(false);
                setNotice("declined");
              },
              onError,
            },
          )
        }
      />
    </div>
  );
}
