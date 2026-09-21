import type { ConfirmPhoneFromWhatsAppInternalPort } from "../../../bounded-contexts/user/app/ports/inbound/confirm-phone-from-whatsapp.internal.command.port";

export interface WhatsAppWebhookResponse {
  status: number;
  body: string;
  contentType: "text/plain" | "application/json";
}

export interface WhatsAppWebhookDeps {
  confirm: ConfirmPhoneFromWhatsAppInternalPort;
  /** Meta app secret: signs every POST. Absent means refuse everything, loudly. */
  appSecret: string | undefined;
  /** Only for the GET handshake when the webhook is registered. */
  verifyToken: string | undefined;
  /**
   * This stage's own WhatsApp Business number, from Meta's `phone_number_id`.
   * Set, a delivery reporting any other id is skipped — no confirm call —
   * because it was addressed to a different WhatsApp number entirely (a
   * sandbox number, another stage's number sharing the same app). Unset,
   * every delivery is handled, as before.
   */
  phoneNumberId: string | undefined;
  /** Shared across requests by the caller, like the Resend route's counter. */
  refusals: { count: number };
}

const json = (status: number, value: unknown): WhatsAppWebhookResponse => ({
  status,
  body: JSON.stringify(value),
  contentType: "application/json",
});

/**
 * Meta's WhatsApp webhook: the subscription handshake and inbound messages.
 *
 * **Framework-free**, like `write/notification/http/resend-webhook.routes.ts`:
 * raw body and headers in, a status out. The Hono binding lives in
 * `apps/backend/api/src/webhooks.ts`, and two fitness tests keep it there.
 *
 * **The signature is checked over the raw bytes, before anything is parsed.**
 * Meta escapes non-ASCII characters in what it signs, so a re-serialised
 * parse would never verify. `crypto.subtle.verify` makes the comparison
 * constant-time.
 *
 * **Everything decided is a 200.** Meta retries anything else for up to
 * seven days and disables a webhook after repeated failures. A command that
 * *throws* — a dropped connection — is not caught: that one is transient and
 * a retry is the right answer.
 */
export function createWhatsAppWebhookHandlers(deps: WhatsAppWebhookDeps) {
  return {
    verify(query: Record<string, string | undefined>): WhatsAppWebhookResponse {
      if (!deps.verifyToken) {
        console.error("[whatsapp-webhook] WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set — refusing the handshake");
        return json(500, { error: "not configured" });
      }
      if (query["hub.mode"] === "subscribe" && query["hub.verify_token"] === deps.verifyToken) {
        return { status: 200, body: query["hub.challenge"] ?? "", contentType: "text/plain" };
      }
      return json(403, { error: "forbidden" });
    },

    async receive(req: { body: string; headers: Record<string, string> }): Promise<WhatsAppWebhookResponse> {
      if (!deps.appSecret) {
        console.error("[whatsapp-webhook] WHATSAPP_APP_SECRET is not set — refusing every event");
        return json(500, { error: "not configured" });
      }

      const signature = req.headers["x-hub-signature-256"] ?? req.headers["X-Hub-Signature-256"];
      if (!(await isSignedBy(deps.appSecret, req.body, signature))) {
        deps.refusals.count += 1;
        // Logged on the first refusal and every hundredth: a wrong secret
        // looks exactly like attacker noise otherwise, and the endpoint would
        // sit dead with nothing saying so.
        if (deps.refusals.count === 1 || deps.refusals.count % 100 === 0) {
          console.error(`[whatsapp-webhook] refused an unsigned or mis-signed body (${deps.refusals.count} so far)`);
        }
        return json(401, { error: "invalid signature" });
      }

      let payload: unknown;
      try {
        payload = JSON.parse(req.body);
      } catch {
        // Signed by Meta but not JSON: no retry can improve these bytes, so it
        // is decided here — the same call the Resend route makes for a signed
        // body that is not an event.
        console.error("[whatsapp-webhook] a signed body was not JSON — ignored");
        return json(200, { ok: true });
      }

      for (const message of inboundMessages(payload, deps.phoneNumberId)) {
        await deps.confirm.execute({ senderPhone: `+${message.from}`, text: message.text });
      }
      return json(200, { ok: true });
    },
  };
}

async function isSignedBy(secret: string, body: string, header: string | undefined): Promise<boolean> {
  const match = header?.match(/^sha256=([0-9a-f]{64})$/i);
  if (!match) return false;
  const expected = hexToBytes(match[1]!);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify("HMAC", key, expected as BufferSource, new TextEncoder().encode(body));
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/**
 * Every inbound message in a delivery; statuses and anything unknown are
 * skipped. A `phoneNumberId` also skips every change addressed to a
 * different WhatsApp number.
 */
function inboundMessages(
  payload: unknown,
  phoneNumberId: string | undefined,
): { from: string; text: string | null }[] {
  const out: { from: string; text: string | null }[] = [];
  if (!isRecord(payload) || payload.object !== "whatsapp_business_account") return out;
  for (const entry of asArray(payload.entry)) {
    if (!isRecord(entry)) continue;
    for (const change of asArray(entry.changes)) {
      if (!isRecord(change) || change.field !== "messages" || !isRecord(change.value)) continue;
      if (phoneNumberId) {
        const metadata = isRecord(change.value.metadata) ? change.value.metadata : undefined;
        if (metadata?.phone_number_id !== phoneNumberId) continue;
      }
      for (const message of asArray(change.value.messages)) {
        if (!isRecord(message) || typeof message.from !== "string") continue;
        if (!/^\d+$/.test(message.from)) {
          console.warn("[whatsapp-webhook] skipped a message whose sender is not a phone number");
          continue;
        }
        const text =
          message.type === "text" && isRecord(message.text) && typeof message.text.body === "string"
            ? message.text.body
            : null;
        out.push({ from: message.from, text });
      }
    }
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
