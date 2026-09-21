import { describe, expect, it, spyOn } from "bun:test";
import type { Locale } from "@ntizo/shared";
import { ConfirmPhoneFromWhatsAppInternalCommand } from "../confirm-phone-from-whatsapp.internal.command";
import type { PhoneConfirmationOutcome } from "../../ports/inbound/confirm-phone-from-whatsapp.internal.command.port";
import type { AuthIdentityPort, PendingPhoneVerification } from "../../ports/outbound";

const NOW = new Date("2026-09-21T14:40:00.000Z");
const SENDER = "+258879801517";
const MESSAGE = "Olá Ntizo! O meu código de confirmação é 483920";

function harness(opts: {
  account?: { userId: string; verified: boolean } | null;
  pending?: PendingPhoneVerification | null;
  markResult?: boolean;
  language?: Locale;
  replyFails?: boolean;
}) {
  const marked: { userId: string; issuedFor: string }[] = [];
  const deleted: string[] = [];
  const replies: { to: string; outcome: PhoneConfirmationOutcome; language: Locale | null }[] = [];

  const identity: AuthIdentityPort = {
    setPhoneNumber: async () => {},
    findPhoneOf: async () => null,
    findByPhoneNumber: async () =>
      opts.account === undefined ? { userId: "u1", verified: false } : opts.account,
    markPhoneNumberVerified: async (userId, issuedFor) => {
      marked.push({ userId, issuedFor });
      return opts.markResult ?? true;
    },
  };

  const command = new ConfirmPhoneFromWhatsAppInternalCommand(
    identity,
    {
      replace: async () => {},
      find: async () =>
        opts.pending === undefined
          ? { code: "483920", phoneNumber: SENDER, expiresAt: new Date(NOW.getTime() + 60_000) }
          : opts.pending,
      delete: async (userId) => {
        deleted.push(userId);
      },
    },
    { findByUserId: async () => ({ language: opts.language ?? "pt-MZ" }), save: async () => {} } as never,
    {
      send: async (to, outcome, language) => {
        if (opts.replyFails) throw new Error("Meta said no");
        replies.push({ to, outcome, language });
      },
    },
    { now: () => NOW },
  );
  return { command, marked, deleted, replies };
}

describe("ConfirmPhoneFromWhatsAppInternalCommand", () => {
  it("confirms the sender's account when the code is theirs and still valid", async () => {
    const { command, marked, deleted, replies } = harness({});
    expect(await command.execute({ senderPhone: SENDER, text: MESSAGE })).toBe("confirmed");
    expect(marked).toEqual([{ userId: "u1", issuedFor: SENDER }]);
    expect(deleted).toEqual(["u1"]);
    expect(replies).toEqual([{ to: SENDER, outcome: "confirmed", language: "pt-MZ" }]);
  });

  it("answers a message with no code without looking for a pending one", async () => {
    const { command, marked } = harness({});
    expect(await command.execute({ senderPhone: SENDER, text: "Olá, bom dia" })).toBe("no-code");
    expect(await command.execute({ senderPhone: SENDER, text: null })).toBe("no-code");
    expect(marked).toEqual([]);
  });

  it("tells a sender with no account, in Portuguese", async () => {
    const { command, replies } = harness({ account: null });
    expect(await command.execute({ senderPhone: SENDER, text: MESSAGE })).toBe("no-account");
    expect(replies).toEqual([{ to: SENDER, outcome: "no-account", language: null }]);
  });

  it("says so when the number is already confirmed, and writes nothing", async () => {
    const { command, marked } = harness({ account: { userId: "u1", verified: true } });
    expect(await command.execute({ senderPhone: SENDER, text: MESSAGE })).toBe("already-confirmed");
    expect(marked).toEqual([]);
  });

  it("refuses a code that is not the pending one", async () => {
    const { command, marked } = harness({});
    expect(await command.execute({ senderPhone: SENDER, text: "o meu código é 111111" })).toBe("invalid-code");
    expect(marked).toEqual([]);
  });

  it("refuses an expired code", async () => {
    const { command, marked } = harness({
      pending: { code: "483920", phoneNumber: SENDER, expiresAt: new Date(NOW.getTime() - 1) },
    });
    expect(await command.execute({ senderPhone: SENDER, text: MESSAGE })).toBe("invalid-code");
    expect(marked).toEqual([]);
  });

  it("refuses when there is no pending code at all", async () => {
    const { command } = harness({ pending: null });
    expect(await command.execute({ senderPhone: SENDER, text: MESSAGE })).toBe("invalid-code");
  });

  it("refuses a code issued for another number", async () => {
    const { command, marked } = harness({
      pending: { code: "483920", phoneNumber: "+258841111111", expiresAt: new Date(NOW.getTime() + 60_000) },
    });
    expect(await command.execute({ senderPhone: SENDER, text: MESSAGE })).toBe("invalid-code");
    expect(marked).toEqual([]);
  });

  it("refuses, and keeps the code, when the number changed before the write", async () => {
    const { command, deleted } = harness({ markResult: false });
    expect(await command.execute({ senderPhone: SENDER, text: MESSAGE })).toBe("invalid-code");
    expect(deleted).toEqual([]);
  });

  it("answers in the account's language", async () => {
    const { command, replies } = harness({ language: "en-US" });
    await command.execute({ senderPhone: SENDER, text: MESSAGE });
    expect(replies[0]?.language).toBe("en-US");
  });

  it("keeps the confirmation when the reply cannot be sent", async () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    const { command, marked } = harness({ replyFails: true });
    expect(await command.execute({ senderPhone: SENDER, text: MESSAGE })).toBe("confirmed");
    expect(marked).toHaveLength(1);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
