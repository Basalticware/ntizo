import { describe, expect, it } from "vitest";
import { ProviderType } from "@ntizo/shared";
import { profileCompleteness } from "../profile-completeness";
import type { ProviderDocument } from "../types";

function doc(type: string, status = "pending"): ProviderDocument {
  return { id: type, type, status, fileName: null, uploadedAt: "2026-10-01T00:00:00Z", reviewedAt: null, rejectionReason: null };
}

const EMPTY = {
  type: ProviderType.Organization,
  name: "Joaquim Serviços",
  description: "",
  address: {},
  logo: null,
  photos: [],
  documents: [],
};

describe("profileCompleteness", () => {
  it("counts nothing but the name on a fresh workspace", () => {
    const result = profileCompleteness(EMPTY);
    expect(result.steps.every((s) => !s.done)).toBe(true);
    expect(result.percent).toBe(0);
    expect(result.documents).toEqual({ held: 0, needed: 4 });
  });

  it("needs a logo and a photo for the brand step", () => {
    const logoOnly = profileCompleteness({ ...EMPTY, logo: { key: "l", url: null } });
    expect(logoOnly.steps.find((s) => s.step === "brand")?.done).toBe(false);
    const both = profileCompleteness({ ...EMPTY, logo: { key: "l", url: null }, photos: [{ key: "p", url: null }] });
    expect(both.steps.find((s) => s.step === "brand")?.done).toBe(true);
  });

  it("counts one identity document however many kinds are held, and not a refused one", () => {
    const result = profileCompleteness({
      ...EMPTY,
      documents: [doc("NATIONAL_ID", "accepted"), doc("PASSPORT"), doc("TAX_NUMBER", "rejected")],
    });
    expect(result.documents).toEqual({ held: 1, needed: 4 });
  });

  it("asks an individual for two papers, not four", () => {
    const result = profileCompleteness({
      ...EMPTY,
      type: ProviderType.Individual,
      documents: [doc("NATIONAL_ID"), doc("TAX_NUMBER")],
    });
    expect(result.documents).toEqual({ held: 2, needed: 2 });
    expect(result.steps.find((s) => s.step === "documents")?.done).toBe(true);
  });

  it("weighs the documents step by the share of papers held", () => {
    const result = profileCompleteness({
      ...EMPTY,
      description: "Canalização",
      address: { city: "Maputo", street: "Av. Julius Nyerere" },
      logo: { key: "l", url: null },
      photos: [{ key: "p", url: null }],
      documents: [doc("NATIONAL_ID", "accepted"), doc("TAX_NUMBER")],
    });
    // Three whole steps and half of the fourth.
    expect(result.percent).toBe(88);
  });
});
