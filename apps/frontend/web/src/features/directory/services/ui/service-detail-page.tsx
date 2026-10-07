import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import type { ServiceDetailDTO, WeeklyHoursDTO } from "@ntizo/shared/read-models";
import { SiteHeader } from "@/shared/components/site-header";
import { EmptyCard } from "@/shared/components/empty-card";
import {
  CalendarDays,
  ChevronRight,
  Database,
  House,
  MapPin,
  PackageX,
  ShieldCheck,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { minutesToLabel } from "@/shared/domain/week-format";
import { useServiceDetail } from "@/features/directory/services/viewmodel/use-service-detail";
import { ServiceProviderCard } from "@/features/directory/services/ui/service-provider-card";
import { ServicePerformers } from "@/features/directory/services/ui/service-performers";
import { ServiceOptions } from "@/features/directory/services/ui/service-options";
import { RailPriceSummary } from "@/features/directory/services/ui/rail-price-summary";
import { ServiceQuoteNotice } from "@/features/directory/services/ui/service-quote-notice";
import { ServicePackagesUnavailable } from "@/features/directory/services/ui/service-packages-unavailable";
import { useCategoryIcon } from "@/features/directory/services/ui/category-icon";
import {
  optionDurationMinutes,
  serviceDetailPanel,
} from "@/features/directory/services/domain/service-card";
// The real ones, from the provider directory. Reused rather than reimplemented
// here: reviews belong to a business, not to one of its services, so there is
// one component and one query for them and this page is a second reader of
// both. See `ServiceReviewsSection` below for what that costs in wording.
import { ProviderReviews, Stars } from "@/features/directory/ui/provider-reviews";
import { DetailGallery } from "@/features/directory/ui/detail-gallery";
import { groupWeekdays, hasAnyHours } from "@/features/directory/domain/weekly-hours";
import { formatRating } from "@/shared/domain/rating";
import { useProviderDetail, useProviderReviews } from "@/features/directory/viewmodel/use-directory";

/**
 * One service, in full.
 *
 * Split in two so `useProviderDetail` below is not called after an early
 * return: the not-found answer needs no provider, and a hook that runs for
 * one service and not for another is the one thing React's rules forbid.
 */
export function ServiceDetailPage({ id }: { id: string }) {
  const { t } = useTranslation("directory");
  const service = useServiceDetail(id);

  if (!service) {
    return (
      <>
        <SiteHeader current="services" />
        <main className="page-shell py-12">
          <EmptyCard
            framed
            badge={PackageX}
            title={t("serviceNotFoundTitle")}
            body={t("serviceNotFoundBody")}
            action={
              <Link
                to="/services"
                className="rounded-full bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                {t("serviceNotFoundAction")}
              </Link>
            }
          />
        </main>
      </>
    );
  }

  return <ServiceDetail service={service} />;
}

/**
 * The service page proper, laid out as `client/servico-detalhe.html`
 * (October 2026).
 *
 * Two columns. On the left, the breadcrumb, the collage, the title beside the
 * business's card, four facts, what the service is, and the reviews. On the
 * right, the booking card — the price, the next free days and times, the
 * button — then how paying works. The rail starts level with the collage, so
 * the price and the only button that starts a booking are visible the moment
 * the page is.
 *
 * **The packages are in the body, the total is in the rail.** `ServiceOptions`
 * takes the rows, `RailPriceSummary` takes the total, and the selection lives
 * here — the only place both can read it from.
 *
 * **The provider is read a second time, by slug**, for its weekly hours —
 * `ServiceDetailDTO` carries none. That read can resolve to `null` — a
 * provider deactivated between the two queries — so the hours line is
 * guarded, and the service, which is still real, is still shown in full.
 *
 * **What the mockup shows and this page does not**, because nothing records
 * it: a coverage area and a response time in the "about" panel, the questions
 * and answers under the rail, and "Escrever avaliação" — a review is left from
 * a finished booking, not from here.
 *
 * Several pieces render nothing in the state most services are in —
 * `DetailGallery` with no photographs, `ServiceOptions` with one package,
 * `ServicePerformers` with fewer than two people, `ProviderReviews` with
 * nobody having reviewed. An empty labelled frame reads as a page that failed
 * to load, where the plain absence of a section reads as "not yet".
 */
function ServiceDetail({ service }: { service: ServiceDetailDTO }) {
  const { t, i18n } = useTranslation("directory");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const provider = useProviderDetail(service.providerSlug, locale);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const CategoryIcon = useCategoryIcon(service.categoryCode);

  // The provider's own default, falling back to the first option — the
  // cheapest, since `getService` already orders `options` cheapest first.
  //
  // `selected` is re-derived from the current `options` on every render rather
  // than trusted as state. The route reuses this component's instance across
  // services, so a `selectedId` left over from the last service would
  // otherwise point at an option this one does not have.
  const defaultOption = service.options.find((option) => option.isDefault) ?? service.options[0];
  const selected = service.options.find((option) => option.id === selectedId) ?? defaultOption;

  // Read off the *selected* option, like the rail's own breakdown: two
  // "Duration" figures on one screen disagreeing because one of them
  // describes a package nobody chose is what lifting the selection prevents.
  const minutes = selected ? optionDurationMinutes(selected) : null;
  const isHourly = selected?.pricingMode === "hourly";
  const place = [service.providerCity, service.providerDistrict].filter(Boolean).join(", ");
  // A location type this build has never heard of resolves to an empty string
  // rather than a raw, untranslated code.
  const where = t(`filterWhereOption.${service.locationType}`, { defaultValue: "" });
  const hours = provider ? hoursSummary(provider.weeklyHours, locale, t("availabilityClosed")) : null;

  return (
    // The mockup's 39px inset at its 1373px width.
    <div className="[--pw-pad:clamp(16px,2.85vw,39px)]">
      <SiteHeader current="services" />

      <div className="public-inset grid gap-x-6 pb-12 lg:grid-cols-[minmax(0,1fr)_391px]">
        <div className="min-w-0">
          <Breadcrumb service={service} />

          <DetailGallery
            // Prefixed: the options list below is keyed by the same id, and
            // two siblings sharing a key is one React will not tell apart.
            key={`gallery-${service.id}`}
            images={service.imageUrls}
            alt={service.name}
            badge={
              <span className="flex h-[38px] items-center gap-2.5 rounded-[18px] bg-[var(--color-blue-softer)] pr-[22px] pl-[17px] text-sm font-medium text-[var(--color-info-fg)]">
                <CategoryIcon className="h-[17px] w-[17px] fill-[var(--color-blue-public)] text-[var(--color-blue-public)]" aria-hidden="true" />
                {service.categoryName}
              </span>
            }
          />

          <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_290px]">
            <header className="min-w-0">
              <h1 className="text-[30px] leading-[1.05] font-extrabold tracking-[-0.02em] text-[var(--color-headline)] md:text-[45px]">
                {service.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[var(--color-muted-foreground)]">
                <ServiceHeaderRating service={service} />
                {service.providerVerified && (
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-[19px] w-[19px] text-[var(--color-blue-public)]" aria-hidden="true" />
                    {t("providerVerifiedLong")}
                  </span>
                )}
                {place && (
                  <span className="flex items-center gap-2">
                    <MapPin className="h-[18px] w-[18px] fill-[var(--color-blue-public)] text-white" aria-hidden="true" />
                    {place}
                  </span>
                )}
              </div>
            </header>
            <ServiceProviderCard service={service} />
          </div>

          {/* The empty string is how a fact asks to be dropped rather than
              printed as a label with nothing under it: a quote service has no
              length and no pricing mode to state, and inventing either would
              be worse than a shorter row. */}
          <FactCards
            facts={[
              {
                icon: Timer,
                label: t("factDurationAverage"),
                value:
                  minutes === null
                    ? ""
                    : t(isHourly ? "serviceMinimumMinutes" : "serviceDurationMinutes", { count: minutes }),
              },
              { icon: House, label: t("factWhere"), value: where },
              {
                icon: Database,
                label: t("factPricingMode"),
                value: selected ? t(isHourly ? "pricingModeHourly" : "pricingModeFixed") : "",
              },
              { icon: CategoryIcon, label: t("factCategory"), value: service.categoryName },
            ]}
          />

          {(service.description || hours || where) && (
            <section className="mt-9 grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
              <div>
                {service.description && (
                  <>
                    <h2 className="text-[22px] leading-[1.1] font-extrabold text-[var(--color-headline)] md:text-2xl">
                      {t("aboutServiceHeading")}
                    </h2>
                    {/* `whitespace-pre-line`, so the paragraph breaks a
                        provider typed survive as paragraph breaks. */}
                    <p className="mt-2.5 max-w-[620px] text-base leading-[1.55] whitespace-pre-line text-[var(--color-muted-foreground)]">
                      {service.description}
                    </p>
                  </>
                )}
              </div>
              {(hours || where) && (
                <dl className="grid gap-4 rounded-xl bg-[var(--color-blue-softer)] px-4 py-[18px]">
                  {hours && <PanelRow icon={CalendarDays} label={t("availabilityHeading")} value={hours} />}
                  {where && <PanelRow icon={House} label={t("factServiceType")} value={where} />}
                </dl>
              )}
            </section>
          )}

          {/* Keyed by id: the route reuses this component's instance across
              services, and a key is what stops the next stateful thing added
              to this list from carrying one service's state onto another's
              page. */}
          <ServiceOptions
            key={`options-${service.id}`}
            options={service.options}
            selectedId={selected?.id ?? ""}
            onSelect={setSelectedId}
            locale={locale}
          />

          <ServicePerformers performers={service.performers} />
          <ServiceReviewsSection service={service} />
        </div>

        {/* 84px, not 0: the site header is 68px and sticky, so a rail pinned
            to the top of the viewport would slide under it. */}
        <aside className="mt-[18px] grid content-start gap-4 lg:sticky lg:top-[84px] lg:self-start">
          {(() => {
            // `serviceDetailPanel` is the one place this three-way split is
            // decided, keyed off `bookingMode` first and never off
            // `options.length` alone.
            const panel = serviceDetailPanel(service);
            if (panel.kind === "quote") {
              // No price is fixed until the provider has seen the job, so
              // there is no slot to offer and no option to book; the notice
              // carries the request itself.
              return (
                <ServiceQuoteNotice
                  serviceId={service.id}
                  providerId={service.providerId}
                  providerName={service.providerName}
                  quoteForm={service.quoteForm}
                />
              );
            }
            // "No option to price" and "no packages" are the same fact and
            // deserve the same answer, rather than a `!` on `selected`.
            if (panel.kind === "unavailable" || !selected) {
              return <ServicePackagesUnavailable />;
            }
            return (
              <RailPriceSummary
                option={selected}
                locale={locale}
                serviceId={service.id}
                providerId={service.providerId}
                // False for a provider that failed to resolve, which is the
                // conservative direction: the sentence claims an administrator
                // accepted this business's documents, and an absent answer is
                // not a yes.
                providerVerified={provider?.verified ?? false}
              />
            );
          })()}
        </aside>
      </div>
    </div>
  );
}

/**
 * The provider's usual week in one line — "Segunda a sexta, 08:00 – 17:00 ·
 * Sábado, 08:00 – 13:00" — from the same grouping the provider page's hours
 * card uses. Closed days are left out of the line: they are what the line does
 * not say. Null for a provider who configured no week, so the row goes.
 */
function hoursSummary(hours: readonly WeeklyHoursDTO[], locale: string, closed: string): string | null {
  if (!hasAnyHours(hours)) return null;
  return groupWeekdays(hours, locale)
    .filter((row) => row.intervals.length > 0)
    .map((row) => {
      const label = row.label.charAt(0).toUpperCase() + row.label.slice(1);
      const spans = row.intervals
        .map((i) => `${minutesToLabel(i.startMinute)} – ${minutesToLabel(i.endMinute)}`)
        .join(", ");
      return `${label}, ${spans || closed}`;
    })
    .join(" · ");
}

/**
 * The four facts under the title, each its own 64px card with a glyph in a
 * soft blue disc. A real `<dl>`, so each value is paired with its label for
 * assistive tech; a fact whose value is empty is dropped rather than drawn as
 * a labelled blank.
 */
function FactCards({ facts }: { facts: { icon: LucideIcon; label: string; value: string }[] }) {
  const shown = facts.filter((fact) => fact.value.trim() !== "");
  if (shown.length === 0) return null;
  return (
    <dl className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
      {shown.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex min-h-16 min-w-0 items-center gap-2.5 rounded-[10px] border border-[var(--color-border)] px-3 py-2.5 md:h-16 md:gap-3 md:px-4 md:py-0">
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-blue-soft)] text-[var(--color-blue-public)]">
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <div className="flex min-w-0 flex-col-reverse">
            <dt className="mt-[3px] truncate text-[13px] text-[var(--color-faint)]">{label}</dt>
            <dd className="text-[15px] leading-[1.3] font-semibold text-[var(--color-headline)] md:truncate">{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

function PanelRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-3.5">
      <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-info-bg)] text-[var(--color-blue-public)]">
        <Icon className="h-[17px] w-[17px]" />
      </span>
      <div className="min-w-0">
        <dt className="text-sm font-semibold text-[var(--color-ink-2)]">{label}</dt>
        <dd className="mt-[3px] text-[13px] text-[var(--color-faint)]">{value}</dd>
      </div>
    </div>
  );
}

/**
 * Where this service sits: home, the services list, its category, itself.
 *
 * The category link is a real filter on the browse rather than decoration, so
 * a reader who decided this particular electrician is not for them lands on
 * the others rather than back at everything. The last crumb is text, not a
 * link to the page you are already on.
 */
function Breadcrumb({ service }: { service: ServiceDetailDTO }) {
  const { t } = useTranslation("directory");
  const { t: tl } = useTranslation("landing");
  const sep = (
    <li aria-hidden="true">
      <ChevronRight className="mx-2.5 h-3.5 w-3.5" strokeWidth={2} />
    </li>
  );
  const link = "hover:text-[var(--color-headline)] hover:underline";

  return (
    <nav aria-label={t("breadcrumbLabel")} className="pt-[18px] pb-4 text-sm leading-[1.2]">
      <ol className="flex list-none flex-wrap items-center p-0 text-[var(--color-faint)]">
        <li>
          <Link to="/" className={link}>
            {t("breadcrumbHome")}
          </Link>
        </li>
        {sep}
        <li>
          <Link to="/services" className={link}>
            {tl("nav.services")}
          </Link>
        </li>
        {sep}
        <li>
          <Link to="/services" search={{ category: service.categoryCode }} className={link}>
            {service.categoryName}
          </Link>
        </li>
        {sep}
        <li className="font-semibold text-[var(--color-ink-2)]">{service.name}</li>
      </ol>
    </nav>
  );
}

/**
 * The score under the title, and a way down to the words behind it.
 *
 * Renders nothing at all until somebody has reviewed: empty stars or "0.0"
 * would show a business nobody has rated yet as the worst on the platform.
 * The count is an anchor to the reviews further down — a promise that the
 * evidence exists, and a promise you cannot follow is just a number.
 */
function ServiceHeaderRating({ service }: { service: ServiceDetailDTO }) {
  const { t, i18n } = useTranslation("directory");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const data = useProviderReviews(service.providerId);
  if (!data || data.summary.count === 0 || data.summary.average === null) return null;
  const score = formatRating(data.summary.average, locale);

  return (
    <a
      href="#service-reviews"
      className="flex items-center hover:underline"
      aria-label={t("providerRatingLabel", { score, count: data.summary.count })}
    >
      <Stars value={data.summary.average} size={18} />
      <b aria-hidden="true" className="mr-1 ml-2 font-bold text-[var(--color-ink-2)]">
        {score}
      </b>
      <span aria-hidden="true">({t("reviewsCount", { count: data.summary.count })})</span>
    </a>
  );
}

/**
 * What customers said — about the business, which is not quite what this page
 * is about.
 *
 * Ntizo's reviews are one per person per business; there is no such thing as
 * a review of one service. So the section is preceded by a line saying whose
 * verdicts these are — above the heading, not under the last review, because
 * a qualifier printed after the thing it qualifies is read only by whoever
 * was already convinced.
 *
 * `ProviderReviews` renders nothing when there are none, and this repeats its
 * guard so the sentence never appears alone.
 */
function ServiceReviewsSection({ service }: { service: ServiceDetailDTO }) {
  const { t } = useTranslation("directory");
  const data = useProviderReviews(service.providerId);
  if (!data || data.summary.count === 0) return null;

  return (
    <div id="service-reviews" className="scroll-mt-20">
      {/* Its own top margin is cancelled so the note reads as this section's
          subtitle rather than as a stray line above a new section. */}
      <p className="mt-9 text-[13px] text-[var(--color-faint)]">{t("reviewsAboutProvider")}</p>
      <div className="[&>section]:mt-1">
        <ProviderReviews providerId={service.providerId} />
      </div>
    </div>
  );
}
