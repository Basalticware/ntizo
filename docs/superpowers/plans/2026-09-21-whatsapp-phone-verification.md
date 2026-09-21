# Confirming a Phone Number by WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SMS code on `/verify-phone` with a free flow in which the person sends a pre-filled WhatsApp message carrying a code, a signed Meta webhook confirms the account whose number is the sender, and every email-confirmation link invites the person to do it once.

**Architecture:**
- **The `user` context owns the phone.** It gains two commands:
  - `StartPhoneVerificationCommand` issues a code into better-auth's `verification` table.
  - `ConfirmPhoneFromWhatsAppInternalCommand` matches an inbound message to an account, confirms it and replies.
- **The webhook decision is framework-free**, in `write/user/http/`, copying the Resend webhook. Hono only binds it in `apps/backend/api/src/webhooks.ts`.
- **The web** rebuilds `/verify-phone` on the site's visual rules around a `usePhoneVerification` viewmodel that issues the code, builds a `wa.me` link and polls the session.

**Tech Stack:**
- Backend: Bun, Hono on Cloudflare Workers, Drizzle and Postgres, better-auth 1.6.2, onion-lasagna GraphQL, `bun:test`.
- Web: React 19, TanStack Router and Query, i18next, Vitest with Testing Library.
- Meta: the WhatsApp Cloud API on Graph `v25.0`.

**Spec:** `docs/superpowers/specs/2026-09-21-whatsapp-phone-verification-design.md`. The approved mockup sits next to it: `2026-09-21-whatsapp-phone-verification.mockup.html`.

## Global Constraints

**The code**
- Six digits, valid for 15 minutes, one per account, bound to the E.164 number it was issued for.
- Stored in `better_auth.verification` with `identifier = "whatsapp-phone:<userId>"` and `value = "<code>:<E.164>"`. No migration.
- It is the first run of exactly six digits standing alone in the message text.

**Confirming**
- The confirming write is `UPDATE better_auth.user SET phone_number_verified = true WHERE id = $user AND phone_number = $issuedFor`.
- The account is found by the sender (`"+" + Meta's from`), never by the code.
- Outcome order: no code in the text → `"no-code"`; no account with that number → `"no-account"`; account already verified → `"already-confirmed"`; pending code missing, wrong, expired or issued for another number, or the conditional write changed nothing → `"invalid-code"`; otherwise `"confirmed"`.

**Replies**
- Portuguese for `pt-MZ`, `pt-PT` and unknown; English for every other locale. "No account" is always Portuguese.
- The help address comes from `CONTACT_INBOX_EMAIL`, falling back to `ola@ntizo.co.mz`.
- A failed reply is logged with `console.error` and never thrown.

**Errors (public contract)**
- `PHONE_NUMBER_MISSING` (UnprocessableError)
- `PHONE_NUMBER_ALREADY_VERIFIED` (ConflictError)
- `PHONE_VERIFICATION_UNAVAILABLE` (UnprocessableError)

**Webhook**
- `GET` and `POST /api/webhooks/whatsapp`, mounted before `authCors` and inside `configMiddleware`, with a 3 MiB body limit.
- The signature is `X-Hub-Signature-256: sha256=<hex HMAC-SHA256(app secret, raw body)>`, checked with `crypto.subtle.verify` before parsing.
- Status codes:
  - 500: secret or verify token missing;
  - 401: bad or missing signature;
  - 403: wrong verify token;
  - 200: everything decided.

**Configuration**
- Vars: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_NUMBER`. These two and `WHATSAPP_ACCESS_TOKEN` live on `InfraEnvBindings`, because `packages/backend` reads them.
- Secrets: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`. The last two live on `AppBindings` only.
- Never a real value anywhere in the repo.
- The start command is "available" when `WHATSAPP_BUSINESS_NUMBER` is non-empty.

**Sending**
- `POST https://graph.facebook.com/v25.0/{WHATSAPP_PHONE_NUMBER_ID}/messages` with `Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}`.
- Body: `{ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body } }`.

**Web**
- The primary action is a real `<a href="https://wa.me/<digits>?text=<encoded>" target="_blank" rel="noopener noreferrer">`. The code is issued when the page loads.
- Polling every 3000 ms, and on `focus` or `visibilitychange`, with `authClient.getSession({ query: { disableCookieCache: true } })`. On confirmation, `authClient.$store.notify("$sessionSignal")`.
- Styling: white page, `--color-headline` headings, navy primary (`--color-navy-surface` / `--color-navy-on`), hairlines, no card, no tinted icon circle, no blue of the page's own. Icons come from `lucide-react`: `MessageCircle`, `CircleCheck`, `CircleAlert`, `Check`.
- The invite: every email-confirmation `callbackURL` becomes `${origin}/verify-phone?next=<encodeURIComponent(safe next or "/")>`.

**Repository rules**
- Do not touch `AuthLayout`, forgot-password, reset-password or accept-invite.
- Keep better-auth's `sendOTP` and `SmsServicePort`.
- No Hono in `packages/backend`; the fitness tests enforce it.
- Stage files by name. Never `git add -A`: another session edits the main checkout.
- Every commit ends with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

**Commands (run from the worktree root `.claude/worktrees/whatsapp-phone-verification` unless stated)**
- Backend test: `cd packages/backend && bun test <path>`
- API test: `cd apps/backend/api && bun test <path>`
- Web test: `cd apps/frontend/web && npx vitest run <path>`
- Everything: `bun run test`, `bun run check-types`, `bun run lint`

---

### Task 1: The code and the three refusals (user domain)

**Files:**
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/domain/value-objects/verification-code.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/domain/value-objects/__tests__/verification-code.test.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/domain/exceptions/phone-verification.exceptions.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/domain/exceptions/__tests__/phone-verification.exceptions.test.ts`
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/user/domain/exceptions/index.ts` (append one re-export)

**Interfaces:**
- Produces:
  - `generateVerificationCode(random?: RandomSource): string`
  - `extractVerificationCode(text: string | null): string | null`
  - `type RandomSource = (buffer: Uint32Array) => Uint32Array`
  - `PhoneNumberMissingError`, `PhoneNumberAlreadyVerifiedError`, `PhoneVerificationUnavailableError`, all with no constructor arguments.

- [ ] **Step 1: Prepare the worktree**

The worktree has no env files, and the database-backed tests in Task 3 read `DEV_DB_URL` from `packages/backend/.env`:

```bash
cp ../../../packages/backend/.env packages/backend/.env
cp ../../../apps/backend/api/.env apps/backend/api/.env
cp ../../../apps/backend/api/.dev.vars apps/backend/api/.dev.vars
bun install
git status --porcelain   # the three files are git-ignored; expect no output
```

- [ ] **Step 2: Write the failing tests**

`packages/backend/src/modules/ntizo/bounded-contexts/user/domain/value-objects/__tests__/verification-code.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { extractVerificationCode, generateVerificationCode } from "../verification-code";

describe("generateVerificationCode", () => {
  it("is always six digits, keeping leading zeros", () => {
    const code = generateVerificationCode((buffer) => {
      buffer[0] = 42;
      return buffer;
    });
    expect(code).toBe("000042");
  });

  it("discards a draw that would bias the result and draws again", () => {
    // 4_294_967_295 is above the largest multiple of 1_000_000 that fits in a
    // uint32 (4_294_000_000); taking it modulo would favour low codes.
    const draws = [4_294_967_295, 7];
    const code = generateVerificationCode((buffer) => {
      buffer[0] = draws.shift()!;
      return buffer;
    });
    expect(code).toBe("000007");
    expect(draws).toEqual([]);
  });

  it("uses the platform's cryptographic source by default", () => {
    for (let i = 0; i < 50; i++) expect(generateVerificationCode()).toMatch(/^\d{6}$/);
  });
});

describe("extractVerificationCode", () => {
  it("finds the code in the pre-filled Portuguese message", () => {
    expect(extractVerificationCode("Olá Ntizo! O meu código de confirmação é 483920")).toBe("483920");
  });

  it("finds it whatever language the message was written in", () => {
    expect(extractVerificationCode("Hi Ntizo! My confirmation code is 012345")).toBe("012345");
  });

  it("does not take six digits out of a longer number", () => {
    expect(extractVerificationCode("ligue-me para 258879801517")).toBeNull();
  });

  it("returns null when there is no code", () => {
    expect(extractVerificationCode("Olá")).toBeNull();
  });

  it("returns null when there is no text at all", () => {
    expect(extractVerificationCode(null)).toBeNull();
  });
});
```

`packages/backend/src/modules/ntizo/bounded-contexts/user/domain/exceptions/__tests__/phone-verification.exceptions.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { ConflictError, UnprocessableError } from "@cosmneo/onion-lasagna";
import {
  PhoneNumberAlreadyVerifiedError,
  PhoneNumberMissingError,
  PhoneVerificationUnavailableError,
} from "..";

// The codes are a public contract: the web branches on them.
describe("phone verification refusals", () => {
  it("names a missing number", () => {
    const error = new PhoneNumberMissingError();
    expect(error).toBeInstanceOf(UnprocessableError);
    expect(error.code).toBe("PHONE_NUMBER_MISSING");
  });

  it("names a number that is already confirmed", () => {
    const error = new PhoneNumberAlreadyVerifiedError();
    expect(error).toBeInstanceOf(ConflictError);
    expect(error.code).toBe("PHONE_NUMBER_ALREADY_VERIFIED");
  });

  it("names a stage with no WhatsApp configured", () => {
    const error = new PhoneVerificationUnavailableError();
    expect(error).toBeInstanceOf(UnprocessableError);
    expect(error.code).toBe("PHONE_VERIFICATION_UNAVAILABLE");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd packages/backend && bun test src/modules/ntizo/bounded-contexts/user/domain`
Expected: FAIL, because `../verification-code` does not exist and the three errors are not exported.

- [ ] **Step 4: Write the implementation**

`packages/backend/src/modules/ntizo/bounded-contexts/user/domain/value-objects/verification-code.ts`:

```ts
/**
 * The six digits a person sends us from WhatsApp to prove they hold a number.
 *
 * Six, because the SMS code this replaces was six and the person reads it
 * once, inside a message that was typed for them.
 */
export const VERIFICATION_CODE_LENGTH = 6;

const SPACE = 10 ** VERIFICATION_CODE_LENGTH;

/**
 * The largest multiple of `SPACE` a uint32 can hold. A draw at or above it is
 * thrown away: taking it modulo `SPACE` would make the low codes slightly more
 * likely than the high ones.
 */
const LIMIT = Math.floor(0x1_0000_0000 / SPACE) * SPACE;

export type RandomSource = (buffer: Uint32Array) => Uint32Array;

const cryptoRandom: RandomSource = (buffer) => crypto.getRandomValues(buffer);

export function generateVerificationCode(random: RandomSource = cryptoRandom): string {
  const buffer = new Uint32Array(1);
  for (;;) {
    const [draw] = random(buffer);
    if (draw !== undefined && draw < LIMIT) {
      return String(draw % SPACE).padStart(VERIFICATION_CODE_LENGTH, "0");
    }
  }
}

/**
 * The code inside a message, whatever language the rest of it is in.
 *
 * Six digits standing alone, so a phone number typed into the chat never
 * yields six of its digits as a code.
 */
export function extractVerificationCode(text: string | null): string | null {
  if (!text) return null;
  return text.match(/(?<!\d)\d{6}(?!\d)/)?.[0] ?? null;
}
```

`packages/backend/src/modules/ntizo/bounded-contexts/user/domain/exceptions/phone-verification.exceptions.ts`:

```ts
import { ConflictError, UnprocessableError } from "@cosmneo/onion-lasagna";

/**
 * Refusals of "confirm my number by WhatsApp".
 *
 * The `code` strings are a PUBLIC CONTRACT: the verification screen branches
 * on them, and on `PHONE_VERIFICATION_UNAVAILABLE` it steps aside silently
 * instead of showing an error.
 */

export class PhoneNumberMissingError extends UnprocessableError {
  constructor() {
    super({ message: "This account has no phone number to confirm.", code: "PHONE_NUMBER_MISSING" });
    this.name = "PhoneNumberMissingError";
  }
}

export class PhoneNumberAlreadyVerifiedError extends ConflictError {
  constructor() {
    super({ message: "This phone number is already confirmed.", code: "PHONE_NUMBER_ALREADY_VERIFIED" });
    this.name = "PhoneNumberAlreadyVerifiedError";
  }
}

/**
 * The stage has no WhatsApp number configured, so a code issued now could
 * never be sent anywhere. qa and prod run this code before the SIM exists.
 */
export class PhoneVerificationUnavailableError extends UnprocessableError {
  constructor() {
    super({
      message: "Phone confirmation by WhatsApp is not configured on this stage.",
      code: "PHONE_VERIFICATION_UNAVAILABLE",
    });
    this.name = "PhoneVerificationUnavailableError";
  }
}
```

Append to `packages/backend/src/modules/ntizo/bounded-contexts/user/domain/exceptions/index.ts`:

```ts
export * from "./phone-verification.exceptions";
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/backend && bun test src/modules/ntizo/bounded-contexts/user/domain`
Expected: PASS, the 8 new tests plus the existing domain tests.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/modules/ntizo/bounded-contexts/user/domain/value-objects/verification-code.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/domain/value-objects/__tests__/verification-code.test.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/domain/exceptions/phone-verification.exceptions.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/domain/exceptions/__tests__/phone-verification.exceptions.test.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/domain/exceptions/index.ts
git commit -m "feat(user): the six-digit code a person sends from WhatsApp, and its three refusals

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: A WhatsApp sender, and the env that configures it

**Files:**
- Create: `packages/backend/src/shared/infrastructure/whatsapp/whatsapp-messenger.port.ts`
- Create: `packages/backend/src/shared/infrastructure/whatsapp/cloud-api-whatsapp-messenger.adapter.ts`
- Create: `packages/backend/src/shared/infrastructure/whatsapp/console-whatsapp-messenger.adapter.ts`
- Create: `packages/backend/src/shared/infrastructure/whatsapp/resolve-whatsapp-messenger.ts`
- Create: `packages/backend/src/shared/infrastructure/whatsapp/index.ts`
- Create: `packages/backend/src/shared/infrastructure/whatsapp/__tests__/whatsapp-messenger.test.ts`
- Modify: `packages/backend/src/shared/infrastructure/stores/infra-store.ts` (the `InfraEnvBindings` interface)
- Modify: `apps/backend/api/src/middlewares/config.middleware.ts` (the object passed to `infraStore.runAsync`)
- Modify: `apps/backend/api/src/infra-env.ts` (`toInfraEnv`)

**Interfaces:**
- Produces:
  - `interface WhatsAppMessengerPort { sendText(to: string, body: string): Promise<void> }`
  - `class CloudApiWhatsAppMessengerAdapter(config: { accessToken: string; phoneNumberId: string }, fetchFn?: typeof fetch)`
  - `class ConsoleWhatsAppMessengerAdapter`
  - `resolveWhatsAppMessenger(): WhatsAppMessengerPort`
  - `class LazyWhatsAppMessenger implements WhatsAppMessengerPort`
  - `WHATSAPP_GRAPH_API_VERSION = "v25.0"`
  - `InfraEnvBindings` gains `WHATSAPP_ACCESS_TOKEN?`, `WHATSAPP_PHONE_NUMBER_ID?` and `WHATSAPP_BUSINESS_NUMBER?`, all `string`.

- [ ] **Step 1: Write the failing tests**

`packages/backend/src/shared/infrastructure/whatsapp/__tests__/whatsapp-messenger.test.ts`:

```ts
import { describe, expect, it, spyOn } from "bun:test";
import { infraStore, type InfraEnvBindings } from "../../stores/infra-store";
import {
  CloudApiWhatsAppMessengerAdapter,
  ConsoleWhatsAppMessengerAdapter,
  resolveWhatsAppMessenger,
  WHATSAPP_GRAPH_API_VERSION,
} from "..";

const BASE_ENV: InfraEnvBindings = {
  STAGE: "local",
  LOG_LEVEL: "info",
  DATABASE_URL: "",
  BETTER_AUTH_SECRET: "x",
  RESEND_API_KEY: "",
  EMAIL_FROM: "x",
  APP_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
};

describe("CloudApiWhatsAppMessengerAdapter", () => {
  it("sends one text message through the Graph API with the bearer token", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 });
    }) as unknown as typeof fetch;

    await new CloudApiWhatsAppMessengerAdapter(
      { accessToken: "token-1", phoneNumberId: "1234" },
      fakeFetch,
    ).sendText("+258879801517", "✅ Número confirmado.");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(`https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}/1234/messages`);
    expect(calls[0]!.init.method).toBe("POST");
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer token-1");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "+258879801517",
      type: "text",
      text: { body: "✅ Número confirmado." },
    });
  });

  it("throws when Meta refuses the message", async () => {
    const fakeFetch = (async () =>
      new Response('{"error":{"message":"Invalid OAuth access token"}}', { status: 401 })) as unknown as typeof fetch;

    await expect(
      new CloudApiWhatsAppMessengerAdapter({ accessToken: "bad", phoneNumberId: "1234" }, fakeFetch).sendText(
        "+258879801517",
        "x",
      ),
    ).rejects.toThrow("401");
  });
});

describe("ConsoleWhatsAppMessengerAdapter", () => {
  it("prints the reply instead of sending it", async () => {
    const info = spyOn(console, "info").mockImplementation(() => {});
    await new ConsoleWhatsAppMessengerAdapter().sendText("+258879801517", "✅ Número confirmado.");
    const printed = info.mock.calls.map((c) => String(c[0])).join("\n");
    info.mockRestore();
    expect(printed).toContain("+258879801517");
    expect(printed).toContain("✅ Número confirmado.");
  });
});

describe("resolveWhatsAppMessenger", () => {
  it("uses the Cloud API when the token and the number id are both set", async () => {
    await infraStore.runAsync(
      { ...BASE_ENV, STAGE: "dev", WHATSAPP_ACCESS_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1" },
      async () => {
        expect(resolveWhatsAppMessenger()).toBeInstanceOf(CloudApiWhatsAppMessengerAdapter);
      },
    );
  });

  it("prints to the terminal on a local run without them", async () => {
    await infraStore.runAsync({ ...BASE_ENV, STAGE: "local" }, async () => {
      expect(resolveWhatsAppMessenger()).toBeInstanceOf(ConsoleWhatsAppMessengerAdapter);
    });
  });

  it("refuses on a deployed stage without them rather than dropping replies", async () => {
    await infraStore.runAsync({ ...BASE_ENV, STAGE: "qa" }, async () => {
      expect(() => resolveWhatsAppMessenger()).toThrow("WHATSAPP_ACCESS_TOKEN");
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/backend && bun test src/shared/infrastructure/whatsapp`
Expected: FAIL, because the module `..` does not exist.

- [ ] **Step 3: Add the three env fields**

In `packages/backend/src/shared/infrastructure/stores/infra-store.ts`, add inside `InfraEnvBindings`, right after `CONTACT_INBOX_EMAIL?: string;`:

```ts
  /**
   * The WhatsApp Cloud API, read by the phone confirmation in the user
   * context: the number the web opens a chat with, the id Meta gives that
   * number, and the token that lets us reply from it.
   *
   * Optional for the same reason the M-Pesa ones are: a local run, a script
   * and every test that builds this shape have none, and each reader says
   * what happens then. No business number means the start command refuses
   * with `PHONE_VERIFICATION_UNAVAILABLE`; no token means replies print to
   * the terminal locally and fail (logged, not thrown) on a deployed stage.
   *
   * `WHATSAPP_ACCESS_TOKEN` is a secret, set with `wrangler secret put`. The
   * other two are configuration and live in `wrangler.jsonc`. The webhook's
   * own two secrets are on `AppBindings`, because only the Hono binding
   * reads them.
   */
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  /** E.164, e.g. `+258843002020`. */
  WHATSAPP_BUSINESS_NUMBER?: string;
```

In `apps/backend/api/src/middlewares/config.middleware.ts`, after `CONTACT_INBOX_EMAIL: env.CONTACT_INBOX_EMAIL,` add:

```ts
      WHATSAPP_ACCESS_TOKEN: env.WHATSAPP_ACCESS_TOKEN,
      WHATSAPP_PHONE_NUMBER_ID: env.WHATSAPP_PHONE_NUMBER_ID,
      WHATSAPP_BUSINESS_NUMBER: env.WHATSAPP_BUSINESS_NUMBER,
```

In `apps/backend/api/src/infra-env.ts`, after `CONTACT_INBOX_EMAIL: env.CONTACT_INBOX_EMAIL,` add the same three lines.

- [ ] **Step 4: Write the sender**

`packages/backend/src/shared/infrastructure/whatsapp/whatsapp-messenger.port.ts`:

```ts
/**
 * Sends a free-form text message on WhatsApp.
 *
 * Only ever used to answer a message the person sent us first, which is what
 * keeps it free: a non-template message inside the 24-hour window that their
 * message opened is not charged.
 */
export interface WhatsAppMessengerPort {
  /** `to` in E.164 (`+258879801517`). Throws when the message was not accepted. */
  sendText(to: string, body: string): Promise<void>;
}
```

`packages/backend/src/shared/infrastructure/whatsapp/cloud-api-whatsapp-messenger.adapter.ts`:

```ts
import type { WhatsAppMessengerPort } from "./whatsapp-messenger.port";

/** Pinned rather than "latest": a version bump is a deliberate edit, not a surprise. */
export const WHATSAPP_GRAPH_API_VERSION = "v25.0";

export class CloudApiWhatsAppMessengerAdapter implements WhatsAppMessengerPort {
  /** `fetchFn` is injectable so the request shape is testable; production passes nothing. */
  constructor(
    private readonly config: { accessToken: string; phoneNumberId: string },
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async sendText(to: string, body: string): Promise<void> {
    const res = await this.fetchFn(
      `https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}/${this.config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { body },
        }),
      },
    );
    if (!res.ok) {
      // The status and Meta's own explanation; never the recipient or the body.
      throw new Error(`[whatsapp] Meta refused the message: ${res.status} ${await res.text()}`);
    }
  }
}
```

`packages/backend/src/shared/infrastructure/whatsapp/console-whatsapp-messenger.adapter.ts`:

```ts
import type { WhatsAppMessengerPort } from "./whatsapp-messenger.port";

/**
 * Local-development sender. Prints the reply instead of sending it, so the
 * whole confirmation can be exercised with `scripts/simulate-whatsapp-message.ts`
 * and no Meta account.
 */
export class ConsoleWhatsAppMessengerAdapter implements WhatsAppMessengerPort {
  async sendText(to: string, body: string): Promise<void> {
    console.info(
      [
        "",
        "┌─────────────────────────────────────────────────────────────",
        "│ WhatsApp (console adapter — nothing was actually sent)",
        `│ to   : ${to}`,
        `│ body : ${body}`,
        "└─────────────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
  }
}
```

`packages/backend/src/shared/infrastructure/whatsapp/resolve-whatsapp-messenger.ts`:

```ts
import { infraStore } from "../stores/infra-store";
import { CloudApiWhatsAppMessengerAdapter } from "./cloud-api-whatsapp-messenger.adapter";
import { ConsoleWhatsAppMessengerAdapter } from "./console-whatsapp-messenger.adapter";
import type { WhatsAppMessengerPort } from "./whatsapp-messenger.port";

/**
 * Picks the sender from the request-scoped env, the way `resolveEmailService`
 * picks the mail adapter. Must be called from inside a request.
 */
export function resolveWhatsAppMessenger(): WhatsAppMessengerPort {
  const env = infraStore.getEnv();
  const stage = env.STAGE ?? "local";

  if (env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID) {
    return new CloudApiWhatsAppMessengerAdapter({
      accessToken: env.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    });
  }

  if (stage !== "local") {
    throw new Error(
      `[whatsapp] WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are required when STAGE="${stage}".`,
    );
  }

  return new ConsoleWhatsAppMessengerAdapter();
}

/** Resolves on every send, so the check runs against the current request's env. */
export class LazyWhatsAppMessenger implements WhatsAppMessengerPort {
  async sendText(to: string, body: string): Promise<void> {
    await resolveWhatsAppMessenger().sendText(to, body);
  }
}
```

`packages/backend/src/shared/infrastructure/whatsapp/index.ts`:

```ts
export type { WhatsAppMessengerPort } from "./whatsapp-messenger.port";
export {
  CloudApiWhatsAppMessengerAdapter,
  WHATSAPP_GRAPH_API_VERSION,
} from "./cloud-api-whatsapp-messenger.adapter";
export { ConsoleWhatsAppMessengerAdapter } from "./console-whatsapp-messenger.adapter";
export { LazyWhatsAppMessenger, resolveWhatsAppMessenger } from "./resolve-whatsapp-messenger";
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/backend && bun test src/shared/infrastructure/whatsapp`
Expected: PASS (6 tests).

Run: `bun run check-types`
Expected: PASS, and `config.middleware.ts` and `infra-env.ts` compile against the widened interface.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/shared/infrastructure/whatsapp \
  packages/backend/src/shared/infrastructure/stores/infra-store.ts \
  apps/backend/api/src/middlewares/config.middleware.ts apps/backend/api/src/infra-env.ts
git commit -m "feat(whatsapp): a sender for free-form replies, on the Cloud API or the terminal

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Reading and writing the number and the pending code

**Files:**
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/outbound/auth-identity.port.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/outbound/phone-verification-code-store.port.ts`
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/outbound/index.ts`
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/better-auth-identity.adapter.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/better-auth-phone-verification-code.store.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/__tests__/phone-verification-persistence.db.test.ts`
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/user/app/use-cases/__tests__/update-my-profile.command.test.ts` (its identity fakes must satisfy the widened port)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `AuthIdentityPort.findPhoneOf(userId: string): Promise<{ phoneNumber: string; verified: boolean } | null>`. It returns null when the account has no number.
  - `AuthIdentityPort.findByPhoneNumber(phoneNumber: string): Promise<{ userId: string; verified: boolean } | null>`
  - `AuthIdentityPort.markPhoneNumberVerified(userId: string, issuedFor: string): Promise<boolean>`
  - `interface PendingPhoneVerification { code: string; phoneNumber: string; expiresAt: Date }`
  - `interface PhoneVerificationCodeStorePort { replace(userId, pending): Promise<void>; find(userId): Promise<PendingPhoneVerification | null>; delete(userId): Promise<void> }`
  - `new BetterAuthIdentityAdapter(update?, db?)` and `new BetterAuthPhoneVerificationCodeStore(db?)`. `db` is a `() => AuthDb` getter defaulting to `getDb`.

- [ ] **Step 1: Write the failing database test**

These run against a real Postgres, as the database tests in `modules/ntizo/shared/infrastructure/database/__tests__/` do. Locally that is `DEV_DB_URL` from `packages/backend/.env`; in CI it is the throwaway container.

`packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/__tests__/phone-verification-persistence.db.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  user as authUser,
  verification,
} from "../../../../../../better-auth/infrastructure/database/schema";
import {
  bestEffortCleanup,
  DEV_DB_COLD_START_TIMEOUT_MS,
  openDevDbConnection,
} from "../../../../../shared/infrastructure/database/__tests__/dev-db-test-connection";
import { BetterAuthIdentityAdapter } from "../better-auth-identity.adapter";
import { BetterAuthPhoneVerificationCodeStore } from "../better-auth-phone-verification-code.store";

setDefaultTimeout(DEV_DB_COLD_START_TIMEOUT_MS);

const sql = openDevDbConnection();
const db = drizzle(sql);
const getDb = () => db as never;

const suffix = crypto.randomUUID().slice(0, 8);
const userId = `wa-test-${suffix}`;
// A number no real account can hold: +258 99 is not an allocated range.
const phone = `+25899${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;

const identity = new BetterAuthIdentityAdapter(undefined, getDb);
const codes = new BetterAuthPhoneVerificationCodeStore(getDb);

beforeAll(async () => {
  await db.insert(authUser).values({
    id: userId,
    name: "WhatsApp Test",
    email: `${userId}@ntizo.test`,
    phoneNumber: phone,
    phoneNumberVerified: false,
  });
});

afterAll(async () => {
  await bestEffortCleanup([
    () => db.delete(verification).where(like(verification.identifier, `whatsapp-phone:${userId}`)),
    () => db.delete(authUser).where(eq(authUser.id, userId)),
    () => sql.end({ timeout: 5 }),
  ]);
});

describe("BetterAuthIdentityAdapter, phone confirmation", () => {
  test("reads the number and whether it is confirmed", async () => {
    expect(await identity.findPhoneOf(userId)).toEqual({ phoneNumber: phone, verified: false });
    expect(await identity.findByPhoneNumber(phone)).toEqual({ userId, verified: false });
  });

  test("finds nobody for a number no account holds, and nothing for an unknown account", async () => {
    expect(await identity.findByPhoneNumber("+258990000000")).toBeNull();
    expect(await identity.findPhoneOf(`missing-${suffix}`)).toBeNull();
  });

  test("does not confirm when the account's number is no longer the one the code was issued for", async () => {
    expect(await identity.markPhoneNumberVerified(userId, "+258990000001")).toBe(false);
    expect((await identity.findPhoneOf(userId))?.verified).toBe(false);
  });

  test("confirms when the number still matches", async () => {
    expect(await identity.markPhoneNumberVerified(userId, phone)).toBe(true);
    expect(await identity.findByPhoneNumber(phone)).toEqual({ userId, verified: true });
  });
});

describe("BetterAuthPhoneVerificationCodeStore", () => {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  test("keeps one pending code per account, the latest", async () => {
    await codes.replace(userId, { code: "111111", phoneNumber: phone, expiresAt });
    await codes.replace(userId, { code: "222222", phoneNumber: phone, expiresAt });

    const rows = await db
      .select()
      .from(verification)
      .where(eq(verification.identifier, `whatsapp-phone:${userId}`));
    expect(rows).toHaveLength(1);

    const pending = await codes.find(userId);
    expect(pending?.code).toBe("222222");
    expect(pending?.phoneNumber).toBe(phone);
    expect(pending?.expiresAt.getTime()).toBe(expiresAt.getTime());
  });

  test("forgets the code once it is used", async () => {
    await codes.delete(userId);
    expect(await codes.find(userId)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/backend && bun test src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/__tests__/phone-verification-persistence.db.test.ts`
Expected: FAIL, because `better-auth-phone-verification-code.store` does not exist and `BetterAuthIdentityAdapter` has no `findPhoneOf`.

- [ ] **Step 3: Widen the ports**

Replace the body of `packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/outbound/auth-identity.port.ts` with:

```ts
/**
 * The user's login identity, as far as this context needs to touch it.
 *
 * A port rather than a direct write because the auth identity lives in another
 * module's tables. The use case depends on this interface and knows nothing
 * about better-auth; exactly one adapter knows, and says so.
 */
export interface AuthIdentityPort {
  /**
   * Writes the number onto the auth identity and clears its verified flag.
   *
   * Both in one statement, always: a number and a stale "verified" belong to
   * different phones the moment they are written separately and something
   * fails in between.
   *
   * @param phoneNumber E.164, or null to release the number.
   * @throws {PhoneNumberAlreadyInUseError} when another account holds it.
   */
  setPhoneNumber(userId: string, phoneNumber: string | null): Promise<void>;

  /** The account's number and whether it is confirmed, or null when it has none. */
  findPhoneOf(userId: string): Promise<{ phoneNumber: string; verified: boolean } | null>;

  /** Whose number this is. The column is unique, so there is at most one. */
  findByPhoneNumber(phoneNumber: string): Promise<{ userId: string; verified: boolean } | null>;

  /**
   * Confirms the number, but only if the account still holds `issuedFor`.
   *
   * Conditional in the statement itself, so a number changed between asking
   * for a code and sending it cannot end up confirmed by a message from the
   * old one. Returns whether a row changed.
   */
  markPhoneNumberVerified(userId: string, issuedFor: string): Promise<boolean>;
}
```

`packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/outbound/phone-verification-code-store.port.ts`:

```ts
/** A code waiting to arrive from WhatsApp. */
export interface PendingPhoneVerification {
  code: string;
  /** The E.164 number the code was issued for. */
  phoneNumber: string;
  expiresAt: Date;
}

/** One pending code per account: issuing a new one replaces the old. */
export interface PhoneVerificationCodeStorePort {
  replace(userId: string, pending: PendingPhoneVerification): Promise<void>;
  find(userId: string): Promise<PendingPhoneVerification | null>;
  delete(userId: string): Promise<void>;
}
```

Append to `packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/outbound/index.ts`:

```ts
export type {
  PendingPhoneVerification,
  PhoneVerificationCodeStorePort,
} from "./phone-verification-code-store.port";
```

- [ ] **Step 4: Implement the adapters**

In `packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/better-auth-identity.adapter.ts`:
- change the drizzle import to `import { and, eq } from "drizzle-orm";`
- add `type AuthDb = ReturnType<typeof getDb>;` below the `UpdateFn` type
- replace the class with:

```ts
export class BetterAuthIdentityAdapter implements AuthIdentityPort {
  /**
   * `update` is injectable so the error mapping can be tested without a
   * database; `db` so the reads and the conditional write can be tested
   * against a real one. Production passes neither.
   */
  constructor(
    private readonly update: UpdateFn = async (userId, phoneNumber, verified) => {
      await getDb()
        .update(authUser)
        .set({ phoneNumber, phoneNumberVerified: verified })
        .where(eq(authUser.id, userId));
    },
    private readonly db: () => AuthDb = getDb,
  ) {}

  async setPhoneNumber(userId: string, phoneNumber: string | null): Promise<void> {
    try {
      await this.update(userId, phoneNumber, false);
    } catch (error) {
      // Only this one is translated. Anything else is an infrastructure
      // failure and must not arrive at the browser dressed as a rejected
      // phone number.
      if (isUniqueViolation(error)) throw new PhoneNumberAlreadyInUseError();
      throw error;
    }
  }

  async findPhoneOf(userId: string): Promise<{ phoneNumber: string; verified: boolean } | null> {
    const [row] = await this.db()
      .select({ phoneNumber: authUser.phoneNumber, verified: authUser.phoneNumberVerified })
      .from(authUser)
      .where(eq(authUser.id, userId))
      .limit(1);
    if (!row?.phoneNumber) return null;
    return { phoneNumber: row.phoneNumber, verified: row.verified === true };
  }

  async findByPhoneNumber(phoneNumber: string): Promise<{ userId: string; verified: boolean } | null> {
    const [row] = await this.db()
      .select({ userId: authUser.id, verified: authUser.phoneNumberVerified })
      .from(authUser)
      .where(eq(authUser.phoneNumber, phoneNumber))
      .limit(1);
    return row ? { userId: row.userId, verified: row.verified === true } : null;
  }

  async markPhoneNumberVerified(userId: string, issuedFor: string): Promise<boolean> {
    const rows = await this.db()
      .update(authUser)
      .set({ phoneNumberVerified: true })
      .where(and(eq(authUser.id, userId), eq(authUser.phoneNumber, issuedFor)))
      .returning({ id: authUser.id });
    return rows.length > 0;
  }
}
```

`packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/better-auth-phone-verification-code.store.ts`:

```ts
import { desc, eq } from "drizzle-orm";
import type {
  PendingPhoneVerification,
  PhoneVerificationCodeStorePort,
} from "../../app/ports/outbound";
import { getDb } from "../../../../../better-auth/infrastructure/client/drizzle";
import { verification } from "../../../../../better-auth/infrastructure/database/schema";

type AuthDb = ReturnType<typeof getDb>;

/**
 * Pending WhatsApp codes, in better-auth's own table for short-lived codes.
 *
 * The second (and last) contained crossing into better-auth's tables from
 * this context, beside `BetterAuthIdentityAdapter`. Reusing `verification`
 * costs no migration; the identifier prefix keeps these rows apart from
 * better-auth's email and OTP rows.
 */
export class BetterAuthPhoneVerificationCodeStore implements PhoneVerificationCodeStorePort {
  constructor(private readonly db: () => AuthDb = getDb) {}

  async replace(userId: string, pending: PendingPhoneVerification): Promise<void> {
    const identifier = identifierFor(userId);
    await this.db().delete(verification).where(eq(verification.identifier, identifier));
    await this.db().insert(verification).values({
      id: crypto.randomUUID(),
      identifier,
      value: `${pending.code}:${pending.phoneNumber}`,
      expiresAt: pending.expiresAt,
    });
  }

  async find(userId: string): Promise<PendingPhoneVerification | null> {
    const [row] = await this.db()
      .select({ value: verification.value, expiresAt: verification.expiresAt })
      .from(verification)
      .where(eq(verification.identifier, identifierFor(userId)))
      .orderBy(desc(verification.createdAt))
      .limit(1);
    if (!row) return null;
    const separator = row.value.indexOf(":");
    if (separator < 0) return null;
    return {
      code: row.value.slice(0, separator),
      phoneNumber: row.value.slice(separator + 1),
      expiresAt: row.expiresAt,
    };
  }

  async delete(userId: string): Promise<void> {
    await this.db().delete(verification).where(eq(verification.identifier, identifierFor(userId)));
  }
}

function identifierFor(userId: string): string {
  return `whatsapp-phone:${userId}`;
}
```

In `packages/backend/src/modules/ntizo/bounded-contexts/user/app/use-cases/__tests__/update-my-profile.command.test.ts`, both identity fakes are object literals with only `setPhoneNumber`. Add the three new methods to each, so the file still typechecks:

```ts
      findPhoneOf: async () => null,
      findByPhoneNumber: async () => null,
      markPhoneNumberVerified: async () => false,
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/backend && bun test src/modules/ntizo/bounded-contexts/user`
Expected: PASS: the 6 new database tests, plus every existing user test, including `better-auth-identity.adapter.test.ts` unchanged.

Run: `bun run check-types`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/outbound \
  packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/better-auth-identity.adapter.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/better-auth-phone-verification-code.store.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/__tests__/phone-verification-persistence.db.test.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/app/use-cases/__tests__/update-my-profile.command.test.ts
git commit -m "feat(user): read a number's owner, keep one pending code, confirm only the number it was issued for

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Starting a confirmation

**Files:**
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/outbound/phone-verification-channel.port.ts`
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/outbound/index.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/inbound/start-phone-verification.command.port.ts`
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/inbound/index.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/app/use-cases/start-phone-verification.command.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/app/use-cases/__tests__/start-phone-verification.command.test.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/env-phone-verification-channel.adapter.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/__tests__/env-phone-verification-channel.adapter.test.ts`

**Interfaces:**
- Consumes:
  - `generateVerificationCode` and the three errors (Task 1)
  - `AuthIdentityPort.findPhoneOf`, `PhoneVerificationCodeStorePort.replace` (Task 3)
- Produces:
  - `interface PhoneVerificationChannelPort { businessNumber(): string | null }`
  - `class EnvPhoneVerificationChannel implements PhoneVerificationChannelPort`
  - `interface PhoneVerificationTicket { code: string; businessNumber: string; expiresAt: Date }`
  - `interface StartPhoneVerificationPort { execute(ctx: ExecutionContext): Promise<PhoneVerificationTicket> }`
  - `class StartPhoneVerificationCommand(authIdentity, codeStore, channel, deps?: { now?: () => Date; generateCode?: () => string })`
  - `PHONE_VERIFICATION_TTL_MS = 15 * 60 * 1000`

- [ ] **Step 1: Write the failing tests**

`packages/backend/src/modules/ntizo/bounded-contexts/user/app/use-cases/__tests__/start-phone-verification.command.test.ts`:

```ts
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
      return opts.phone === undefined ? { phoneNumber: "+258879801517", verified: false } : opts.phone;
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
      { userId: "u1", pending: { code: "483920", phoneNumber: "+258879801517", expiresAt: ticket.expiresAt } },
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
    const { command, stored } = harness({ phone: { phoneNumber: "+258879801517", verified: true } });
    await expect(command.execute(ctx)).rejects.toBeInstanceOf(PhoneNumberAlreadyVerifiedError);
    expect(stored).toEqual([]);
  });

  it("refuses an anonymous caller", async () => {
    const { command } = harness({});
    const anonymous = { requester: { type: "anonymous" }, metadata: ctx.metadata } as unknown as ExecutionContext;
    await expect(command.execute(anonymous)).rejects.toThrow();
  });
});
```

`packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/__tests__/env-phone-verification-channel.adapter.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { infraStore, type InfraEnvBindings } from "../../../../../../../shared/infrastructure/stores/infra-store";
import { EnvPhoneVerificationChannel } from "../env-phone-verification-channel.adapter";

const ENV: InfraEnvBindings = {
  STAGE: "dev",
  LOG_LEVEL: "info",
  DATABASE_URL: "",
  BETTER_AUTH_SECRET: "x",
  RESEND_API_KEY: "",
  EMAIL_FROM: "x",
  APP_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
};

describe("EnvPhoneVerificationChannel", () => {
  it("answers with the configured number", async () => {
    await infraStore.runAsync({ ...ENV, WHATSAPP_BUSINESS_NUMBER: "+258843002020" }, async () => {
      expect(new EnvPhoneVerificationChannel().businessNumber()).toBe("+258843002020");
    });
  });

  it("treats an absent or blank value as not configured", async () => {
    await infraStore.runAsync(ENV, async () => {
      expect(new EnvPhoneVerificationChannel().businessNumber()).toBeNull();
    });
    await infraStore.runAsync({ ...ENV, WHATSAPP_BUSINESS_NUMBER: "  " }, async () => {
      expect(new EnvPhoneVerificationChannel().businessNumber()).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/backend && bun test src/modules/ntizo/bounded-contexts/user/app/use-cases/__tests__/start-phone-verification.command.test.ts src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/__tests__/env-phone-verification-channel.adapter.test.ts`
Expected: FAIL, because the modules do not exist.

- [ ] **Step 3: Write the ports, the command and the adapter**

`packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/outbound/phone-verification-channel.port.ts`:

```ts
/** The WhatsApp number people send their code to, when this stage has one. */
export interface PhoneVerificationChannelPort {
  /** E.164, or null when the stage is not configured. */
  businessNumber(): string | null;
}
```

Append to `app/ports/outbound/index.ts`:

```ts
export type { PhoneVerificationChannelPort } from "./phone-verification-channel.port";
```

`packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/inbound/start-phone-verification.command.port.ts`:

```ts
import type { ExecutionContext } from "../../../../../shared/infrastructure/execution-context";

/** What the screen needs to open WhatsApp with the message already typed. */
export interface PhoneVerificationTicket {
  code: string;
  /** E.164 of the number to send it to. */
  businessNumber: string;
  expiresAt: Date;
}

export interface StartPhoneVerificationPort {
  execute(ctx: ExecutionContext): Promise<PhoneVerificationTicket>;
}
```

Append to `app/ports/inbound/index.ts`:

```ts
export type * from "./start-phone-verification.command.port";
```

`packages/backend/src/modules/ntizo/bounded-contexts/user/app/use-cases/start-phone-verification.command.ts`:

```ts
import type {
  AuthIdentityPort,
  PhoneVerificationChannelPort,
  PhoneVerificationCodeStorePort,
} from "../ports/outbound";
import type {
  PhoneVerificationTicket,
  StartPhoneVerificationPort,
} from "../ports/inbound/start-phone-verification.command.port";
import {
  type ExecutionContext,
  requireAuthenticated,
} from "../../../../shared/infrastructure/execution-context";
import {
  PhoneNumberAlreadyVerifiedError,
  PhoneNumberMissingError,
  PhoneVerificationUnavailableError,
} from "../../domain/exceptions";
import { generateVerificationCode } from "../../domain/value-objects/verification-code";

/** Long enough to switch to WhatsApp, find the chat, send, and come back. */
export const PHONE_VERIFICATION_TTL_MS = 15 * 60 * 1000;

/**
 * Issues the code the caller will send us from WhatsApp.
 *
 * The subject is always the caller. There is no input at all: the number is
 * the one already on the account, read here rather than supplied, so nobody
 * can aim a code at a number that is not theirs.
 *
 * Availability is checked first so an unconfigured stage never touches the
 * database. The screen treats that refusal as "step aside", not as an error.
 */
export class StartPhoneVerificationCommand implements StartPhoneVerificationPort {
  private readonly now: () => Date;
  private readonly generateCode: () => string;

  constructor(
    private readonly authIdentity: AuthIdentityPort,
    private readonly codeStore: PhoneVerificationCodeStorePort,
    private readonly channel: PhoneVerificationChannelPort,
    deps: { now?: () => Date; generateCode?: () => string } = {},
  ) {
    this.now = deps.now ?? (() => new Date());
    this.generateCode = deps.generateCode ?? (() => generateVerificationCode());
  }

  async execute(ctx: ExecutionContext): Promise<PhoneVerificationTicket> {
    const requester = requireAuthenticated(ctx);

    const businessNumber = this.channel.businessNumber();
    if (!businessNumber) throw new PhoneVerificationUnavailableError();

    const phone = await this.authIdentity.findPhoneOf(requester.userId);
    if (!phone) throw new PhoneNumberMissingError();
    if (phone.verified) throw new PhoneNumberAlreadyVerifiedError();

    const code = this.generateCode();
    const expiresAt = new Date(this.now().getTime() + PHONE_VERIFICATION_TTL_MS);
    await this.codeStore.replace(requester.userId, {
      code,
      phoneNumber: phone.phoneNumber,
      expiresAt,
    });

    return { code, businessNumber, expiresAt };
  }
}
```

`packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/env-phone-verification-channel.adapter.ts`:

```ts
import type { PhoneVerificationChannelPort } from "../../app/ports/outbound";
import { infraStore } from "../../../../../../shared/infrastructure/stores/infra-store";

/** Reads the stage's WhatsApp number from the request-scoped env on every call. */
export class EnvPhoneVerificationChannel implements PhoneVerificationChannelPort {
  businessNumber(): string | null {
    const value = infraStore.getEnv().WHATSAPP_BUSINESS_NUMBER?.trim();
    return value ? value : null;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run the command from Step 2.
Expected: PASS (7 tests). If `requireAuthenticated` is not what throws for the anonymous caller, read `modules/ntizo/shared/infrastructure/execution-context/execution-context.ts` and keep the test's `toThrow()` generic. It must not depend on the message.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports \
  packages/backend/src/modules/ntizo/bounded-contexts/user/app/use-cases/start-phone-verification.command.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/app/use-cases/__tests__/start-phone-verification.command.test.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/env-phone-verification-channel.adapter.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/__tests__/env-phone-verification-channel.adapter.test.ts
git commit -m "feat(user): issue the code a person will send from WhatsApp

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Confirming from an inbound message, and answering it

**Files:**
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/inbound/confirm-phone-from-whatsapp.internal.command.port.ts`
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/inbound/index.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/outbound/phone-verification-replies.port.ts`
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/outbound/index.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/app/use-cases/confirm-phone-from-whatsapp.internal.command.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/app/use-cases/__tests__/confirm-phone-from-whatsapp.internal.command.test.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/whatsapp-phone-verification-replies.adapter.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/__tests__/whatsapp-phone-verification-replies.adapter.test.ts`

**Interfaces:**
- Consumes:
  - `extractVerificationCode` (Task 1)
  - `AuthIdentityPort.findByPhoneNumber` and `.markPhoneNumberVerified`, `PhoneVerificationCodeStorePort` (Task 3)
  - `ProfileRepositoryPort.findByUserId` (existing); `Profile.language` is a `Locale`
  - `WhatsAppMessengerPort` (Task 2)
- Produces:
  - `type PhoneConfirmationOutcome = "confirmed" | "no-account" | "invalid-code" | "already-confirmed" | "no-code"`
  - `interface ConfirmPhoneFromWhatsAppInternalInput { senderPhone: string; text: string | null }`
  - `interface ConfirmPhoneFromWhatsAppInternalPort { execute(input): Promise<PhoneConfirmationOutcome> }`
  - `interface PhoneVerificationRepliesPort { send(to: string, outcome: PhoneConfirmationOutcome, language: Locale | null): Promise<void> }`
  - `class ConfirmPhoneFromWhatsAppInternalCommand(authIdentity, codeStore, profileRepo, replies, deps?: { now?: () => Date })`
  - `class WhatsAppPhoneVerificationReplies(messenger: WhatsAppMessengerPort, contactEmail?: () => string)`
  - `phoneVerificationReply(outcome, language, ctx: { phone: string; contactEmail: string }): string`

- [ ] **Step 1: Write the failing tests**

`packages/backend/src/modules/ntizo/bounded-contexts/user/app/use-cases/__tests__/confirm-phone-from-whatsapp.internal.command.test.ts`:

```ts
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
```

`packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/__tests__/whatsapp-phone-verification-replies.adapter.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import {
  phoneVerificationReply,
  WhatsAppPhoneVerificationReplies,
} from "../whatsapp-phone-verification-replies.adapter";

const CTX = { phone: "+258841112233", contactEmail: "ola@ntizo.co.mz" };

describe("phoneVerificationReply", () => {
  it("speaks Portuguese to pt-MZ, pt-PT and an unknown language", () => {
    const expected = "✅ Número confirmado. Pode voltar à Ntizo.";
    expect(phoneVerificationReply("confirmed", "pt-MZ", CTX)).toBe(expected);
    expect(phoneVerificationReply("confirmed", "pt-PT", CTX)).toBe(expected);
    expect(phoneVerificationReply("confirmed", null, CTX)).toBe(expected);
  });

  it("speaks English to every other language", () => {
    expect(phoneVerificationReply("confirmed", "de-DE", CTX)).toBe("✅ Number confirmed. You can go back to Ntizo.");
  });

  it("names the number that has no account", () => {
    expect(phoneVerificationReply("no-account", null, CTX)).toBe(
      "Não encontrámos nenhuma conta Ntizo com o número +258841112233. Envie a mensagem a partir do WhatsApp do número que registou.",
    );
  });

  it("points a message with no code at the help address", () => {
    expect(phoneVerificationReply("no-code", "pt-MZ", CTX)).toBe(
      "Este número serve só para confirmar contas Ntizo. Para ajuda, escreva para ola@ntizo.co.mz.",
    );
  });

  it("has the two remaining replies", () => {
    expect(phoneVerificationReply("invalid-code", "pt-MZ", CTX)).toBe(
      "Este código já não é válido. Volte à Ntizo e toque outra vez em Confirmar pelo WhatsApp.",
    );
    expect(phoneVerificationReply("already-confirmed", "pt-MZ", CTX)).toBe("O seu número já está confirmado.");
  });
});

describe("WhatsAppPhoneVerificationReplies", () => {
  it("sends the composed reply to the sender", async () => {
    const sent: { to: string; body: string }[] = [];
    const replies = new WhatsAppPhoneVerificationReplies(
      { sendText: async (to, body) => void sent.push({ to, body }) },
      () => "ola@ntizo.co.mz",
    );
    await replies.send("+258879801517", "already-confirmed", "en-US");
    expect(sent).toEqual([{ to: "+258879801517", body: "Your number is already confirmed." }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/backend && bun test src/modules/ntizo/bounded-contexts/user/app/use-cases/__tests__/confirm-phone-from-whatsapp.internal.command.test.ts src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/__tests__/whatsapp-phone-verification-replies.adapter.test.ts`
Expected: FAIL, because the modules do not exist.

- [ ] **Step 3: Write the ports**

`packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/inbound/confirm-phone-from-whatsapp.internal.command.port.ts`:

```ts
/** What became of one inbound message. Each one is answered in WhatsApp. */
export type PhoneConfirmationOutcome =
  | "confirmed"
  | "no-account"
  | "invalid-code"
  | "already-confirmed"
  | "no-code";

export interface ConfirmPhoneFromWhatsAppInternalInput {
  /** E.164: `"+"` and Meta's `from` digits. */
  senderPhone: string;
  /** The text of a text message; null for any other kind (audio, image...). */
  text: string | null;
}

/** Internal: only the signed WhatsApp webhook calls it. */
export interface ConfirmPhoneFromWhatsAppInternalPort {
  execute(input: ConfirmPhoneFromWhatsAppInternalInput): Promise<PhoneConfirmationOutcome>;
}
```

Append to `app/ports/inbound/index.ts`:

```ts
export type * from "./confirm-phone-from-whatsapp.internal.command.port";
```

`packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/outbound/phone-verification-replies.port.ts`:

```ts
import type { Locale } from "@ntizo/shared";
import type { PhoneConfirmationOutcome } from "../inbound/confirm-phone-from-whatsapp.internal.command.port";

/** Answers the sender, in WhatsApp, where they are when the answer matters. */
export interface PhoneVerificationRepliesPort {
  send(to: string, outcome: PhoneConfirmationOutcome, language: Locale | null): Promise<void>;
}
```

Append to `app/ports/outbound/index.ts`:

```ts
export type { PhoneVerificationRepliesPort } from "./phone-verification-replies.port";
```

- [ ] **Step 4: Write the command**

`packages/backend/src/modules/ntizo/bounded-contexts/user/app/use-cases/confirm-phone-from-whatsapp.internal.command.ts`:

```ts
import type { Locale } from "@ntizo/shared";
import type {
  AuthIdentityPort,
  PhoneVerificationCodeStorePort,
  PhoneVerificationRepliesPort,
  ProfileRepositoryPort,
} from "../ports/outbound";
import type {
  ConfirmPhoneFromWhatsAppInternalInput,
  ConfirmPhoneFromWhatsAppInternalPort,
  PhoneConfirmationOutcome,
} from "../ports/inbound/confirm-phone-from-whatsapp.internal.command.port";
import { extractVerificationCode } from "../../domain/value-objects/verification-code";

/**
 * Confirms the account whose number sent us its code.
 *
 * The account is found by the SENDER, never by the code. WhatsApp verified
 * the sender's number itself, so a message from X was sent by whoever holds
 * X; the code is what ties that message to the account that asked. Codes are
 * never searched on their own, so there is no code space to guess across.
 *
 * No attempt limit: only the holder of X can send from X, and only the
 * account holding X can be confirmed by it — guessing could only confirm the
 * guesser's own number, which the code on their screen already does.
 *
 * Every outcome is answered. A reply that fails is logged and swallowed: the
 * confirmation is already written, and Meta retrying the delivery would only
 * produce "already confirmed".
 */
export class ConfirmPhoneFromWhatsAppInternalCommand implements ConfirmPhoneFromWhatsAppInternalPort {
  private readonly now: () => Date;

  constructor(
    private readonly authIdentity: AuthIdentityPort,
    private readonly codeStore: PhoneVerificationCodeStorePort,
    private readonly profileRepo: ProfileRepositoryPort,
    private readonly replies: PhoneVerificationRepliesPort,
    deps: { now?: () => Date } = {},
  ) {
    this.now = deps.now ?? (() => new Date());
  }

  async execute(input: ConfirmPhoneFromWhatsAppInternalInput): Promise<PhoneConfirmationOutcome> {
    const account = await this.authIdentity.findByPhoneNumber(input.senderPhone);
    const language: Locale | null = account
      ? ((await this.profileRepo.findByUserId(account.userId))?.language ?? null)
      : null;

    const outcome = await this.decide(input, account);

    try {
      await this.replies.send(input.senderPhone, outcome, language);
    } catch (error) {
      // console.error, not the logger: this runs from a webhook with no
      // request-scoped logger set, the same reason the Resend route logs so.
      console.error(`[phone-verification] could not answer a "${outcome}" message`, error);
    }
    return outcome;
  }

  private async decide(
    input: ConfirmPhoneFromWhatsAppInternalInput,
    account: { userId: string; verified: boolean } | null,
  ): Promise<PhoneConfirmationOutcome> {
    const code = extractVerificationCode(input.text);
    if (!code) return "no-code";
    if (!account) return "no-account";
    if (account.verified) return "already-confirmed";

    const pending = await this.codeStore.find(account.userId);
    const valid =
      pending !== null &&
      pending.code === code &&
      pending.phoneNumber === input.senderPhone &&
      pending.expiresAt.getTime() > this.now().getTime();
    if (!valid) return "invalid-code";

    // Conditional on the number still being the one the code was issued for.
    const changed = await this.authIdentity.markPhoneNumberVerified(account.userId, pending.phoneNumber);
    if (!changed) return "invalid-code";

    await this.codeStore.delete(account.userId);
    return "confirmed";
  }
}
```

- [ ] **Step 5: Write the replies adapter**

`packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/whatsapp-phone-verification-replies.adapter.ts`:

```ts
import type { Locale } from "@ntizo/shared";
import type { PhoneVerificationRepliesPort } from "../../app/ports/outbound";
import type { PhoneConfirmationOutcome } from "../../app/ports/inbound/confirm-phone-from-whatsapp.internal.command.port";
import type { WhatsAppMessengerPort } from "../../../../../../shared/infrastructure/whatsapp";
import { infraStore } from "../../../../../../shared/infrastructure/stores/infra-store";

const DEFAULT_CONTACT_EMAIL = "ola@ntizo.co.mz";

type Ctx = { phone: string; contactEmail: string };

const PT: Record<PhoneConfirmationOutcome, (c: Ctx) => string> = {
  confirmed: () => "✅ Número confirmado. Pode voltar à Ntizo.",
  "no-account": (c) =>
    `Não encontrámos nenhuma conta Ntizo com o número ${c.phone}. Envie a mensagem a partir do WhatsApp do número que registou.`,
  "invalid-code": () =>
    "Este código já não é válido. Volte à Ntizo e toque outra vez em Confirmar pelo WhatsApp.",
  "already-confirmed": () => "O seu número já está confirmado.",
  "no-code": (c) => `Este número serve só para confirmar contas Ntizo. Para ajuda, escreva para ${c.contactEmail}.`,
};

const EN: Record<PhoneConfirmationOutcome, (c: Ctx) => string> = {
  confirmed: () => "✅ Number confirmed. You can go back to Ntizo.",
  "no-account": (c) =>
    `We couldn't find a Ntizo account with the number ${c.phone}. Send the message from the WhatsApp of the number you registered.`,
  "invalid-code": () => "This code is no longer valid. Go back to Ntizo and tap Confirm with WhatsApp again.",
  "already-confirmed": () => "Your number is already confirmed.",
  "no-code": (c) => `This number is only for confirming Ntizo accounts. For help, write to ${c.contactEmail}.`,
};

/**
 * Portuguese for the launch market and for anyone whose language is unknown,
 * English for everyone else. "No account" never has a profile to read, so it
 * always lands in Portuguese.
 */
export function phoneVerificationReply(
  outcome: PhoneConfirmationOutcome,
  language: Locale | null,
  ctx: Ctx,
): string {
  const table = language === null || language.startsWith("pt") ? PT : EN;
  return table[outcome](ctx);
}

export class WhatsAppPhoneVerificationReplies implements PhoneVerificationRepliesPort {
  constructor(
    private readonly messenger: WhatsAppMessengerPort,
    private readonly contactEmail: () => string = () =>
      infraStore.getEnv().CONTACT_INBOX_EMAIL || DEFAULT_CONTACT_EMAIL,
  ) {}

  async send(to: string, outcome: PhoneConfirmationOutcome, language: Locale | null): Promise<void> {
    const body = phoneVerificationReply(outcome, language, { phone: to, contactEmail: this.contactEmail() });
    await this.messenger.sendText(to, body);
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run the command from Step 2.
Expected: PASS (17 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports \
  packages/backend/src/modules/ntizo/bounded-contexts/user/app/use-cases/confirm-phone-from-whatsapp.internal.command.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/app/use-cases/__tests__/confirm-phone-from-whatsapp.internal.command.test.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/whatsapp-phone-verification-replies.adapter.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/__tests__/whatsapp-phone-verification-replies.adapter.test.ts
git commit -m "feat(user): confirm the account whose number sent its code, and answer every message

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Wiring, and the `user.startPhoneVerification` mutation

**Files:**
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/user/bootstrap/index.ts`
- Modify: `packages/backend/src/modules/ntizo/write/user/graphql/schema/mutations.ts`
- Modify: `packages/backend/src/modules/ntizo/write/user/graphql/handlers/mutations.handlers.ts`
- Create: `packages/backend/src/modules/ntizo/write/user/__tests__/start-phone-verification.handler.test.ts`
- Modify: `apps/backend/api/src/graphql/private.ts` (the `createUserWriteHandlers({...})` call)

**Interfaces:**
- Consumes: everything from Tasks 2–5.
- Produces:
  - `bootstrapUser().useCases.startPhoneVerification: StartPhoneVerificationCommand`
  - `bootstrapUser().useCases.internal.confirmPhoneFromWhatsApp: ConfirmPhoneFromWhatsAppInternalCommand`
  - `UserWriteModule.startPhoneVerification: StartPhoneVerificationPort`
  - GraphQL field `userStartPhoneVerification(input: {})` returning `{ code: String!, businessNumber: String!, expiresAt: String! }`, with `expiresAt` as ISO 8601.

- [ ] **Step 1: Write the failing test**

`packages/backend/src/modules/ntizo/write/user/__tests__/start-phone-verification.handler.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/backend && bun test src/modules/ntizo/write/user/__tests__/start-phone-verification.handler.test.ts`
Expected: FAIL. No handler has key `user.startPhoneVerification`, so `field(...)` is undefined.

- [ ] **Step 3: Add the mutation and its handler**

In `packages/backend/src/modules/ntizo/write/user/graphql/schema/mutations.ts`, add before `export const userWriteSchema`:

```ts
/**
 * Issues the code the caller will send from WhatsApp to confirm their number.
 *
 * No input: the number is the one on the account, never one the caller names.
 * `expiresAt` travels as ISO text so the screen can show "até 14:52" and
 * switch to "expired" on its own clock.
 */
export const startPhoneVerification = defineMutation({
  input: zodSchema(z.object({})),
  output: zodSchema(
    z.object({
      code: z.string(),
      businessNumber: z.string(),
      expiresAt: z.string(),
    }),
  ),
  docs: { summary: "Start confirming your phone number by WhatsApp", tags: ["User"] },
});
```

and add `startPhoneVerification,` to the `user: { ... }` map in `userWriteSchema`.

In `packages/backend/src/modules/ntizo/write/user/graphql/handlers/mutations.handlers.ts`:
- import the port type: `import type { StartPhoneVerificationPort } from "../../../../bounded-contexts/user/app/ports/inbound/start-phone-verification.command.port";`
- add `readonly startPhoneVerification: StartPhoneVerificationPort;` to `UserWriteModule`
- chain the handler after `user.deleteAddress`:

```ts
    // No input: the subject and the number both come from the session.
    .handle("user.startPhoneVerification", async (_args, ctx) => {
      const nctx = asNtizoGraphqlContext(ctx);
      const ticket = await writeModule.startPhoneVerification.execute(toExecutionContext(nctx));
      return {
        code: ticket.code,
        businessNumber: ticket.businessNumber,
        expiresAt: ticket.expiresAt.toISOString(),
      };
    })
```

If the builder requires the `.handle(...)` calls in schema order, place it where the compiler asks. `graphqlRoutes` reports a missing or misordered key at type level.

- [ ] **Step 4: Wire the bootstrap**

In `packages/backend/src/modules/ntizo/bounded-contexts/user/bootstrap/index.ts` add the imports:

```ts
import { StartPhoneVerificationCommand } from "../app/use-cases/start-phone-verification.command";
import { ConfirmPhoneFromWhatsAppInternalCommand } from "../app/use-cases/confirm-phone-from-whatsapp.internal.command";
import { BetterAuthPhoneVerificationCodeStore } from "../infrastructure/adapters/better-auth-phone-verification-code.store";
import { EnvPhoneVerificationChannel } from "../infrastructure/adapters/env-phone-verification-channel.adapter";
import { WhatsAppPhoneVerificationReplies } from "../infrastructure/adapters/whatsapp-phone-verification-replies.adapter";
import { LazyWhatsAppMessenger } from "../../../../../shared/infrastructure/whatsapp";
```

After `const deleteMyAddress = ...` add:

```ts
  const phoneVerificationCodes = new BetterAuthPhoneVerificationCodeStore();
  const startPhoneVerification = new StartPhoneVerificationCommand(
    authIdentity,
    phoneVerificationCodes,
    new EnvPhoneVerificationChannel(),
  );
  const confirmPhoneFromWhatsApp = new ConfirmPhoneFromWhatsAppInternalCommand(
    authIdentity,
    phoneVerificationCodes,
    profileRepository,
    new WhatsAppPhoneVerificationReplies(new LazyWhatsAppMessenger()),
  );
```

Add `startPhoneVerification,` to `useCases` (after `deleteMyAddress`) and `confirmPhoneFromWhatsApp,` to `useCases.internal`.

In `apps/backend/api/src/graphql/private.ts`, add to the `createUserWriteHandlers({ ... })` object:

```ts
        startPhoneVerification: user.useCases.startPhoneVerification,
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/backend && bun test src/modules/ntizo/write/user src/modules/ntizo/__tests__`
Expected: PASS: the 3 new tests, and the fitness gates, which include "write = mutations only".

Run: `bun run check-types`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/modules/ntizo/bounded-contexts/user/bootstrap/index.ts \
  packages/backend/src/modules/ntizo/write/user/graphql \
  packages/backend/src/modules/ntizo/write/user/__tests__/start-phone-verification.handler.test.ts \
  apps/backend/api/src/graphql/private.ts
git commit -m "feat(user): the startPhoneVerification mutation, wired to the new commands

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: The webhook decision, framework-free

**Files:**
- Create: `packages/backend/src/modules/ntizo/write/user/http/whatsapp-webhook.routes.ts`
- Create: `packages/backend/src/modules/ntizo/write/user/http/index.ts`
- Create: `packages/backend/src/modules/ntizo/write/user/__tests__/whatsapp-webhook.routes.test.ts`
- Modify: `packages/backend/src/modules/ntizo/write/user/index.ts`

**Interfaces:**
- Consumes: `ConfirmPhoneFromWhatsAppInternalPort` (Task 5).
- Produces (exported from `@ntizo/backend/modules/ntizo/write/user`):
  - `createWhatsAppWebhookHandlers(deps: WhatsAppWebhookDeps): { verify(query: Record<string, string | undefined>): WhatsAppWebhookResponse; receive(req: { body: string; headers: Record<string, string> }): Promise<WhatsAppWebhookResponse> }`
  - `interface WhatsAppWebhookDeps { confirm: ConfirmPhoneFromWhatsAppInternalPort; appSecret: string | undefined; verifyToken: string | undefined; refusals: { count: number } }`
  - `interface WhatsAppWebhookResponse { status: number; body: string; contentType: "text/plain" | "application/json" }`

- [ ] **Step 1: Write the failing tests**

`packages/backend/src/modules/ntizo/write/user/__tests__/whatsapp-webhook.routes.test.ts`:

```ts
import { describe, expect, it, spyOn } from "bun:test";
import { createHmac } from "node:crypto";
import { createWhatsAppWebhookHandlers } from "../http/whatsapp-webhook.routes";
import type { ConfirmPhoneFromWhatsAppInternalInput } from "../../../bounded-contexts/user/app/ports/inbound/confirm-phone-from-whatsapp.internal.command.port";

const SECRET = "app-secret-for-tests";
const VERIFY = "verify-token-for-tests";

function sign(body: string, secret = SECRET): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

function inbound(messages: unknown[], statuses: unknown[] = []): string {
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
              metadata: { display_phone_number: "258843002020", phone_number_id: "106540352242922" },
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
  from: "258879801517",
  id: "wamid.1",
  timestamp: "1758465420",
  type: "text",
  text: { body: "Olá Ntizo! O meu código de confirmação é 483920" },
};

function harness(overrides: { appSecret?: string | undefined; verifyToken?: string | undefined } = {}) {
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
    expect(calls).toEqual([{ senderPhone: "+258879801517", text: TEXT.text.body }]);
  });

  it("passes a non-text message on as having no text", async () => {
    const { handlers, calls } = harness();
    const body = inbound([{ from: "258879801517", id: "wamid.2", timestamp: "1", type: "audio", audio: { id: "a1" } }]);
    await handlers.receive({ body, headers: { "x-hub-signature-256": sign(body) } });
    expect(calls).toEqual([{ senderPhone: "+258879801517", text: null }]);
  });

  it("handles every message in one delivery", async () => {
    const { handlers, calls } = harness();
    const body = inbound([TEXT, { ...TEXT, id: "wamid.3", from: "258841112233" }]);
    await handlers.receive({ body, headers: { "x-hub-signature-256": sign(body) } });
    expect(calls.map((c) => c.senderPhone)).toEqual(["+258879801517", "+258841112233"]);
  });

  it("ignores delivery statuses", async () => {
    const { handlers, calls } = harness();
    const body = inbound([], [{ id: "wamid.9", status: "delivered", recipient_id: "258879801517" }]);
    const res = await handlers.receive({ body, headers: { "x-hub-signature-256": sign(body) } });
    expect(res.status).toBe(200);
    expect(calls).toEqual([]);
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
      refusals: { count: 0 },
    });
    const body = inbound([TEXT]);
    await expect(handlers.receive({ body, headers: { "x-hub-signature-256": sign(body) } })).rejects.toThrow(
      "connection terminated",
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/backend && bun test src/modules/ntizo/write/user/__tests__/whatsapp-webhook.routes.test.ts`
Expected: FAIL, because `../http/whatsapp-webhook.routes` does not exist.

- [ ] **Step 3: Write the handlers**

`packages/backend/src/modules/ntizo/write/user/http/whatsapp-webhook.routes.ts`:

```ts
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

      for (const message of inboundMessages(JSON.parse(req.body))) {
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
  return crypto.subtle.verify("HMAC", key, expected, new TextEncoder().encode(body));
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** Every inbound message in a delivery; statuses and anything unknown are skipped. */
function inboundMessages(payload: unknown): { from: string; text: string | null }[] {
  const out: { from: string; text: string | null }[] = [];
  if (!isRecord(payload) || payload.object !== "whatsapp_business_account") return out;
  for (const entry of asArray(payload.entry)) {
    if (!isRecord(entry)) continue;
    for (const change of asArray(entry.changes)) {
      if (!isRecord(change) || change.field !== "messages" || !isRecord(change.value)) continue;
      for (const message of asArray(change.value.messages)) {
        if (!isRecord(message) || typeof message.from !== "string" || !/^\d+$/.test(message.from)) continue;
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
```

`packages/backend/src/modules/ntizo/write/user/http/index.ts`:

```ts
export {
  createWhatsAppWebhookHandlers,
  type WhatsAppWebhookDeps,
  type WhatsAppWebhookResponse,
} from "./whatsapp-webhook.routes";
```

Append to `packages/backend/src/modules/ntizo/write/user/index.ts`:

```ts
export {
  createWhatsAppWebhookHandlers,
  type WhatsAppWebhookDeps,
  type WhatsAppWebhookResponse,
} from "./http";
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/backend && bun test src/modules/ntizo/write/user src/modules/ntizo/__tests__`
Expected: PASS: 12 new tests, and the fitness gates, since the file imports no framework.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/modules/ntizo/write/user/http \
  packages/backend/src/modules/ntizo/write/user/index.ts \
  packages/backend/src/modules/ntizo/write/user/__tests__/whatsapp-webhook.routes.test.ts
git commit -m "feat(user): Meta's webhook — handshake, signature over the raw bytes, one confirmation per message

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Mounting the webhook, and configuring the stages

**Files:**
- Modify: `apps/backend/api/src/webhooks.ts`
- Modify: `apps/backend/api/src/api.ts`: move `const userBootstrap = bootstrapUser();` above `mountWebhooks(...)` and pass the new dependency.
- Modify: `apps/backend/api/src/types.ts` (`AppBindings`)
- Modify: `apps/backend/api/wrangler.jsonc`: the top-level `vars` and each of `env.dev`, `env.qa` and `env.prod` `vars`, plus the SECRETS comment.
- Modify: `apps/backend/api/.env.example`
- Create: `apps/backend/api/scripts/simulate-whatsapp-message.ts`
- Create: `apps/backend/api/src/__tests__/whatsapp-webhook-mount.test.ts`

**Interfaces:**
- Consumes: `createWhatsAppWebhookHandlers` (Task 7); `bootstrapUser().useCases.internal.confirmPhoneFromWhatsApp` (Task 6).
- Produces:
  - routes `GET /api/webhooks/whatsapp` and `POST /api/webhooks/whatsapp`;
  - `WebhookDeps.confirmPhoneFromWhatsApp`;
  - `AppBindings.WHATSAPP_APP_SECRET?` and `AppBindings.WHATSAPP_WEBHOOK_VERIFY_TOKEN?`.

- [ ] **Step 1: Write the failing mount test**

`apps/backend/api/src/__tests__/whatsapp-webhook-mount.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/backend/api && bun test src/__tests__/whatsapp-webhook-mount.test.ts`
Expected: FAIL with 404s, because the routes are not mounted.

- [ ] **Step 3: Mount the routes**

In `apps/backend/api/src/types.ts`, add inside `AppBindings`, after `RESEND_WEBHOOK_SECRET?: string;`:

```ts
  /**
   * The Meta app secret that signs every POST to `/api/webhooks/whatsapp`
   * (`X-Hub-Signature-256`). A secret, set with `wrangler secret put`.
   * Absent, the route refuses every event with a 500, like the Resend one.
   * On `AppBindings`, not `InfraEnvBindings`: only the Hono binding reads it.
   */
  WHATSAPP_APP_SECRET?: string;
  /** Answers Meta's GET handshake when the webhook is registered. A secret. */
  WHATSAPP_WEBHOOK_VERIFY_TOKEN?: string;
```

Export the port from the user BC's public index. Add this line to `packages/backend/src/modules/ntizo/bounded-contexts/user/index.ts`:

```ts
export type { ConfirmPhoneFromWhatsAppInternalPort } from "./app/ports/inbound/confirm-phone-from-whatsapp.internal.command.port";
```

In `apps/backend/api/src/webhooks.ts`:
- add the imports:

```ts
import type { Context } from "hono";
import { createWhatsAppWebhookHandlers } from "@ntizo/backend/modules/ntizo/write/user";
import type { ConfirmPhoneFromWhatsAppInternalPort } from "@ntizo/backend/modules/ntizo/bounded-contexts/user";
```

- add `const MAX_WHATSAPP_WEBHOOK_BODY_BYTES = 3 * 1024 * 1024;` under `MAX_WEBHOOK_BODY_BYTES`, with the comment `// Meta's payloads can be up to 3 MB (their webhook docs); Resend's 1 MiB stays for its own route.`
- add `const whatsAppRefusalsSinceBoot = { count: 0 };` under `refusalsSinceBoot`
- add to `WebhookDeps`:

```ts
  /** Confirms the account whose number sent its code (user context). */
  readonly confirmPhoneFromWhatsApp: ConfirmPhoneFromWhatsAppInternalPort;
```

- at the end of `mountWebhooks`, before its closing brace, add:

```ts
  // Meta's WhatsApp webhook (phone confirmation). Same placement rules as the
  // Resend route above: before `authCors`, inside `configMiddleware`.
  app.get("/api/webhooks/whatsapp", (c) => {
    const res = whatsAppHandlers(c).verify(c.req.query());
    return new Response(res.body, { status: res.status, headers: { "content-type": res.contentType } });
  });

  app.post("/api/webhooks/whatsapp", async (c) => {
    const declared = Number(c.req.header("content-length"));
    if (Number.isFinite(declared) && declared > MAX_WHATSAPP_WEBHOOK_BODY_BYTES) return tooLarge();

    // RAW body: the HMAC covers the exact bytes Meta sent.
    const body = await c.req.text();
    if (body.length > MAX_WHATSAPP_WEBHOOK_BODY_BYTES) return tooLarge();

    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((value, name) => {
      headers[name] = value;
    });

    const res = await whatsAppHandlers(c).receive({ body, headers });
    return new Response(res.body, { status: res.status, headers: { "content-type": res.contentType } });
  });

  function whatsAppHandlers(c: Context<{ Bindings: AppBindings }>) {
    return createWhatsAppWebhookHandlers({
      confirm: deps.confirmPhoneFromWhatsApp,
      appSecret: c.env.WHATSAPP_APP_SECRET,
      verifyToken: c.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      refusals: whatsAppRefusalsSinceBoot,
    });
  }
```

In `apps/backend/api/src/api.ts`:
- move `// Bootstrap the user BC once at module scope; the sign-up hook below shares it.` and `const userBootstrap = bootstrapUser();` from their current place, after `app.on(["POST", "GET"], "/api/auth/*", ...)`, to just above `mountWebhooks(app, {`;
- extend the comment to say the webhook shares it too;
- add the dependency:

```ts
mountWebhooks(app, {
  handleResendWebhook: notificationBootstrap.useCases.internal.handleResendWebhook,
  confirmPhoneFromWhatsApp: userBootstrap.useCases.internal.confirmPhoneFromWhatsApp,
});
```

- [ ] **Step 4: Configure the stages**

In `apps/backend/api/wrangler.jsonc`, add to the top-level `vars` and to each of `env.dev.vars`, `env.qa.vars` and `env.prod.vars` (named envs do not inherit `vars`):

```jsonc
        // WhatsApp phone confirmation (see WHATSAPP_* in packages/backend's
        // InfraEnvBindings). Empty = not configured: the screen steps aside
        // and the webhook refuses with a 500. Filled per stage once Meta's
        // app and number exist; the id is Meta's, the number is E.164.
        "WHATSAPP_PHONE_NUMBER_ID": "",
        "WHATSAPP_BUSINESS_NUMBER": ""
```

In the `// SECRETS` comment block, add a paragraph after the M-Pesa one:

```jsonc
  // `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET` and
  // `WHATSAPP_WEBHOOK_VERIFY_TOKEN` are the phone confirmation's three. The
  // token lets us reply from Ntizo's WhatsApp number; the app secret signs
  // every webhook POST, so anyone holding it could confirm any number; the
  // verify token only answers Meta's handshake. Per stage, names only:
  //
  //   wrangler secret put WHATSAPP_ACCESS_TOKEN --env dev          # and qa, prod
  //   wrangler secret put WHATSAPP_APP_SECRET --env dev
  //   wrangler secret put WHATSAPP_WEBHOOK_VERIFY_TOKEN --env dev
```

Append to `apps/backend/api/.env.example`:

```bash

# WhatsApp phone confirmation (Meta Cloud API). Leave all five empty locally:
# replies then print to the terminal, and scripts/simulate-whatsapp-message.ts
# plays Meta. Set WHATSAPP_BUSINESS_NUMBER (any E.164) to make the screen
# issue codes, and WHATSAPP_APP_SECRET to any string the script also uses.
# Deployed stages: the two ids are wrangler `vars`; the three secrets are
#   wrangler secret put <NAME> --env <stage>
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_NUMBER=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
```

- [ ] **Step 5: Write the local simulator**

`apps/backend/api/scripts/simulate-whatsapp-message.ts`:

```ts
/**
 * Plays Meta for a local run: signs an inbound WhatsApp message the way Meta
 * does and posts it to the local API, so the whole confirmation works with no
 * Meta account. Replies print in the `wrangler dev` terminal.
 *
 *   bun scripts/simulate-whatsapp-message.ts +258879801517 "Olá Ntizo! O meu código de confirmação é 483920"
 *
 * Reads WHATSAPP_APP_SECRET from the environment (bun loads .env); it must
 * match the value in .dev.vars that `wrangler dev` runs with.
 */
import { createHmac } from "node:crypto";

const [from, text] = process.argv.slice(2);
const secret = process.env.WHATSAPP_APP_SECRET;
const url = process.env.WHATSAPP_WEBHOOK_URL ?? "http://localhost:8788/api/webhooks/whatsapp";

if (!from?.startsWith("+") || !text || !secret) {
  console.error('Usage: WHATSAPP_APP_SECRET=… bun scripts/simulate-whatsapp-message.ts +2588… "text"');
  process.exit(1);
}

const body = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "local",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "local", phone_number_id: "local" },
            messages: [
              {
                from: from.slice(1),
                id: `wamid.local.${Date.now()}`,
                timestamp: String(Math.floor(Date.now() / 1000)),
                type: "text",
                text: { body: text },
              },
            ],
          },
        },
      ],
    },
  ],
});

const res = await fetch(url, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-hub-signature-256": `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`,
  },
  body,
});
console.log(res.status, await res.text());
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd apps/backend/api && bun test src/__tests__/whatsapp-webhook-mount.test.ts src/__tests__/webhook-mount.test.ts src/__tests__/resend-webhook.test.ts`
Expected: PASS: 4 new tests, and the Resend mount tests unchanged.

Run: `bun run check-types`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/api/src/webhooks.ts apps/backend/api/src/api.ts apps/backend/api/src/types.ts \
  apps/backend/api/wrangler.jsonc apps/backend/api/.env.example \
  apps/backend/api/scripts/simulate-whatsapp-message.ts \
  apps/backend/api/src/__tests__/whatsapp-webhook-mount.test.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/index.ts
git commit -m "feat(api): mount Meta's WhatsApp webhook, configure the stages, simulate it locally

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Web helpers: the WhatsApp link, the invite URL, the start call

**Files:**
- Create: `apps/frontend/web/src/features/auth/domain/phone-verification.ts`
- Create: `apps/frontend/web/src/features/auth/domain/__tests__/phone-verification.test.ts`
- Create: `apps/frontend/web/src/features/auth/viewmodel/email-callback.ts`
- Create: `apps/frontend/web/src/features/auth/viewmodel/__tests__/email-callback.test.ts`
- Modify: `apps/frontend/web/src/features/user/data/user.repository.ts`
- Create: `apps/frontend/web/src/features/user/data/__tests__/start-phone-verification.test.ts`

**Interfaces:**
- Produces:
  - `whatsAppLink(businessNumber: string, message: string): string`
  - `formatPhone(e164: string): string`
  - `emailConfirmedCallbackURL(origin: string, next: string | undefined): string`
  - `interface PhoneVerificationTicketDTO { code: string; businessNumber: string; expiresAt: string }`
  - `startPhoneVerification(): Promise<PhoneVerificationTicketDTO>`

- [ ] **Step 1: Write the failing tests**

`apps/frontend/web/src/features/auth/domain/__tests__/phone-verification.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatPhone, whatsAppLink } from "../phone-verification";

describe("whatsAppLink", () => {
  it("opens a chat with Ntizo's number and the message already typed", () => {
    expect(whatsAppLink("+258843002020", "Olá Ntizo! O meu código de confirmação é 483920")).toBe(
      "https://wa.me/258843002020?text=Ol%C3%A1%20Ntizo!%20O%20meu%20c%C3%B3digo%20de%20confirma%C3%A7%C3%A3o%20%C3%A9%20483920",
    );
  });

  it("keeps only the digits of the number", () => {
    expect(whatsAppLink("+258 84 300 2020", "x")).toBe("https://wa.me/258843002020?text=x");
  });
});

describe("formatPhone", () => {
  it("spaces an E.164 number the way people read it", () => {
    expect(formatPhone("+258879801517")).toBe("+258 87 980 1517");
  });

  it("returns anything it cannot read untouched", () => {
    expect(formatPhone("not a number")).toBe("not a number");
  });
});
```

`apps/frontend/web/src/features/auth/viewmodel/__tests__/email-callback.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { emailConfirmedCallbackURL } from "../email-callback";

describe("emailConfirmedCallbackURL", () => {
  it("lands on the phone invite first, carrying where the person was going", () => {
    expect(emailConfirmedCallbackURL("https://dev.ntizo.co.mz", "/book/svc-1?memberId=m1")).toBe(
      "https://dev.ntizo.co.mz/verify-phone?next=%2Fbook%2Fsvc-1%3FmemberId%3Dm1",
    );
  });

  it("goes home afterwards when there was nowhere in particular", () => {
    expect(emailConfirmedCallbackURL("https://dev.ntizo.co.mz", undefined)).toBe(
      "https://dev.ntizo.co.mz/verify-phone?next=%2F",
    );
  });

  it("never carries an outside address", () => {
    expect(emailConfirmedCallbackURL("https://dev.ntizo.co.mz", "//evil.example/x")).toBe(
      "https://dev.ntizo.co.mz/verify-phone?next=%2F",
    );
  });
});
```

`apps/frontend/web/src/features/user/data/__tests__/start-phone-verification.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/frontend/web && npx vitest run src/features/auth/domain/__tests__/phone-verification.test.ts src/features/auth/viewmodel/__tests__/email-callback.test.ts src/features/user/data/__tests__/start-phone-verification.test.ts`
Expected: FAIL, because the modules and the export do not exist.

- [ ] **Step 3: Write the implementation**

`apps/frontend/web/src/features/auth/domain/phone-verification.ts`:

```ts
import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * A link that opens WhatsApp on a chat with `businessNumber`, with `message`
 * already typed. `wa.me` wants the number as bare digits.
 */
export function whatsAppLink(businessNumber: string, message: string): string {
  return `https://wa.me/${businessNumber.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

/** "+258879801517" → "+258 87 980 1517"; anything unreadable comes back as it was. */
export function formatPhone(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}
```

`apps/frontend/web/src/features/auth/viewmodel/email-callback.ts`:

```ts
import { isSafeInternalPath } from "@/shared/lib/zones";

/**
 * Where an email-confirmation link lands: the phone invite first, then where
 * the person was going.
 *
 * Absolute, because better-auth resolves a relative callback against the API
 * origin. `next` is checked here because it ends up in a URL a server
 * redirects to, and an unchecked one is an open redirect.
 */
export function emailConfirmedCallbackURL(origin: string, next: string | undefined): string {
  const destination = isSafeInternalPath(next ?? null) ? next : "/";
  return `${origin}/verify-phone?next=${encodeURIComponent(destination)}`;
}
```

Append to `apps/frontend/web/src/features/user/data/user.repository.ts`, before `/** Query definitions. ...`:

```ts
/**
 * `user.startPhoneVerification` — issues the code the person sends from
 * WhatsApp. No input; the number is the one on the account.
 */
const START_PHONE_VERIFICATION = `
  mutation UserStartPhoneVerification {
    userStartPhoneVerification(input: {}) {
      code businessNumber expiresAt
    }
  }`;

export interface PhoneVerificationTicketDTO {
  code: string;
  /** E.164 of Ntizo's WhatsApp number. */
  businessNumber: string;
  /** ISO 8601. */
  expiresAt: string;
}

export async function startPhoneVerification(): Promise<PhoneVerificationTicketDTO> {
  const d = await sessionGraphql<{ userStartPhoneVerification: PhoneVerificationTicketDTO }>(
    START_PHONE_VERIFICATION,
  );
  return d.userStartPhoneVerification;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run the command from Step 2.
Expected: PASS (8 tests). If `formatPhone` spaces the number differently (libphonenumber's metadata decides), update the expected string to what `formatInternational()` actually returns for `+258879801517`, keep the assertion exact, and note it in the commit.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/web/src/features/auth/domain apps/frontend/web/src/features/auth/viewmodel/email-callback.ts \
  apps/frontend/web/src/features/auth/viewmodel/__tests__/email-callback.test.ts \
  apps/frontend/web/src/features/user/data/user.repository.ts \
  apps/frontend/web/src/features/user/data/__tests__/start-phone-verification.test.ts
git commit -m "feat(web): the WhatsApp link, the invite callback URL and the start call

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: The `usePhoneVerification` viewmodel

**Files:**
- Create: `apps/frontend/web/src/features/auth/viewmodel/use-phone-verification.ts`
- Create: `apps/frontend/web/src/features/auth/viewmodel/__tests__/use-phone-verification.test.ts`

**Interfaces:**
- Consumes: `startPhoneVerification` (Task 9), `whatsAppLink` (Task 9), `authClient` and `GraphqlError` (existing).
- Produces:
  - `usePhoneVerification(messageFor: (code: string) => string): { state: PhoneVerificationState; markSent(): void; restart(): void }`
  - `POLL_INTERVAL_MS = 3000`
  - `type PhoneVerificationState` has these variants:
    - `{ status: "starting" }`
    - `{ status: "ready" | "waiting"; code: string; businessNumber: string; expiresAt: Date; link: string }`
    - `{ status: "confirmed" }`, `{ status: "expired" }`, `{ status: "unavailable" }`, `{ status: "failed" }`

- [ ] **Step 1: Write the failing tests**

`apps/frontend/web/src/features/auth/viewmodel/__tests__/use-phone-verification.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { GraphqlError } from "@/shared/lib/graphql/session-graphql";

const fakes = vi.hoisted(() => ({
  start: vi.fn(),
  getSession: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/features/user/data/user.repository", () => ({ startPhoneVerification: fakes.start }));
vi.mock("@/shared/lib/api/auth-client", () => ({
  authClient: { getSession: fakes.getSession, $store: { notify: fakes.notify } },
}));

const { usePhoneVerification, POLL_INTERVAL_MS } = await import("../use-phone-verification");

const NOW = new Date("2026-09-21T14:37:00.000Z");
const TICKET = { code: "483920", businessNumber: "+258843002020", expiresAt: "2026-09-21T14:52:00.000Z" };
const message = (code: string) => `Olá Ntizo! O meu código de confirmação é ${code}`;

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  fakes.start.mockReset().mockResolvedValue(TICKET);
  fakes.getSession.mockReset().mockResolvedValue({ data: { user: { phoneNumberVerified: false } } });
  fakes.notify.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("usePhoneVerification", () => {
  it("issues a code on mount and builds the WhatsApp link from it", async () => {
    const { result } = renderHook(() => usePhoneVerification(message));
    expect(result.current.state.status).toBe("starting");
    await flush();
    expect(result.current.state).toMatchObject({
      status: "ready",
      code: "483920",
      businessNumber: "+258843002020",
      expiresAt: new Date(TICKET.expiresAt),
    });
    expect(result.current.state.status === "ready" && result.current.state.link).toContain(
      "https://wa.me/258843002020?text=",
    );
  });

  it("waits once the link is used, and confirms when the session says so", async () => {
    const { result } = renderHook(() => usePhoneVerification(message));
    await flush();
    act(() => result.current.markSent());
    expect(result.current.state.status).toBe("waiting");

    fakes.getSession.mockResolvedValue({ data: { user: { phoneNumberVerified: true } } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    expect(fakes.getSession).toHaveBeenCalledWith({ query: { disableCookieCache: true } });
    expect(result.current.state.status).toBe("confirmed");
    expect(fakes.notify).toHaveBeenCalledWith("$sessionSignal");
  });

  it("checks at once when the person comes back to the tab", async () => {
    const { result } = renderHook(() => usePhoneVerification(message));
    await flush();
    act(() => result.current.markSent());
    fakes.getSession.mockResolvedValue({ data: { user: { phoneNumberVerified: true } } });

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.state.status).toBe("confirmed");
  });

  it("does not poll before the link is used", async () => {
    renderHook(() => usePhoneVerification(message));
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });
    expect(fakes.getSession).not.toHaveBeenCalled();
  });

  it("expires at the code's own expiry", async () => {
    const { result } = renderHook(() => usePhoneVerification(message));
    await flush();
    act(() => result.current.markSent());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
    });
    expect(result.current.state.status).toBe("expired");
  });

  it("issues a fresh code on restart", async () => {
    const { result } = renderHook(() => usePhoneVerification(message));
    await flush();
    fakes.start.mockResolvedValue({ ...TICKET, code: "777777" });
    await act(async () => {
      result.current.restart();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.state).toMatchObject({ status: "ready", code: "777777" });
  });

  it("reports an unconfigured stage as unavailable, and an already-confirmed number as confirmed", async () => {
    fakes.start.mockRejectedValue(
      new GraphqlError(200, [{ message: "x", extensions: { code: "UNPROCESSABLE", originalCode: "PHONE_VERIFICATION_UNAVAILABLE" } }] as never),
    );
    const first = renderHook(() => usePhoneVerification(message));
    await flush();
    expect(first.result.current.state.status).toBe("unavailable");

    fakes.start.mockRejectedValue(
      new GraphqlError(200, [{ message: "x", extensions: { code: "CONFLICT", originalCode: "PHONE_NUMBER_ALREADY_VERIFIED" } }] as never),
    );
    const second = renderHook(() => usePhoneVerification(message));
    await flush();
    expect(second.result.current.state.status).toBe("confirmed");
  });

  it("reports anything else as failed", async () => {
    fakes.start.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => usePhoneVerification(message));
    await flush();
    expect(result.current.state.status).toBe("failed");
  });

  it("ignores an answer that arrives after a newer request was made", async () => {
    let resolveFirst!: (value: typeof TICKET) => void;
    fakes.start
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce({ ...TICKET, code: "222222" });
    const { result } = renderHook(() => usePhoneVerification(message));
    await act(async () => {
      result.current.restart();
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      resolveFirst({ ...TICKET, code: "111111" });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.state).toMatchObject({ status: "ready", code: "222222" });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/frontend/web && npx vitest run src/features/auth/viewmodel/__tests__/use-phone-verification.test.ts`
Expected: FAIL, because `../use-phone-verification` does not exist.

- [ ] **Step 3: Write the viewmodel**

`apps/frontend/web/src/features/auth/viewmodel/use-phone-verification.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "@/shared/lib/api/auth-client";
import { GraphqlError } from "@/shared/lib/graphql/session-graphql";
import { startPhoneVerification } from "@/features/user/data/user.repository";
import { whatsAppLink } from "@/features/auth/domain/phone-verification";

/** One small session read per open waiting screen, for at most 15 minutes. */
export const POLL_INTERVAL_MS = 3000;

interface Ticket {
  code: string;
  businessNumber: string;
  expiresAt: Date;
  link: string;
}

export type PhoneVerificationState =
  | { status: "starting" }
  | ({ status: "ready" } & Ticket)
  | ({ status: "waiting" } & Ticket)
  | { status: "confirmed" }
  | { status: "expired" }
  | { status: "unavailable" }
  | { status: "failed" };

/**
 * Drives "confirm my number by WhatsApp".
 *
 * The code is issued on mount so the page's button can be a plain link: a
 * `window.open` that waits on a network answer first is a blocked popup on
 * iOS and in desktop browsers.
 *
 * While waiting it reads the session every 3 s and the moment the tab comes
 * back into view, skipping better-auth's 60-second cookie cache, which would
 * otherwise hide the confirmation for up to a minute.
 */
export function usePhoneVerification(messageFor: (code: string) => string) {
  const [state, setState] = useState<PhoneVerificationState>({ status: "starting" });
  const attempt = useRef(0);
  const messageRef = useRef(messageFor);
  messageRef.current = messageFor;

  const start = useCallback(async () => {
    const mine = ++attempt.current;
    setState({ status: "starting" });
    try {
      const ticket = await startPhoneVerification();
      if (mine !== attempt.current) return;
      setState({
        status: "ready",
        code: ticket.code,
        businessNumber: ticket.businessNumber,
        expiresAt: new Date(ticket.expiresAt),
        link: whatsAppLink(ticket.businessNumber, messageRef.current(ticket.code)),
      });
    } catch (error) {
      if (mine !== attempt.current) return;
      const code = error instanceof GraphqlError ? error.code : undefined;
      if (code === "PHONE_VERIFICATION_UNAVAILABLE") setState({ status: "unavailable" });
      else if (code === "PHONE_NUMBER_ALREADY_VERIFIED") setState({ status: "confirmed" });
      else setState({ status: "failed" });
    }
  }, []);

  useEffect(() => {
    void start();
    // Invalidates the in-flight request, so StrictMode's double mount keeps
    // only the second code — the one the server actually has.
    return () => {
      attempt.current++;
    };
  }, [start]);

  const expiresAt =
    state.status === "ready" || state.status === "waiting" ? state.expiresAt.getTime() : null;
  useEffect(() => {
    if (expiresAt === null) return;
    const id = setTimeout(() => setState({ status: "expired" }), Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(id);
  }, [expiresAt]);

  const waiting = state.status === "waiting";
  useEffect(() => {
    if (!waiting) return;
    let cancelled = false;

    async function check() {
      try {
        const { data } = await authClient.getSession({ query: { disableCookieCache: true } });
        const verified = (data?.user as { phoneNumberVerified?: boolean | null } | undefined)
          ?.phoneNumberVerified;
        if (verified && !cancelled) {
          setState({ status: "confirmed" });
          // The header and Conta → Segurança read the shared session store.
          authClient.$store.notify("$sessionSignal");
        }
      } catch {
        // A failed read is retried by the next tick.
      }
    }

    const onReturn = () => {
      if (document.visibilityState === "visible") void check();
    };
    const id = setInterval(check, POLL_INTERVAL_MS);
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [waiting]);

  const markSent = useCallback(() => {
    setState((s) => (s.status === "ready" ? { ...s, status: "waiting" as const } : s));
  }, []);

  const restart = useCallback(() => {
    void start();
  }, [start]);

  return { state, markSent, restart };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run the command from Step 2.
Expected: PASS (9 tests). If `authClient.$store` is not in the client's TypeScript type, `bun run check-types` will say so. Then cast at the call site: `(authClient as unknown as { $store: { notify(s: string): void } }).$store.notify("$sessionSignal")`, with the comment `// $store is on the runtime client (better-auth/client config.mjs) but not on its public type.`

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/web/src/features/auth/viewmodel/use-phone-verification.ts \
  apps/frontend/web/src/features/auth/viewmodel/__tests__/use-phone-verification.test.ts
git commit -m "feat(web): usePhoneVerification — issue, link, wait, confirm, expire

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: The screen, its route and its copy

**Files:**
- Modify (full rewrite): `apps/frontend/web/src/features/auth/components/verify-phone.tsx`
- Create: `apps/frontend/web/src/features/auth/components/__tests__/verify-phone.test.tsx`
- Modify: `apps/frontend/web/src/routes/verify-phone.tsx`
- Create: `apps/frontend/web/src/routes/__tests__/verify-phone.test.tsx`
- Modify: `apps/frontend/web/src/shared/locales/{pt-MZ,pt-PT,en-US,es-ES,fr-FR,de-DE,it-IT,nl-NL}/auth.json`

**Interfaces:**
- Consumes: `usePhoneVerification` (Task 10), `formatPhone` (Task 9).
- Produces:
  - `VerifyPhone({ next }: { next?: string })`
  - the route `/verify-phone` with search `{ next?: string }`

- [ ] **Step 1: Write the copy (all eight locales)**

Save this as `/tmp/verify-phone-copy.mjs` and run it from `apps/frontend/web`. It removes the SMS screen's strings, changes `phoneHint` and adds the `verifyPhone` group:

```js
import { readFileSync, writeFileSync } from "node:fs";

const REMOVE = [
  "verifyPhoneTitle", "verifyPhoneSubtitle", "otpSentTo", "sendCode", "verifyCode", "verifying",
  "resendCode", "resendIn", "otpDigitLabel", "otpInvalid", "otpSendFailed",
  "phoneAlreadyVerifiedTitle", "phoneAlreadyVerifiedSubtitle", "noPhoneOnAccount", "backToHome",
];

const pt = {
  phoneHint: "Vai confirmá-lo com uma mensagem no WhatsApp.",
  verifyPhone: {
    emailConfirmed: "E-mail confirmado",
    title: "Confirme o seu número",
    lede: "Envie-nos uma mensagem pelo WhatsApp a partir deste número. Demora menos de um minuto.",
    yourNumber: "O seu número",
    change: "Alterar",
    confirmWithWhatsApp: "Confirmar pelo WhatsApp",
    hint: "O WhatsApp abre com a mensagem já escrita. Só tem de tocar em enviar.",
    notNow: "Agora não",
    backToAccount: "Voltar à conta",
    waitingTitle: "Toque em enviar no WhatsApp",
    waitingLede: "Assim que a mensagem chegar, esta página confirma o número sozinha.",
    messageLabel: "A mensagem",
    messageTo: "Para a Ntizo · {{number}}",
    validUntil: "até {{time}}",
    waiting: "À espera da mensagem…",
    openAgain: "Abrir o WhatsApp outra vez",
    noWhatsApp: "Não tem WhatsApp neste número? Pode confirmar mais tarde em Conta › Segurança.",
    confirmedTitle: "Número confirmado",
    confirmedLede: "{{phone}} está confirmado na sua conta.",
    continue: "Continuar",
    expiredEyebrow: "Passaram mais de 15 minutos",
    expiredTitle: "O código expirou",
    expiredLede: "Peça um novo e envie-o logo a seguir. O anterior deixa de funcionar.",
    newCode: "Pedir um novo código",
    failedTitle: "Não foi possível começar agora",
    failedLede: "Tente dentro de momentos.",
    retry: "Tentar outra vez",
    preparing: "A preparar…",
    message: "Olá Ntizo! O meu código de confirmação é {{code}}",
  },
};

const COPY = {
  "pt-MZ": pt,
  "pt-PT": pt,
  "en-US": {
    phoneHint: "You'll confirm it with a WhatsApp message.",
    verifyPhone: {
      emailConfirmed: "Email confirmed", title: "Confirm your number",
      lede: "Send us a WhatsApp message from this number. It takes less than a minute.",
      yourNumber: "Your number", change: "Change", confirmWithWhatsApp: "Confirm with WhatsApp",
      hint: "WhatsApp opens with the message already written. You only need to tap send.",
      notNow: "Not now", backToAccount: "Back to account", waitingTitle: "Tap send in WhatsApp",
      waitingLede: "As soon as the message arrives, this page confirms the number by itself.",
      messageLabel: "The message", messageTo: "To Ntizo · {{number}}", validUntil: "until {{time}}",
      waiting: "Waiting for the message…", openAgain: "Open WhatsApp again",
      noWhatsApp: "No WhatsApp on this number? You can confirm later in Account › Security.",
      confirmedTitle: "Number confirmed", confirmedLede: "{{phone}} is confirmed on your account.",
      continue: "Continue", expiredEyebrow: "More than 15 minutes have passed",
      expiredTitle: "The code has expired",
      expiredLede: "Ask for a new one and send it right away. The previous one stops working.",
      newCode: "Get a new code", failedTitle: "We couldn't start right now",
      failedLede: "Try again in a moment.", retry: "Try again", preparing: "Getting ready…",
      message: "Hi Ntizo! My confirmation code is {{code}}",
    },
  },
  "es-ES": {
    phoneHint: "Lo confirmarás con un mensaje de WhatsApp.",
    verifyPhone: {
      emailConfirmed: "Correo electrónico confirmado", title: "Confirma tu número",
      lede: "Envíanos un mensaje por WhatsApp desde este número. Tarda menos de un minuto.",
      yourNumber: "Tu número", change: "Cambiar", confirmWithWhatsApp: "Confirmar por WhatsApp",
      hint: "WhatsApp se abre con el mensaje ya escrito. Solo tienes que tocar enviar.",
      notNow: "Ahora no", backToAccount: "Volver a la cuenta", waitingTitle: "Toca enviar en WhatsApp",
      waitingLede: "En cuanto llegue el mensaje, esta página confirma el número sola.",
      messageLabel: "El mensaje", messageTo: "Para Ntizo · {{number}}", validUntil: "hasta las {{time}}",
      waiting: "Esperando el mensaje…", openAgain: "Abrir WhatsApp otra vez",
      noWhatsApp: "¿No tienes WhatsApp en este número? Puedes confirmarlo más tarde en Cuenta › Seguridad.",
      confirmedTitle: "Número confirmado", confirmedLede: "{{phone}} está confirmado en tu cuenta.",
      continue: "Continuar", expiredEyebrow: "Han pasado más de 15 minutos",
      expiredTitle: "El código ha caducado",
      expiredLede: "Pide uno nuevo y envíalo enseguida. El anterior deja de funcionar.",
      newCode: "Pedir un código nuevo", failedTitle: "No se ha podido empezar ahora",
      failedLede: "Inténtalo de nuevo en unos momentos.", retry: "Intentar de nuevo", preparing: "Preparando…",
      message: "¡Hola Ntizo! Mi código de confirmación es {{code}}",
    },
  },
  "fr-FR": {
    phoneHint: "Vous le confirmerez avec un message WhatsApp.",
    verifyPhone: {
      emailConfirmed: "E-mail confirmé", title: "Confirmez votre numéro",
      lede: "Envoyez-nous un message WhatsApp depuis ce numéro. Cela prend moins d'une minute.",
      yourNumber: "Votre numéro", change: "Modifier", confirmWithWhatsApp: "Confirmer par WhatsApp",
      hint: "WhatsApp s'ouvre avec le message déjà rédigé. Il vous suffit d'appuyer sur envoyer.",
      notNow: "Pas maintenant", backToAccount: "Retour au compte", waitingTitle: "Appuyez sur envoyer dans WhatsApp",
      waitingLede: "Dès que le message arrive, cette page confirme le numéro toute seule.",
      messageLabel: "Le message", messageTo: "À Ntizo · {{number}}", validUntil: "jusqu'à {{time}}",
      waiting: "En attente du message…", openAgain: "Rouvrir WhatsApp",
      noWhatsApp: "Pas de WhatsApp sur ce numéro ? Vous pourrez confirmer plus tard dans Compte › Sécurité.",
      confirmedTitle: "Numéro confirmé", confirmedLede: "{{phone}} est confirmé sur votre compte.",
      continue: "Continuer", expiredEyebrow: "Plus de 15 minutes se sont écoulées",
      expiredTitle: "Le code a expiré",
      expiredLede: "Demandez-en un nouveau et envoyez-le aussitôt. L'ancien ne fonctionne plus.",
      newCode: "Demander un nouveau code", failedTitle: "Impossible de commencer pour l'instant",
      failedLede: "Réessayez dans un instant.", retry: "Réessayer", preparing: "Préparation…",
      message: "Bonjour Ntizo ! Mon code de confirmation est {{code}}",
    },
  },
  "de-DE": {
    phoneHint: "Sie bestätigen sie mit einer WhatsApp-Nachricht.",
    verifyPhone: {
      emailConfirmed: "E-Mail bestätigt", title: "Bestätigen Sie Ihre Nummer",
      lede: "Senden Sie uns von dieser Nummer eine WhatsApp-Nachricht. Das dauert weniger als eine Minute.",
      yourNumber: "Ihre Nummer", change: "Ändern", confirmWithWhatsApp: "Mit WhatsApp bestätigen",
      hint: "WhatsApp öffnet sich mit der fertigen Nachricht. Sie müssen nur auf Senden tippen.",
      notNow: "Jetzt nicht", backToAccount: "Zurück zum Konto", waitingTitle: "Tippen Sie in WhatsApp auf Senden",
      waitingLede: "Sobald die Nachricht ankommt, bestätigt diese Seite die Nummer von selbst.",
      messageLabel: "Die Nachricht", messageTo: "An Ntizo · {{number}}", validUntil: "bis {{time}}",
      waiting: "Warten auf die Nachricht…", openAgain: "WhatsApp erneut öffnen",
      noWhatsApp: "Kein WhatsApp auf dieser Nummer? Sie können später unter Konto › Sicherheit bestätigen.",
      confirmedTitle: "Nummer bestätigt", confirmedLede: "{{phone}} ist in Ihrem Konto bestätigt.",
      continue: "Weiter", expiredEyebrow: "Mehr als 15 Minuten sind vergangen",
      expiredTitle: "Der Code ist abgelaufen",
      expiredLede: "Fordern Sie einen neuen an und senden Sie ihn sofort. Der alte funktioniert nicht mehr.",
      newCode: "Neuen Code anfordern", failedTitle: "Das hat gerade nicht geklappt",
      failedLede: "Versuchen Sie es gleich noch einmal.", retry: "Erneut versuchen", preparing: "Wird vorbereitet…",
      message: "Hallo Ntizo! Mein Bestätigungscode ist {{code}}",
    },
  },
  "it-IT": {
    phoneHint: "Lo confermerai con un messaggio WhatsApp.",
    verifyPhone: {
      emailConfirmed: "E-mail confermata", title: "Conferma il tuo numero",
      lede: "Inviaci un messaggio WhatsApp da questo numero. Ci vuole meno di un minuto.",
      yourNumber: "Il tuo numero", change: "Modifica", confirmWithWhatsApp: "Conferma con WhatsApp",
      hint: "WhatsApp si apre con il messaggio già scritto. Devi solo toccare invia.",
      notNow: "Non ora", backToAccount: "Torna all'account", waitingTitle: "Tocca invia su WhatsApp",
      waitingLede: "Appena arriva il messaggio, questa pagina conferma il numero da sola.",
      messageLabel: "Il messaggio", messageTo: "A Ntizo · {{number}}", validUntil: "fino alle {{time}}",
      waiting: "In attesa del messaggio…", openAgain: "Apri di nuovo WhatsApp",
      noWhatsApp: "Non hai WhatsApp su questo numero? Puoi confermarlo più tardi in Account › Sicurezza.",
      confirmedTitle: "Numero confermato", confirmedLede: "{{phone}} è confermato sul tuo account.",
      continue: "Continua", expiredEyebrow: "Sono passati più di 15 minuti",
      expiredTitle: "Il codice è scaduto",
      expiredLede: "Richiedine uno nuovo e invialo subito. Quello precedente non funziona più.",
      newCode: "Richiedi un nuovo codice", failedTitle: "Non è stato possibile iniziare ora",
      failedLede: "Riprova tra un momento.", retry: "Riprova", preparing: "Preparazione…",
      message: "Ciao Ntizo! Il mio codice di conferma è {{code}}",
    },
  },
  "nl-NL": {
    phoneHint: "Je bevestigt het met een WhatsApp-bericht.",
    verifyPhone: {
      emailConfirmed: "E-mail bevestigd", title: "Bevestig je nummer",
      lede: "Stuur ons een WhatsApp-bericht vanaf dit nummer. Het duurt minder dan een minuut.",
      yourNumber: "Je nummer", change: "Wijzigen", confirmWithWhatsApp: "Bevestigen via WhatsApp",
      hint: "WhatsApp opent met het bericht al ingevuld. Je hoeft alleen op verzenden te tikken.",
      notNow: "Nu niet", backToAccount: "Terug naar account", waitingTitle: "Tik op verzenden in WhatsApp",
      waitingLede: "Zodra het bericht binnen is, bevestigt deze pagina het nummer vanzelf.",
      messageLabel: "Het bericht", messageTo: "Aan Ntizo · {{number}}", validUntil: "tot {{time}}",
      waiting: "Wachten op het bericht…", openAgain: "WhatsApp opnieuw openen",
      noWhatsApp: "Geen WhatsApp op dit nummer? Je kunt later bevestigen via Account › Beveiliging.",
      confirmedTitle: "Nummer bevestigd", confirmedLede: "{{phone}} is bevestigd op je account.",
      continue: "Doorgaan", expiredEyebrow: "Er zijn meer dan 15 minuten verstreken",
      expiredTitle: "De code is verlopen",
      expiredLede: "Vraag een nieuwe aan en stuur die meteen. De vorige werkt niet meer.",
      newCode: "Nieuwe code aanvragen", failedTitle: "Starten lukt nu niet",
      failedLede: "Probeer het zo meteen opnieuw.", retry: "Opnieuw proberen", preparing: "Voorbereiden…",
      message: "Hoi Ntizo! Mijn bevestigingscode is {{code}}",
    },
  },
};

for (const [locale, copy] of Object.entries(COPY)) {
  const path = `src/shared/locales/${locale}/auth.json`;
  const json = JSON.parse(readFileSync(path, "utf8"));
  for (const key of REMOVE) delete json[key];
  json.phoneHint = copy.phoneHint;
  json.verifyPhone = copy.verifyPhone;
  writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
}

// Every locale must now declare the same verifyPhone keys as pt-MZ.
const reference = Object.keys(COPY["pt-MZ"].verifyPhone).sort().join();
for (const [locale, copy] of Object.entries(COPY)) {
  if (Object.keys(copy.verifyPhone).sort().join() !== reference) throw new Error(`${locale} verifyPhone keys differ`);
}
console.log("auth.json updated in", Object.keys(COPY).length, "locales");
```

```bash
cd apps/frontend/web && node /tmp/verify-phone-copy.mjs && rm /tmp/verify-phone-copy.mjs
grep -rn '"verifyPhoneTitle"\|"otpSendFailed"\|"backToHome"' src/shared/locales || echo "old keys gone"
```

Expected: `auth.json updated in 8 locales` and `old keys gone`. The old keys are still referenced by the current `verify-phone.tsx`, which Step 4 replaces.

- [ ] **Step 2: Write the failing tests**

`apps/frontend/web/src/features/auth/components/__tests__/verify-phone.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithRouter } from "@/test/render-with-router";
import type { PhoneVerificationState } from "@/features/auth/viewmodel/use-phone-verification";

const fakes = vi.hoisted(() => ({
  state: { status: "starting" } as PhoneVerificationState,
  markSent: vi.fn(),
  restart: vi.fn(),
}));

vi.mock("@/features/auth/viewmodel/use-phone-verification", () => ({
  usePhoneVerification: () => ({ state: fakes.state, markSent: fakes.markSent, restart: fakes.restart }),
}));
vi.mock("@/shared/lib/api/auth-client", () => ({
  useSession: () => ({ data: { user: { phoneNumber: "+258879801517" } }, isPending: false }),
}));

const { VerifyPhone } = await import("../verify-phone");

const TICKET = {
  code: "483920",
  businessNumber: "+258843002020",
  expiresAt: new Date("2026-09-21T14:52:00.000Z"),
  link: "https://wa.me/258843002020?text=Hi%20Ntizo!%20My%20confirmation%20code%20is%20483920",
};
const ROUTES = ["/account", "/bookings"];

beforeEach(() => {
  fakes.markSent.mockReset();
  fakes.restart.mockReset();
});

describe("VerifyPhone", () => {
  it("offers WhatsApp as a real link, and marks the person as waiting when they use it", async () => {
    fakes.state = { status: "ready", ...TICKET };
    await renderWithRouter(<VerifyPhone next="/bookings" />, { routes: ROUTES });

    expect(screen.getByRole("heading", { name: /confirm your number/i })).toBeInTheDocument();
    expect(screen.getByText("Email confirmed")).toBeInTheDocument();
    expect(screen.getByText("+258 87 980 1517")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /change/i })).toHaveAttribute("href", "/account");

    const whatsapp = screen.getByRole("link", { name: /confirm with whatsapp/i });
    expect(whatsapp).toHaveAttribute("href", TICKET.link);
    expect(whatsapp).toHaveAttribute("target", "_blank");
    fireEvent.click(whatsapp);
    expect(fakes.markSent).toHaveBeenCalled();

    expect(screen.getByRole("button", { name: /not now/i })).toBeInTheDocument();
  });

  it("from the account, offers the way back instead of 'not now', and says nothing about the email", async () => {
    fakes.state = { status: "ready", ...TICKET };
    await renderWithRouter(<VerifyPhone />, { routes: ROUTES });
    expect(screen.queryByText("Email confirmed")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /not now/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to account/i })).toHaveAttribute("href", "/account");
  });

  it("while waiting, shows the message and the code, and can reopen WhatsApp", async () => {
    fakes.state = { status: "waiting", ...TICKET };
    await renderWithRouter(<VerifyPhone next="/bookings" />, { routes: ROUTES });
    expect(screen.getByRole("heading", { name: /tap send in whatsapp/i })).toBeInTheDocument();
    expect(screen.getByText("483920")).toBeInTheDocument();
    expect(screen.getByText(/waiting for the message/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open whatsapp again/i })).toHaveAttribute("href", TICKET.link);
  });

  it("once confirmed, continues to where the person was going", async () => {
    fakes.state = { status: "confirmed" };
    const { router } = await renderWithRouter(<VerifyPhone next="/bookings" />, { routes: ROUTES });
    expect(screen.getByRole("heading", { name: /number confirmed/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/bookings"));
  });

  it("when the code expired, asks for a new one", async () => {
    fakes.state = { status: "expired" };
    await renderWithRouter(<VerifyPhone next="/bookings" />, { routes: ROUTES });
    expect(screen.getByRole("heading", { name: /the code has expired/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /get a new code/i }));
    expect(fakes.restart).toHaveBeenCalled();
  });

  it("as an invite on a stage without WhatsApp, steps aside to where the person was going", async () => {
    fakes.state = { status: "unavailable" };
    const { router } = await renderWithRouter(<VerifyPhone next="/bookings" />, { routes: ROUTES });
    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/bookings"));
  });

  it("from the account, says it could not start and offers a retry", async () => {
    fakes.state = { status: "unavailable" };
    await renderWithRouter(<VerifyPhone />, { routes: ROUTES });
    expect(screen.getByRole("heading", { name: /couldn't start right now/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(fakes.restart).toHaveBeenCalled();
  });
});
```

`apps/frontend/web/src/routes/__tests__/verify-phone.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

/**
 * The real route: who is sent where before the page draws anything.
 * The page itself is stubbed; its states are `verify-phone.test.tsx`'s.
 */
const fakes = vi.hoisted(() => ({
  session: null as { user: { phoneNumber?: string | null; phoneNumberVerified?: boolean | null } } | null,
}));

vi.mock("@/shared/lib/api/auth-client", () => ({
  authClient: { getSession: async () => ({ data: fakes.session }) },
}));
vi.mock("@/features/auth/components/verify-phone", () => ({
  VerifyPhone: ({ next }: { next?: string }) => <p>verify page next={next ?? "none"}</p>,
}));

const { Route: VerifyPhoneRoute } = await import("../verify-phone");

async function visit(url: string) {
  const root = createRootRoute();
  const page = VerifyPhoneRoute.update({ getParentRoute: () => root, path: "/verify-phone", id: undefined } as never);
  const stubs = ["/sign-in", "/account", "/bookings"].map((path) =>
    createRoute({ getParentRoute: () => root, path, component: () => <p>at {path}</p> }),
  );
  const router = createRouter({
    routeTree: root.addChildren([page as never, ...stubs]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  render(<RouterProvider router={router} />);
  await router.load();
  return router;
}

beforeEach(() => {
  fakes.session = null;
});

describe("/verify-phone", () => {
  it("sends a signed-out visitor to sign in", async () => {
    await visit("/verify-phone?next=%2Fbookings");
    expect(await screen.findByText("at /sign-in")).toBeInTheDocument();
  });

  it("as an invite, skips straight on for an account with no number", async () => {
    fakes.session = { user: { phoneNumber: null } };
    await visit("/verify-phone?next=%2Fbookings");
    expect(await screen.findByText("at /bookings")).toBeInTheDocument();
  });

  it("as an invite, skips straight on for a number already confirmed", async () => {
    fakes.session = { user: { phoneNumber: "+258879801517", phoneNumberVerified: true } };
    await visit("/verify-phone?next=%2Fbookings");
    expect(await screen.findByText("at /bookings")).toBeInTheDocument();
  });

  it("as an invite, shows the page for a number still to confirm", async () => {
    fakes.session = { user: { phoneNumber: "+258879801517", phoneNumberVerified: false } };
    await visit("/verify-phone?next=%2Fbookings");
    expect(await screen.findByText("verify page next=/bookings")).toBeInTheDocument();
  });

  it("drops a `next` that leaves the site", async () => {
    fakes.session = { user: { phoneNumber: "+258879801517", phoneNumberVerified: false } };
    await visit("/verify-phone?next=%2F%2Fevil.example");
    expect(await screen.findByText("verify page next=none")).toBeInTheDocument();
  });

  it("from the account, sends someone with no number to add one", async () => {
    fakes.session = { user: { phoneNumber: null } };
    await visit("/verify-phone");
    await waitFor(() => expect(screen.getByText("at /account")).toBeInTheDocument());
  });
});
```

If `Route.update(...)` does not re-parent cleanly with the installed TanStack Router, follow `routes/__tests__/booking.$bookingId.confirm.test.tsx`: import `Route` and mount it with the same `createRootRoute` / `createRouter` shape used there. It is the reference for driving a real file route in this repo. Keep the six assertions unchanged.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd apps/frontend/web && npx vitest run src/features/auth/components/__tests__/verify-phone.test.tsx src/routes/__tests__/verify-phone.test.tsx`
Expected: FAIL. The old screen renders the SMS copy, the route has no `validateSearch`, and there are no redirects for `next`.

- [ ] **Step 4: Rewrite the screen**

Replace `apps/frontend/web/src/features/auth/components/verify-phone.tsx` entirely:

```tsx
import { useEffect, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Check, CircleAlert, CircleCheck, MessageCircle } from "lucide-react";
import { useSession } from "@/shared/lib/api/auth-client";
import { usePhoneVerification } from "@/features/auth/viewmodel/use-phone-verification";
import { formatPhone } from "@/features/auth/domain/phone-verification";
import { textAction } from "@/shared/ui/text-action";

/**
 * Confirming a phone number by sending Ntizo a WhatsApp message.
 *
 * Drawn on the site's rules rather than on `AuthLayout`'s card: white page,
 * navy heading and action, hairlines, no tinted icon circle. See the approved
 * mockup, docs/superpowers/specs/2026-09-21-whatsapp-phone-verification.mockup.html.
 *
 * `next` present means the page was reached as the invite after an email
 * confirmation: "Agora não" and "Continuar" go there, and a stage without
 * WhatsApp is skipped silently. Absent means Conta → Segurança sent them.
 */
export function VerifyPhone({ next }: { next?: string }) {
  const { t, i18n } = useTranslation("auth");
  const navigate = useNavigate();
  const { data: session } = useSession();
  const phone = (session?.user as { phoneNumber?: string | null } | undefined)?.phoneNumber ?? "";
  const { state, markSent, restart } = usePhoneVerification((code) =>
    t("verifyPhone.message", { code }),
  );

  const invite = next !== undefined;
  const goOn = () => void navigate({ href: next ?? "/account", replace: true });

  useEffect(() => {
    if (invite && state.status === "unavailable") void navigate({ href: next, replace: true });
  }, [invite, next, navigate, state.status]);

  const leave = invite ? (
    <button type="button" onClick={goOn} className={quiet}>
      {t("verifyPhone.notNow")}
    </button>
  ) : (
    <Link to="/account" className={quiet}>
      {t("verifyPhone.backToAccount")}
    </Link>
  );

  const numberFact = phone ? (
    <div className="flex items-end justify-between gap-4 border-y border-[var(--color-border)] py-4">
      <div>
        <p className="type-caption text-[var(--color-muted-foreground)]">{t("verifyPhone.yourNumber")}</p>
        <p className="text-[21px] font-semibold tabular-nums text-[var(--color-foreground)]">{formatPhone(phone)}</p>
      </div>
      <Link to="/account" className={textAction()}>
        {t("verifyPhone.change")}
      </Link>
    </div>
  ) : null;

  if (state.status === "starting" || (invite && state.status === "unavailable")) {
    return (
      <Page>
        <p className="type-body text-[var(--color-muted-foreground)]" aria-live="polite">
          {t("verifyPhone.preparing")}
        </p>
      </Page>
    );
  }

  if (state.status === "ready") {
    return (
      <Page>
        {invite ? (
          <p className="type-body-medium flex items-center gap-1.5 text-[var(--color-success)]">
            <Check className="h-4 w-4" aria-hidden />
            {t("verifyPhone.emailConfirmed")}
          </p>
        ) : null}
        <h1 className="type-h1 text-[var(--color-headline)]">{t("verifyPhone.title")}</h1>
        <p className="type-body max-w-[40ch] text-[var(--color-muted-foreground)]">{t("verifyPhone.lede")}</p>
        {numberFact}
        <a href={state.link} target="_blank" rel="noopener noreferrer" onClick={markSent} className={primary}>
          <MessageCircle className="h-5 w-5" aria-hidden />
          {t("verifyPhone.confirmWithWhatsApp")}
        </a>
        <p className="type-body -mt-2 text-[var(--color-muted-foreground)]">{t("verifyPhone.hint")}</p>
        <div className="pt-2">{leave}</div>
      </Page>
    );
  }

  if (state.status === "waiting") {
    const until = new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit" }).format(
      state.expiresAt,
    );
    return (
      <Page
        aside={
          <div className="rounded-[18px] bg-[var(--color-muted)] p-5">
            <p className="type-caption text-[var(--color-muted-foreground)]">{t("verifyPhone.messageLabel")}</p>
            <p className="mt-2 text-[16px] leading-[1.45] text-[var(--color-foreground)] md:text-[19px]">
              {t("verifyPhone.message", { code: "" }).trim()}{" "}
              <span className="font-bold tracking-[0.06em] text-[var(--color-headline)] tabular-nums">
                {state.code}
              </span>
            </p>
            <p className="type-caption mt-3 flex justify-between gap-3 border-t border-[var(--color-border)] pt-2.5 text-[var(--color-muted-foreground)]">
              <span>{t("verifyPhone.messageTo", { number: formatPhone(state.businessNumber) })}</span>
              <span className="tabular-nums">{t("verifyPhone.validUntil", { time: until })}</span>
            </p>
          </div>
        }
      >
        <h1 className="type-h1 text-[var(--color-headline)]">{t("verifyPhone.waitingTitle")}</h1>
        <p className="type-body max-w-[40ch] text-[var(--color-muted-foreground)]">{t("verifyPhone.waitingLede")}</p>
        <p className="type-body-medium flex items-center gap-2.5 text-[var(--color-foreground)]" aria-live="polite">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-headline)] opacity-40 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--color-headline)]" />
          </span>
          {t("verifyPhone.waiting")}
        </p>
        <a href={state.link} target="_blank" rel="noopener noreferrer" className={secondary}>
          <MessageCircle className="h-5 w-5" aria-hidden />
          {t("verifyPhone.openAgain")}
        </a>
        <p className="type-body text-[var(--color-muted-foreground)]">{t("verifyPhone.noWhatsApp")}</p>
        <div>{leave}</div>
      </Page>
    );
  }

  if (state.status === "confirmed") {
    return (
      <Page>
        <CircleCheck className="h-11 w-11 text-[var(--color-success)]" strokeWidth={1.6} aria-hidden />
        <h1 className="type-h1 text-[var(--color-headline)]">{t("verifyPhone.confirmedTitle")}</h1>
        {phone ? (
          <p className="type-body text-[var(--color-muted-foreground)]">
            {t("verifyPhone.confirmedLede", { phone: formatPhone(phone) })}
          </p>
        ) : null}
        <button type="button" onClick={goOn} className={primary}>
          {t("verifyPhone.continue")}
        </button>
      </Page>
    );
  }

  const expired = state.status === "expired";
  return (
    <Page>
      {expired ? (
        <p className="type-body-medium flex items-center gap-1.5 text-[var(--color-destructive)]">
          <CircleAlert className="h-4 w-4" aria-hidden />
          {t("verifyPhone.expiredEyebrow")}
        </p>
      ) : null}
      <h1 className="type-h1 text-[var(--color-headline)]">
        {expired ? t("verifyPhone.expiredTitle") : t("verifyPhone.failedTitle")}
      </h1>
      <p className="type-body max-w-[40ch] text-[var(--color-muted-foreground)]">
        {expired ? t("verifyPhone.expiredLede") : t("verifyPhone.failedLede")}
      </p>
      {expired ? numberFact : null}
      <button type="button" onClick={restart} className={primary}>
        {expired ? <MessageCircle className="h-5 w-5" aria-hidden /> : null}
        {expired ? t("verifyPhone.newCode") : t("verifyPhone.retry")}
      </button>
      <div className="pt-2">{leave}</div>
    </Page>
  );
}

const primary =
  "inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] bg-[var(--color-navy-surface)] px-5 text-[16px] font-semibold text-[var(--color-navy-on)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2";
const secondary =
  "inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] border border-[var(--color-border-strong)] px-5 text-[16px] font-semibold text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 md:w-auto md:self-start";
const quiet =
  "type-body-medium text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:underline underline-offset-4";

/** The page frame: the wordmark, then one column (two on wide screens when there is an aside). */
function Page({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="min-h-svh bg-[var(--color-background)]">
      <div className="px-6 pt-6 md:px-14 md:pt-7">
        <Link to="/" className="text-[24px] font-extrabold leading-none tracking-[-0.04em] text-[var(--color-primary)]">
          ntizo
        </Link>
      </div>
      <main
        className={
          aside
            ? "mx-auto grid max-w-[980px] gap-10 px-6 py-12 md:grid-cols-[minmax(0,460px)_minmax(0,420px)] md:items-center md:justify-center md:gap-24 md:py-20"
            : "mx-auto max-w-[460px] px-6 py-12 md:py-20"
        }
      >
        <div className="flex flex-col gap-[22px]">{children}</div>
        {aside ?? null}
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Update the route**

Replace `apps/frontend/web/src/routes/verify-phone.tsx`:

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "@/shared/lib/api/auth-client";
import { isSafeInternalPath } from "@/shared/lib/zones";
import { VerifyPhone } from "@/features/auth/components/verify-phone";

/**
 * Deliberately outside `_public`: that layout bounces anyone with a session,
 * and this screen needs one — the number being confirmed is read from the
 * session rather than retyped, so nobody can aim a code at a number that
 * isn't theirs.
 *
 * `next` makes it the invite every email-confirmation link lands on. As an
 * invite it steps aside before drawing anything when there is nothing to do
 * — no number (a Google sign-up) or one already confirmed. Reached from the
 * account without a number, the place to add one is the profile form.
 */
export const Route = createFileRoute("/verify-phone")({
  validateSearch: (search: Record<string, unknown>): { next?: string } =>
    typeof search.next === "string" && isSafeInternalPath(search.next) ? { next: search.next } : {},
  beforeLoad: async ({ search }) => {
    const { data: session } = await authClient.getSession();
    if (!session) throw redirect({ to: "/sign-in" });

    const user = session.user as { phoneNumber?: string | null; phoneNumberVerified?: boolean | null };
    if (search.next && (!user.phoneNumber || user.phoneNumberVerified)) {
      throw redirect({ href: search.next });
    }
    if (!search.next && !user.phoneNumber) throw redirect({ to: "/account" });
  },
  component: VerifyPhoneRoute,
});

function VerifyPhoneRoute() {
  const { next } = Route.useSearch();
  return <VerifyPhone next={next} />;
}
```

Regenerate the route tree, because `validateSearch` changes the route's search type: run `cd apps/frontend/web && npx vite build --mode development`, or start `bun run dev` for a few seconds and stop it. Either way the TanStack Router plugin rewrites `src/routeTree.gen.ts`. Include the regenerated file in the commit only if it changed.

- [ ] **Step 6: Run the tests to verify they pass**

Run the command from Step 3.
Expected: PASS (13 tests).

Run: `cd apps/frontend/web && npx vitest run src/features/account src/features/auth src/routes`
Expected: PASS. The account pages still link "Verificar" to `/verify-phone` and are untouched.

Run: `bun run check-types && bun run lint`
Expected: PASS. Lint covers the boundaries rules: `components` imports `viewmodel`, `domain` and `shared` only.

- [ ] **Step 7: Look at it once**

Boot the web against the dev API. The dev API is not configured yet, so every visit shows "failed" or steps aside. To see the four states, temporarily point the mock in `verify-phone.test.tsx` at each state, or run the whole stack locally:
- `cd apps/backend/api && bun run dev` with `WHATSAPP_BUSINESS_NUMBER=+258843002020` and `WHATSAPP_APP_SECRET=local-secret` in `.dev.vars`;
- `cd apps/frontend/web && bun run dev`;
- sign in, open `/verify-phone?next=%2F`.

Take one screenshot at 390 px and one at 1280 px and compare them with the mockup. Fix only what differs visibly (spacing, colour, missing element). Do not add anything the mockup does not have.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/web/src/features/auth/components/verify-phone.tsx \
  apps/frontend/web/src/features/auth/components/__tests__/verify-phone.test.tsx \
  apps/frontend/web/src/routes/verify-phone.tsx apps/frontend/web/src/routes/__tests__/verify-phone.test.tsx \
  apps/frontend/web/src/shared/locales/*/auth.json
git status --porcelain apps/frontend/web/src/routeTree.gen.ts   # add it too if listed
git commit -m "feat(web): /verify-phone confirms by WhatsApp, on the site's own rules

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: The invite, and the sign-up hint

**Files:**
- Modify: `apps/frontend/web/src/features/auth/components/sign-up.tsx` (both `callbackURL`s)
- Modify: `apps/frontend/web/src/features/auth/components/sign-in.tsx` (the resend `callbackURL`)
- Modify: `apps/frontend/web/src/features/auth/components/__tests__/sign-in.test.tsx`
- Create: `apps/frontend/web/src/features/auth/components/__tests__/sign-up.test.tsx`

**Interfaces:**
- Consumes: `emailConfirmedCallbackURL` (Task 9) and the `phoneHint` copy (Task 11).

- [ ] **Step 1: Write the failing tests**

In `apps/frontend/web/src/features/auth/components/__tests__/sign-in.test.tsx`, in the test "tells an unverified account to confirm its email, and sends a new link when asked", change the expected callback:

```ts
        callbackURL: `${window.location.origin}/verify-phone?next=%2F`,
```

`apps/frontend/web/src/features/auth/components/__tests__/sign-up.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/shared/lib/api/auth-client", () => ({
  authClient: { signUp: { email: vi.fn() }, signIn: { social: vi.fn() }, sendVerificationEmail: vi.fn() },
  API_BASE_URL: "",
  AUTH_API_URL_FALLBACK: "http://localhost:8788",
}));

const { SignUp } = await import("../sign-up");

describe("SignUp", () => {
  it("says the number is confirmed on WhatsApp, and promises no SMS", async () => {
    await renderWithRouter(<SignUp />, { routes: ["/sign-in", "/terms", "/privacy"] });
    expect(screen.getByText("You'll confirm it with a WhatsApp message.")).toBeInTheDocument();
    expect(screen.queryByText(/sms/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/frontend/web && npx vitest run src/features/auth/components/__tests__/sign-in.test.tsx src/features/auth/components/__tests__/sign-up.test.tsx`
Expected: sign-in FAILS, because the callback is still `${origin}/`. Sign-up PASSES already, because Task 11 changed the copy. That is correct: the hint's behaviour was delivered with the copy, and this test pins it.

- [ ] **Step 3: Route the three links through the invite**

In `sign-up.tsx` and `sign-in.tsx`, import the helper:

```ts
import { emailConfirmedCallbackURL } from "@/features/auth/viewmodel/email-callback";
```

Replace each of the three expressions

```ts
`${window.location.origin}${isSafeInternalPath(next ?? null) ? next : "/"}`
```

(sign-up: in `signUp.email({... callbackURL })` and in `<ResendVerification callbackURL>`; sign-in: in `<ResendVerification callbackURL>`) with:

```ts
emailConfirmedCallbackURL(window.location.origin, next)
```

On the sign-up `callbackURL`, extend the existing comment with one line: `// It lands on the phone invite first (/verify-phone?next=…), which steps aside when there is nothing to confirm.` Remove the `isSafeInternalPath` import from either file only if nothing else in it still uses it. Sign-in still uses it elsewhere, so check with grep.

Do not touch the Google `callbackURL`s (`${window.location.origin}/`): those accounts have no number.

- [ ] **Step 4: Run the tests to verify they pass**

Run the command from Step 2.
Expected: PASS.

Run: `cd apps/frontend/web && npx vitest run src/features/auth && cd ../../.. && bun run check-types && bun run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/web/src/features/auth/components/sign-up.tsx apps/frontend/web/src/features/auth/components/sign-in.tsx \
  apps/frontend/web/src/features/auth/components/__tests__/sign-in.test.tsx \
  apps/frontend/web/src/features/auth/components/__tests__/sign-up.test.tsx
git commit -m "feat(web): every email-confirmation link invites the person to confirm their number

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Whole-branch verification, follow-ups, pull request

**Files:**
- Modify: `docs/superpowers/follow-ups.md`: append the spec's five out-of-scope items as numbered entries after the last one, and amend entry 15's SMS paragraph to say the SMS path is now unused by the web.

- [ ] **Step 1: Bring in `origin/dev` and run everything**

```bash
git fetch origin dev && git merge origin/dev
bun run check-types
bun run lint
bun run test
```

Expected: all green. `bun run test` includes the database tests, reading `DEV_DB_URL` from `packages/backend/.env`. If the merge brought anything in, type errors are where semantic conflicts show up. Read and fix them; do not paper over them.

- [ ] **Step 2: Exercise the whole flow locally**

- In `apps/backend/api/.dev.vars`, set `WHATSAPP_BUSINESS_NUMBER=+258843002020` and `WHATSAPP_APP_SECRET=local-secret`.
- Run `bun run dev` in `apps/backend/api` and in `apps/frontend/web`.
- Sign in with an account that has an unverified number, open `/verify-phone?next=%2F`, press **Confirmar pelo WhatsApp** (a new tab to wa.me opens; close it), and note the code on the page.
- Run `cd apps/backend/api && WHATSAPP_APP_SECRET=local-secret bun scripts/simulate-whatsapp-message.ts +<that number> "Olá Ntizo! O meu código de confirmação é <code>"`.

Expected:
- the script prints `200 {"ok":true}`;
- the API terminal prints the console WhatsApp box with "✅ Número confirmado";
- within 3 s the page shows "Número confirmado";
- the profile header no longer says "Não verificado".

Restore `.dev.vars` afterwards, since it is git-ignored.

- [ ] **Step 3: Record the follow-ups and commit**

Append the entries to `docs/superpowers/follow-ups.md`, in the file's existing format:
- moving the other auth screens to the site's rules;
- number squatting;
- a CD probe for `WHATSAPP_APP_SECRET`;
- de-duplicating by message id;
- removing the SMS OTP path.

```bash
git add docs/superpowers/follow-ups.md
git commit -m "docs(follow-ups): what the WhatsApp confirmation left out on purpose

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Open the pull request into dev (ask the owner before merging or deploying)**

```bash
git push -u origin feat/whatsapp-phone-verification
gh pr create --base dev --title "Confirm a phone number by WhatsApp (free), instead of SMS" --body "$(cat <<'EOF'
## Summary
- /verify-phone confirms by WhatsApp: the person sends a pre-filled code to Ntizo's number, Meta's signed webhook confirms the account whose number sent it, and every outcome is answered in WhatsApp. No per-message cost.
- Every email-confirmation link lands on the phone invite first (`/verify-phone?next=…`), which steps aside when there is nothing to confirm or the stage has no WhatsApp.
- Unconfigured stages (qa, prod until the SIM exists) behave as before; nothing else notices.

Spec: `docs/superpowers/specs/2026-09-21-whatsapp-phone-verification-design.md` · mockup beside it.

## Setup still needed per stage
Vars `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_NUMBER`; secrets `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`; register `https://<stage api>/api/webhooks/whatsapp` in the Meta app and subscribe to `messages`.

## Test plan
- [ ] CI green (typecheck, lint, test incl. the DB-backed adapter tests, e2e)
- [ ] Local end-to-end with `scripts/simulate-whatsapp-message.ts`
- [ ] Dev end-to-end with Meta's test number once the Meta app exists

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Stop here and report the PR link. Merging into `dev` and deploying (`bun run deploy:dev` in `apps/backend/api` first, then in `apps/frontend/web`, with Node 22 on PATH) happen only when the owner says so. The same goes for the Meta setup in the browser.
