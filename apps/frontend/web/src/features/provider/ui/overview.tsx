import type { ComponentType, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Calendar, ChevronUp, Coins, MessageSquare, Star } from "lucide-react";
import { Skeleton } from "@ntizo/frontend-ui";
import { usePageHeader } from "@/shared/lib/page-header";
import { useCurrentUser } from "@/features/user/viewmodel/use-current-user";
import { formatMoneyShort } from "@/features/wallet/domain/money";
import { useProviderStats } from "../bookings/viewmodel/use-provider-bookings";
import { useActiveProvider } from "../viewmodel/use-active-provider";
import { useProviderRating } from "../viewmodel/use-provider-rating";
import { UpcomingBookings } from "./overview-upcoming";
import { AvailabilityTodayCard, MessagesCard, WalletCard } from "./overview-side";
import { MORE_LINK } from "./overview-link";

/**
 * The workspace at a glance, as the October mockup draws it: the greeting
 * beside the brand photo, four readings, the next bookings on the calendar,
 * and three side cards — today's hours, the latest conversations and the
 * money that can be taken out.
 *
 * Every number here is read, never derived: the counts and the money come
 * from one `bookingStatsForProvider` call, so the sidebar's badge and the
 * "por responder" card cannot disagree. The mockup's month-over-month deltas
 * are not drawn — nothing on the read side compares one month with the last,
 * and an arrow over a figure nobody computed is a claim, not a reading. The
 * line under each value says what the server does know instead.
 */
export function OverviewPage() {
  const { t, i18n } = useTranslation("provider");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { activeProvider } = useActiveProvider();
  const providerId = activeProvider?.id ?? "";
  const slug = activeProvider?.slug ?? "";
  const { data: me } = useCurrentUser();

  const stats = useProviderStats(providerId);
  const rating = useProviderRating(providerId);

  // The person, not the workspace: the mockup greets "Joaquim", and a team's
  // workspace name is not who is reading. The workspace stands in only until
  // the session's own name has loaded.
  const name = me?.firstName?.trim() || activeProvider?.name || "";
  const title = t("overview.hello", { name });
  // The page draws its own heading — the eyebrow and the photo beside it — so
  // the shell keeps the title for the document and the menu only.
  usePageHeader(title, t("overview.subtitle"), { ownHeading: true });

  // A person with no workspace gets the message, not a grid of zeros.
  if (!activeProvider) return <p className="type-body">{t("noActiveProvider")}</p>;

  const s = stats.data;
  const money = (minor: number) => formatMoneyShort(minor, s?.currency ?? "MZN", locale);

  return (
    <div className="grid w-full max-w-[1400px]">
      <section className="grid items-start gap-6 lg:grid-cols-[minmax(360px,1fr)_minmax(0,708px)] lg:gap-4">
        <div className="lg:pt-9">
          <p className="text-[13px] font-medium tracking-[0.08em] text-[var(--color-muted-foreground)] uppercase">
            {t("overview.eyebrow")}
          </p>
          <h1 className="font-display mt-2 text-[30px] leading-[1.05] font-extrabold tracking-[-0.02em] text-[var(--color-headline)] md:text-[44px]">
            {title}
          </h1>
          <p className="mt-2 text-base leading-[1.45] text-[var(--color-muted-foreground)] md:text-[16.5px]">
            {t("overview.subtitle")}
          </p>
          {/* The activity log left the menu; this is where it is reached from now. */}
          <Link to="/provider/$slug/activity" params={{ slug }} className={`${MORE_LINK} mt-4`}>
            {t("overview.activityLink")}
            <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
          </Link>
        </div>
        <HeroArt quote={t("overview.heroQuote")} />
      </section>

      {stats.isError && (
        <p role="alert" className="type-body mt-4 text-[var(--color-destructive)]">
          {t("overview.loadError")}{" "}
          <button type="button" className="underline" onClick={() => void stats.refetch()}>
            {t("overview.retry")}
          </button>
        </p>
      )}

      {/* Two up until `xl`: four cards beside a 297px sidebar at 1024px would
          each get a box narrower than a phone, with the money at 31px. Two up
          on a phone too, compact: one card a row was four screen-heights of
          tiles holding one number each. */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:gap-[23px] xl:grid-cols-[239fr_262fr_266fr_283fr]">
        <StatTile
          icon={Calendar}
          label={t("overview.weekTitle")}
          value={s?.upcomingWeek ?? 0}
          loading={stats.isLoading}
          foot={s ? t("overview.todayCount", { count: s.upcomingToday }) : null}
        />
        <StatTile
          icon={Coins}
          label={t("overview.revenueTitle")}
          value={money(s?.revenueLast30Minor ?? 0)}
          loading={stats.isLoading}
          foot={
            s ? (
              <span className="grid gap-1">
                {s.pipelineMinor > 0 && (
                  <span className="flex flex-wrap items-center sm:flex-nowrap sm:whitespace-nowrap">
                    <FootFigure>{t("overview.pipelineAmount", { amount: money(s.pipelineMinor) })}</FootFigure>
                    {t("overview.pipelineLabel")}
                  </span>
                )}
                {/* The figure above is the payout, not the listed price — and
                    when nothing has been completed (nothing writes COMPLETED
                    yet) the sentence says why it is zero instead (ruling R10). */}
                <span>
                  {s.completedLast30 === 0 ? t("overview.nothingCompleted") : t("overview.revenueHint")}
                </span>
              </span>
            ) : null
          }
        />
        <StatTile
          icon={Star}
          label={t("overview.ratingTitle")}
          value={
            rating.data?.average != null
              ? new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(rating.data.average)
              : "—"
          }
          loading={rating.isLoading}
          foot={
            rating.data?.count ? (
              <span className="flex items-center whitespace-nowrap">
                <FootFigure>{t("overview.ratingCount", { count: rating.data.count })}</FootFigure>
                {/* The public page, because that is where the words are. */}
                <Link
                  to="/providers/$slug"
                  params={{ slug }}
                  className="font-semibold text-[var(--color-primary)] hover:underline"
                >
                  {t("overview.seeReviews")}
                </Link>
              </span>
            ) : (
              t("overview.ratingNone")
            )
          }
        />
        <StatTile
          icon={MessageSquare}
          label={t("overview.awaitingTitle")}
          value={s?.awaitingResponse ?? 0}
          loading={stats.isLoading}
          // The one reading that is a task, so the one card with a verb.
          foot={
            s ? (
              s.awaitingResponse > 0 ? (
                <Link
                  to="/provider/$slug/bookings"
                  params={{ slug }}
                  search={{ tab: "requests" }}
                  className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-primary)] hover:underline"
                >
                  {t("overview.awaitingAction")}
                  <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              ) : (
                t("overview.awaitingNone")
              )
            ) : null
          }
        />
      </section>

      <section className="mt-10 grid items-start gap-[27px] xl:grid-cols-[minmax(0,1fr)_346px]">
        <UpcomingBookings providerId={providerId} slug={slug} locale={locale} />
        <div className="grid gap-[22px] sm:grid-cols-2 xl:grid-cols-1">
          <AvailabilityTodayCard providerId={providerId} slug={slug} locale={locale} />
          <MessagesCard providerId={providerId} slug={slug} locale={locale} />
          <WalletCard providerId={providerId} slug={slug} locale={locale} />
        </div>
      </section>
    </div>
  );
}

/**
 * The brand photo with the promise written over its right edge. Positions
 * are the mockup's, as fractions of the 708 × 189 artwork, so the panel
 * stays on the photo's blank strip at any width the column gives it — and
 * the type is sized in the same fractions (container units), so the four
 * lines fit the panel however wide the column is.
 */
function HeroArt({ quote }: { quote: string }) {
  return (
    <div className="@container relative hidden aspect-[708/189] w-full sm:block">
      <img src="/console/provider-hero.jpg" alt="" className="block h-full w-full" />
      <p className="absolute top-[19.6%] left-[74.3%] m-0 h-[61.4%] w-[24.3%] overflow-hidden bg-[var(--color-info-bg)] pt-[0.85cqw] pl-[1.84cqw] text-[2.61cqw] leading-[3.39cqw] whitespace-pre-line text-[var(--color-ink-2)]">
        {quote}
      </p>
    </div>
  );
}

/** A reading's strong part in the card's foot — where the mockup draws its green delta. */
function FootFigure({ children }: { children: ReactNode }) {
  return (
    <b className="mr-2.5 flex h-5 shrink-0 items-center gap-1.5 border-r whitespace-nowrap border-[var(--color-border)] pr-2.5 text-[14.5px] font-bold text-[var(--color-ok-fg)]">
      <ChevronUp aria-hidden="true" className="h-4 w-4" strokeWidth={2.6} />
      {children}
    </b>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  loading,
  foot,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  loading: boolean;
  foot: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card)] p-4 sm:px-[25px] sm:pt-5 sm:pb-[22px]">
      <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-[var(--color-info-bg)] text-[var(--color-primary)] sm:h-12 sm:w-[50px]">
        <Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" />
      </span>
      {loading ? (
        <Skeleton className="mt-3 h-[30px] w-24 sm:h-[37px] sm:w-28" />
      ) : (
        <p className="mt-2.5 text-[22px] leading-[1.2] font-extrabold tracking-[-0.01em] break-words text-[var(--color-headline)] tabular-nums sm:mt-3 sm:text-[31px] sm:whitespace-nowrap">
          {value}
        </p>
      )}
      {/* The label is the card's name, so it paints before the number does. */}
      <p className="mt-1 text-[14px] leading-snug text-[var(--color-ink-2)] sm:mt-1.5 sm:text-[15px]">{label}</p>
      <div className="mt-3 flex min-h-5 items-center text-[12.5px] leading-snug text-[var(--color-muted-foreground)] sm:mt-[22px] sm:text-[13px]">
        {foot}
      </div>
    </div>
  );
}
