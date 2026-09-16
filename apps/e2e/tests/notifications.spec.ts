import { test, expect } from "@playwright/test";
import { createVerifiedUser } from "../fixtures/auth";
import { sql } from "../fixtures/db";
import { fillSignInForm } from "../fixtures/ui";

/**
 * The one seam no unit test observes: a real sign-up, a real transaction, a
 * real commit, and a notification that only exists if `runAfterCommit` fired
 * and the router had a handler registered. Everything either side of that
 * seam is covered in isolation; this is the proof they are joined.
 *
 * `createVerifiedUser` (fixtures/auth.ts) is what every other spec in this
 * suite reaches for to get "a real sign-up through the real
 * POST /api/auth/sign-up/email, verified without a mailbox to click through"
 * — see its own doc comment for why a direct DB insert would skip the very
 * path (`CreateUserOnSignUpInternalCommand` inside better-auth's
 * `user.create.after` hook) this test exists to exercise. There is no
 * `signUpAndVerify` export in fixtures/auth.ts to reach for instead.
 */
test("registering produces a welcome in the new user's inbox", async ({ page }) => {
  const user = await createVerifiedUser(undefined, { firstName: "Ana", lastName: "Registrant" });

  await page.goto("/sign-in");
  await fillSignInForm(page, user);
  // A brand-new customer owns no provider and holds no elevated role, so
  // resolvePostLoginDestination sends them to "/" (see auth.spec.ts).
  await page.waitForURL("http://localhost:3000/");

  await page.goto("/account/notifications");

  await expect(page.getByRole("heading", { name: /notifications/i })).toBeVisible();
  // This text exists only if the whole chain fired: the outbox row published
  // inside CreateUserOnSignUpInternalCommand's transaction, runAfterCommit
  // dispatched it after commit, the in-process EventRouter had
  // "user.registered" registered (registerUserNotificationHandlers), and
  // that handler's RaiseNotificationInternalCommand actually wrote a row.
  await expect(page.getByText(/welcome to ntizo/i)).toBeVisible();
});

test("marking it read clears the badge", async ({ page }) => {
  const user = await createVerifiedUser(undefined, { firstName: "Ana", lastName: "Registrant" });

  await page.goto("/sign-in");
  await fillSignInForm(page, user);
  await page.waitForURL("http://localhost:3000/");

  await page.goto("/account/notifications");

  // NotificationCell (features/notifications/ui/notification-cell.tsx) renders
  // the whole row as one <button> — "marking read is the only thing it does" —
  // and that button carries the unread border directly
  // (`border-transparent` vs `border-[var(--color-primary)]`); the <li> around
  // it carries no class attribute at all, read or unread.
  //
  // `getByRole("listitem").first()` (this task's brief, verbatim) does not
  // reach this row: the account sidebar rendered on the very same page has
  // its own <li> items — down to a literal `listitem: button "Sign out"` —
  // and comes first in DOM order, so `.first()` resolves to the sidebar's
  // "My profile" link item, whose `getByRole("button")` then legitimately
  // finds nothing. Confirmed empirically: that exact locator failed with
  // "element(s) not found" against the real page, not a class mismatch.
  // Matching on this row's own accessible name sidesteps the ambiguity
  // instead of guessing an index into a list shared with unrelated UI.
  const row = page.getByRole("button", { name: /welcome to ntizo/i });
  // The row's own list item, which is where the unread state now lives: an
  // unread row carries its own "Mark as read" control beside the sentence,
  // and a read row does not. That control is the marker, not a class — a
  // class name is what the 2026-09-07 refresh changed, and this assertion
  // survived the change only because it is about what the reader can do.
  const item = row.locator("xpath=ancestor::li[1]");
  const markRead = item.getByRole("button", { name: /mark as read/i });

  // Asserted present before the click, not just absent after: a negative
  // assertion with nothing to negate is true from first render, and would
  // keep passing forever — proving nothing. `useMarkRead` does no optimistic
  // update, so this row is the only end-to-end proof the server state
  // actually changed. `toHaveCount`, not `toBeVisible`: the control is
  // hidden until the row is hovered, and its presence is the point.
  await expect(markRead).toHaveCount(1);

  await row.click();

  // The control is gone from the row, which is the assertion that survives
  // a refactor of the badge's polling interval.
  await expect(markRead).toHaveCount(0);
});

/**
 * The other half of that seam: the email.
 *
 * Everything about delivery is otherwise proven with fakes — a fake sender, a
 * fake clock, an in-memory repository. This is the only place the whole chain
 * runs against a real Worker and a real Postgres, and since 2026-09-16 it
 * proves two things at once.
 *
 * **The welcome is not emailed to an e-mail sign-up.** better-auth's
 * verification mail says "welcome" and "confirm your address" in one; a second
 * welcome seconds later, saying the account was ready, was the one a QA
 * tester opened while sign-in still refused them. The inbox row stays (the
 * test above), the email does not: `user.registered` carries
 * `emailVerified: false` and the handler raises with `email: false`.
 *
 * **Deliveries still land.** An absence proves nothing on its own — a broken
 * pipeline records nothing either. So the same new user opens a support
 * request, which emails every administrator, and this waits for that row to
 * arrive under `waitUntil` before looking for a welcome. The welcome's own
 * delivery would have been deferred earlier, at sign-up; once a later one has
 * landed, an earlier one that existed would have too.
 *
 * `sent` with no provider message id, because this harness sets no
 * `RESEND_API_KEY` and `STAGE` stays at wrangler.jsonc's `"local"`, so the
 * console adapter prints the message and reports success with a null id.
 * Scoped by thread id: other specs open support requests against the same
 * administrators in the same database.
 *
 * No `resetDb()` here, deliberately: `globalSetup` resets once, and a second
 * reset would drop the schemas out from under every spec running in parallel.
 */
test("an e-mail sign-up is not emailed a second welcome, while other notifications still send", async ({ page }) => {
  const admin = await createVerifiedUser("admin", { firstName: "Ada", lastName: "Admin" });
  const user = await createVerifiedUser(undefined, { firstName: "Ana", lastName: "Registrant" });

  await page.goto("/sign-in");
  await fillSignInForm(page, user);
  await page.waitForURL("http://localhost:3000/");

  const opened = await page.request.post("http://localhost:8788/graphql", {
    headers: {
      "Content-Type": "application/json",
      "x-graphql-csrf": "1",
      Origin: "http://localhost:3000",
    },
    data: {
      query: `mutation CommunicationOpenSupportRequest($input: CommunicationOpenSupportRequestInput!) {
        communicationOpenSupportRequest(input: $input) { threadId }
      }`,
      variables: {
        input: { audience: "customer", subject: "Pagamento", body: "Paguei duas vezes." },
      },
    },
  });
  const body = (await opened.json()) as {
    data?: { communicationOpenSupportRequest: { threadId: string } };
    errors?: unknown;
  };
  expect(body.errors, JSON.stringify(body.errors)).toBeUndefined();
  const threadId = body.data!.communicationOpenSupportRequest.threadId;

  await expect
    .poll(
      async () => {
        const rows = await sql()<{ status: string; provider_message_id: string | null }[]>`
          SELECT d.status, d.provider_message_id
          FROM ntizo_notification.notification_delivery d
          JOIN ntizo_notification.notification n ON n.id = d.notification_id
          WHERE d.to_email = ${admin.email} AND n.payload->>'threadId' = ${threadId}`;
        return rows.map((r) => `${r.status}/${r.provider_message_id ?? "no-message-id"}`);
      },
      { timeout: 15_000, message: "expected the administrator's support-request email to be recorded" },
    )
    .toEqual(["sent/no-message-id"]);

  const welcomes = await sql()`
    SELECT d.id
    FROM ntizo_notification.notification_delivery d
    WHERE d.to_email = ${user.email} AND d.type = 'WELCOME'`;
  expect(welcomes).toHaveLength(0);
});
