import { describe, expect, it, spyOn } from "bun:test";
import { createHmac } from "node:crypto";
import { createWhatsAppWebhookHandlers } from "../http/whatsapp-webhook.routes";
import type { ConfirmPhoneFromWhatsAppInternalInput } from "../../../bounded-contexts/user/app/ports/inbound/confirm-phone-from-whatsapp.internal.command.port";

const SECRET = "app-secret-for-tests";
const VERIFY = "verify-token-for-tests";

function sign(body: string, secret = SECRET): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

function inbound(messages: unknown[], statuses: unknown[] = [], phoneNumberId = "106540352242922"): string {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "102290129340398",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "258843002020", phone_number_id: phoneNumberId },
              ...(messages.length ? { messages } : {}),
              ...(statuses.length ? { statuses } : {}),
            },
          },
        ],
      },
    ],
  });
}

const TEXT = {
  from: "258841234567",
  id: "wamid.1",
  timestamp: "1758465420",
  type: "text",
  text: { body: "Olá Ntizo! O meu código de confirmação é 483920" },
};

function harness(
  overrides: {
    appSecret?: string | undefined;
    verifyToken?: string | undefined;
    phoneNumberId?: string | undefined;
  } = {},
) {
  const calls: ConfirmPhoneFromWhatsAppInternalInput[] = [];
  const handlers = createWhatsAppWebhookHandlers({
    confirm: {
      execute: async (input) => {
        calls.push(input);
        return "confirmed";
      },
    },
    appSecret: "appSecret" in overrides ? overrides.appSecret : SECRET,
    verifyToken: "verifyToken" in overrides ? overrides.verifyToken : VERIFY,
    phoneNumberId: overrides.phoneNumberId,
    refusals: { count: 0 },
  });
  return { handlers, calls };
}

describe("verify (Meta's subscription handshake)", () => {
  it("echoes the challenge as plain text when the token matches", () => {
    const { handlers } = harness();
    expect(
      handlers.verify({ "hub.mode": "subscribe", "hub.verify_token": VERIFY, "hub.challenge": "1158201444" }),
    ).toEqual({ status: 200, body: "1158201444", contentType: "text/plain" });
  });

  it("refuses a wrong token", () => {
    const { handlers } = harness();
    expect(
      handlers.verify({ "hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "1" }).status,
    ).toBe(403);
  });

  it("answers 500 when the stage has no verify token", () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    const { handlers } = harness({ verifyToken: undefined });
    expect(handlers.verify({ "hub.mode": "subscribe", "hub.verify_token": "", "hub.challenge": "1" }).status).toBe(500);
    error.mockRestore();
  });
});

describe("receive", () => {
  it("confirms from a signed text message, with the sender as E.164", async () => {
    const { handlers, calls } = harness();
    const body = inbound([TEXT]);
    const res = await handlers.receive({ body, headers: { "x-hub-signature-256": sign(body) } });
    expect(res.status).toBe(200);
    expect(calls).toEqual([{ senderPhone: "+258841234567", text: TEXT.text.body }]);
  });

  it("passes a non-text message on as having no text", async () => {
    const { handlers, calls } = harness();
    const body = inbound([{ from: "258841234567", id: "wamid.2", timestamp: "1", type: "audio", audio: { id: "a1" } }]);
    await handlers.receive({ body, headers: { "x-hub-signature-256": sign(body) } });
    expect(calls).toEqual([{ senderPhone: "+258841234567", text: null }]);
  });

  it("handles every message in one delivery", async () => {
    const { handlers, calls } = harness();
    const body = inbound([TEXT, { ...TEXT, id: "wamid.3", from: "258841112233" }]);
    await handlers.receive({ body, headers: { "x-hub-signature-256": sign(body) } });
    expect(calls.map((c) => c.senderPhone)).toEqual(["+258841234567", "+258841112233"]);
  });

  it("ignores delivery statuses", async () => {
    const { handlers, calls } = harness();
    const body = inbound([], [{ id: "wamid.9", status: "delivered", recipient_id: "258841234567" }]);
    const res = await handlers.receive({ body, headers: { "x-hub-signature-256": sign(body) } });
    expect(res.status).toBe(200);
    expect(calls).toEqual([]);
  });

  it("ignores a delivery for another WhatsApp number when one is configured", async () => {
    const { handlers, calls } = harness({ phoneNumberId: "106540352242922" });
    const body = inbound([TEXT], [], "some-other-number-id");
    const res = await handlers.receive({ body, headers: { "x-hub-signature-256": sign(body) } });
    expect(res.status).toBe(200);
    expect(calls).toEqual([]);
  });

  it("confirms a delivery for another WhatsApp number when none is configured", async () => {
    const { handlers, calls } = harness({ phoneNumberId: undefined });
    const body = inbound([TEXT], [], "some-other-number-id");
    const res = await handlers.receive({ body, headers: { "x-hub-signature-256": sign(body) } });
    expect(res.status).toBe(200);
    expect(calls).toEqual([{ senderPhone: "+258841234567", text: TEXT.text.body }]);
  });

  it("confirms a delivery for the configured WhatsApp number", async () => {
    const { handlers, calls } = harness({ phoneNumberId: "106540352242922" });
    const body = inbound([TEXT], [], "106540352242922");
    await handlers.receive({ body, headers: { "x-hub-signature-256": sign(body) } });
    expect(calls).toEqual([{ senderPhone: "+258841234567", text: TEXT.text.body }]);
  });

  it("logs and drops a message whose sender is not a phone number, without the sender in the log", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const { handlers, calls } = harness();
    const body = inbound([{ ...TEXT, from: "not-a-phone-number" }]);
    const res = await handlers.receive({ body, headers: { "x-hub-signature-256": sign(body) } });
    expect(res.status).toBe(200);
    expect(calls).toEqual([]);
    expect(warn).toHaveBeenCalledWith("[whatsapp-webhook] skipped a message whose sender is not a phone number");
    for (const call of warn.mock.calls) {
      for (const arg of call) expect(String(arg)).not.toContain("not-a-phone-number");
    }
    warn.mockRestore();
  });

  it("refuses a missing signature without reading the body", async () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    const { handlers, calls } = harness();
    const res = await handlers.receive({ body: inbound([TEXT]), headers: {} });
    expect(res.status).toBe(401);
    expect(calls).toEqual([]);
    error.mockRestore();
  });

  it("refuses a signature made with another secret", async () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    const { handlers, calls } = harness();
    const body = inbound([TEXT]);
    const res = await handlers.receive({ body, headers: { "x-hub-signature-256": sign(body, "other") } });
    expect(res.status).toBe(401);
    expect(calls).toEqual([]);
    error.mockRestore();
  });

  it("verifies the raw bytes: a re-serialised body no longer matches", async () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    const { handlers } = harness();
    const raw = inbound([TEXT]).replace('"object":', '"object" :');
    const res = await handlers.receive({
      body: JSON.stringify(JSON.parse(raw)),
      headers: { "x-hub-signature-256": sign(raw) },
    });
    expect(res.status).toBe(401);
    error.mockRestore();
  });

  it("answers 500 when the stage has no app secret", async () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    const { handlers, calls } = harness({ appSecret: undefined });
    const body = inbound([TEXT]);
    const res = await handlers.receive({ body, headers: { "x-hub-signature-256": sign(body) } });
    expect(res.status).toBe(500);
    expect(calls).toEqual([]);
    error.mockRestore();
  });

  it("lets a failing command throw so Meta retries it", async () => {
    const handlers = createWhatsAppWebhookHandlers({
      confirm: {
        execute: async () => {
          throw new Error("connection terminated");
        },
      },
      appSecret: SECRET,
      verifyToken: VERIFY,
      phoneNumberId: undefined,
      refusals: { count: 0 },
    });
    const body = inbound([TEXT]);
    await expect(handlers.receive({ body, headers: { "x-hub-signature-256": sign(body) } })).rejects.toThrow(
      "connection terminated",
    );
  });

  it("answers a signed body that is not JSON as decided, without confirming anything", async () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    const { handlers, calls } = harness();
    const body = "not json at all";
    const res = await handlers.receive({ body, headers: { "x-hub-signature-256": sign(body) } });
    expect(res.status).toBe(200);
    expect(calls).toEqual([]);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
