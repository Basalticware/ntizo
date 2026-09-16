import { describe, expect, it } from "bun:test";
import { earliestOf } from "../next-due";

describe("earliestOf", () => {
  it("picks the earliest date and skips the contexts with nothing due", () => {
    const a = new Date("2026-09-16T12:05:00.000Z");
    const b = new Date("2026-09-16T12:01:00.000Z");
    expect(earliestOf(a, null, b)).toEqual(b);
  });

  it("is null when no context has anything due", () => {
    expect(earliestOf(null, null, null)).toBeNull();
    expect(earliestOf()).toBeNull();
  });
});
