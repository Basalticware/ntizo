import { useMemo, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  CircleAlert,
  Coins,
  Headphones,
  Mail,
  MapPin,
  Store,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Badge, Skeleton } from "@ntizo/frontend-ui";
import { ProviderStatus } from "@ntizo/shared";
import type { ProviderBookingStatsDayDTO } from "@ntizo/shared/read-models";
import { ActivityChart } from "@/shared/components/activity-chart";
import { ConsolePage } from "@/shared/components/console/console-page";
import { DETAILS_BUTTON_CLASS } from "@/shared/components/list-cells";
import {
  CAPTION,
  CARD_LINK,
  IconDisc,
  LinkArrow,
  StatCard,
  type DiscTone,
} from "@/shared/components/stat-card";
import { greetingKey } from "@/shared/domain/greeting";
import { usePageHeader } from "@/shared/lib/page-header";
import { AdminPerson, AdminTable, adminDate } from "@/features/admin/shared/ui/admin-list";
import { PROVIDER_STATUS_TONE } from "@/features/admin/providers/ui/provider-row";
import { useCurrentUser } from "@/features/user/viewmodel/use-current-user";
import { formatMoney } from "@/features/wallet/domain/money";
import type { NeedsYouItem, NeedsYouKey } from "../domain/needs-you";
import { useAdminStats, useLatestApplications, useNeedsYou } from "../viewmodel/use-admin-dashboard";

/** Each owed thing's glyph and the status colour of what is waiting: a complaint is red. */
const NEEDS_YOU_LOOK: Record<NeedsYouKey, { icon: LucideIcon; tone: DiscTone }> = {
  disputed: { icon: CircleAlert, tone: "danger" },
  providers: { icon: Users, tone: "info" },
  support: { icon: Headphones, tone: "success" },
  contact: { icon: Mail, tone: "violet" },
};

/** The one grid both card rows share, so their columns line up at every width. */
const STAT_GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4";

/**
 * The platform at a glance, in the order the spec fixes: what is owed, then
 * the thirty days, then who applied. The first row is verbs — every card on
 * it is a task — and a task with nothing waiting stays, quiet, so the row
 * never changes shape.
 * The tiles below carry no verb; they are readings, and none of them carries
 * a "+12% vs período anterior": the stats answer one window, and a delta
 * against a period nobody asked for would be invented.
 *
 * There is no period picker either, for the same reason — the query takes no
 * window, so "Últimos 30 dias" is a fact the labels state, not a control.
 *
 * The provider's dashboard shows a workspace its share; this one shows the
 * platform the gross and what it kept, over the same bookings and the same
 * window, so the two never describe different money.
 */
export function DashboardPage() {
  const { t, i18n } = useTranslation("admin");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const me = useCurrentUser();
  const stats = useAdminStats();
  const needs = useNeedsYou();
  const applications = useLatestApplications();

  // The instant the numbers were answered, as the provider Overview reasons.
  const now = useMemo(() => new Date(stats.dataUpdatedAt || Date.now()), [stats.dataUpdatedAt]);

  usePageHeader(
    t(`overview.greeting.${greetingKey(now)}`, { name: me.data?.firstName ?? "" }),
    t("overview.subtitle"),
  );

  const s = stats.data;
  const money = (minor: number) => formatMoney(minor, s?.currency ?? "MZN", locale);
  const rows = applications.rows;

  return (
    <ConsolePage>
      {needs.failed && (
        <p role="alert" className="type-body text-[var(--color-destructive)]">
          {t("overview.loadError")}{" "}
          <button type="button" className="underline" onClick={needs.retry}>
            {t("overview.retry")}
          </button>
        </p>
      )}

      {/* Both rows are one grid: one column on a phone, two from `sm`, four
          from `xl` — the provider Overview says why not `lg`. The task row
          draws all four sources every day, a quiet one as a muted zero, so
          its columns are always the readings' columns and nothing shifts
          when a queue empties. Grid rows stretch, so each row's cards share
          one height. */}
      <div className={STAT_GRID}>
        {needs.items.map((item) => {
          const quiet = item.count === 0;
          return (
            <StatCard
              key={item.key}
              icon={NEEDS_YOU_LOOK[item.key].icon}
              tone={quiet ? "muted" : NEEDS_YOU_LOOK[item.key].tone}
              label={t(`overview.needsYou.${item.key}`)}
              value={item.count ?? "—"}
              loading={item.loading}
              quiet={quiet}
              hint={quiet ? t("overview.needsYou.nothingPending") : undefined}
              action={<NeedsYouLink item={item} label={t(`overview.needsYou.${item.key}Action`)} />}
            />
          );
        })}
      </div>

      <div className={STAT_GRID}>
        <StatCard
          icon={CalendarDays}
          label={t("overview.bookingsTitle")}
          value={s?.confirmedLast30 ?? 0}
          loading={stats.isLoading}
          hint={t("overview.bookingsHint", { count: s?.completedLast30 ?? 0 })}
        />
        <StatCard
          icon={UserPlus}
          label={t("overview.newProvidersTitle")}
          value={s?.newProvidersLast30 ?? 0}
          loading={stats.isLoading}
        />
        <StatCard
          icon={Wallet}
          label={t("overview.grossTitle")}
          value={money(s?.grossLast30Minor ?? 0)}
          loading={stats.isLoading}
          hint={s && s.completedLast30 === 0 ? t("overview.nothingCompleted") : t("overview.grossHint")}
        />
        <StatCard
          icon={Coins}
          tone="warning"
          label={t("overview.commissionTitle")}
          value={money(s?.commissionLast30Minor ?? 0)}
          loading={stats.isLoading}
          hint={t("overview.commissionHint")}
        />
      </div>

      <ActivityChart
        days={s?.perDay ?? []}
        locale={locale}
        labels={{
          title: t("overview.chartTitle"),
          range: t("overview.chartRange"),
          requests: t("overview.chartRequests"),
          confirmed: t("overview.chartConfirmed"),
          empty: t("overview.chartEmpty"),
          day: t("overview.chartTableDay"),
        }}
        dayLabel={(date, d: ProviderBookingStatsDayDTO) =>
          t("overview.chartDayLabel", { date, requests: d.requests, confirmed: d.confirmed })
        }
      />

      {/* The table inside a card with its own header, as the mockup draws it:
          the admin table kit's frame loses its outline and corners here,
          because the card around it is the frame. Below `lg` the rows are
          `CollectionCard`'s phone cards, which keep their own borders. */}
      <section
        aria-labelledby="latest-applications"
        className="min-w-0 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-card)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-5">
          <div className="flex min-w-0 items-center gap-4">
            <IconDisc icon={Users} />
            <div className="min-w-0">
              <h2 id="latest-applications" className={CAPTION}>
                {t("overview.applicationsTitle")}
              </h2>
              <div className="type-caption text-[var(--color-muted-foreground)]">
                {applications.isLoading ? (
                  <Skeleton className="mt-1 h-3 w-24" />
                ) : applications.total !== null ? (
                  t("provider:peopleShown", { shown: rows.length, total: applications.total })
                ) : (
                  t("provider:peopleShownPartial", { shown: rows.length })
                )}
              </div>
            </div>
          </div>
          <Link to="/admin/providers" className={CARD_LINK}>
            {t("overview.applicationsAll")}
            <LinkArrow />
          </Link>
        </div>

        {/* The column heads in the card's caption voice, as the mockup sets
            them, rather than the full lists' sentence-case 14.5px. */}
        <div className="px-4 pb-4 lg:p-0 [&_section>div:nth-child(2)]:rounded-none [&_section>div:nth-child(2)]:border-x-0 [&_section>div:nth-child(2)]:border-b-0 [&_thead_th]:text-xs [&_thead_th]:font-semibold [&_thead_th]:tracking-[0.08em] [&_thead_th]:uppercase">
          <AdminTable
            title={t("overview.applicationsTitle")}
            shown={rows.length}
            total={rows.length}
            loading={applications.isLoading}
            tableFrom="lg"
            columns={[
              { key: "business", label: t("providersBusiness"), className: "pl-5" },
              { key: "place", label: t("providersPlace"), skeletonWidth: "w-32" },
              { key: "status", label: t("providersStatus"), skeletonWidth: "w-20", skeletonShape: "badge" },
              { key: "applied", label: t("providersApplied"), skeletonWidth: "w-24" },
              { key: "actions", label: t("common:colActions"), className: "pr-5", hideOnCard: true },
            ]}
            rows={rows.map((provider) => {
              const href = { to: "/admin/providers/$providerId", params: { providerId: provider.id } } as const;
              const place = [provider.city, provider.country].filter(Boolean).join(", ");
              return {
                key: provider.id,
                primary: (
                  <AdminPerson
                    name={provider.name}
                    compact
                    className="max-w-[300px]"
                    title={
                      <Link {...href} className="hover:underline">
                        {provider.name}
                      </Link>
                    }
                    sub={<span className="truncate">{provider.ownerEmail ?? provider.slug}</span>}
                  />
                ),
                cells: {
                  place: place ? (
                    <span className="flex items-center gap-2 text-sm whitespace-nowrap text-[var(--color-muted-foreground)]">
                      <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
                      {place}
                    </span>
                  ) : (
                    "—"
                  ),
                  status: (
                    <Badge
                      tone={PROVIDER_STATUS_TONE[provider.status] ?? "info"}
                      className="min-w-[96px] justify-center text-[13.5px]"
                    >
                      {t(`providerStatus.${provider.status}`)}
                    </Badge>
                  ),
                  applied: (
                    <span className="text-sm whitespace-nowrap text-[var(--color-muted-foreground)] tabular-nums">
                      {adminDate(provider.createdAt, locale)}
                    </span>
                  ),
                },
                // The name is the way in; "Ver detalhes" is the same link drawn
                // where the mockup puts the row's action. No "⋯": the only
                // things an admin does to an application happen on its page.
                actions: (
                  <Link {...href} className={`${DETAILS_BUTTON_CLASS} h-9 px-4 text-sm`} tabIndex={-1}>
                    {t("common:viewDetails")}
                  </Link>
                ),
              };
            })}
            emptyTitle={t("overview.applicationsEmptyTitle")}
            emptyText={t("overview.applicationsEmpty")}
            emptyBadge={Store}
            noMatchesTitle={t("overview.applicationsEmptyTitle")}
            noMatchesText={t("overview.applicationsEmpty")}
            // Nothing narrows this card — it is the newest five, always.
            filtered={false}
          />
        </div>
      </section>
    </ConsolePage>
  );
}

/** Each owed thing opens its own queue, already narrowed to what is owed. */
function NeedsYouLink({ item, label }: { item: NeedsYouItem; label: string }): ReactElement {
  const content = (
    <>
      {label}
      <LinkArrow />
    </>
  );
  switch (item.key) {
    case "disputed":
      return (
        <Link to="/admin/bookings" search={{ tab: "disputed" }} className={CARD_LINK}>
          {content}
        </Link>
      );
    case "providers":
      return (
        <Link to="/admin/providers" search={{ status: ProviderStatus.Pending }} className={CARD_LINK}>
          {content}
        </Link>
      );
    case "support":
      return (
        <Link to="/admin/support" className={CARD_LINK}>
          {content}
        </Link>
      );
    case "contact":
      return (
        <Link to="/admin/contact" className={CARD_LINK}>
          {content}
        </Link>
      );
  }
}
