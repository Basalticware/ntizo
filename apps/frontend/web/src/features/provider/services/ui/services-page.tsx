import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BrandImage } from "@/shared/components/brand-image";
import { Link, useNavigate } from "@tanstack/react-router";
import { Calendar, CirclePlus, Clock, LayoutGrid, MoreHorizontal, Sparkles, icons } from "lucide-react";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
} from "@ntizo/frontend-ui";
import { CollectionCard } from "@/shared/components/collection-card";
import { DETAILS_BUTTON_CLASS } from "@/shared/components/list-cells";
import { formatHours } from "@/shared/domain/week-format";
import { initialsFrom } from "@/shared/lib/initials";
import { usePageAction, usePageHeader } from "@/shared/lib/page-header";
import { formatMoneyShort } from "@/features/wallet/domain/money";
import { useActiveProvider } from "@/features/provider/viewmodel/use-active-provider";
import { isWorkspaceLive } from "@/features/provider/domain/workspace-status";
import { useAvailabilityConfig } from "@/features/provider/availability/viewmodel/use-availability";
import { useCategoryLookup, useServices } from "../viewmodel/use-services";
import { useSetServiceStatus } from "../viewmodel/use-service-editor";
import { publishBlocker } from "../domain/completeness";
import { availabilitySummary } from "../domain/availability-summary";
import { defaultOption, ownerName, priceCell, type ProviderService } from "../domain/types";
import { SegmentedTabs } from "./segmented-tabs";

/**
 * What a row's pill says. Not the stored status alone: a published service
 * priced on request is "Sob orçamento" in the mockup, because what a customer
 * meets there is a request form rather than a booking — and the tabs above
 * partition the catalogue by the same four words, so a row sits under exactly
 * the tab its pill names.
 */
type ServiceKind = "active" | "quote" | "draft" | "archived";
const KINDS: readonly ServiceKind[] = ["active", "quote", "draft", "archived"];
type ServicesTab = "all" | ServiceKind;

function kindOf(service: ProviderService): ServiceKind {
  if (service.status === "draft") return "draft";
  if (service.status === "archived") return "archived";
  return service.bookingMode === "quote" ? "quote" : "active";
}

const KIND_TONE: Record<ServiceKind, "success" | "warning" | "violet" | "danger"> = {
  active: "success",
  quote: "warning",
  draft: "violet",
  archived: "danger",
};

/**
 * A provider's own catalogue: what they sell, at what price, when, and
 * whether customers can see it yet.
 *
 * The mockup's table, column for column, less the one the data does not
 * have: "Pagamento" — how a service is paid is not something a service
 * carries. The tabs, the category, the duration and the price are all read
 * off the one `serviceMine` request; the hours come from the availability the
 * workspace configured, merged across whoever performs the service.
 */
export function ServicesPage() {
  const { t, i18n } = useTranslation("provider");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { activeProvider } = useActiveProvider();
  const query = useServices(activeProvider?.id);
  const categories = useCategoryLookup();
  const availability = useAvailabilityConfig(activeProvider?.id);
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ServicesTab>("all");

  usePageHeader(t("nav.services"), t("servicesSubtitle"));
  // `null` while the workspace is still loading — without that guard, a
  // click during that window would navigate with `slug: undefined`. Depends
  // on the slug (not the whole `activeProvider` object, which is a fresh
  // reference on every render) so switching workspace re-registers the
  // button pointing at the new one.
  usePageAction(
    activeProvider ? (
      <Button
        onClick={() =>
          void navigate({
            to: "/provider/$slug/services/$serviceId",
            params: { slug: activeProvider.slug, serviceId: "new" },
          })
        }
        className="h-[49px] gap-4 rounded-[10px] px-6 text-[15.5px] font-semibold"
      >
        <CirclePlus className="h-[30px] w-[30px]" strokeWidth={1.5} />
        <span className="hidden sm:inline">{t("serviceNew")}</span>
      </Button>
    ) : null,
    [activeProvider?.slug],
  );

  const rows = useMemo(() => query.data ?? [], [query.data]);

  // No server-side search on this query (it takes only providerId and an
  // optional status) — a provider's own catalogue is small enough that
  // filtering the already-fetched list is simpler than adding a param the
  // backend would have to support for one screen. The same holds for the
  // tabs and their counts: the whole catalogue is here.
  const searched = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((service) => {
      const category = categories.get(service.categoryId)?.name ?? service.categoryCode;
      return (
        ownerName(service, locale).toLowerCase().includes(needle) ||
        category.toLowerCase().includes(needle)
      );
    });
  }, [rows, search, locale, categories]);
  const visible = tab === "all" ? searched : searched.filter((s) => kindOf(s) === tab);

  /** Each service's weekly hours: its performers' patterns, or the whole team's when it names none. */
  const hoursOf = (service: ProviderService) => {
    const members = availability.data?.members ?? [];
    const performers = service.memberIds.length
      ? members.filter((m) => service.memberIds.includes(m.memberId))
      : members;
    return availabilitySummary(performers.flatMap((m) => m.weekly), locale);
  };

  if (!activeProvider) return null;

  return (
    <div className="flex w-full max-w-[1400px] flex-col gap-4">
      {query.error && (
        <p className="type-body text-[var(--color-destructive)]">
          {t("servicesError")}
        </p>
      )}

      <CollectionCard
        title={t("servicesTitle")}
        tabs={
          <SegmentedTabs
            ariaLabel={t("servicesTitle")}
            value={tab}
            onChange={setTab}
            tabs={(["all", ...KINDS] as const).map((key) => ({
              key,
              label: t(`servicesTab.${key}`),
              count: key === "all" ? rows.length : rows.filter((s) => kindOf(s) === key).length,
            }))}
          />
        }
        shown={visible.length}
        total={rows.length}
        loading={query.isLoading}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t("servicesSearchPlaceholder")}
        columns={[
          { key: "service", label: t("servicesService"), className: "w-[320px] pl-[18px]" },
          { key: "category", label: t("servicesCategory"), skeletonWidth: "w-28", className: "w-[150px] pl-1" },
          { key: "duration", label: t("servicesDuration"), skeletonWidth: "w-16", className: "w-[100px] pl-1" },
          { key: "price", label: t("servicesPrice"), skeletonWidth: "w-20", className: "w-[150px] pl-1" },
          { key: "availability", label: t("servicesAvailability"), skeletonWidth: "w-28", className: "w-[190px] pl-2" },
          {
            key: "status",
            label: t("servicesStatusLabel"),
            skeletonWidth: "w-20",
            skeletonShape: "badge",
            className: "w-[170px] pl-1",
          },
          { key: "actions", label: t("servicesActions"), className: "pr-5 pl-1", hideOnCard: true },
        ]}
        emptyText={t("servicesEmpty")}
        emptyTitle={t("servicesEmptyTitle")}
        emptyBadge={LayoutGrid}
        noMatchesText={search.trim() ? t("servicesNoMatches") : t("servicesTabEmpty")}
        noMatchesTitle={t("servicesNoMatchesTitle")}
        filtered={search.trim() !== "" || tab !== "all"}
        // No `reorder`: there is no mutation to set the display order of a
        // provider's own service list (unlike its options, which have
        // `service.options.reorder`) — only sorting/filtering, nothing to drag.
        rows={visible.map((service) => {
          const kind = kindOf(service);
          const cell = priceCell(service);
          const option = defaultOption(service);
          const category = categories.get(service.categoryId);
          const hours = hoursOf(service);
          const edit = () =>
            void navigate({
              to: "/provider/$slug/services/$serviceId",
              params: { slug: activeProvider.slug, serviceId: service.id },
            });
          return {
            key: service.id,
            primary: <ServiceCell service={service} slug={activeProvider.slug} locale={locale} />,
            cells: {
              category: (
                <CategoryChip
                  name={category?.name ?? service.categoryCode}
                  icon={category?.icon ?? null}
                />
              ),
              duration: option?.durationMinutes ? (
                <IconLine icon={<Clock className="h-[21px] w-[21px] text-[var(--color-muted-foreground)] dark:text-[var(--color-ink-2)]" />}>
                  {option.durationMinutes < 60
                    ? t("servicesMinutes", { count: option.durationMinutes })
                    : formatHours(option.durationMinutes, locale)}
                </IconLine>
              ) : (
                "—"
              ),
              price:
                cell.kind === "priced" ? (
                  <span className="text-[15.5px] font-bold whitespace-nowrap text-[var(--color-headline)] tabular-nums">
                    {formatMoneyShort(cell.option.amountMinor, cell.option.currency, locale)}
                    {cell.option.pricingMode === "hourly" && " / h"}
                  </span>
                ) : (
                  <span className="text-sm text-[var(--color-muted-foreground)]">
                    {t(cell.kind === "quote" ? "servicesPriceOnQuote" : "servicesPriceNone")}
                  </span>
                ),
              availability: hours ? (
                <IconLine icon={<Calendar className="h-[21px] w-[21px] text-[var(--color-primary)]" />}>
                  <span className="block">{hours.days === "all" ? t("servicesEveryDay") : hours.days}</span>
                  <span className="block tabular-nums">{hours.hours}</span>
                  {hours.more && <span className="block text-[12px]">{t("servicesMoreHours")}</span>}
                </IconLine>
              ) : (
                <span className="text-[13px] text-[var(--color-muted-foreground)]">{t("servicesNoHours")}</span>
              ),
              status: (
                <Badge tone={KIND_TONE[kind]} className="h-[34px] gap-2 px-3.5 text-[13px]">
                  <span aria-hidden="true" className="h-[9px] w-[9px] rounded-full bg-current" />
                  {t(`servicesStatus.${kind === "active" ? "published" : kind}`)}
                </Badge>
              ),
            },
            actions: (
              <span className="flex items-center">
                {/* A draft is still being written, so its way in is the editor's
                    verb; anything published or archived is looked at first.
                    On a phone the card's name is that link already, and the
                    button would squeeze it to a word a line. */}
                <Link
                  to="/provider/$slug/services/$serviceId"
                  params={{ slug: activeProvider.slug, serviceId: service.id }}
                  tabIndex={-1}
                  className={cn(
                    DETAILS_BUTTON_CLASS,
                    "h-11 w-[134px] border-[var(--color-blue-edge)] px-0 text-[14.5px] max-md:hidden",
                    kind === "draft" &&
                      "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-deep)]",
                  )}
                >
                  {kind === "draft" ? t("servicesEditDraft") : t("common:viewDetails")}
                </Link>
                <RowActions
                  service={service}
                  providerId={activeProvider.id}
                  canPublish={activeProvider.role === "owner" || activeProvider.role === "admin"}
                  individualProvider={activeProvider.type === "individual"}
                  workspaceActive={isWorkspaceLive(activeProvider.status)}
                  onEdit={edit}
                />
              </span>
            ),
          };
        })}
      />
    </div>
  );
}

/** The photo if there is one, the monogram if not, the name — a link to the editor — and the description under it. */
function ServiceCell({
  service,
  slug,
  locale,
}: {
  service: ProviderService;
  slug: string;
  locale: string;
}) {
  const name = ownerName(service, locale);
  const description =
    service.translations.find((tr) => tr.locale === locale)?.description ??
    service.translations.find((tr) => tr.locale === service.sourceLocale)?.description ??
    null;
  return (
    <div className="flex min-w-0 items-center gap-[21px] py-1.5">
      <div className="grid h-[74px] w-[77px] shrink-0 place-items-center overflow-hidden rounded-[9px] bg-[var(--color-muted)]">
        {service.imageUrls[0] ? (
          <BrandImage src={service.imageUrls[0]} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm font-semibold text-[var(--color-muted-foreground)]">{initialsFrom(name)}</span>
        )}
      </div>
      <div className="min-w-0">
        <Link
          to="/provider/$slug/services/$serviceId"
          params={{ slug, serviceId: service.id }}
          className="block text-[15.5px] leading-[23px] font-bold text-[var(--color-headline)] hover:underline"
        >
          {name}
        </Link>
        {description && (
          <p className="mt-1 line-clamp-2 text-sm leading-[21px] text-[var(--color-faint)] dark:text-[var(--color-muted-foreground)]">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

/** The category, on its own tinted ground, with the icon the admin gave it. */
/**
 * The category as a small pill, the size of the status badge beside it.
 *
 * It was a 50px-tall, 125px-wide tile in one of three colours hashed from
 * the code, which read as a button and drew the eye before the service's own
 * name did (the user, 2026-10-08). One soft blue for every category now: a
 * category is a fact about the row, not a state to tell apart at a glance.
 */
function CategoryChip({ name, icon }: { name: string; icon: string | null }) {
  const Icon = (icon && icons[icon as keyof typeof icons]) || Sparkles;
  return (
    <span className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-[var(--color-blue-softer)] px-2.5 text-[12.5px] font-medium whitespace-nowrap text-[var(--color-primary)] dark:bg-[var(--color-info-bg)]">
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
      <span className="min-w-0 truncate">{name}</span>
    </span>
  );
}

/** A small icon and one or two muted lines beside it — duration and hours. */
function IconLine({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-3 text-[13px] leading-[19px] text-[var(--color-faint)] dark:text-[var(--color-muted-foreground)]">
      <span aria-hidden="true" className="shrink-0">{icon}</span>
      <span className="min-w-0">{children}</span>
    </span>
  );
}

/**
 * The rest of what a row can do — edit, publish, unpublish, archive. No
 * move-up/move-down: there is no mutation that orders a provider's services
 * against one another (only within one service's options).
 */
function RowActions({
  service,
  providerId,
  canPublish,
  individualProvider,
  workspaceActive,
  onEdit,
}: {
  service: ProviderService;
  providerId: string;
  canPublish: boolean;
  individualProvider: boolean;
  workspaceActive: boolean;
  onEdit: () => void;
}) {
  const { t } = useTranslation("provider");
  const setStatus = useSetServiceStatus(providerId);

  // The same rule the review step applies, asked here so the menu never
  // offers a Publish the server would refuse. `publishBlocker` mirrors
  // `canPublish` on the server, in the server's own order.
  const blocker = publishBlocker({
    categoryId: service.categoryId || null,
    sourceName:
      service.translations.find((tr) => tr.locale === service.sourceLocale)?.name?.trim() ?? "",
    bookingMode: service.bookingMode,
    optionCount: service.options.length,
    memberIds: service.memberIds,
    individualProvider,
    workspaceActive,
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button
          type="button"
          aria-label={t("servicesActions")}
          className="ml-[9px] grid h-9 w-9 place-items-center rounded-full text-[var(--color-info-fg)] hover:bg-[var(--color-muted)]"
        >
          <MoreHorizontal className="h-[22px] w-[22px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>{t("serviceEdit")}</DropdownMenuItem>

        {/* The status changes, so a provider taking a service off the
            marketplace for a week does not have to walk six wizard steps to
            do it. Only what is actually available from here: a draft that
            still has a blocker offers no Publish at all rather than one that
            fails, because a menu item that errors on click teaches people to
            distrust the menu. */}
        {canPublish && service.status === "draft" && blocker === null && (
          <DropdownMenuItem
            onSelect={() => void setStatus.mutateAsync({ serviceId: service.id, status: "published" })}
          >
            {t("servicePublish")}
          </DropdownMenuItem>
        )}
        {canPublish && service.status === "published" && (
          <DropdownMenuItem
            onSelect={() => void setStatus.mutateAsync({ serviceId: service.id, status: "draft" })}
          >
            {t("serviceUnpublish")}
          </DropdownMenuItem>
        )}
        {canPublish && service.status !== "archived" && (
          <DropdownMenuItem
            onSelect={() => void setStatus.mutateAsync({ serviceId: service.id, status: "archived" })}
          >
            {t("serviceArchive")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
