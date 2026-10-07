import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { BrowseHead } from "@/shared/components/browse/browse-head";
import { BrowseSearchForm } from "@/shared/components/browse/browse-search-form";
import {
  browseSearch,
  type BrowseSearch,
} from "@/features/directory/services/domain/browse-search";
import { useServiceCities } from "@/features/directory/services/viewmodel/use-browse-services";

/**
 * The top of `/services`: the breadcrumb, the title and one line under it — see
 * `BrowseHead`, which `/providers` draws too.
 *
 * `title` is the page's `h1`. Unnarrowed it is the page's headline; once the
 * reader asked for something — a term, a category, a city — the page passes
 * what they asked for instead, because a heading that answers a question
 * nobody asked is the bug `browseTitle` exists to prevent.
 */
export function BrowseHero({ title }: { title: string }) {
  const { t } = useTranslation("directory");
  return <BrowseHead crumb={t("browseHeroEyebrow")} title={title} subtitle={t("browseHeroSubtitle")} />;
}

/**
 * The list's own big search bar: what, where, and "Pesquisar".
 *
 * A second field on a page whose header already has one, on purpose: the
 * header's asks for anything and starts over, this one is the list's — it
 * carries the city, and a submit keeps every filter already set, through the
 * same `browseSearch` every other control here uses, and resets the page.
 *
 * "Where" is the city facet as a select, offered only once there are cities
 * to choose between; "Todas as cidades" is the absent parameter. Picking one
 * waits for the submit like the term does, so the bar is one question asked
 * once rather than two controls that each navigate.
 */
export function BrowseSearchBar({ current }: { current: BrowseSearch }) {
  const { t } = useTranslation("directory");
  const navigate = useNavigate();
  const cities = useServiceCities();
  return (
    <BrowseSearchForm
      question={t("browseSearchQuestion")}
      hint={t("browseSearchHint")}
      submitLabel={t("searchAction")}
      cityLabel={t("filterCity")}
      allCitiesLabel={t("browseAllCities")}
      cities={cities.map((c) => c.city)}
      term={current.q ?? ""}
      city={current.city ?? ""}
      onSearch={({ q, city }) =>
        void navigate({
          to: "/services",
          search: browseSearch(current, { q, city, offset: undefined }),
        })
      }
    />
  );
}
