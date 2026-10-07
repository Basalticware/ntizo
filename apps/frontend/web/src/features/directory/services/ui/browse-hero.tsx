import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, MapPin, Search } from "lucide-react";
import {
  browseSearch,
  type BrowseSearch,
} from "@/features/directory/services/domain/browse-search";
import { useServiceCities } from "@/features/directory/services/viewmodel/use-browse-services";

/**
 * The top of `/services`, from `client/servicos.html`: the eyebrow, the title
 * and the subtitle on the left, and on a wide screen the photograph bleeding
 * to the window's right edge with the sky-blue quote panel over it.
 *
 * The photograph and the quote are the page's own artwork, not data about
 * anybody: the same picture for every reader, like the home page's collage.
 * Below `lg` they go, and the text has the width to itself.
 *
 * `title` is the page's `h1`. Unnarrowed it is the mockup's headline; once the
 * reader asked for something — a term, a category, a city — the page passes
 * what they asked for instead, because a heading that answers a question
 * nobody asked is the bug `browseTitle` exists to prevent.
 */
export function BrowseHero({ title }: { title: string }) {
  const { t } = useTranslation("directory");

  return (
    <section className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,730px)] lg:gap-x-6">
      <div className="pt-[22px] pb-4 pl-[var(--pw-pad)] pr-[var(--pw-pad)] lg:pr-0">
        <p className="text-[13px] leading-[1.2] font-bold tracking-[0.04em] text-[#1d87fd] uppercase">
          {t("browseHeroEyebrow")}
        </p>
        <h1 className="mt-2.5 text-[36px] leading-[1.02] font-extrabold tracking-[-0.02em] whitespace-pre-line text-[#061e4c] lg:text-[53px]">
          {title}
        </h1>
        <p className="mt-3.5 max-w-[540px] text-[17px] leading-normal text-[var(--color-muted-foreground)]">
          {t("browseHeroSubtitle")}
        </p>
      </div>

      <div aria-hidden="true" className="relative hidden h-[203px] self-start overflow-hidden lg:block">
        <img
          src="/images/services-hero.jpg"
          alt=""
          className="block h-[205px] w-[730px] max-w-none object-cover object-left"
        />
        <p className="absolute top-[38px] left-[488px] w-[216px] rounded-xl bg-[#d7ecfd] pt-4 pr-5 pb-[18px] pl-6 text-[17.4px] leading-[1.45] whitespace-pre-line text-[#0b2081]">
          {t("browseHeroQuote")}
        </p>
        <span className="absolute top-[150px] left-[670px] h-7 w-[25px] rounded bg-[#93cdfc]" />
        <span className="absolute top-[174px] left-[651px] h-[22px] w-[21px] rounded bg-[#8ccdfd]" />
      </div>
    </section>
  );
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
      className="flex flex-wrap items-center gap-y-2 rounded-xl border border-[#ebeff5] bg-[var(--color-background)] py-1.5 pr-1.5 pl-[18px] shadow-[0_2px_8px_rgba(30,60,120,.05)] md:h-16 md:flex-nowrap md:py-0"
    >
      <Search className="h-6 w-6 shrink-0 text-[#0068fe]" strokeWidth={2.2} aria-hidden="true" />
      <label className="ml-[18px] grid min-w-0 flex-1">
        <span className="text-[15px] font-medium text-[#273469]">{t("browseSearchQuestion")}</span>
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
          <span aria-hidden="true" className="mx-[18px] hidden w-px self-stretch bg-[#ebeff5] md:block" />
          <label className="relative flex w-full items-center gap-3 md:w-[190px]">
            <MapPin
              className="h-[26px] w-6 shrink-0 fill-[#0068fe] text-white"
              strokeWidth={1.6}
              aria-hidden="true"
            />
            <span className="sr-only">{t("filterCity")}</span>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-6 text-[15px] font-medium text-[#273469] outline-none"
            >
              <option value="">{t("browseAllCities")}</option>
              {cities.map((c) => (
                <option key={c.city} value={c.city}>
                  {c.city}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-0 h-4 w-4 text-[#33416b]"
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
