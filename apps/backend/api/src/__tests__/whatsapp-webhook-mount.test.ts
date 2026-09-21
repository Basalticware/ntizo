import { describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";
import type { AppBindings } from "../types";
// The subject is the mounted app: the handler's decisions are proven in
// packages/backend. This proves the routes exist, sit outside CORS, and are
// handed the exact bytes that were signed.
import { app } from "../api";

const SECRET = "app-secret-for-mount-test";
const VERIFY = "verify-token-for-mount-test";
const ENV = {
  STAGE: "local",
  WHATSAPP_APP_SECRET: SECRET,
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: VERIFY,
} as unknown as AppBindings;

// Statuses only: the route answers 200 without touching the database.
const STATUSES_ONLY = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [{ id: "1", changes: [{ field: "messages", value: { statuses: [{ id: "wamid.1", status: "read" }] } }] }],
});

const sign = (body: string) => `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`;

describe("/api/webhooks/whatsapp", () => {
  it("answers Meta's handshake with the challenge", async () => {
    const res = await app.request(
      `/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=42`,
      {},
      ENV,
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("42");
  });

  it("accepts a signed body, without CORS headers even when an Origin is sent", async () => {
    const res = await app.request(
      "/api/webhooks/whatsapp",
      {
        method: "POST",
        body: STATUSES_ONLY,
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": sign(STATUSES_ONLY),
          origin: "http://localhost:3000",
        },
      },
      ENV,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("refuses an unsigned body with 401", async () => {
    const res = await app.request(
      "/api/webhooks/whatsapp",
      { method: "POST", body: STATUSES_ONLY, headers: { "content-type": "application/json" } },
      ENV,
    );
    expect(res.status).toBe(401);
  });

  it("refuses a declared body over 3 MiB before reading it", async () => {
    const res = await app.request(
      "/api/webhooks/whatsapp",
      {
        method: "POST",
        body: "{}",
        headers: { "content-length": String(3 * 1024 * 1024 + 1), "x-hub-signature-256": sign("{}") },
      },
      ENV,
    );
    expect(res.status).toBe(413);
  });
});
