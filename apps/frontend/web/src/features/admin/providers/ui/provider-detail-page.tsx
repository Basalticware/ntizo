import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BrandImage } from "@/shared/components/brand-image";
import { Link, useParams } from "@tanstack/react-router";
import {
  Archive,
  Ban,
  BadgeCheck,
  Briefcase,
  Calendar,
  Check,
  ChevronRight,
  CircleAlert,
  Clock,
  Clock3,
  CreditCard,
  FileText,
  Fingerprint,
  Loader2,
  Mail,
  MapPin,
  Percent,
  Phone,
  RotateCw,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Input,
  Skeleton,
  cn,
} from "@ntizo/frontend-ui";
import { ProviderStatus } from "@ntizo/shared";
import { WalletPanel } from "@/features/wallet/ui/wallet-panel";
import { DocumentTiles, DocumentsSection } from "./documents-section";
import { initialsFrom } from "@/shared/lib/initials";
import { shortDate } from "@/shared/lib/relative-day";
import { usePageHeader } from "@/shared/lib/page-header";
import {
  useAdminProviderDetail,
  useDecideProviderStatus,
  useSetProviderCommission,
} from "../viewmodel/use-admin-providers";
import {
  type AdminProviderDetail,
  type AdminProviderInvite,
  type AdminProviderMember,
} from "../domain/types";
import { formatCommission } from "@/shared/domain/commission-format";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  [ProviderStatus.Active]: "success",
  [ProviderStatus.Pending]: "warning",
  [ProviderStatus.Rejected]: "danger",
  [ProviderStatus.Suspended]: "danger",
  [ProviderStatus.Archived]: "neutral",
};

/**
 * The approval panel's buttons, one look per destination: approving is the
 * green one, the two that stop a business are red, and archiving — the one
 * nobody comes back from — is the quiet one, so it is never the button the
 * eye lands on first.
 */
const REFUSE_LOOK =
  "border border-[color-mix(in_srgb,var(--color-bad-fg)_45%,white)] bg-[color-mix(in_srgb,var(--color-bad-bg)_40%,var(--color-card))] text-[var(--color-bad-fg)]";
const ACTION_LOOK: Record<string, { icon: LucideIcon; className: string }> = {
  [ProviderStatus.Active]: {
    icon: Check,
    className: "bg-[var(--color-success)] text-white hover:bg-[color-mix(in_srgb,var(--color-success)_88%,black)]",
  },
  [ProviderStatus.Pending]: {
    icon: RotateCw,
    className:
      "border border-[color-mix(in_srgb,var(--color-warning)_60%,white)] bg-[color-mix(in_srgb,var(--color-warn-bg)_60%,var(--color-card))] text-[var(--color-warn-fg)]",
  },
  [ProviderStatus.Rejected]: { icon: X, className: REFUSE_LOOK },
  [ProviderStatus.Suspended]: { icon: Ban, className: REFUSE_LOOK },
  [ProviderStatus.Archived]: {
    icon: Archive,
    className: "border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-ink-2)]",
  },
};

type Tab = "overview" | "documents";

/** The cards every section of this page sits in, as the mockup draws them. */
const CARD =
  "min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-[22px] pt-5 pb-6 shadow-[0_2px_8px_rgba(30,70,140,0.025)]";

const VIEW_ALL =
  "grid h-8 shrink-0 place-items-center rounded-md border border-[var(--color-blue-outline)] px-3.5 text-sm font-medium whitespace-nowrap text-[var(--color-primary)] hover:bg-[color-mix(in_srgb,var(--color-primary)_6%,transparent)]";

/**
 * One business, and the two decisions an administrator makes about it.
 *
 * The decisions are deliberately separate: approving a business and setting
 * what it is charged have different consequences, and one Save covering both
 * would let a slip in the commission ride along with an approval nobody meant
 * to revisit.
 *
 * Which status buttons appear comes from the server, not from a list written
 * here. The aggregate owns which moves are legal, and a button the server then
 * refuses is worse than no button.
 *
 * Laid out as the October mockup's file: a hero with the mark and the name,
 * tabs, and three columns — who to reach and what the business is on the
 * left, its papers and its money in the middle, the decision on the right.
 * The mockup's services table, statistics, rating and response rate are not
 * drawn: this read carries none of them. Its tabs are the two this page has
 * content for — the overview, and the documents in full with the decision
 * on each.
 */
export function AdminProviderDetailPage() {
  const { t, i18n } = useTranslation("admin");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { providerId } = useParams({ strict: false }) as { providerId: string };
  const [tab, setTab] = useState<Tab>("overview");

  const query = useAdminProviderDetail(providerId);
  const decide = useDecideProviderStatus(providerId);
  const commission = useSetProviderCommission(providerId);
  const detail = query.data;

  usePageHeader(detail?.name ?? t("providerDetailTitle"), detail?.slug, { ownHeading: true });

  // "12 Jan 2024", the mockups' short date, in the reader's own zone.
  const date = (iso: string) =>
    shortDate(iso, Intl.DateTimeFormat().resolvedOptions().timeZone, locale, { year: true });
  // Superseded papers stay on the Documents tab, visibly retired; the
  // overview's tiles are what the business stands on now.
  const liveDocuments = (detail?.documents ?? []).filter((d) => d.status !== "superseded");

  return (
    <div className="flex w-full max-w-[1400px] flex-col">
      <nav aria-label={t("providersTitle")} className="flex min-w-0 items-center gap-2 text-[15px] text-[var(--color-muted-foreground)]">
        <Link to="/admin/providers" className="shrink-0 text-[var(--color-primary)] hover:underline">
          {t("providersTitle")}
        </Link>
        <ChevronRight aria-hidden="true" className="mx-1.5 h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{detail?.name ?? t("providerDetailTitle")}</span>
      </nav>

      {query.error && (
        <p className="type-body mt-4 text-[var(--color-destructive)]">{t("providerDetailError")}</p>
      )}

      {query.isLoading || !detail ? <HeroSkeleton /> : <Hero detail={detail} date={date} />}

      <div
        role="tablist"
        aria-label={t("providerDetailTitle")}
        className="mt-[30px] flex gap-6 overflow-x-auto border-b border-[var(--color-border)] [scrollbar-width:none] md:gap-10"
      >
        <PageTab selected={tab === "overview"} onSelect={() => setTab("overview")} icon={Clock3}>
          {t("providerPage.tabOverview")}
        </PageTab>
        <PageTab selected={tab === "documents"} onSelect={() => setTab("documents")} icon={FileText}>
          {t("providerPage.tabDocuments")}
          {detail && (
            <span className="font-normal text-[var(--color-muted-foreground)]">({liveDocuments.length})</span>
          )}
        </PageTab>
      </div>

      {tab === "documents" ? (
        <div className="mt-6">
          <DocumentsSection
            providerId={providerId}
            documents={detail?.documents ?? []}
            reverificationRequestedAt={detail?.reverificationRequestedAt ?? null}
            loading={query.isLoading}
          />
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[356px_minmax(0,1fr)_344px]">
          {/* ── Who to reach, and what the business is ───────────────────── */}
          <div className="grid min-w-0 gap-6">
            <section className={CARD}>
              <CardHead title={t("providerPage.contact")} />
              <div className="mt-5 grid gap-[18px]">
                <ContactLine icon={Phone} value={detail?.ownerPhone} loading={query.isLoading} />
                <ContactLine icon={Mail} value={detail?.ownerEmail} loading={query.isLoading} />
                <ContactLine
                  icon={MapPin}
                  loading={query.isLoading}
                  value={
                    detail
                      ? [detail.addressStreet, detail.addressDistrict, detail.city, detail.addressPostalCode, detail.country]
                          .filter(Boolean)
                          .join(", ") || null
                      : null
                  }
                />
              </div>
            </section>

            <section className={CARD}>
              <CardHead title={t("providerPage.data")} />
              <dl className="mt-5 mb-0 grid gap-5">
                <DataLine icon={User} label={t("providersOwner")} value={detail?.ownerName} />
                <DataLine
                  icon={Briefcase}
                  label={t("providerDetailType")}
                  value={detail ? t(`providerType.${detail.type}`, { defaultValue: detail.type }) : null}
                />
                {/* In full, not masked. The person reading this is the one who
                    has to send the money, and half an account number is no use
                    to them — the protection is that this read is refused to
                    everybody else, not that the number is hidden from the one
                    person who needs it. */}
                <DataLine
                  icon={CreditCard}
                  label={t("providerDetailPayout")}
                  value={
                    detail?.payoutType
                      ? `${t(`payoutMethod.${detail.payoutType}`, { defaultValue: detail.payoutType })} · ${detail.payoutIdentifier ?? "—"}`
                      : null
                  }
                />
                {/* Shown because the provider's own settings show it, and
                    because it is what anybody asking about this business over
                    support will quote. */}
                <DataLine icon={Fingerprint} label={t("providerDetailId")} value={detail?.id} mono />
              </dl>
            </section>

            <TeamSection
              members={detail?.members ?? []}
              invites={detail?.invites ?? []}
              loading={query.isLoading}
            />
          </div>

          {/* ── The papers and the money ─────────────────────────────────── */}
          <div className="grid min-w-0 gap-6">
            <section className={CARD}>
              <CardHead
                title={t("providerPage.documents")}
                action={
                  <button type="button" onClick={() => setTab("documents")} className={VIEW_ALL}>
                    {t("providerPage.viewAll")}
                  </button>
                }
              />
              <DocumentTiles documents={liveDocuments} loading={query.isLoading} />
            </section>

            {detail && detail.photoUrls.length > 0 && (
              <section className={CARD}>
                <CardHead title={t("providerDetailPhotos")} />
                <div className="mt-[18px] grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                  {detail.photoUrls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      <BrandImage src={url} alt="" className="aspect-[4/3] w-full rounded-[9px] object-cover" />
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* How much a business is holding is a fact about it, like its
                status and its owner — the thing that decides whether
                suspending it is a small act or an expensive one. */}
            <section className={CARD}>
              <CardHead title={t("providerDetailWallet")} />
              <div className="mt-[18px]">
                <WalletPanel providerId={providerId} show="balances" />
              </div>
            </section>

            <section className={CARD}>
              <CardHead title={t("providerDetailMovements")} />
              <p className="mt-1.5 mb-0 text-sm text-[var(--color-muted-foreground)]">{t("providerDetailMovementsHint")}</p>
              <div className="mt-[18px]">
                <WalletPanel providerId={providerId} show="history" compact />
              </div>
            </section>
          </div>

          {/* ── The decision ─────────────────────────────────────────────── */}
          <div className="grid min-w-0 gap-6">
            <section className={CARD}>
              <CardHead title={t("providerPage.approval")} />
              {query.isLoading || !detail ? (
                <Skeleton className="mt-[18px] h-[76px] w-full rounded-[9px]" />
              ) : (
                <StatusBox
                  status={detail.status}
                  reverificationRequestedAt={detail.reverificationRequestedAt}
                  date={date}
                />
              )}

              <div className="mt-5 grid gap-3.5">
                <KeyValue icon={Calendar} label={t("providersApplied")} value={detail ? date(detail.createdAt) : null} />
                <KeyValue icon={Clock} label={t("providerPage.lastChange")} value={detail ? date(detail.updatedAt) : null} />
              </div>

              {decide.error && (
                <p className="mt-4 mb-0 text-sm text-[var(--color-destructive)]">
                  {t(`providerActionError.${(decide.error as { code?: string }).code}`, {
                    defaultValue: t("providerActionFailed"),
                  })}
                </p>
              )}

              <div className="mt-[22px] grid gap-2.5">
                {query.isLoading || !detail ? (
                  <>
                    <Skeleton className="h-10 w-full rounded-[7px]" />
                    <Skeleton className="h-10 w-full rounded-[7px]" />
                  </>
                ) : detail.allowedTransitions.length === 0 ? (
                  // Archived is terminal. Saying so beats an empty row that
                  // reads as a screen that failed to load its buttons.
                  <p className="m-0 text-sm text-[var(--color-muted-foreground)]">{t("providerDetailNoActions")}</p>
                ) : (
                  detail.allowedTransitions.map((status) => {
                    const look = ACTION_LOOK[status] ?? ACTION_LOOK[ProviderStatus.Archived]!;
                    const Icon = look.icon;
                    return (
                      <button
                        key={status}
                        type="button"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate(status)}
                        className={cn(
                          "flex h-10 items-center justify-center gap-3 rounded-[7px] text-[15px] font-semibold transition-colors disabled:opacity-60",
                          look.className,
                        )}
                      >
                        {decide.isPending && decide.variables === status ? (
                          <Loader2 className="h-[18px] w-[18px] animate-spin" />
                        ) : (
                          <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
                        )}
                        {t(`providerAction.${status}`)}
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <section className={CARD}>
              <CardHead title={t("providersCommission")} />
              <p className="mt-1.5 mb-0 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
                {t("providerDetailCommissionHint")}
              </p>
              {/* No `key` here. Remounting on every change of the saved value did
                  the same job as the effect inside, and did it worse: a background
                  refetch landing while somebody was typing threw away what they had
                  written. One mechanism, and it only fires when the server's answer
                  actually changes. */}
              <CommissionForm
                currentBps={detail?.commissionBps ?? null}
                pending={commission.isPending}
                error={commission.error as { code?: string } | null}
                onSave={(bps) => commission.mutate(bps)}
              />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function CardHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="flex min-h-8 items-center justify-between gap-3">
      <h2 className="m-0 text-lg font-bold text-[var(--color-headline)]">{title}</h2>
      {action}
    </header>
  );
}

/**
 * The mark, the name and where the business is, with three facts the read
 * actually has beside them. The mockup's rating and response rate are not
 * among them, so the strip says what the business is charged, how many
 * people act for it and since when it has been on the platform.
 */
function Hero({ detail, date }: { detail: AdminProviderDetail; date: (iso: string) => string }) {
  const { t, i18n } = useTranslation("admin");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const active = detail.status === ProviderStatus.Active;
  const place = [detail.city, detail.addressDistrict].filter(Boolean).join(", ");

  return (
    <section className="mt-[22px] grid items-start gap-[26px] md:grid-cols-[136px_minmax(0,1fr)] 2xl:grid-cols-[136px_minmax(0,1fr)_auto]">
      {/* The logo, not a monogram, when there is one: an administrator
          looking at a business should see the mark its customers see. */}
      <Avatar className="h-24 w-24 md:h-[136px] md:w-[136px]">
        {detail.logoUrl && <AvatarImage src={detail.logoUrl} alt="" />}
        <AvatarFallback className="bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] text-3xl font-semibold text-[var(--color-primary)]">
          {initialsFrom(detail.name)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0">
        <h1 className="m-0 flex flex-wrap items-center gap-x-[18px] gap-y-2 font-display text-[28px] leading-tight font-extrabold tracking-[-0.01em] text-[var(--color-headline)] md:text-[35.5px]">
          <span className="min-w-0 break-words">{detail.name}</span>
          {active && (
            <BadgeCheck aria-hidden="true" className="h-[25px] w-[25px] shrink-0 fill-[var(--color-primary)] text-white" />
          )}
          <Badge
            tone={STATUS_TONE[detail.status] ?? "neutral"}
            className="ml-1.5 h-[30px] px-[17px] text-[14.5px] tracking-normal"
          >
            {active ? t("providerPage.verified") : t(`providerStatus.${detail.status}`)}
          </Badge>
        </h1>
        <div className="mt-2.5 flex min-w-0 items-center text-base text-[var(--color-muted-foreground)]">
          <Briefcase aria-hidden="true" className="mr-[11px] h-[19px] w-[19px] shrink-0" />
          {t(`providerType.${detail.type}`, { defaultValue: detail.type })}
          <span className="mx-[15px] text-sm">•</span>
          <span className="truncate">{detail.slug}</span>
        </div>
        {place && (
          <div className="mt-2.5 flex items-center text-base text-[var(--color-muted-foreground)]">
            <MapPin aria-hidden="true" className="mr-[11px] h-[19px] w-[19px] shrink-0" />
            {place}
          </div>
        )}
        {detail.description?.trim() && (
          // `whitespace-pre-line` so the paragraphs the provider typed
          // survive. Collapsed into one block it reads as a different text
          // from the one they wrote.
          <p className="mt-3 mb-0 max-w-[690px] text-base leading-normal whitespace-pre-line text-[var(--color-muted-foreground)]">
            {detail.description}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-y-3 md:col-span-2 2xl:col-span-1 2xl:mt-6">
        <Kpi icon={Percent} iconClass="text-[var(--color-primary)]" value={formatCommission(detail.commissionBps, locale)} label={t("providersCommission")} />
        <Kpi icon={Users} iconClass="text-[var(--color-success)]" value={String(detail.memberCount)} label={t("providerDetailMembers")} />
        <Kpi icon={Calendar} iconClass="text-[var(--color-primary)]" value={date(detail.createdAt)} label={t("providerPage.memberSince")} />
      </div>
    </section>
  );
}

function Kpi({ icon: Icon, iconClass, value, label }: { icon: LucideIcon; iconClass: string; value: string; label: string }) {
  return (
    <div className="grid grid-cols-[auto_auto] items-center gap-x-[13px] gap-y-[7px] border-l border-[var(--color-border)] py-1 pr-[22px] pl-5 first:border-l-0 first:pl-0 2xl:first:border-l 2xl:first:pl-5">
      <Icon aria-hidden="true" className={cn("h-[22px] w-[22px]", iconClass)} />
      <b className="text-[18.5px] font-bold whitespace-nowrap text-[var(--color-headline)]">{value}</b>
      <span className="col-start-2 text-[13px] whitespace-nowrap text-[var(--color-faint)]">{label}</span>
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div className="mt-[22px] flex items-start gap-[26px]">
      <Skeleton className="h-24 w-24 shrink-0 rounded-full md:h-[136px] md:w-[136px]" />
      <div className="grid gap-3 pt-2">
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-5 w-40" />
      </div>
    </div>
  );
}

function PageTab({
  selected,
  onSelect,
  icon: Icon,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "relative flex h-[52px] shrink-0 items-center gap-4 px-3.5 text-base whitespace-nowrap",
        selected
          ? "font-semibold text-[var(--color-primary)] after:absolute after:inset-x-0 after:bottom-0 after:h-1 after:rounded-sm after:bg-[var(--color-primary)]"
          : "font-medium text-[var(--color-headline)] hover:text-[var(--color-primary)]",
      )}
    >
      <Icon aria-hidden="true" className="h-[21px] w-[21px]" />
      {children}
    </button>
  );
}

function ContactLine({ icon: Icon, value, loading }: { icon: LucideIcon; value: string | null | undefined; loading: boolean }) {
  return (
    <div className="flex min-w-0 items-center text-[15px] text-[var(--color-muted-foreground)]">
      <Icon aria-hidden="true" className="mr-4 h-[21px] w-[21px] shrink-0 text-[var(--color-primary)]" />
      {loading ? <Skeleton className="h-[18px] w-40" /> : <span className="truncate">{value?.trim() || "—"}</span>}
    </div>
  );
}

function DataLine({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: LucideIcon;
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center">
      <Icon aria-hidden="true" className="mr-4 h-[21px] w-[21px] shrink-0 text-[var(--color-headline)]" />
      <dt className="w-[130px] shrink-0 text-sm text-[var(--color-muted-foreground)]">{label}</dt>
      <dd
        className={cn("m-0 min-w-0 truncate text-[14.5px] text-[var(--color-ink-2)]", mono && "font-mono text-[13px]")}
        title={value ?? undefined}
      >
        {value?.trim() || "—"}
      </dd>
    </div>
  );
}

function KeyValue({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | null }) {
  return (
    <div className="flex items-center text-sm whitespace-nowrap text-[var(--color-muted-foreground)]">
      <Icon aria-hidden="true" className="mr-[18px] h-[17px] w-[17px] shrink-0 text-[var(--color-headline)]" />
      {label}
      <span className="ml-auto min-w-[112px] pl-3 text-[15px] text-[var(--color-ink-2)]">{value ?? "—"}</span>
    </div>
  );
}

const BOX_LOOK = {
  success: {
    ground: "bg-[color-mix(in_srgb,var(--color-ok-bg)_60%,var(--color-card))]",
    dot: "bg-[var(--color-success)]",
    text: "text-[var(--color-ok-fg)]",
    icon: Check,
  },
  warning: {
    ground: "bg-[color-mix(in_srgb,var(--color-warn-bg)_70%,var(--color-card))]",
    dot: "bg-[var(--color-warning)]",
    text: "text-[var(--color-warn-fg)]",
    icon: CircleAlert,
  },
  danger: {
    ground: "bg-[color-mix(in_srgb,var(--color-bad-bg)_60%,var(--color-card))]",
    dot: "bg-[var(--color-destructive)]",
    text: "text-[var(--color-bad-fg)]",
    icon: X,
  },
  neutral: {
    ground: "bg-[var(--color-muted)]",
    dot: "bg-[var(--color-ink-2)]",
    text: "text-[var(--color-ink-2)]",
    icon: Archive,
  },
} as const;

/**
 * Where the business stands, in a sentence. Green and ticked when it is
 * trading; amber while it waits for a decision; red once it has been refused
 * or stopped. A replaced approved document overrides all of them — it is the
 * single most important thing on this screen when it is set.
 */
function StatusBox({
  status,
  reverificationRequestedAt,
  date,
}: {
  status: string;
  reverificationRequestedAt: string | null;
  date: (iso: string) => string;
}) {
  const { t } = useTranslation("admin");
  const look = BOX_LOOK[reverificationRequestedAt ? "warning" : (STATUS_TONE[status] ?? "neutral")];
  const Icon = look.icon;
  const title = reverificationRequestedAt
    ? t("providerPage.statusReverify")
    : status === ProviderStatus.Active
      ? t("providerPage.verified")
      : t(`providerStatus.${status}`);
  const body = reverificationRequestedAt
    ? t("providerDetailReverification", { when: date(reverificationRequestedAt) })
    : t(`providerPage.statusBody.${status}`, { defaultValue: "" });

  return (
    <div className={cn("mt-[18px] flex gap-[18px] rounded-[9px] px-4 pt-3.5 pb-4", look.ground)}>
      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-white", look.dot)}>
        <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
      </span>
      <div className="min-w-0">
        <b className={cn("block text-[15px] font-semibold", look.text)}>{title}</b>
        {body && <p className={cn("mt-1 mb-0 text-sm leading-[1.45] opacity-90", look.text)}>{body}</p>}
      </div>
    </div>
  );
}

/**
 * The commission, typed as a percentage and stored as basis points.
 *
 * A percentage because that is what the number is called in every conversation
 * about it; basis points on the wire because 7.5% is 750 exactly and 0.075 is
 * not. The conversion happens once, here.
 */
function CommissionForm({
  currentBps,
  pending,
  error,
  onSave,
}: {
  currentBps: number | null;
  pending: boolean;
  error: { code?: string } | null;
  onSave: (bps: number) => void;
}) {
  const { t } = useTranslation("admin");
  const [value, setValue] = useState(
    currentBps === null ? "" : String(currentBps / 100),
  );

  useEffect(() => {
    if (currentBps !== null) setValue(String(currentBps / 100));
  }, [currentBps]);

  const parsed = Number(value.replace(",", "."));
  const valid = Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
  // Rounded, because 7.55% is 755 basis points and 7.555% is not expressible.
  const bps = Math.round(parsed * 100);
  const changed = currentBps !== null && bps !== currentBps;

  return (
    <div className="mt-[18px] grid gap-2">
      <div className="flex items-center gap-2.5">
        <div className="relative min-w-0 flex-1">
          <Input
            value={value}
            inputMode="decimal"
            onChange={(e) => setValue(e.target.value)}
            aria-label={t("providersCommission")}
            className="h-10 rounded-[7px] pr-8"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[var(--color-muted-foreground)]">
            %
          </span>
        </div>
        <Button
          type="button"
          className="h-10 rounded-[7px]"
          disabled={!valid || !changed || pending}
          onClick={() => onSave(bps)}
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("providerDetailCommissionSave")}
        </Button>
      </div>
      {!valid && value.trim() !== "" && (
        <p className="type-caption text-[var(--color-destructive)]">
          {t("providerDetailCommissionRange")}
        </p>
      )}
      {error && (
        <p className="text-sm text-[var(--color-destructive)]">
          {t(`providerActionError.${error.code}`, {
            defaultValue: t("providerActionFailed"),
          })}
        </p>
      )}
    </div>
  );
}

/**
 * Who can act for this business.
 *
 * Pending invitations sit beside the members on purpose: an invitation is
 * somebody who is *about* to have access, and a reviewer reading only the
 * accepted list is reading half the answer to "who is this business".
 */
function TeamSection({
  members,
  invites,
  loading,
}: {
  members: readonly AdminProviderMember[];
  invites: readonly AdminProviderInvite[];
  loading: boolean;
}) {
  const { t, i18n } = useTranslation("admin");
  // Roles and invitation states are named in the `provider` namespace, where
  // the workspace's own people list already reads them. Read from there rather
  // than copied across: a copy is one more place for "Owner" to change on one
  // screen and not the other. Getting this wrong is silent — i18next renders
  // the key.
  const { t: tp } = useTranslation("provider");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));

  return (
    <section className={CARD}>
      <CardHead title={t("providerDetailTeam")} />
      <p className="mt-1.5 mb-0 text-sm text-[var(--color-muted-foreground)]">{t("providerDetailTeamHint")}</p>

      {loading ? (
        <p className="mt-4 mb-0 py-6 text-center text-sm text-[var(--color-muted-foreground)]">
          {t("providerDetailDocumentsLoading")}
        </p>
      ) : (
        <ul className="mt-3 mb-0 grid list-none gap-0 p-0">
          {members.map((m) => (
            <li
              key={m.userId}
              className="flex items-center justify-between gap-3 border-t border-[var(--color-line-2)] py-3 first:border-t-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] text-xs font-semibold text-[var(--color-primary)]">
                    {initialsFrom(m.name ?? m.email ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="m-0 truncate text-sm font-bold text-[var(--color-headline)]">
                    {m.name ?? m.email ?? "—"}
                  </p>
                  <p className="m-0 truncate text-[13px] text-[var(--color-muted-foreground)]">
                    {m.name ? m.email : t("providerDetailJoined", { date: date(m.joinedAt) })}
                  </p>
                </div>
              </div>
              <Badge tone={m.role === "owner" ? "success" : "info"} className="h-[26px] px-3 text-[13px]">
                {tp(`peopleRoles.${m.role}`, { defaultValue: m.role })}
              </Badge>
            </li>
          ))}

          {invites.map((i) => (
            <li
              key={i.id}
              className="flex items-center justify-between gap-3 border-t border-[var(--color-line-2)] py-3 first:border-t-0"
            >
              <div className="min-w-0">
                <p className="m-0 truncate text-sm font-bold text-[var(--color-headline)]">{i.email}</p>
                <p className="m-0 truncate text-[13px] text-[var(--color-muted-foreground)]">
                  {t("providerDetailInviteExpires", { date: date(i.expiresAt) })}
                </p>
              </div>
              <Badge tone="warning" className="h-[26px] px-3 text-[13px]">
                {/* The table stores `pending`; the people list calls that state
                    `invited`, which is the word a reader understands — an
                    invitation is not pending in the way a document is. Mapped
                    rather than adding a second name for the same state. */}
                {tp(`peopleStatus.${i.status === "pending" ? "invited" : i.status}`, {
                  defaultValue: i.status,
                })}
              </Badge>
            </li>
          ))}

          {members.length === 0 && invites.length === 0 && (
            <li className="py-6 text-center text-sm text-[var(--color-muted-foreground)]">
              {t("providerDetailNoTeam")}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
