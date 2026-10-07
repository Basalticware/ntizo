import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, MapPin, Search } from "lucide-react";

/**
 * The big search on `/services` and `/providers`: what, where, and Pesquisar.
 *
 * The two pages are twins, so the bar is one component asked two different
 * questions. It draws itself twice over:
 *
 * - From `md`, one 64px bar: the question above its field, a divider, the
 *   city, and a 150px "Pesquisar" at the end — the mockups' bar.
 * - On a phone, a 52px field with the search button inside it as a blue
 *   square, and the city as a small chip under it. The desktop bar stacked
 *   on a phone was a tall card (question, hint, full-width button) taller
 *   than the result it searched for.
 *
 * One button for both, not a phone one and a desktop one: two submit buttons
 * named "Pesquisar" would be two in the accessibility tree too. On a phone
 * its label is `sr-only` and it shows an arrow; the field row is
 * `md:contents`, so from `md` its children join the form's own row and
 * `md:order-last` sends the button past the city.
 *
 * The city select shows only once there are cities to choose between;
 * "all cities" is the absent value. Both fields wait for the submit.
 */
export function BrowseSearchForm({
  question,
  hint,
  submitLabel,
  cityLabel,
  allCitiesLabel,
  cities,
  term: currentTerm,
  city: currentCity,
  onSearch,
}: {
  question: string;
  hint: string;
  submitLabel: string;
  cityLabel: string;
  allCitiesLabel: string;
  cities: readonly string[];
  term: string;
  city: string;
  onSearch: (values: { q: string | undefined; city: string | undefined }) => void;
}) {
  const [term, setTerm] = useState(currentTerm);
  const [city, setCity] = useState(currentCity);

  // Follow the URL when it changes underneath the bar — back/forward, or the
  // header's own search — so the field never shows a term the list is not.
  useEffect(() => setTerm(currentTerm), [currentTerm]);
  useEffect(() => setCity(currentCity), [currentCity]);

  return (
    <form
      role="search"
      aria-label={question}
      onSubmit={(e) => {
        e.preventDefault();
        onSearch({ q: term.trim() || undefined, city: city || undefined });
      }}
      className="grid gap-2.5 md:flex md:h-16 md:items-center md:gap-0 md:rounded-xl md:border md:border-[var(--color-border)] md:bg-[var(--color-background)] md:pr-1.5 md:pl-[18px] md:shadow-[0_2px_8px_rgba(30,60,120,.05)]"
    >
      <div className="flex h-[52px] items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] pr-1.5 pl-4 shadow-[0_2px_8px_rgba(30,60,120,.05)] md:contents">
        <Search
          className="h-5 w-5 shrink-0 text-[var(--color-primary)] md:h-6 md:w-6"
          strokeWidth={2.2}
          aria-hidden="true"
        />
        <label className="ml-3 grid min-w-0 flex-1 md:ml-[18px]">
          <span className="sr-only text-[15px] font-medium text-[var(--color-ink-2)] md:not-sr-only">{question}</span>
          <input
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={hint}
            className="min-w-0 truncate bg-transparent text-[15px] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-faint)] md:mt-1 md:text-[13px]"
          />
        </label>
        <button
          type="submit"
          className="ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-[9px] bg-[var(--color-blue-public)] text-base font-semibold text-white hover:opacity-90 md:order-last md:ml-5 md:h-[52px] md:w-[150px]"
        >
          <ArrowRight className="h-5 w-5 md:hidden" strokeWidth={2.4} aria-hidden="true" />
          <span className="sr-only md:not-sr-only">{submitLabel}</span>
        </button>
      </div>

      {cities.length > 1 && (
        <>
          <span aria-hidden="true" className="mx-[18px] hidden w-px self-stretch bg-[var(--color-border)] md:block" />
          <label className="relative inline-flex h-10 items-center gap-2 justify-self-start rounded-full border border-[var(--color-border)] bg-[var(--color-background)] pl-3 md:h-auto md:w-[190px] md:gap-3 md:rounded-none md:border-0 md:bg-transparent md:pl-0">
            <MapPin
              className="h-[18px] w-[18px] shrink-0 fill-[var(--color-primary)] text-[var(--color-background)] md:h-[26px] md:w-6"
              strokeWidth={1.6}
              aria-hidden="true"
            />
            <span className="sr-only">{cityLabel}</span>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-9 text-[14px] font-medium text-[var(--color-ink-2)] outline-none md:pr-6 md:text-[15px]"
            >
              <option value="">{allCitiesLabel}</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 h-4 w-4 text-[var(--color-ink-2)] md:right-0"
              strokeWidth={2.4}
              aria-hidden="true"
            />
          </label>
        </>
      )}
    </form>
  );
}
