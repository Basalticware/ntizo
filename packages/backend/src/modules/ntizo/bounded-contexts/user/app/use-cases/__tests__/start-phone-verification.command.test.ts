import { describe, expect, it } from "bun:test";
import {
  PHONE_VERIFICATION_TTL_MS,
  StartPhoneVerificationCommand,
} from "../start-phone-verification.command";
import {
  PhoneNumberAlreadyVerifiedError,
  PhoneNumberMissingError,
  PhoneVerificationUnavailableError,
} from "../../../domain/exceptions";
import type { AuthIdentityPort, PendingPhoneVerification } from "../../ports/outbound";
import type { ExecutionContext } from "../../../../../shared/infrastructure/execution-context";

const ctx = {
  requester: {
    type: "authenticated",
    user: { userId: "u1", email: "ana@ntizo.test", firstName: "Ana", lastName: "Sitoe", platformRole: "customer" },
  },
  metadata: { requestId: "req-1", receivedAt: new Date() },
} as unknown as ExecutionContext;

const NOW = new Date("2026-09-21T14:37:00.000Z");

function harness(opts: {
  phone?: { phoneNumber: string; verified: boolean } | null;
  businessNumber?: string | null;
}) {
  const stored: { userId: string; pending: PendingPhoneVerification }[] = [];
  const askedFor: string[] = [];
  const identity: AuthIdentityPort = {
    setPhoneNumber: async () => {},
    findPhoneOf: async (userId) => {
      askedFor.push(userId);
      return opts.phone === undefined ? { phoneNumber: "+258841234567", verified: false } : opts.phone;
    },
    findByPhoneNumber: async () => null,
    markPhoneNumberVerified: async () => false,
  };
  const command = new StartPhoneVerificationCommand(
    identity,
    {
      replace: async (userId, pending) => {
        stored.push({ userId, pending });
      },
      find: async () => null,
      delete: async () => {},
    },
    { businessNumber: () => (opts.businessNumber === undefined ? "+258843002020" : opts.businessNumber) },
    { now: () => NOW, generateCode: () => "483920" },
  );
  return { command, stored, askedFor };
}

describe("StartPhoneVerificationCommand", () => {
  it("issues a code for the caller's own number, valid for fifteen minutes", async () => {
    const { command, stored, askedFor } = harness({});
    const ticket = await command.execute(ctx);

    expect(ticket).toEqual({
      code: "483920",
      businessNumber: "+258843002020",
      expiresAt: new Date(NOW.getTime() + PHONE_VERIFICATION_TTL_MS),
    });
    expect(PHONE_VERIFICATION_TTL_MS).toBe(15 * 60 * 1000);
    expect(askedFor).toEqual(["u1"]);
    expect(stored).toEqual([
      { userId: "u1", pending: { code: "483920", phoneNumber: "+258841234567", expiresAt: ticket.expiresAt } },
    ]);
  });

  it("refuses when the stage has no WhatsApp number, before touching anything", async () => {
    const { command, stored, askedFor } = harness({ businessNumber: null });
    await expect(command.execute(ctx)).rejects.toBeInstanceOf(PhoneVerificationUnavailableError);
    expect(askedFor).toEqual([]);
    expect(stored).toEqual([]);
  });

  it("refuses an account with no number", async () => {
    const { command, stored } = harness({ phone: null });
    await expect(command.execute(ctx)).rejects.toBeInstanceOf(PhoneNumberMissingError);
    expect(stored).toEqual([]);
  });

  it("refuses a number that is already confirmed", async () => {
    const { command, stored } = harness({ phone: { phoneNumber: "+258841234567", verified: true } });
    await expect(command.execute(ctx)).rejects.toBeInstanceOf(PhoneNumberAlreadyVerifiedError);
    expect(stored).toEqual([]);
  });

  it("refuses an anonymous caller", async () => {
    const { command } = harness({});
    const anonymous = { requester: { type: "anonymous" }, metadata: ctx.metadata } as unknown as ExecutionContext;
    await expect(command.execute(anonymous)).rejects.toThrow();
  });
});
