import { useTranslation } from "react-i18next";
import { LayoutGrid } from "lucide-react";
import { Skeleton } from "@ntizo/frontend-ui";
import { EmptyCard } from "@/shared/components/empty-card";
import { useProviderServices } from "@/features/directory/services/viewmodel/use-provider-services";
import { ServiceRow } from "@/features/directory/services/ui/service-row";

/**
 * A provider's published services, on their public page.
 *
 * A section rather than the whole page's own loading state: the provider's
 * name and description are what `provider-detail-page.tsx` renders from its
 * own, already-resolved data — this fetches separately and degrades on its
 * own, so a slow or failing services request never blanks the page around
 * it.
 *
 * **Rows, not the four-across grid this used to draw.** That grid's argument
 * was that two columns of a 4:3 photograph push a provider's catalogue below
 * the fold, so four narrower cards fit more of it on screen. The argument was
 * right about the photographs and wrong about the shape: a customer on *this*
 * page has usually already chosen the provider and is deciding which of their
 * services to buy, which is a comparison of prices down one column. A grid
 * scatters those prices across the page at whatever height each photograph
 * happens to end; a row gives every price the same horizontal position, and
 * fits more services on screen than four cards ever did because a row is not
 * as tall as a photograph. It is also the shape the platform-wide browse
 * reached for at the time, in the since-deleted `ServiceListingCard`, and
 * the one its phone rows use today — the two lists had drifted into different
 * answers to the same question.
 *
 * `id="servicos"` is the rail's "See services" anchor, and `scroll-mt-[100px]`
 * keeps the heading clear of the 84px sticky header once it has jumped.
 */
export function ProviderServicesSection({
  providerId,
  providerImageUrl,
  locale,
}: {
  providerId: string;
  providerImageUrl: string | null;
  locale: string;
}) {
  const { t } = useTranslation("directory");
  const { data, isPending, isError } = useProviderServices(providerId);
  const items = data?.items ?? [];

  return (
    <section id="servicos" className="mt-9 scroll-mt-[84px]">
      <h2 className="text-[22px] font-extrabold text-[var(--color-headline)]">
        {isPending || isError
          ? t("servicesTitle")
          : t("servicesTitleCount", { count: data?.total ?? items.length })}
      </h2>

      {isError ? (
        <p className="mt-3 text-[var(--color-destructive)]">
          {t("servicesError")}
        </p>
      ) : !isPending && items.length === 0 ? (
        <EmptyCard
          compact
          badge={LayoutGrid}
          title={t("providerServicesEmptyTitle")}
          body={t("providerServicesEmpty")}
        />
      ) : (
        <ul className="mt-4 grid list-none gap-4 p-0">
          {isPending
            ? Array.from({ length: 3 }, (_, i) => (
                <ServiceRowSkeleton key={i} />
              ))
            : items.map((service) => (
                <ServiceRow
                  key={service.id}
                  service={service}
                  providerImageUrl={providerImageUrl}
                  locale={locale}
                />
              ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The shape of a row before it has one — the same grid, the same hairlines and
 * the same thumbnail square `ServiceRow` draws, so the list does not jump when
 * the request lands.
 */
function ServiceRowSkeleton() {
  return (
    <li className="grid grid-cols-[91px_minmax(0,1fr)] items-center gap-5 rounded-[10px] border border-[#edf1f7] px-5 py-3.5 sm:grid-cols-[91px_minmax(0,1fr)_auto]">
      <Skeleton className="h-[68px] w-[91px] rounded-md" />
      <div className="min-w-0">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="mt-2.5 h-3 w-3/4" />
        <Skeleton className="mt-2.5 h-3 w-1/3" />
      </div>
      <div className="col-start-2 mt-3 grid justify-items-start gap-2 sm:col-start-3 sm:mt-0 sm:justify-items-end">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-9 w-32" />
      </div>
    </li>
  );
}
