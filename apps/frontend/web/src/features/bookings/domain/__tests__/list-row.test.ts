import { describe, expect, it } from "vitest";
import type { BookingDTO } from "@ntizo/shared/read-models";
import {
  durationWording,
  initialsOf,
  longDateWording,
  nextBooking,
  placeWording,
} from "../list-row";

const NOW = new Date("2026-10-07T12:00:00.000Z");

function b(over: Partial<BookingDTO>): BookingDTO {
  return {
    id: "bk",
    status: "CONFIRMED",
    startsAt: "2026-10-10T08:00:00.000Z",
    endsAt: "2026-10-10T10:00:00.000Z",
    ...over,
  } as BookingDTO;
}

describe("durationWording", () => {
  it("writes minutes under an hour, whole hours bare, and the rest padded", () => {
    expect(durationWording(45)).toBe("45 min");
    expect(durationWording(120)).toBe("2h");
    expect(durationWording(90)).toBe("1h30");
    expect(durationWording(65)).toBe("1h05");
  });
});

describe("longDateWording", () => {
  it("reads the date in the provider's zone, not the browser's", () => {
    // 23:30 UTC on the 14th is already the 15th in Maputo (UTC+2).
    expect(longDateWording("2026-10-14T23:30:00.000Z", "pt-MZ", "Africa/Maputo")).toBe(
      "15 de outubro de 2026",
    );
  });
});

describe("placeWording", () => {
  it("joins the city and the district, and skips what is missing", () => {
    expect(placeWording({ addressCity: "Maputo", addressDistrict: "Polana" })).toBe(
      "Maputo, Polana",
    );
    expect(placeWording({ addressCity: "Maputo", addressDistrict: null })).toBe("Maputo");
    expect(placeWording({ addressCity: null, addressDistrict: " " })).toBeNull();
  });
});

describe("initialsOf", () => {
  it("takes the first and the last word", () => {
    expect(initialsOf("Hélder Cossa")).toBe("HC");
    expect(initialsOf("Casa Limpa Matola")).toBe("CM");
    expect(initialsOf("Nélia")).toBe("N");
  });
});

describe("nextBooking", () => {
  it("takes the soonest confirmed booking still ahead", () => {
    const soon = b({ id: "soon", startsAt: "2026-10-08T08:00:00.000Z" });
    const later = b({ id: "later", startsAt: "2026-10-20T08:00:00.000Z" });
    expect(nextBooking([soon, later], null, NOW)?.id).toBe("soon");
  });

  it("prefers a pending booking that starts earlier, when the waiting tab is whole", () => {
    const confirmed = b({ id: "c", startsAt: "2026-10-12T08:00:00.000Z" });
    const pending = b({
      id: "p",
      status: "AWAITING_PROVIDER",
      startsAt: "2026-10-09T08:00:00.000Z",
    });
    expect(nextBooking([confirmed], [pending], NOW)?.id).toBe("p");
    // A partial waiting tab is not consulted at all.
    expect(nextBooking([confirmed], null, NOW)?.id).toBe("c");
  });

  it("ignores slots already behind now and is null when nothing is ahead", () => {
    const past = b({ id: "past", startsAt: "2026-10-01T08:00:00.000Z" });
    const pendingPast = b({
      id: "pp",
      status: "PENDING_PAYMENT",
      startsAt: "2026-10-06T08:00:00.000Z",
    });
    expect(nextBooking([past], [pendingPast], NOW)).toBeNull();
    expect(nextBooking([], [], NOW)).toBeNull();
  });
});
