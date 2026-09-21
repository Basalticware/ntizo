# Confirming a Phone Number by WhatsApp — Design

**Status:** approved in brainstorming, 2026-09-21. Awaiting the owner's review of this document before a plan is written.

**Mockup:** `2026-09-21-whatsapp-phone-verification.mockup.html`, next to this file, and published at
<https://claude.ai/artifact/As8hzpDa2PPnhZUMWBQTBS>. The Portuguese in it is the approved pt-MZ copy and is the source
the locale files are written from.

## What this is

`/verify-phone` promises "Vamos enviar um código por SMS" and cannot keep the promise anywhere but a developer's laptop.
No SMS provider was ever chosen, so `resolveSmsService()` in `apps/backend/api/src/bootstrap.ts` throws on every stage
except `local`, and "Enviar código" answers every tester on dev, qa and prod with "Algo correu mal". A tester hit exactly
that on 2026-09-21 with a Movitel number.

The owner will not pay per SMS. Paid SMS to Mozambique runs from €0.043 (tmCel) to €0.218 (Movitel) a message, and no
provider offers a recurring free allowance the way Resend does for email.

This spec turns the direction around. **The person sends us the code, instead of us sending it to them.** The screen
issues a six-digit code; WhatsApp opens with a message already typed that carries it, addressed to a number Ntizo owns;
the person taps send. Meta delivers that inbound message to our API by webhook, and the API confirms the account whose
number matches the sender.

It costs nothing to run. On Meta's own pricing page, "messages sent from a WhatsApp user to a business are not charged",
and "all non-template messages are free within an open customer service window" — which the person's message opens, so
our reply is free too. The Cloud API itself has no usage fee.

It is also sound as proof of ownership. WhatsApp verified the sender's number when the person installed it, so a message
that arrives *from* `+258879801517` was sent by whoever holds that number. The code is what ties the message to the
account that asked for it.

## What exists, and what does not

**The number and its flag already live in one place.** `better_auth.user.phone_number` is unique and E.164-normalised,
at sign-up (`normalizeSignUpPhoneNumber`) and on every profile edit (`UpdateMyProfileCommand` →
`BetterAuthIdentityAdapter.setPhoneNumber`). `phone_number_verified` sits beside it, and changing the number already
clears the flag in the same statement. The web reads the flag from the session, on the profile header and on
Conta → Segurança, and both already say "Não verificado" and link to `/verify-phone`.

**A signed-webhook pattern already exists.** `POST /api/webhooks/resend` is mounted by `apps/backend/api/src/webhooks.ts`
before `authCors` and inside `configMiddleware`. It refuses bodies over a size before buffering, verifies the raw bytes
before parsing, answers 500 when its secret is missing and 401 when a signature fails. The decision lives
framework-free in `packages/backend/src/modules/ntizo/write/notification/http/`. The WhatsApp webhook copies all of
that.

**better-auth already has a table for short-lived codes.** `better_auth.verification` holds `identifier`, `value`,
`expires_at`. Using it means no migration.

**What does not exist:**

- Any way to receive a message: no WhatsApp number, no Meta app, no webhook route.
- Any way to confirm a number other than better-auth's SMS OTP, which cannot send.
- Any invitation to confirm. The only way into `/verify-phone` is the "Verificar" link on Conta → Segurança.

## The flow

```
Ntizo (/verify-phone)            WhatsApp (person's phone)          Ntizo API
─────────────────────            ─────────────────────────          ─────────
page loads → code 483920 issued
[Confirmar pelo WhatsApp]  ──►   opens wa.me/258843002020?text=…483920
  (a plain link)                 person taps Send          ──►      POST /api/webhooks/whatsapp
                                                                     signature ok → from +258879801517
                                                                     account with that number?
                                                                     code matches, not expired, number unchanged?
                                 "✅ Número confirmado…"   ◄──       phone_number_verified = true, reply
page sees verified  ◄────────────────────────────────────────────── (next 3 s check, or on focus)
```

## Decisions taken, and why

### A new SIM that only does this

The owner chose a dedicated number over putting Ntizo's existing WhatsApp Business app on the API ("coexistence").
Nobody reads that inbox, so every inbound message gets an automatic answer. Until the SIM is registered, dev uses the
free test number Meta creates with every Cloud API app. It receives inbound messages from anyone. It can only *reply*
to up to five numbers registered as test recipients, so the tester's number is added there.

### Optional, but invited once

Verification stays optional, as today: sign-in never depends on it (`requireVerification: false` stays). What changes
is that it is offered at the one moment it is natural. Every email-confirmation link now lands on
`/verify-phone?next=<where they were going>` first. "Agora não" continues to `next`. The page steps aside without
showing anything when there is nothing to do:

- the account has no number (a Google sign-up);
- the number is already confirmed;
- WhatsApp is not configured on this stage (see "Unconfigured stages").

"Verificar" on Conta → Segurança keeps leading here, without `next`. There the same spot reads "Voltar à conta".

### The code is issued when the page loads, not when the button is pressed

The button has to be a plain `<a href="https://wa.me/…">`, because on iOS and in desktop browsers a `window.open` that
waits for a network response first is a blocked popup. So the page issues the code as it renders and the link is ready
before anyone taps it. A person who taps "Agora não" leaves behind one unused row that expires in 15 minutes, which is
the whole cost. If the code has expired by the time they tap, the page shows the expired state rather than sending a
dead code.

### Six digits, fifteen minutes, one per account, bound to the number

- **Six digits and fifteen minutes.** Six digits match the old OTP. Fifteen minutes rather than five covers switching
  apps, finding the chat and coming back.
- **One per account.** Issuing a code deletes any earlier one for the same account.
- **Bound to the number.** Each code records the number it was issued for. The confirming write is conditional on the
  account still having that number:
  `UPDATE … SET phone_number_verified = true WHERE id = $user AND phone_number = $issuedFor`.
  A person who changes their number between asking and sending does not end up with the new number confirmed by a
  message from the old one.
- **Stored in `better_auth.verification`**, with `identifier = 'whatsapp-phone:<userId>'` and
  `value = '<code>:<E.164>'`.

**No attempt limit.** Only the holder of number X can send from X, and only an account whose number is X can be
confirmed by it. Guessing codes from X can therefore only confirm the guesser's own number, which the code on their
own screen already lets them do.

**The code is still required** even though the sender is trustworthy. Without it, any message from X would confirm
whichever account registered X, including an account someone else registered with X. The code makes the confirmation
an act of the account that asked.

### The account is found by the sender, not by the code

The webhook looks up `better_auth.user` by the sender's number, then checks that account's pending code. It never
searches codes globally, so a code on its own identifies nothing and there is no code space to enumerate. The sender
arrives as digits without `+` (Meta's `from`), and is compared as `+<digits>` against the stored E.164 value.

### Five outcomes, each answered in WhatsApp

The person is in WhatsApp when the answer matters, so that is where it goes. Every reply is free-form text inside the
window the person just opened.

| Outcome | Reply (pt) |
|---|---|
| Confirmed | ✅ Número confirmado. Pode voltar à Ntizo. |
| No account has this number | Não encontrámos nenhuma conta Ntizo com o número +258…. Envie a mensagem a partir do WhatsApp do número que registou. |
| Code wrong, expired or issued for another number | Este código já não é válido. Volte à Ntizo e toque outra vez em Confirmar pelo WhatsApp. |
| Already confirmed | O seu número já está confirmado. |
| No code in the message (including any non-text message) | Este número serve só para confirmar contas Ntizo. Para ajuda, escreva para ola@ntizo.co.mz. |

A few rules apply to all five:

- **Language.** Replies follow the account's profile language: Portuguese for `pt-MZ` and `pt-PT`, English for every
  other locale. "No account" has no profile to read, so it is always Portuguese.
- **Contact address.** The help address comes from `CONTACT_INBOX_EMAIL`, not a literal.
- **Reading the code.** The code is the first run of exactly six digits standing alone in the message, so the parse
  does not depend on the language the pre-filled text was written in.
- **A failed reply is logged and swallowed.** The confirmation is already written, and a retry would only answer
  "already confirmed".

### Meta's duplicate deliveries are tolerated rather than de-duplicated

Meta retries any non-200 for up to seven days and warns that retries can duplicate a delivery. A duplicate of a
confirming message now meets an already-confirmed account and gets "O seu número já está confirmado": one extra,
truthful message. Storing message ids to suppress it would be a table for a cosmetic problem, so it is left out.

### The page learns by asking, not by being told

While waiting, the page reads the session every 3 seconds, and immediately on `visibilitychange` or `focus`, since
coming back from WhatsApp is the moment the answer is most likely there. Each read passes
`query: { disableCookieCache: true }`, because `session.cookieCache` is on with `maxAge: 60` and would otherwise hide
the change for up to a minute. Polling stops on confirmation, on expiry, or when the page unmounts.

There is no push channel (SSE, a Durable Object), because nothing else in the app needs one and a 3-second poll on one
screen for at most 15 minutes is cheap.

### Unconfigured stages degrade quietly

qa and prod will run this code before the SIM exists. When the WhatsApp configuration is absent on a stage:

- the start command fails with a dedicated `PhoneVerificationUnavailableError`;
- in invite mode the page goes straight to `next`;
- from Conta → Segurança it shows "Não foi possível começar agora. Tente dentro de momentos." with a retry;
- the webhook route answers 500 to any POST, exactly as the Resend route does without its secret.

Nothing else in the app notices.

### The screen is drawn on the site's rules, and the other auth screens are left alone

The mockup puts `/verify-phone` on the site's rules: white page, navy heading and primary action, hairlines rather than
a card, no icon in a tinted circle, no blue of the page's own. It therefore stops using `AuthLayout`.

Forgot-password, reset-password and accept-invite stay on `AuthLayout`'s card for now, and sign-up keeps its blue split
panel. Moving them is its own change, confirmed out of scope on 2026-09-21.

## Backend

All new domain code lives in the `user` bounded context, which already owns the phone and already has the one adapter
allowed to write `better_auth.user`.

### Ports (`bounded-contexts/user/app/ports/outbound/`)

- **`AuthIdentityPort` grows three methods** next to `setPhoneNumber`:
  - `findPhoneOf(userId)` returns `{ phoneNumber, verified } | null`.
  - `findByPhoneNumber(e164)` returns `{ userId, verified } | null`.
  - `markPhoneNumberVerified(userId, issuedFor)` returns `boolean`. It is the conditional update above and reports
    whether a row changed.
- **`PhoneVerificationCodeStorePort`** has three methods: `replace(userId, { code, phoneNumber, expiresAt })`,
  `find(userId)` and `delete(userId)`.
- **`WhatsAppMessengerPort`** has one method: `sendText(toE164, body)`.

### Use cases (`bounded-contexts/user/app/use-cases/`)

- **`StartPhoneVerificationCommand`** is authenticated, and its subject is always `requireAuthenticated(ctx).userId`.
  It refuses with:
  - `PhoneNumberMissingError` when the account has no number;
  - `PhoneNumberAlreadyVerifiedError` when the number is already confirmed;
  - `PhoneVerificationUnavailableError` when the business number is not configured.

  Otherwise it generates the code with `crypto.getRandomValues` and rejection sampling, so every value from `000000` to
  `999999` is equally likely. It replaces any earlier code and returns `{ code, businessNumber, expiresAt }`. The clock
  and the code source are injected so tests are deterministic.
- **`ConfirmPhoneFromWhatsAppInternalCommand`** takes `{ senderPhone, text | null }`. It decides the outcome, writes the
  confirmation when it is one, deletes the used code, reads the profile language and sends the reply. It returns the
  outcome, so tests can assert on it.

### Adapters

- **`BetterAuthIdentityAdapter`** gains the three methods above.
- **`BetterAuthPhoneVerificationCodeStore`** (new, in `infrastructure/adapters/`) is the second, contained crossing into
  better-auth's tables, over `verification`.
- **The messenger lives in `shared/infrastructure/whatsapp/`**, beside `email/` and `sms/`:
  - `CloudApiWhatsAppMessengerAdapter` sends `POST https://graph.facebook.com/v25.0/{WHATSAPP_PHONE_NUMBER_ID}/messages`
    with `Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}` and the body
    `{ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body } }`. A non-2xx
    response throws.
  - `ConsoleWhatsAppMessengerAdapter` prints the reply in the terminal.
  - Selection is lazy and per request, like `resolveEmailService`. The Cloud API is used when both values are present.
    Without them the console adapter is used on `local`, and on any other stage the resolver throws, which the confirm
    command catches as a failed reply.

### The webhook (`write/user/http/whatsapp-webhook.routes.ts`, framework-free)

- **`verify(query)`** handles Meta's subscription handshake. With `hub.mode=subscribe` and a `hub.verify_token` equal to
  `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, it answers 200 with the raw `hub.challenge` as plain text. Anything else gets 403,
  and a missing token gets 500.
- **`receive({ body, headers })`**:
  - **Secret and signature.** A missing `WHATSAPP_APP_SECRET` gets 500 and is logged. The signature is then checked
    over the raw bytes: `X-Hub-Signature-256: sha256=<hex>`, an HMAC-SHA256 keyed with the app secret, checked with
    `crypto.subtle.verify` so the comparison is constant-time. A bad or missing signature gets 401, logged on the first
    refusal and every hundredth after, as Resend's route does.
  - **Parsing, only after the signature passes.** Under `object: "whatsapp_business_account"`, every
    `entry[].changes[]` with `field: "messages"` is read. Each `value.messages[]` becomes one call to the confirm
    command: `text.body` for `type: "text"`, `null` for every other type. `statuses[]` and anything unrecognised are
    ignored.
  - **Status codes.** Everything decided answers 200. A thrown command, such as a lost database connection, is not
    caught, so Meta retries it.
- **The Hono binding** goes in `apps/backend/api/src/webhooks.ts`: `GET` and `POST /api/webhooks/whatsapp`, registered
  with the Resend route before `authCors` and inside `configMiddleware`. The body limit for this route is 3 MiB,
  because Meta's payloads can be up to 3 MB. Resend's 1 MiB is kept for its own route.

### GraphQL

The `user` write schema gets `user.startPhoneVerification`, a mutation with no input that returns
`{ code, businessNumber, expiresAt }`. It is wired in `graphql/private.ts` like `updateMyProfile`. The three refusals
reach the client as error codes: `PHONE_NUMBER_MISSING`, `PHONE_NUMBER_ALREADY_VERIFIED` and
`PHONE_VERIFICATION_UNAVAILABLE`.

### What is left alone

better-auth's phone-number plugin keeps its `sendOTP`, and `SmsServicePort` with its console adapter stays. Nothing on
the web calls them any more. Removing them is not needed for this change, and keeping them keeps SMS a one-adapter
change if a provider is ever paid for.

## Web

- **Route.** `routes/verify-phone.tsx` gains `validateSearch` for `next`, accepted only when `isSafeInternalPath` says
  so. In `beforeLoad`, with `next` present, an account with no number or an already-confirmed one is redirected to
  `next` without rendering.
- **The screen.** `VerifyPhone` is rebuilt on the site's rules with five states: intro, waiting, confirmed, expired and
  failed. The states, the copy and the layout are the mockup's.
  - The primary action is a link built from the start mutation's answer:
    `https://wa.me/<businessNumber digits>?text=<encoded message>`. The message is the locale's
    "Olá Ntizo! O meu código de confirmação é {{code}}".
  - Clicking it moves the page to waiting. It does not prevent the navigation.
  - "Alterar" goes to `/account`, the profile form.
  - In invite mode the secondary action is "Agora não" and "Continuar" goes to `next`. From the account it is
    "Voltar à conta".
- **Viewmodel and data.** A `usePhoneVerification` viewmodel owns the start call, the expiry timer and the polling. The
  mutation goes through the user data repository like `updateMyProfile`. After confirmation the shared session store is
  refreshed, so the header and Segurança stop saying "Não verificado" without a reload.
- **The invite.** Three `callbackURL`s change to `/verify-phone?next=<the same destination as today>`: sign-up's
  submit, sign-up's resend, and sign-in's resend for an unverified email. Google sign-in and sign-up are unchanged,
  because those accounts have no number.
- **Sign-up copy.** `phoneHint` becomes "Vai confirmá-lo com uma mensagem no WhatsApp." in all eight locales.
- **Locales.** The new strings go into the `auth` namespace in all eight locales. The strings only the SMS screen used
  are removed. The OTP input component in `@ntizo/frontend-ui` stays, because it is a general component.

## Configuration

Following the layout of the M-Pesa and Resend settings in `wrangler.jsonc`:

**Vars** (per stage; empty means not configured):

- `WHATSAPP_PHONE_NUMBER_ID` is Meta's id for the sending number.
- `WHATSAPP_BUSINESS_NUMBER` is that number in E.164, for the `wa.me` link.

**Secrets** (`wrangler secret put … --env <stage>`; names only, never values, anywhere in the repo):

- `WHATSAPP_ACCESS_TOKEN` is a permanent system-user token.
- `WHATSAPP_APP_SECRET` signs every webhook POST.
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` is used only for the subscription handshake.

All five are added to `AppBindings`, `infra-env.ts` and `.env.example`. Locally, with none of them set, the messenger
prints to the terminal. A small script, `apps/backend/api/scripts/simulate-whatsapp-message.ts`, signs and posts a fake
inbound message to the local API, so the whole flow can be exercised without Meta.

## Testing

**Backend** (`bun:test`, alongside the existing suites):

- **`StartPhoneVerificationCommand`**:
  - the code is six digits, `expiresAt` is now + 15 minutes, and an earlier code is replaced;
  - each of the three refusals;
  - the subject is always the caller.
- **`ConfirmPhoneFromWhatsAppInternalCommand`**:
  - all five outcomes;
  - an expired code;
  - a number changed between issue and send, where the conditional write changes nothing and the answer is "not
    valid";
  - the reply language for `pt-MZ`, `pt-PT` and `en-US`;
  - a failing messenger does not undo or throw.
- **The code generator**: range and format.
- **The webhook handlers**:
  - the handshake: success, wrong token, missing token;
  - `receive`: valid, invalid and missing signature, and a missing secret;
  - a body with a valid signature that was re-serialised is refused, which proves the signature covers the raw bytes;
  - a text message, a non-text message, a statuses-only payload, and several messages in one delivery.
- **The mount test**, modelled on `webhook-mount.test.ts`: both routes exist, sit outside CORS and inside
  `configMiddleware`, and the 3 MiB limit applies.
- **The two messenger adapters**: the request shape against a stubbed `fetch`, the error on non-2xx, and the console
  output.
- **The fitness tests**, unchanged, must stay green. No Hono in `packages/backend`.

**Web** (`vitest`):

- the five states of `VerifyPhone`, and that the primary action is a real link with the right `href`;
- waiting moves to confirmed when the session flips, and to expired at `expiresAt`;
- invite mode skips to `next` for an account with no number, an already-confirmed one, and on
  `PHONE_VERIFICATION_UNAVAILABLE`;
- the new sign-up hint and the three new `callbackURL`s.

**End to end on dev, by hand, once the Meta app exists:** register the webhook, add the tester's number as a test
recipient, and confirm a real account from a real phone.

## Rollout

1. Build test-first on `feat/whatsapp-phone-verification`. Open a PR into `dev`. Deploy the dev API, then the dev web.
   Until the Meta app exists, dev behaves like an unconfigured stage.
2. **Meta setup (owner, guided):**
   - create a Meta Business portfolio, a developer app with the WhatsApp product, and a system user with a permanent
     token;
   - set the two vars and three secrets on dev;
   - register `https://dev.api.ntizo.co.mz/api/webhooks/whatsapp` with the verify token and subscribe to `messages`;
   - add the tester's number as a test recipient.
3. Test end to end on dev with the tester.
4. qa and prod follow only when asked. Once the SIM is registered, prod gets its own number id and secrets.

## Out of scope, recorded as follow-ups

- Moving forgot-password, reset-password, accept-invite and sign-up onto the site's rules.
- **Number squatting.** An unverified account holding someone else's number blocks the real owner from registering it,
  because the column is unique. With WhatsApp proof available, a verified claim could release it. Not built here.
- A CD probe for `WHATSAPP_APP_SECRET`, like the Resend one. It would fail every qa and prod deploy until those stages
  are configured, so it waits for that.
- De-duplicating Meta's repeated deliveries by message id.
- Removing better-auth's SMS OTP path and `SmsServicePort`.

## Risks

- **A few countries' WhatsApp ids differ from the dialled number**: Brazil's ninth digit, Mexico's `1`. For Mozambique
  `wa_id` equals the E.164 digits. An account from one of those countries could get "no account" and would stay
  unverified, which is harmless because verification is optional.
- **Meta can disable a webhook** after five consecutive failures. The route answers 200 to everything it decides, so
  only a sustained outage reaches that, and the Meta dashboard shows it.
- **The page's 3-second poll** is one small session read per open waiting screen, capped at 15 minutes by expiry.
