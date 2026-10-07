import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Star } from "lucide-react";
import { cn } from "@ntizo/frontend-ui";
import type { ProviderReviewsPublicDTO, ReviewPublicDTO } from "@ntizo/shared/read-models";
import { formatRating } from "@/shared/domain/rating";
import { useProviderReviews } from "@/features/directory/viewmodel/use-directory";

const BARS = ["five", "four", "three", "two", "one"] as const;
const SCORE_OF: Record<(typeof BARS)[number], number> = {
  five: 5,
  four: 4,
  three: 3,
  two: 2,
  one: 1,
};

/**
 * The most the public read model returns. Asking for more is pointless —
 * `ListProviderReviews` clamps any `limit` to this.
 */
const REVIEWS_CAP = 50;

/**
 * Five stars filled to a score, with the same quarter-star tolerance
 * `RatingStars` uses, so 4.8 fills its fifth star rather than reading as 4.
 * Decorative: the number beside it is what is read.
 */
export function Stars({ value, size, off = "#dfe3ec" }: { value: number; size: number; off?: string }) {
  return (
    <span aria-hidden="true" className="inline-flex">
      {[1, 2, 3, 4, 5].map((position) => (
        <Star
          key={position}
          style={{ width: size, height: size, marginRight: 1 }}
          className="stroke-none"
          fill={value >= position - 0.25 ? "var(--color-star)" : off}
        />
      ))}
    </span>
  );
}

/**
 * What customers said about a business, in the two shapes the October 2026
 * mockups draw it.
 *
 * - `wide`, the service page's (`client/servico-detalhe.html`): a heading, a
 *   bordered summary — the score, its stars, the count, and the
 *   distribution — and the reviews as a row of cards, four across.
 * - `rail`, the provider page's (`client/prestador-detalhe.html`): one card
 *   in the right column, the summary on top and the reviews listed under it.
 *
 * Renders nothing until somebody has reviewed. An empty set of stars, or
 * "0.0", is a claim — and the worst one available: a business nobody has
 * rated yet would be shown as the worst on the platform.
 *
 * The distribution is there so an average can be weighed rather than
 * trusted: 4.5 from all fours and 4.5 from half fives and half threes are the
 * same number describing two different businesses.
 *
 * The mockups' "Escrever avaliação" is not drawn: a review is left from a
 * finished booking, not from a public page, and a button here would have
 * nowhere honest to go.
 */
export function ProviderReviews({
  providerId,
  layout = "wide",
}: {
  providerId: string;
  layout?: "wide" | "rail";
}) {
  const { t, i18n } = useTranslation("directory");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  // Undefined until the reader asks for more; then the read model's own cap.
  const [limit, setLimit] = useState<number | undefined>(undefined);
  const data = useProviderReviews(providerId, limit);

  if (!data || data.summary.count === 0) return null;

  const { summary, reviews } = data;
  const score = formatRating(summary.average ?? 0, locale);
  const more = summary.count > reviews.length;
  // Said plainly rather than with a "load more" that keeps offering past 50:
  // once `reviews.length` reaches the cap this sentence is the honest end of
  // the story, not a control promising a next page.
  const showing = more && (
    <p className="mt-3 text-[13px] text-[var(--color-muted-foreground)]">
      {t("reviewsShowing", { shown: reviews.length, total: summary.count })}
    </p>
  );
  const seeAll = more && reviews.length < REVIEWS_CAP;

  if (layout === "rail") {
    return (
      <section className="rounded-xl border border-[var(--color-line-2)] bg-[var(--color-background)] px-5 pt-5 pb-[22px]">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[22px] font-extrabold text-[var(--color-headline)]">
            {t("reviewsHeading", { count: summary.count })}
          </h2>
          {seeAll && (
            <button
              type="button"
              onClick={() => setLimit(REVIEWS_CAP)}
              className="flex items-center gap-2 text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              {t("reviewsSeeAll")}
              <ArrowRight className="h-[15px] w-[15px]" strokeWidth={2.2} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="mt-4 flex items-center gap-6 border-b border-[var(--color-line-2)] pb-[18px]">
          <div className="shrink-0">
            <p className="text-[45px] leading-none font-extrabold tracking-[-0.02em] text-[var(--color-headline)] tabular-nums">
              {score}
            </p>
            <span className="mt-1.5 flex">
              <Stars value={summary.average ?? 0} size={16} />
            </span>
            <p className="mt-1.5 text-[13px] text-[var(--color-muted-foreground)]">
              {t("reviewsCount", { count: summary.count })}
            </p>
          </div>
          <Distribution summary={summary} rail />
        </div>
        <ul className="grid list-none p-0">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="grid grid-cols-[38px_minmax(0,1fr)_auto] gap-x-3 py-4 [&+&]:border-t [&+&]:border-[var(--color-line-2)]"
            >
              <Initials name={review.authorName} className="row-span-3 h-[38px] w-[38px] bg-[var(--color-blue-soft)] text-[var(--color-ink-2)]" />
              <p className="text-sm font-bold text-[var(--color-headline)]">
                {review.authorName ?? t("reviewAnonymous")}
              </p>
              <ReviewScore review={review} size={12} locale={locale} />
              <ReviewDate review={review} locale={locale} className="col-span-2 mt-0.5" />
              {review.comment && (
                <p className="col-span-2 mt-1.5 text-sm leading-[1.45] whitespace-pre-line text-[var(--color-muted-foreground)]">
                  {review.comment}
                </p>
              )}
            </li>
          ))}
        </ul>
        {showing}
      </section>
    );
  }

  return (
    <section className="mt-9">
      <h2 className="text-[22px] leading-[1.1] font-extrabold text-[var(--color-headline)] md:text-2xl">
        {t("reviewsHeading", { count: summary.count })}
      </h2>
      <div className="mt-3.5 flex flex-col gap-6 rounded-xl border border-[var(--color-border)] py-[18px] pr-6 pl-2 sm:flex-row sm:items-center">
        <div className="shrink-0 text-center sm:w-[150px]">
          <p className="text-[40px] leading-none font-extrabold tracking-[-0.02em] text-[var(--color-headline)] tabular-nums">
            {score}
          </p>
          <span className="mt-1.5 flex justify-center">
            <Stars value={summary.average ?? 0} size={17} />
          </span>
          <p className="mt-1 text-sm text-[var(--color-faint)]">{t("reviewsCount", { count: summary.count })}</p>
        </div>
        <Distribution summary={summary} />
      </div>

      <ul className="mt-4 grid list-none grid-cols-1 gap-3.5 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {reviews.map((review) => (
          <li key={review.id} className="rounded-xl border border-[var(--color-border)] px-3.5 py-4">
            <div className="flex gap-2.5">
              <Initials name={review.authorName} className="h-9 w-9 bg-[var(--color-border)] text-[var(--color-ink-2)]" />
              <div className="min-w-0">
                {/* Somebody who set no display name is "a customer", never
                    their email and never their id: this page is public, and
                    they did not agree to appear under either. */}
                <p className="text-sm font-semibold text-[var(--color-headline)]">
                  {review.authorName ?? t("reviewAnonymous")}
                </p>
                <ReviewDate review={review} locale={locale} className="mt-0.5" />
                <span className="mt-1.5 flex">
                  <ReviewScore review={review} size={13} locale={locale} />
                </span>
              </div>
            </div>
            {review.comment && (
              <p className="mt-3 text-sm leading-normal whitespace-pre-line text-[var(--color-faint)]">
                {review.comment}
              </p>
            )}
          </li>
        ))}
      </ul>

      {(seeAll || showing) && (
        <div className="mt-4">
          {seeAll && (
            <button
              type="button"
              onClick={() => setLimit(REVIEWS_CAP)}
              className="h-11 rounded-[10px] border border-[var(--color-border)] px-5 text-[15px] font-medium text-[var(--color-info-fg)] hover:border-[var(--color-blue-line)]"
            >
              {t("reviewsSeeAll")}
            </button>
          )}
          {showing}
        </div>
      )}
    </section>
  );
}

function Distribution({
  summary,
  rail = false,
}: {
  summary: ProviderReviewsPublicDTO["summary"];
  rail?: boolean;
}) {
  return (
    <div className={cn("grid flex-1 text-xs", rail ? "gap-1.5 text-[var(--color-muted-foreground)]" : "max-w-[400px] gap-1.5 text-[var(--color-muted-foreground)]")}>
      {BARS.map((bar) => {
        const n = summary.histogram[bar];
        const share = summary.count === 0 ? 0 : (n / summary.count) * 100;
        return (
          <div
            key={bar}
            className={cn(
              "grid items-center",
              rail ? "h-3.5 grid-cols-[30px_1fr_22px]" : "grid-cols-[36px_1fr_28px]",
            )}
          >
            <span className="inline-flex items-center gap-0.5 tabular-nums">
              {SCORE_OF[bar]}
              <Star className="h-2.5 w-2.5 fill-current stroke-none" aria-hidden="true" />
            </span>
            {/* Decoration for the number beside it; a screen reader gets "4
                stars, 12" from the row, not a percentage. */}
            <span
              aria-hidden="true"
              className={cn("overflow-hidden", rail ? "h-1.5 rounded-[3px] bg-[var(--color-border)]" : "h-2 rounded bg-[var(--color-line-2)]")}
            >
              <span
                className={cn("block h-full", rail ? "rounded-[3px] bg-[var(--color-ink-2)]" : "rounded bg-[var(--color-ink-2)]")}
                style={{ width: `${share}%` }}
              />
            </span>
            <span className={cn("tabular-nums", rail ? "text-right" : "pl-3.5")}>{n}</span>
          </div>
        );
      })}
    </div>
  );
}

function ReviewScore({ review, size, locale }: { review: ReviewPublicDTO; size: number; locale: string }) {
  const { t } = useTranslation("directory");
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--color-headline)]"
      aria-label={t("reviewsStarsLabel", { count: review.rating })}
    >
      <Stars value={review.rating} size={size} />
      <span aria-hidden="true">{formatRating(review.rating, locale)}</span>
    </span>
  );
}

function ReviewDate({ review, locale, className }: { review: ReviewPublicDTO; locale: string; className?: string }) {
  return (
    <time dateTime={review.createdAt} className={cn("block text-[13px] text-[var(--color-faint)]", className)}>
      {new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(
        new Date(review.createdAt),
      )}
    </time>
  );
}

function Initials({ name, className }: { name: string | null; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center rounded-full text-[13px] font-semibold", className)}
    >
      {initials(name)}
    </span>
  );
}

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => [...w][0] ?? "")
    .join("")
    .toUpperCase();
}
