import { describe, expect, it, vi } from "vitest";

const fakes = vi.hoisted(() => ({ sessionGraphql: vi.fn() }));
vi.mock("@/shared/lib/graphql/session-graphql", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  sessionGraphql: fakes.sessionGraphql,
}));

const { startPhoneVerification } = await import("../user.repository");

describe("startPhoneVerification", () => {
  it("asks for a code with an empty input and returns the ticket", async () => {
    fakes.sessionGraphql.mockResolvedValue({
      userStartPhoneVerification: { code: "483920", businessNumber: "+258843002020", expiresAt: "2026-09-21T14:52:00.000Z" },
    });

    const ticket = await startPhoneVerification();

    expect(fakes.sessionGraphql.mock.calls[0]![0]).toContain("userStartPhoneVerification(input: {})");
    expect(ticket).toEqual({ code: "483920", businessNumber: "+258843002020", expiresAt: "2026-09-21T14:52:00.000Z" });
  });
});
