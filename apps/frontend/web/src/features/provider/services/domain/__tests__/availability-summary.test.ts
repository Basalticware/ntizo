import { describe, expect, it } from "vitest";
import { availabilitySummary } from "../availability-summary";

const rule = (weekday: number, start: number, end: number) => ({ weekday, startMinute: start * 60, endMinute: end * 60 });

describe("availabilitySummary", () => {
  it("says nothing for a week with no hours", () => {
    expect(availabilitySummary([], "pt-MZ")).toBeNull();
  });

  it("calls seven days with the same hours every day", () => {
    const week = [0, 1, 2, 3, 4, 5, 6].map((d) => rule(d, 9, 19));
    expect(availabilitySummary(week, "pt-MZ")).toEqual({ days: "all", hours: "09:00 – 19:00", more: false });
  });

  it("writes a run of days as its two ends, abbreviated the Portuguese way", () => {
    const week = [1, 2, 3, 4, 5, 6].map((d) => rule(d, 8, 18));
    expect(availabilitySummary(week, "pt-MZ")).toEqual({ days: "Seg – Sáb", hours: "08:00 – 18:00", more: false });
  });

  it("merges the hours of several performers on one day", () => {
    const week = [rule(1, 8, 12), rule(1, 11, 14), rule(2, 8, 14), rule(3, 8, 14)];
    expect(availabilitySummary(week, "pt-MZ")?.hours).toBe("08:00 – 14:00");
  });

  it("names the most common hours and says other days differ", () => {
    const week = [...[1, 2, 3, 4, 5].map((d) => rule(d, 8, 18)), rule(6, 9, 13)];
    expect(availabilitySummary(week, "pt-MZ")).toEqual({ days: "Seg – Sex", hours: "08:00 – 18:00", more: true });
  });

  it("lists days that do not follow one another", () => {
    const week = [rule(1, 8, 18), rule(3, 8, 18)];
    expect(availabilitySummary(week, "en-US")?.days).toBe("Mon and Wed");
  });
});
