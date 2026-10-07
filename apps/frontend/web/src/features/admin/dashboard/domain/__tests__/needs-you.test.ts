import { describe, expect, it } from "vitest";
import { needsYou } from "../needs-you";

describe("needsYou", () => {
  it("always lists the four sources, in priority order", () => {
    expect(needsYou({ disputed: 2, providers: 4, support: 1, contact: 3 })).toEqual([
      { key: "disputed", count: 2 },
      { key: "providers", count: 4 },
      { key: "support", count: 1 },
      { key: "contact", count: 3 },
    ]);
  });

  it("keeps a quiet source as a zero rather than dropping it", () => {
    expect(needsYou({ disputed: 0, providers: 4, support: 0, contact: 0 })).toEqual([
      { key: "disputed", count: 0 },
      { key: "providers", count: 4 },
      { key: "support", count: 0 },
      { key: "contact", count: 0 },
    ]);
  });

  it("leaves a count that has not arrived unknown, not zero", () => {
    expect(needsYou({ disputed: undefined, providers: 1 })).toEqual([
      { key: "disputed", count: null },
      { key: "providers", count: 1 },
      { key: "support", count: null },
      { key: "contact", count: null },
    ]);
  });
});
