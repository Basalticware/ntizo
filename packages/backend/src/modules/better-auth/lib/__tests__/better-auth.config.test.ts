import { describe, expect, it } from "bun:test";
import { infraStore } from "../../../../shared/infrastructure/stores/infra-store";
import { getAuth } from "../better-auth";

// Building the instance touches no database: the drizzle handle is a lazy
// proxy that resolves on first query. It does read the request-scoped env.
const TEST_ENV = {
  STAGE: "local" as const,
  LOG_LEVEL: "info",
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  BETTER_AUTH_SECRET: "s",
  RESEND_API_KEY: "",
  EMAIL_FROM: "a@b.c",
  APP_URL: "https://ntizo.test",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
};

describe("better-auth configuration", () => {
  it("keeps a verification link valid for 24 hours, not better-auth's default hour", async () => {
    // One hour was never chosen, only inherited. A QA tester's three accounts
    // were locked out because the links had lapsed before anyone opened them —
    // a mail read the next morning should still work.
    const auth = await infraStore.runAsync(TEST_ENV, async () => getAuth());
    expect(auth.options.emailVerification?.expiresIn).toBe(24 * 60 * 60);
  });
});
