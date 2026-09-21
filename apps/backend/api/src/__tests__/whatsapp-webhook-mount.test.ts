import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { createHmac } from "node:crypto";
import { infraStore } from "@ntizo/backend/shared/infra";
import { Db } from "@ntizo/backend/shared/infra/database";
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

// A real code, so the command reads past "no-code" and queries the database
// for the sender's account.
const TEXT_MESSAGE = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "1",
      changes: [
        {
          field: "messages",
          value: {
            metadata: { display_phone_number: "258843002020", phone_number_id: "106540352242922" },
            messages: [
              {
                from: "258841234567",
                id: "wamid.mount1",
                timestamp: "1758465420",
                type: "text",
                text: { body: "Olá Ntizo! O meu código de confirmação é 483920" },
              },
            ],
          },
        },
      ],
    },
  ],
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

  it("does not refuse a declared 2 MiB body with 413 — this route's limit is 3 MiB, not Resend's 1 MiB", async () => {
    // Synthetic, like `webhook-mount.test.ts`'s own declared-size test: the
    // actual body is tiny, only the declared `content-length` is 2 MiB. If
    // this route reused Resend's 1 MiB cap, this alone would already be
    // refused with 413. Left unsigned so the request still resolves quickly
    // — reaching the signature check (401) is exactly what proves the size
    // gate let it through.
    const res = await app.request(
      "/api/webhooks/whatsapp",
      {
        method: "POST",
        body: "{}",
        headers: { "content-length": String(2 * 1024 * 1024), "content-type": "application/json" },
      },
      ENV,
    );
    expect(res.status).toBe(401);
  });
});

/**
 * `Db.getDbConnection` swapped rather than a connection seeded, for the same
 * reason `webhook-mount.test.ts` does it: `configMiddleware` opens its own
 * `infraStore.runAsync` scope that a test cannot reach from outside.
 */
describe("configMiddleware wraps the whatsapp webhook too", () => {
  const originalGetDbConnection = Db.getDbConnection;
  afterEach(() => {
    Db.getDbConnection = originalGetDbConnection;
  });

  function captureDatabaseUse() {
    const seen = { asked: 0, insideInfraScope: [] as boolean[] };

    const query: Record<string, unknown> = {
      then(resolve: (rows: unknown[]) => void) {
        resolve([]);
      },
    };
    for (const step of ["from", "where", "orderBy", "limit"]) {
      query[step] = () => query;
    }

    Db.getDbConnection = () => {
      seen.asked += 1;
      // The discriminator: without `configMiddleware` in front of this
      // route, the real `getDbConnection` would fall through to
      // `infraStore.getConnectionString()` and throw "[infra-store] not
      // initialized" instead of ever reaching this fake.
      seen.insideInfraScope.push(infraStore.isInContext());
      return { drizzleDbClient: { select: () => query }, postgresDbClient: {} } as never;
    };

    return seen;
  }

  it("queries the database from inside a request scope for a signed text message", async () => {
    const info = spyOn(console, "info").mockImplementation(() => {});
    const seen = captureDatabaseUse();
    try {
      // No account matches the empty rows the fake returns, so the command
      // decides "no-account" and replies through the console adapter
      // (STAGE=local, no WhatsApp credentials configured) — no network call.
      const res = await app.request(
        "/api/webhooks/whatsapp",
        {
          method: "POST",
          body: TEXT_MESSAGE,
          headers: { "content-type": "application/json", "x-hub-signature-256": sign(TEXT_MESSAGE) },
        },
        ENV,
      );

      expect(res.status).toBe(200);
      // The whole point: not "a connection was returned" — this fake hands
      // one over unconditionally — but "the code asking for it was inside
      // the scope that would have supplied a real one".
      expect(seen.asked).toBeGreaterThan(0);
      expect(seen.insideInfraScope).not.toContain(false);
    } finally {
      info.mockRestore();
    }
  });
});
