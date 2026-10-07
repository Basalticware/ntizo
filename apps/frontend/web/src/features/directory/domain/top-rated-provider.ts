import type { ProviderPublicDTO } from "@ntizo/shared";

/**
 * The one business `/providers` draws wide above its grid, or `null`.
 *
 * `topRatedService`'s rule for the directory: the highest rating on the page
 * in hand, ties broken by the larger count of reviews, and only a business
 * somebody has reviewed. Picked from the current page, so the label is
 * honest — "the best rated of what you are looking at", not a ranking
 * nothing computes. Ties beyond both numbers keep the page's own order.
 */
export function topRatedProvider(
  items: readonly ProviderPublicDTO[],
): ProviderPublicDTO | null {
  let best: ProviderPublicDTO | null = null;
  for (const item of items) {
    if (item.ratingAverage === null || item.reviewCount === 0) continue;
    if (
      best === null ||
      item.ratingAverage > best.ratingAverage! ||
      (item.ratingAverage === best.ratingAverage && item.reviewCount > best.reviewCount)
    ) {
      best = item;
    }
  }
  return best;
}
