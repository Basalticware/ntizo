import { describe, expect, it } from "vitest";
import type { ProviderPublicDTO } from "@ntizo/shared";
import { topRatedProvider } from "../top-rated-provider";

function provider(id: string, average: number | null, count: number): ProviderPublicDTO {
  return { id, ratingAverage: average, reviewCount: count } as ProviderPublicDTO;
}

describe("topRatedProvider", () => {
  it("picks the highest rating on the page", () => {
    expect(topRatedProvider([provider("a", 4.2, 9), provider("b", 4.9, 3)])?.id).toBe("b");
  });

  it("breaks a tie on the rating by the larger count of reviews", () => {
    expect(topRatedProvider([provider("a", 4.8, 2), provider("b", 4.8, 61)])?.id).toBe("b");
  });

  it("keeps the page's order when both numbers tie", () => {
    expect(topRatedProvider([provider("a", 4.8, 5), provider("b", 4.8, 5)])?.id).toBe("a");
  });

  it("is null when nobody on the page has been reviewed", () => {
    expect(topRatedProvider([provider("a", null, 0)])).toBeNull();
    expect(topRatedProvider([])).toBeNull();
  });

  it("never picks an average that rests on no reviews", () => {
    expect(topRatedProvider([provider("a", 5, 0), provider("b", 3.1, 1)])?.id).toBe("b");
  });
});
