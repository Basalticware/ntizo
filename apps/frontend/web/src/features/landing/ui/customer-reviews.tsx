import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Star } from "lucide-react";
import { Skeleton, cn } from "@ntizo/frontend-ui";
import { initialsOf } from "@/shared/domain/initials";
import { TILE_TITLE_LINK_CLASS } from "@/shared/components/browse/result-tile";
import { useFeaturedReviews } from "@/features/landing/viewmodel/use-featured-reviews";
import { usePopularServices } from "@/features/landing/viewmodel/use-popular-services";
import { usePopularProviders } from "@/features/landing/viewmodel/use-popular-providers";
import { useLocale } from "@/features/landing/viewmodel/use-locale";
import { SectionHead } from "@/features/landing/ui/section-head";
import { LANDING_SERVICES } from "@/features/landing/ui/popular-services";
import { LANDING_PROVIDERS } from "@/features/landing/ui/verified-providers";

/** How many featured reviews the section draws: the mockup's one row. */
export const LANDING_STORIES = 1;

/**
 * "O que dizem os nossos clientes": a featured review and the platform's
 * numbers beside it.
 *
 * Nothing in the review is translated and nothing should be: it is what one
 * person wrote, in the language they wrote it. Only the date is formatted, in
 * the reader's locale.
 *
 * **Only numbers the page can actually fetch.** The mockup's tiles were
 * "4,8 / 5", "1 200+ serviços concluídos" and "300+ prestadores
 * verificados"; none of those is a figure anything serves. What is real:
 *
 * - the count of published services — `serviceAll`'s `total` with no
 *   filter, which is the same number `/services` shows. It is read from the
 *   popular services' own query (same key, so no second request).
 * - the count of verified providers — `providerList`'s `total` with
 *   `verifiedOnly`, read from the popular providers' query the same way.
 *
 * There is no platform-wide average rating in any public read model, so that
 * tile is not drawn rather than averaged from four cards. A count that has
 * not arrived, or is zero, draws no tile either; with no review and no
 * number the section is not drawn at all.
 */
export function CustomerReviews() {
  const { t } = useTranslation("landing"); // t:CustomerReviews
  const locale = useLocale();
  const reviews = useFeaturedReviews(LANDING_STORIES);
  const services = usePopularServices(LANDING_SERVICES);
  const providers = usePopularProviders(LANDING_PROVIDERS);
  const stories = reviews.data ?? [];
  const stats = [
    { key: "services", value: services.data?.total ?? 0, label: "home.statServices" },
    { key: "providers", value: providers.data?.total ?? 0, label: "home.statProviders" },
  ].filter((s) => s.value > 0);

  if (!reviews.isLoading && stories.length === 0 && stats.length === 0) return null;

  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  const number = new Intl.NumberFormat(locale);

  return (
    <section className="public-inset pt-10">
      <SectionHead title={t("home.storiesTitle")} blurb={t("home.storiesBlurb")} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
        {reviews.isLoading ? (
          <div className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] p-5">
            <Skeleton className="h-14 w-14 rounded-full" />
            <span className="grid gap-2">
              <Skeleton className="h-[14px] w-1/3" />
              <Skeleton className="h-[16px] w-4/5" />
            </span>
          </div>
        ) : (
          stories.map((s) => (
            // `group` and `relative` are what the whole-card link resolves
            // against: `TILE_TITLE_LINK_CLASS` stretches the business's
            // anchor over this box with an `::after`, so the card is one tab
            // stop leading to the business.
            <article
              key={s.id}
              className="group relative grid items-center gap-x-5 gap-y-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-[var(--color-card-foreground)] sm:grid-cols-[56px_auto_minmax(0,1fr)]"
            >
              <span className="hidden h-14 w-14 place-items-center rounded-full bg-[var(--color-blue-soft)] text-[16px] font-bold text-[var(--color-primary)] sm:grid">
                {s.authorName ? initialsOf(s.authorName) : "—"}
              </span>
              <span className="min-w-0">
                <b className="block truncate text-[15px] font-bold text-[var(--color-headline)]">
                  {s.authorName ?? t("storyAnonymous")}
                </b>
                <span
                  className="mt-1 flex gap-0.5"
                  role="img"
                  aria-label={t("storyRating", { rating: s.rating })}
                >
                  {Array.from({ length: 5 }, (_, star) => (
                    <Star
                      key={star}
                      aria-hidden="true"
                      className={
                        star < s.rating
                          ? "h-4 w-4 fill-[var(--color-star)] text-[var(--color-star)]"
                          : "h-4 w-4 text-[color-mix(in_srgb,var(--color-muted-foreground)_40%,transparent)]"
                      }
                    />
                  ))}
                </span>
              </span>
              <span className="min-w-0 sm:pl-3">
                <span className="block text-[13px] text-[var(--color-muted-foreground)]">
                  {date.format(new Date(s.createdAt))}
                </span>
                {/* Clamped at two lines: the card is one row beside the
                    numbers, and a long review would push them apart. */}
                <blockquote className="mt-1 line-clamp-2 text-[16px] leading-[1.4] font-medium text-[var(--color-headline)]">
                  “{s.comment}”
                </blockquote>
                <Link
                  to="/providers/$slug"
                  params={{ slug: s.providerSlug }}
                  className={cn(
                    "mt-1 block text-[13px] text-[var(--color-muted-foreground)] group-hover:underline group-focus-within:underline",
                    TILE_TITLE_LINK_CLASS,
                  )}
                >
                  {s.providerName}
                </Link>
              </span>
            </article>
          ))
        )}

        {stats.length > 0 ? (
          <dl
            data-testid="home-stats"
            className="grid grid-flow-col divide-x divide-[var(--color-border)] rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-card)] xl:auto-cols-[200px]"
          >
            {stats.map((s) => (
              <div key={s.key} className="flex flex-col justify-center px-6 py-5">
                {/* The term first in the document, as `<dl>` requires; the
                    figure is drawn above it. */}
                <dt className="mt-2 text-[14px] text-[var(--color-muted-foreground)]">
                  {t(s.label, { count: s.value })}
                </dt>
                <dd className="order-first text-[28px] leading-none font-extrabold tracking-[-0.01em] text-[var(--color-headline)] tabular-nums">
                  {number.format(s.value)}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}
