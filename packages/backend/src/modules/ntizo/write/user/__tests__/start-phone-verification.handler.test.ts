import { describe, expect, it } from "bun:test";
import { getGraphQLErrorCode } from "@cosmneo/onion-lasagna";
import type { NtizoGraphqlContext } from "../../../graphql/context";
import { createUserWriteHandlers, type UserWriteModule } from "../graphql/handlers/mutations.handlers";
import { PhoneVerificationUnavailableError } from "../../../bounded-contexts/user/domain/exceptions";

function ctx(overrides: Partial<NtizoGraphqlContext> = {}): NtizoGraphqlContext {
  return {
    requesterUserId: "u-session",
    email: null,
    firstName: null,
    lastName: null,
    role: "customer",
    requestId: null,
    ipAddress: null,
    userAgent: null,
    ...overrides,
  };
}

function module(execute: UserWriteModule["startPhoneVerification"]["execute"]): UserWriteModule {
  const unused = { execute: async () => undefined } as never;
  return {
    updateMyProfile: unused,
    addMyAddress: unused,
    updateMyAddress: unused,
    deleteMyAddress: unused,
    startPhoneVerification: { execute },
  };
}

function field(m: UserWriteModule) {
  return createUserWriteHandlers(m).find((h) => h.key === "user.startPhoneVerification")!;
}

describe("user.startPhoneVerification", () => {
  it("issues the caller's code and sends the expiry as ISO text", async () => {
    const seen: string[] = [];
    const f = field(
      module(async (ec) => {
        seen.push(ec.requester.type === "authenticated" ? ec.requester.user.userId : "anon");
        return {
          code: "483920",
          businessNumber: "+258843002020",
          expiresAt: new Date("2026-09-21T14:52:00.000Z"),
        };
      }),
    );

    const result = await f.handler({ input: {} } as never, ctx());

    expect(seen).toEqual(["u-session"]);
    expect(result).toEqual({
      code: "483920",
      businessNumber: "+258843002020",
      expiresAt: "2026-09-21T14:52:00.000Z",
    });
  });

  it("passes the command's refusal through with its own code", async () => {
    const f = field(
      module(async () => {
        throw new PhoneVerificationUnavailableError();
      }),
    );
    let caught: unknown;
    try {
      await f.handler({ input: {} } as never, ctx());
    } catch (error) {
      caught = error;
    }
    expect((caught as { code?: string }).code).toBe("PHONE_VERIFICATION_UNAVAILABLE");
    expect(getGraphQLErrorCode(caught)).not.toBe("INTERNAL_ERROR");
  });

  it("refuses an anonymous caller before the command runs", async () => {
    let ran = false;
    const f = field(
      module(async () => {
        ran = true;
        throw new Error("unreachable");
      }),
    );
    await expect(f.handler({ input: {} } as never, ctx({ requesterUserId: null }))).rejects.toThrow();
    expect(ran).toBe(false);
  });
});
