import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, ChevronRight } from "lucide-react";
import { useCategoryPreview } from "@/features/landing/viewmodel/use-categories";
import { LANDING_CATEGORIES } from "@/features/landing/ui/category-grid";
import { CategoryPicture } from "@/features/landing/ui/category-picture";

/** The trades the banner names first, in the mockup's order, when they exist. */
const HOME_CODES = ["electrical", "plumbing", "cleaning", "building"];
const HOME_ROWS = 4;

/**
 * "Resolva o que precisa em casa": a photograph with a way into the services
 * that come to the customer, and four trades beside it.
 *
 * The button opens `/services?locationType=at_customer` — the listing's own
 * "Em sua casa" filter, so it promises exactly what the list then shows.
 *
 * The rows are real categories, from the same preview query the tiles above
 * draw (one request, one cache entry): the four household trades the mockup
 * names when they exist, topped up from the rest of the set when they do
 * not. Each line under a name is the category's own description where an
 * administrator wrote one, else a short hint for the codes the home knows;
 * a category with neither shows its name alone.
 *
 * The photograph is cropped from the mockup and is low resolution — it waits
 * for a real one. Its left edge fades into the page's own ground, so the
 * words sit on a token colour in either theme rather than on the picture.
 */
export function HomeBanner() {
  const { t } = useTranslation("landing"); // t:HomeBanner
  const { data } = useCategoryPreview(LANDING_CATEGORIES);
  const all = data?.items ?? [];
  const preferred = HOME_CODES.flatMap((code) => all.filter((c) => c.code === code));
  const rows = [...preferred, ...all.filter((c) => !HOME_CODES.includes(c.code))].slice(
    0,
    HOME_ROWS,
  );

  return (
    <section className="public-inset pt-10">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.23fr)_minmax(0,1fr)] lg:gap-6">
        <div className="relative isolate flex min-h-[252px] items-center overflow-hidden rounded-[14px] bg-[var(--color-muted)]">
          <img
            src="/images/home-banner.jpg"
            alt=""
            className="absolute inset-y-0 right-0 -z-10 h-full w-full object-cover object-right sm:w-[68%]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-gradient-to-r from-[var(--color-background)] from-25% via-[var(--color-background)]/75 via-45% to-transparent to-80% max-sm:via-[var(--color-background)]/85 max-sm:to-[var(--color-background)]/40"
          />
          <div className="max-w-[340px] px-6 py-8 sm:px-8">
            <h2 className="text-[30px] leading-[1.08] font-extrabold tracking-[-0.02em] text-[var(--color-headline)] sm:text-[33px]">
              {t("home.homeTitle")}
            </h2>
            <p className="mt-2.5 text-[16px] leading-snug text-[var(--color-ink-2)]">
              {t("home.homeBody")}
            </p>
            <Link
              to="/services"
              search={{ locationType: "at_customer" }}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-[var(--color-blue-public)] bg-[var(--color-card)] px-5 text-[15px] font-semibold text-[var(--color-blue-public)] hover:bg-[var(--color-blue-softer)]"
            >
              {t("home.homeCta")}
              <ArrowRight className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
            </Link>
          </div>
        </div>

        {rows.length > 0 ? (
          <ul className="grid content-between gap-2.5">
            {rows.map((c) => {
              const hint = c.description ?? t(`home.categoryHint.${c.code}`, { defaultValue: "" });
              return (
                <li key={c.id}>
                  <Link
                    to="/services"
                    search={{ category: c.code }}
                    className="group grid h-full grid-cols-[124px_minmax(0,1fr)_auto] items-center gap-4 overflow-hidden rounded-[10px] bg-[var(--color-blue-softer)] pr-4 hover:bg-[var(--color-blue-soft)]"
                  >
                    <span className="block h-[56px] overflow-hidden">
                      <CategoryPicture category={c} className="h-full w-full" iconClassName="h-6 w-6" />
                    </span>
                    <span className="min-w-0">
                      <b className="block truncate text-[15px] font-bold text-[var(--color-headline)] group-hover:underline">
                        {c.name}
                      </b>
                      {hint ? (
                        <span className="block truncate text-[13.5px] text-[var(--color-muted-foreground)]">
                          {hint}
                        </span>
                      ) : null}
                    </span>
                    <ChevronRight
                      className="h-5 w-5 text-[var(--color-ink-2)]"
                      strokeWidth={2.2}
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
