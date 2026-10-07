import type { ServiceDTO } from "@/features/directory/services/domain/types";

/**
 * The one service `/services` draws wide above its grid, or `null`.
 *
 * The highest provider rating on the page in hand, ties broken by the larger
 * count of reviews — 4,8 from 61 people says more than 4,8 from 2. Only a
 * service somebody has reviewed qualifies: a page of new providers has no
 * "best rated", and promoting the first of them would be inventing one.
 *
 * Picked from the current page rather than asked of the server, which keeps
 * the label honest: it is "the best rated of what you are looking at", not a
 * platform-wide ranking nothing computes. Nothing in the data marks a service
 * as featured, which is why the card never says so.
 *
 * Ties beyond both numbers keep the page's own order, so the pick is stable
 * across renders and follows the sort the reader chose.
 */
export function topRatedService(items: readonly ServiceDTO[]): ServiceDTO | null {
  let best: ServiceDTO | null = null;
  for (const item of items) {
    if (item.providerRatingAverage === null || item.providerReviewCount === 0) continue;
    if (
      best === null ||
      item.providerRatingAverage > best.providerRatingAverage! ||
      (item.providerRatingAverage === best.providerRatingAverage &&
        item.providerReviewCount > best.providerReviewCount)
    ) {
      best = item;
    }
  }
  return best;
}
