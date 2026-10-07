import { describe, expect, it } from "vitest";
import { topRatedService } from "../top-rated";
import type { ServiceDTO } from "../types";

function service(id: string, average: number | null, count: number): ServiceDTO {
  return {
    id,
    providerId: `p-${id}`,
    providerName: "Barbearia Central",
    providerSlug: "barbearia",
    providerType: "organization",
    providerVerified: false,
    providerRatingAverage: average,
    providerReviewCount: count,
    categoryCode: "hair",
    categoryName: "Cabeleireiro",
    name: "Corte de cabelo",
    description: null,
    locationType: "at_provider",
    bookingMode: "priced",
    imageUrls: [],
    defaultOption: null,
    fromAmountMinor: null,
    optionCount: 0,
    isFallback: false,
  };
}

describe("topRatedService", () => {
  it("picks the highest rating on the page", () => {
    expect(topRatedService([service("a", 4.2, 9), service("b", 4.9, 3), service("c", 4.5, 40)])?.id).toBe("b");
  });

  it("breaks a tie on the rating by the larger count of reviews", () => {
    expect(topRatedService([service("a", 4.8, 2), service("b", 4.8, 61)])?.id).toBe("b");
  });

  it("keeps the page's order when both numbers tie", () => {
    expect(topRatedService([service("a", 4.8, 5), service("b", 4.8, 5)])?.id).toBe("a");
  });

  it("is null when nobody on the page has been reviewed", () => {
    expect(topRatedService([service("a", null, 0), service("b", null, 0)])).toBeNull();
    expect(topRatedService([])).toBeNull();
  });

  it("never picks an average that rests on no reviews", () => {
    expect(topRatedService([service("a", 5, 0), service("b", 3.1, 1)])?.id).toBe("b");
  });
});
