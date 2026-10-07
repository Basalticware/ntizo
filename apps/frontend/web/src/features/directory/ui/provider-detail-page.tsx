import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, List, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ProviderPublicDetailDTO } from "@ntizo/shared/read-models";
import { useProviderDetail } from "@/features/directory/viewmodel/use-directory";
import { formatMemberSince } from "@/features/directory/domain/member-since";
import { ProviderServicesSection } from "@/features/directory/services/ui/services-section";
import { useCategoryIcon } from "@/features/directory/services/ui/category-icon";
import { DetailFacts } from "@/features/directory/ui/detail-facts";
import { DetailGallery } from "@/features/directory/ui/detail-gallery";
import { ProviderHero } from "@/features/directory/ui/provider-hero";
import { ProviderRail } from "@/features/directory/ui/provider-rail";
import { SiteHeader } from "@/shared/components/site-header";

/**
 * A single provider's public page.
 *
 * Server-rendered, so this is the HTML a search engine indexes for that
 * provider. The `<title>` and description are set in the route's `head`, from
 * the same loader data — a page whose title is the site name for every provider
 * is worth very little in a result list.
 *
 * Two columns, and the split is the point: who they are and what they sell on
 * the left, what it costs and how to reach them on the right. The page it
 * replaces had no rail and no price anywhere on it — a reader could get all
 * the way down the services list without learning whether this was a 500 or a
 * 5000 job. The rail is sticky because it is the part a reader acts on, and
 * the left column is the part they read first and scroll past.
 *
 * **The collage is inside the left column, and the rail starts level with
 * it.** The page used to open with a collage spanning the whole shell, which
 * pushed the rail — the price, and the button that opens a conversation — a
 * full gallery down the page, below the fold on every laptop. This is the
 * move `ServiceDetailPage` made first and left noted as owed here; the two
 * pages now open the same way, which is the point of them looking alike at
 * all. Everything under the collage kept its order and its spacing:
 * `ProviderHero`'s `mt-10` measures the same 40px the grid's old `py-10` did,
 * including for the majority of providers who have no photographs and whose
 * page therefore opens on the hero either way.
 *
 * Below `lg` the rail unstacks under the content, so the phone reads
 * top-to-bottom the way somebody decides: photographs, who they are, the four
 * facts, what they say about themselves, what they sell, what customers said.
 *
 * Three of the pieces here render nothing at all in the state most providers
 * are actually in — `DetailGallery` with no photographs, `WeeklyHoursCard`
 * (inside the rail) with no configured week, `ProviderReviews` with nobody
 * having reviewed. That is deliberate in each of them and the page must let
 * it: an empty labelled frame reads as a page that failed to load, where the
 * plain absence of a section reads as "not yet".
 */
export function ProviderDetailPage({ slug }: { slug: string }) {
  const { t, i18n } = useTranslation("directory");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const provider = useProviderDetail(slug, locale);
  const CategoryIcon = useCategoryIcon(provider?.categories[0]?.code ?? "");

  if (!provider) {
    return (
      <>
        <SiteHeader current="providers" />
        <main className="page-shell py-16 text-center">
          <h1 className="type-h1">{t("notFoundTitle")}</h1>
          <p className="type-body mt-3 text-[var(--color-muted-foreground)]">{t("notFoundBody")}</p>
          <Link
            to="/providers"
            className="type-body-medium mt-8 inline-block font-semibold text-[var(--color-primary)] hover:underline"
          >
            {t("backToDirectory")}
          </Link>
        </main>
      </>
    );
  }

  return (
    // The mockup's 45px inset at its 1357px width.
    <div className="[--pw-pad:clamp(16px,3.3vw,45px)]">
      <SiteHeader current="providers" />

      <div className="public-inset grid gap-x-9 gap-y-6 pb-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-y-0">
        <div className="lg:col-span-2">
          <Breadcrumb provider={provider} />
        </div>

        <main className="min-w-0">
          {/* Keyed by slug: the route reuses this page's instance across
              slugs, and `DetailGallery` holds its own state — the photo
              dialog and the photo it is showing — which must not follow the
              reader to another provider. */}
          <DetailGallery
            key={provider.slug}
            layout="provider"
            images={provider.photoUrls}
            alt={provider.name}
          />

          <ProviderHero provider={provider} />

          <DetailFacts
            facts={[
              {
                icon: CategoryIcon,
                label: t("factCategory"),
                value: provider.categories.map((category) => category.name).join(" · "),
              },
              {
                icon: MapPin,
                label: t("factWhere"),
                value: locationLabels(provider.serviceLocationTypes, t),
              },
              // A count survives `DetailFacts`'s empty-value filter, and
              // should: a provider with nothing published has published
              // nothing, which is a fact worth stating.
              {
                icon: List,
                label: t("servicesTitle"),
                value: t("servicesCountValue", { count: provider.serviceCount }),
              },
              {
                icon: CalendarDays,
                label: t("factMemberSince"),
                // `formatMemberSince` returns null for a missing or malformed
                // value; the empty string drops the whole pair.
                value: capitalise(formatMemberSince(provider.memberSince, locale) ?? ""),
              },
            ]}
          />

          {/* The mockup's four feature lines under "Sobre" ("Profissionais
              experientes", …) are not drawn: nothing records them, and a
              claim the business never made is not one this page can print
              for it. */}
          {provider.description && (
            <section className="mt-7">
              <h2 className="text-[22px] font-extrabold text-[var(--color-headline)]">{t("aboutHeading")}</h2>
              {/* `whitespace-pre-line`, so the paragraph breaks a provider
                  typed into the field survive as paragraph breaks. */}
              <p className="mt-2 max-w-[800px] text-base leading-normal whitespace-pre-line text-[var(--color-muted-foreground)]">
                {provider.description}
              </p>
            </section>
          )}

          <ProviderServicesSection
            providerId={provider.id}
            providerImageUrl={provider.logoUrl}
            locale={locale}
          />
        </main>

        {/* 84px, not 0: the site header is 68px and sticky, so a rail pinned
            to the top of the viewport would slide under it. The reviews are
            the rail's last card, as the mockup draws them. */}
        <aside className="lg:sticky lg:top-[84px] lg:self-start">
          <ProviderRail provider={provider} />
        </aside>
      </div>
    </div>
  );
}

/** "agosto de 2026" → "Agosto de 2026": a value on a line of its own. */
function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Every place this business actually works, joined — "At your place · At
 * their place".
 *
 * All of them, never collapsed. An earlier draft folded three or more into
 * `filterWhereOption.flexible`, which is wrong: `flexible` is one of the four
 * location types a service can be published under, not a word meaning
 * "several", so a provider who both travels and receives would have been
 * relabelled as one who does neither in particular.
 *
 * A code this build has never heard of resolves to an empty string rather
 * than a raw, untranslated identifier — falsy, so it drops out of the join
 * instead of leaving a stray separator beside nothing. The same guard
 * `ServiceRow` applies to the same key.
 */
function locationLabels(
  codes: readonly string[],
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  return codes
    .map((code) => t(`filterWhereOption.${code}`, { defaultValue: "" }))
    .filter(Boolean)
    .join(" · ");
}

/**
 * Where this business sits: the directory, its trade, itself.
 *
 * The middle crumb is a real filter on the directory rather than decoration,
 * so a reader who decided this particular electrician is not for them lands on
 * the others rather than back at everything. It also gives a crawler the one
 * thing a detail page otherwise lacks — a path back up. The same shape
 * `ServiceDetailPage`'s own breadcrumb already uses.
 *
 * A provider publishes no services in any category until they publish a
 * service at all, so `categories` can be empty — in which case the middle
 * crumb is omitted rather than rendered as a link to an empty filter.
 *
 * The last crumb is text, not a link to the page you are already on.
 */
const CRUMB_SEPARATOR = (
  <li aria-hidden="true">
    <ChevronRight className="h-3.5 w-3.5 text-[var(--color-ink-2)]" strokeWidth={2.4} />
  </li>
);

function Breadcrumb({ provider }: { provider: ProviderPublicDetailDTO }) {
  const { t } = useTranslation("directory");
  const category = provider.categories[0];

  return (
    <nav aria-label={t("breadcrumbLabel")} className="pt-5 pb-[18px] text-sm leading-[1.2]">
      <ol className="flex list-none flex-wrap items-center gap-2.5 p-0 text-[var(--color-muted-foreground)]">
        <li>
          <Link to="/providers" className="hover:text-[var(--color-headline)] hover:underline">
            {t("breadcrumbProviders")}
          </Link>
        </li>
        {category && (
          <>
            {CRUMB_SEPARATOR}
            <li>
              <Link
                to="/providers"
                search={{ category: category.code }}
                className="hover:text-[var(--color-headline)] hover:underline"
              >
                {category.name}
              </Link>
            </li>
          </>
        )}
        {CRUMB_SEPARATOR}
        <li className="font-semibold text-[var(--color-headline)]">{provider.name}</li>
      </ol>
    </nav>
  );
}
