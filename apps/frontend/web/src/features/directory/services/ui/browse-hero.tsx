import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, MapPin, Search } from "lucide-react";
import { BrowseHead } from "@/shared/components/browse/browse-head";
import {
  browseSearch,
  type BrowseSearch,
} from "@/features/directory/services/domain/browse-search";
import { useServiceCities } from "@/features/directory/services/viewmodel/use-browse-services";

/**
 * The top of `/services`: the eyebrow, the title and one line under it — see
 * `BrowseHead`, which `/providers` draws too.
 *
 * `title` is the page's `h1`. Unnarrowed it is the page's headline; once the
 * reader asked for something — a term, a category, a city — the page passes
 * what they asked for instead, because a heading that answers a question
 * nobody asked is the bug `browseTitle` exists to prevent.
 */
export function BrowseHero({ title }: { title: string }) {
  const { t } = useTranslation("directory");
  return <BrowseHead eyebrow={t("browseHeroEyebrow")} title={title} subtitle={t("browseHeroSubtitle")} />;
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
  const [term, setTerm] = useState(current.q ?? "");
  const [city, setCity] = useState(current.city ?? "");

  // Follow the URL when it changes underneath the bar — back/forward, or the
  // header's own search — so the field never shows a term the list is not.
  useEffect(() => setTerm(current.q ?? ""), [current.q]);
  useEffect(() => setCity(current.city ?? ""), [current.city]);

  return (
    <form
      role="search"
      aria-label={t("browseSearchQuestion")}
      onSubmit={(e) => {
        e.preventDefault();
        void navigate({
          to: "/services",
          search: browseSearch(current, {
            q: term.trim() || undefined,
            city: city || undefined,
            offset: undefined,
          }),
        });
      }}
      className="flex flex-wrap items-center gap-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] py-1.5 pr-1.5 pl-[18px] shadow-[0_2px_8px_rgba(30,60,120,.05)] md:h-16 md:flex-nowrap md:py-0"
    >
      <Search className="h-6 w-6 shrink-0 text-[var(--color-primary)]" strokeWidth={2.2} aria-hidden="true" />
      <label className="ml-[18px] grid min-w-0 flex-1">
        <span className="text-[15px] font-medium text-[var(--color-ink-2)]">{t("browseSearchQuestion")}</span>
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t("browseSearchHint")}
          className="mt-1 min-w-0 truncate bg-transparent text-[13px] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-faint)]"
        />
      </label>

      {cities.length > 1 && (
        <>
          <span aria-hidden="true" className="mx-[18px] hidden w-px self-stretch bg-[var(--color-border)] md:block" />
          <label className="relative flex w-full items-center gap-3 md:w-[190px]">
            <MapPin
              className="h-[26px] w-6 shrink-0 fill-[var(--color-primary)] text-white"
              strokeWidth={1.6}
              aria-hidden="true"
            />
            <span className="sr-only">{t("filterCity")}</span>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-6 text-[15px] font-medium text-[var(--color-ink-2)] outline-none"
            >
              <option value="">{t("browseAllCities")}</option>
              {cities.map((c) => (
                <option key={c.city} value={c.city}>
                  {c.city}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-0 h-4 w-4 text-[var(--color-ink-2)]"
              strokeWidth={2.4}
              aria-hidden="true"
            />
          </label>
        </>
      )}

      <button
        type="submit"
        className="h-[52px] w-full shrink-0 rounded-[9px] bg-[var(--color-blue-public)] text-base font-semibold text-white hover:opacity-90 md:ml-5 md:w-[150px]"
      >
        {t("searchAction")}
      </button>
    </form>
  );
}
