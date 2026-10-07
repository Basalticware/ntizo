import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { BrowseHead } from "@/shared/components/browse/browse-head";
import { BrowseSearchForm } from "@/shared/components/browse/browse-search-form";
import {
  directorySearch,
  type DirectorySearch,
} from "@/features/directory/domain/directory-search";
import { useProviderCities } from "@/features/directory/viewmodel/use-directory";

/**
 * The top of `/providers`: `/services`' head in the directory's words — the
 * same `BrowseHead`, because the two browse pages are twins and a reader
 * moving between them should not see two different openings.
 *
 * `title` is the page's `h1`: the headline until the reader narrows the
 * list, then what they asked for — see `directoryTitle`.
 */
export function DirectoryHero({ title, current }: { title: string; current: DirectorySearch }) {
  const { t } = useTranslation("directory");
  return (
    <BrowseHead
      title={title}
      subtitle={t("providersHeroSubtitle")}
      search={<DirectorySearchBar current={current} />}
    />
  );
}

/**
 * The directory's own big search bar: who, where, and "Pesquisar" —
 * `BrowseSearchBar` asking for a business instead of a service.
 *
 * A second field on a page whose header already has one, on purpose, for the
 * reason the services bar gives: this one is the list's. It carries the city,
 * and a submit keeps every filter already set through the same
 * `directorySearch` every other control here uses, and resets the page.
 *
 * "Where" is the city facet as a select, offered only once there are cities
 * to choose between; "Todas as cidades" is the absent parameter. Picking one
 * waits for the submit like the name does.
 */
export function DirectorySearchBar({ current }: { current: DirectorySearch }) {
  const { t } = useTranslation("directory");
  const navigate = useNavigate();
  const cities = useProviderCities();
  return (
    <BrowseSearchForm
      question={t("providerSearchQuestion")}
      hint={t("providerSearchHint")}
      submitLabel={t("searchAction")}
      cityLabel={t("filterCity")}
      allCitiesLabel={t("browseAllCities")}
      cities={cities.map((c) => c.city)}
      term={current.q ?? ""}
      city={current.city ?? ""}
      onSearch={({ q, city }) =>
        void navigate({
          to: "/providers",
          search: directorySearch(current, { q, city, offset: undefined }),
        })
      }
    />
  );
}
