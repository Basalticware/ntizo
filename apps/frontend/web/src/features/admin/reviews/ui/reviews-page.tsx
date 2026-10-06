import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import {
  Calendar,
  ChevronRight,
  CircleCheck,
  EyeOff,
  MessageSquareQuote,
  Star,
  X,
} from "lucide-react";
import type { ReviewAdminDTO } from "@ntizo/shared/read-models";
import { Avatar, AvatarFallback, Badge, Button, cn } from "@ntizo/frontend-ui";
import { CollectionCard } from "@/shared/components/collection-card";
import { StatusTabs } from "@/shared/components/status-tabs";
import { initialsFrom } from "@/shared/lib/initials";
import { shortDate } from "@/shared/lib/relative-day";
import { usePageHeader } from "@/shared/lib/page-header";
import { ADMIN_REVIEW_PAGE_SIZE } from "../data/admin-review.repository";
import { useAdminReviews, useSetReviewFeatured } from "../viewmodel/use-admin-reviews";

/**
 * How many the home page draws. Mirrors `MAX_FEATURED` on the server, which is
 * the one that actually enforces it — this copy exists so the screen can say
 * "2 of 4" before a fifth attempt is refused, not instead of the refusal.
 */
const MAX_FEATURED = 4;

/** The reader's own zone: a review is dated where the administrator reads it. */
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

type ReviewTab = "all" | "featured";

/**
 * Every review, and which of them the home page shows.
 *
 * The home page's testimonials used to be four invented quotes with invented
 * names in a file called `mock-content.ts`. They are now whichever real
 * reviews an administrator picks here — which is why this screen exists at
 * all, and why it lists hidden reviews too: a hidden review that is still
 * marked featured is a state worth being able to see.
 *
 * Drawn as the October mockup: the list on the left and, once "Ver detalhe"
 * picks a row, the review in full on the right with the one moderation the
 * platform has — putting it on the home page or taking it off. The mockup's
 * reported/awaiting tabs, its hide and "ask for context" actions, the service
 * column and the rating/state/city pickers are not drawn: there is no report,
 * no hide mutation and no service or city on this read. The two tabs are the
 * two sets the server can actually count.
 */
export function AdminReviewsPage() {
  const { t, i18n } = useTranslation("admin");
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const [tab, setTab] = useState<ReviewTab>("all");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<ReviewAdminDTO | null>(null);
  const featuredOnly = tab === "featured";
  const query = useAdminReviews({
    offset,
    ...(featuredOnly ? { featuredOnly: true } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  });
  const setFeatured = useSetReviewFeatured();

  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const featuredCount = query.data?.featuredCount ?? 0;
  // The row as the latest read has it, so the panel follows a toggle; the
  // snapshot taken on "Ver detalhe" only while the row is off this page.
  const open = selected ? (rows.find((r) => r.id === selected.id) ?? selected) : null;

  usePageHeader(t("reviewsTitle"), t("reviewsPage.subtitle"), { ownHeading: true });

  const day = (iso: string) => shortDate(iso, TIME_ZONE, locale, { year: true });

  return (
    <div className="grid w-full max-w-[1400px] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_388px]">
      <div className={cn("flex min-w-0 flex-col gap-4", !open && "xl:col-span-2")}>
        <div>
          <h1 className="font-display text-[30px] leading-[1.05] font-extrabold tracking-[-0.01em] text-[var(--color-headline)] md:text-[37px]">
            {t("reviewsTitle")}
          </h1>
          <p className="mt-1.5 text-base text-[var(--color-muted-foreground)] md:text-[16.5px]">
            {query.data
              ? `${t("reviewsPage.subtitle")} ${t("reviewsFeaturedCount", { count: featuredCount, max: MAX_FEATURED })}.`
              : t("reviewsPage.subtitle")}
          </p>
        </div>

        {query.error && (
          <p className="type-body text-[var(--color-destructive)]">{t("reviewsError")}</p>
        )}
        {/* The refusal from the server, said where the toggle that caused it is.
            The cap is checked there, not here — this only reports it. */}
        {setFeatured.error && (
          <p className="type-body text-[var(--color-destructive)]">
            {t("reviewsFeatureFailed", { max: MAX_FEATURED })}
          </p>
        )}

        {/* The mockup's table is denser than the shared card's: eight
            columns in the width the side panel leaves, so the cells are
            padded here at its 9px rather than the card's 40. */}
        <div className="min-w-0 [&_td]:pr-1 [&_td]:pl-3 [&_th]:pr-1 [&_th]:pl-3 [&_th]:text-[13px] [&_thead_tr]:h-11 [&_tbody_tr]:h-[76px]">
        <CollectionCard
          title={t("reviewsTitle")}
          tabs={
            <StatusTabs
              ariaLabel={t("reviewsTitle")}
              value={tab}
              onChange={(next) => {
                setTab(next);
                // Back to the first page: page three of the unfiltered list is
                // past the end of a four-row one, which renders as empty and
                // reads as the filter having found nothing.
                setOffset(0);
              }}
              tabs={[
                // A count only where the server gave one for that set: the
                // total belongs to the tab on screen, the featured count is
                // always on the payload.
                { key: "all", label: t("reviewsPage.tabAll"), count: !featuredOnly && query.data && !search.trim() ? total : null },
                { key: "featured", label: t("reviewsOnHomeFilter"), count: query.data ? featuredCount : null, tone: "info" },
              ]}
            />
          }
          shown={rows.length}
          total={total}
          loading={query.isLoading}
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            // Back to the first page. Page three of the unfiltered list is
            // past the end of a two-row result, which renders as empty and
            // reads as the search having found nothing.
            setOffset(0);
          }}
          searchPlaceholder={t("reviewsSearchPlaceholder")}
          columns={[
            { key: "client", label: t("reviewsPage.client") },
            { key: "provider", label: t("reviewsPage.provider"), skeletonWidth: "w-32" },
            { key: "rating", label: t("reviewsPage.rating"), skeletonWidth: "w-24" },
            { key: "comment", label: t("reviewsPage.comment"), skeletonWidth: "w-40" },
            { key: "status", label: t("reviewsStatus"), skeletonWidth: "w-20", skeletonShape: "badge" },
            // Declared, and it has to be: `CollectionCard` renders
            // `row.actions` into the column whose key is literally "actions".
            { key: "actions", label: t("reviewsPage.actions"), className: "pr-5", skeletonWidth: "w-24" },
          ]}
          emptyText={t("reviewsEmpty")}
          emptyTitle={t("reviewsEmptyTitle")}
          emptyBadge={MessageSquareQuote}
          noMatchesText={t("reviewsNoMatches")}
          noMatchesTitle={t("reviewsNoMatchesTitle")}
          filtered={featuredOnly || search.trim() !== ""}
          rows={rows.map((review) => ({
            key: review.id,
            primary: (
              <PersonLine
                name={review.authorName ?? t("reviewsAnonymous")}
                sub={day(review.createdAt)}
              />
            ),
            cells: {
              provider: <PersonLine name={review.providerName} />,
              rating: <Stars rating={review.rating} locale={locale} />,
              comment: (
                // Two lines, not one: a testimonial is being judged on its
                // words, and a single truncated line is not enough to judge
                // one by.
                <p className="m-0 line-clamp-2 max-w-[34ch] text-sm leading-[1.45] text-[var(--color-muted-foreground)]">
                  {review.comment?.trim() || t("reviewsNoComment")}
                </p>
              ),
              status: <ReviewState review={review} />,
            },
            actions: (
              <button
                type="button"
                onClick={() => setSelected(review)}
                aria-pressed={open?.id === review.id}
                className={cn(
                  "inline-flex h-[38px] items-center rounded-md border-[1.5px] border-[var(--color-blue-edge)] px-3 text-[13px] font-medium whitespace-nowrap text-[var(--color-primary)]",
                  open?.id === review.id
                    ? "bg-[var(--color-blue-soft)]"
                    : "bg-[var(--color-card)] hover:bg-[color-mix(in_srgb,var(--color-primary)_6%,transparent)]",
                )}
              >
                {t("reviewsPage.viewDetail")}
              </button>
            ),
          }))}
        />
        </div>

        {/* Plain previous/next rather than numbered pages: the backend answers
            with a total and an offset, and nothing here needs to jump to page
            seven of a list somebody is skimming. */}
        {total > ADMIN_REVIEW_PAGE_SIZE && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - ADMIN_REVIEW_PAGE_SIZE))}
            >
              {t("reviewsPrevious")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + ADMIN_REVIEW_PAGE_SIZE >= total}
              onClick={() => setOffset((o) => o + ADMIN_REVIEW_PAGE_SIZE)}
            >
              {t("reviewsNext")}
            </Button>
          </div>
        )}
      </div>

      {open && (
        <ReviewPanel
          review={open}
          locale={locale}
          featuredCount={featuredCount}
          pending={setFeatured.isPending}
          onToggleFeatured={() =>
            setFeatured.mutate({ reviewId: open.id, featured: open.featuredAt === null })
          }
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/** The monogram and the name — the read carries no photo for either side. */
function PersonLine({ name, sub, size = 42 }: { name: string; sub?: string; size?: 42 | 46 | 64 }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar className={cn("shrink-0", size === 42 ? "h-[42px] w-[42px]" : size === 46 ? "h-[46px] w-[46px]" : "h-16 w-16")}>
        <AvatarFallback className="bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] text-[13px] font-semibold text-[var(--color-primary)]">
          {initialsFrom(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 leading-[1.3]">
        <b className="block truncate text-sm font-bold text-[var(--color-headline)]">{name}</b>
        {sub && <span className="mt-[3px] block truncate text-[13px] text-[var(--color-faint)]">{sub}</span>}
      </div>
    </div>
  );
}

/**
 * Five stars and the score beside them. A one-star review draws its one star
 * red, as the mockup does: it is the row an administrator should notice.
 */
function Stars({ rating, locale, size = "sm" }: { rating: number; locale: string; size?: "sm" | "lg" }) {
  const { t } = useTranslation("admin");
  const score = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rating);
  return (
    <span
      className={cn("flex items-center whitespace-nowrap", size === "sm" ? "gap-px" : "gap-1")}
      aria-label={t("reviewsPage.ratingAria", { rating })}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          aria-hidden="true"
          strokeWidth={1}
          className={cn(
            size === "sm" ? "h-3.5 w-3.5" : "h-[19px] w-[19px]",
            i >= rating
              ? "fill-[var(--color-border)] text-[var(--color-border)]"
              : rating === 1
                ? "fill-[var(--color-bad-fg)] text-[var(--color-bad-fg)]"
                : "fill-[var(--color-star)] text-[var(--color-star)]",
          )}
        />
      ))}
      <em
        className={cn(
          "not-italic tabular-nums",
          size === "sm"
            ? "ml-2 text-[13px] text-[var(--color-muted-foreground)]"
            : "ml-[15px] text-[14.5px] font-bold text-[var(--color-headline)]",
        )}
      >
        {score}
      </em>
    </span>
  );
}

function ReviewState({ review }: { review: ReviewAdminDTO }) {
  const { t } = useTranslation("admin");
  return (
    <span className="flex items-center gap-2">
      <Badge tone={review.status === "published" ? "success" : "warning"} className="h-[30px] px-3 text-[13px]">
        {t(`reviewStatus.${review.status}`, { defaultValue: review.status })}
      </Badge>
      {review.featuredAt !== null && (
        <Star
          role="img"
          aria-label={t("reviewsOnHome")}
          className="h-4 w-4 shrink-0 fill-[var(--color-primary)] text-[var(--color-primary)]"
        />
      )}
    </span>
  );
}

/**
 * One review in full, and the moderation the platform has for it.
 *
 * Beside the list from `xl`, where the mockup puts it; over the page on
 * anything narrower, where there is no beside.
 */
function ReviewPanel({
  review,
  locale,
  featuredCount,
  pending,
  onToggleFeatured,
  onClose,
}: {
  review: ReviewAdminDTO;
  locale: string;
  featuredCount: number;
  pending: boolean;
  onToggleFeatured: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("admin");
  const isFeatured = review.featuredAt !== null;
  // A review with no words has nothing to put on the card, and the public
  // query filters it out — so offering the toggle would be offering a
  // control whose effect is invisible.
  const hasWords = (review.comment ?? "").trim().length > 0;
  const full = !isFeatured && featuredCount >= MAX_FEATURED;
  const created = new Date(review.createdAt);
  const day = shortDate(review.createdAt, TIME_ZONE, locale, { year: true });
  const time = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(created);

  const tag =
    review.status === "hidden"
      ? { tone: "warning" as const, icon: EyeOff, label: t("reviewsPage.tagHidden") }
      : isFeatured
        ? { tone: "info" as const, icon: Star, label: t("reviewsOnHome") }
        : { tone: "success" as const, icon: CircleCheck, label: t("reviewsPage.tagPublished") };
  const TagIcon = tag.icon;

  return (
    <aside
      aria-label={t("reviewsPage.panelTitle")}
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--color-card)] px-6 pt-[18px] pb-6 xl:sticky xl:inset-auto xl:top-6 xl:z-auto xl:mt-2 xl:rounded-xl xl:border xl:border-[var(--color-border)] xl:shadow-[0_6px_20px_rgba(30,60,130,0.05)]"
    >
      <div className="flex items-center justify-between">
        <Badge tone={tag.tone} className="h-9 gap-3 rounded-md px-3.5 text-sm">
          <TagIcon aria-hidden="true" className="h-[18px] w-[18px]" />
          {tag.label}
        </Badge>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="grid h-8 w-8 place-items-center rounded-full text-[var(--color-headline)] hover:bg-[var(--color-muted)]"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-[18px] flex items-center gap-[18px]">
        <Avatar className="h-16 w-16 shrink-0">
          <AvatarFallback className="bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] text-lg font-semibold text-[var(--color-primary)]">
            {initialsFrom(review.authorName ?? t("reviewsAnonymous"))}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <b className="block truncate text-[17px] font-bold text-[var(--color-headline)]">
            {review.authorName ?? t("reviewsAnonymous")}
          </b>
          <span className="mt-1.5 block text-sm text-[var(--color-faint)]">{t("reviewsPage.client")}</span>
        </div>
      </div>

      <hr className="my-5 border-0 border-t border-[var(--color-line-2)]" />

      <div className="grid min-h-[46px] grid-cols-[120px_minmax(0,1fr)_18px] items-center gap-x-2">
        <span className="text-sm text-[var(--color-muted-foreground)]">{t("reviewsPage.provider")}</span>
        <Link
          to="/admin/providers/$providerId"
          params={{ providerId: review.providerId }}
          className="col-span-2 grid min-w-0 grid-cols-[minmax(0,1fr)_18px] items-center gap-x-2 no-underline hover:opacity-80"
        >
          <PersonLine name={review.providerName} sub={review.providerSlug} size={46} />
          <ChevronRight aria-hidden="true" className="h-[17px] w-[17px] text-[var(--color-headline)]" />
        </Link>
      </div>
      <div className="mt-2.5 grid min-h-[46px] grid-cols-[120px_minmax(0,1fr)] items-center gap-x-2">
        <span className="text-sm text-[var(--color-muted-foreground)]">{t("reviewsPage.reviewDate")}</span>
        <span className="flex items-center gap-[13px] text-[14.5px] text-[var(--color-headline)]">
          <Calendar aria-hidden="true" className="ml-2 h-[19px] w-[19px] shrink-0" />
          {t("reviewsPage.dateAt", { date: day, time })}
        </span>
      </div>

      <hr className="my-5 border-0 border-t border-[var(--color-line-2)]" />

      <div className="grid min-h-[30px] grid-cols-[120px_minmax(0,1fr)] items-center gap-x-2">
        <span className="text-sm text-[var(--color-muted-foreground)]">{t("reviewsPage.rating")}</span>
        <Stars rating={review.rating} locale={locale} size="lg" />
      </div>
      <span className="mt-4 block text-sm text-[var(--color-muted-foreground)]">{t("reviewsPage.fullComment")}</span>
      <blockquote className="m-0 mt-3 rounded-[9px] bg-[var(--color-blue-softer)] px-[18px] pt-3.5 pb-4 text-[14.5px] leading-normal whitespace-pre-line text-[var(--color-muted-foreground)]">
        {review.comment?.trim() ? `“${review.comment.trim()}”` : t("reviewsNoComment")}
      </blockquote>

      <b className="mt-[22px] block text-[15.5px] font-bold text-[var(--color-headline)]">{t("reviewsPage.moderation")}</b>
      <button
        type="button"
        disabled={!hasWords || full || pending}
        onClick={onToggleFeatured}
        className={cn(
          "mt-3 flex min-h-[58px] w-full items-center justify-center gap-4 rounded-[7px] px-4 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50",
          isFeatured
            ? "border border-[var(--color-blue-outline)] bg-[var(--color-card)] text-[var(--color-primary)]"
            : "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]",
        )}
      >
        <Star aria-hidden="true" className={cn("h-[22px] w-[22px] shrink-0", !isFeatured && "fill-current")} />
        <span>
          <b className="block text-[15px] font-semibold">
            {isFeatured ? t("reviewsPage.removeFromHome") : t("reviewsPage.putOnHome")}
          </b>
          <span className="mt-0.5 block text-[13.5px]">
            {!hasWords
              ? t("reviewsCannotFeatureNoComment")
              : full
                ? t("reviewsFeatureFull", { max: MAX_FEATURED })
                : t("reviewsFeaturedCount", { count: featuredCount, max: MAX_FEATURED })}
          </span>
        </span>
      </button>
    </aside>
  );
}
