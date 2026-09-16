import { test, expect } from "@playwright/test";
import { createVerifiedUser, verifyUserByEmail } from "../fixtures/auth";
import { createProvider } from "../fixtures/provider";
import { fillSignInForm, signOutViaSidebar } from "../fixtures/ui";

test("sign up, verify, sign in, and land on the right zone", async ({ page }) => {
  const email = `e2e-ui-signup-${crypto.randomUUID()}@example.test`;
  const password = "Password123!";

  await page.goto("/sign-up");
  await page.getByLabel("First name").fill("Signup");
  await page.getByLabel("Last name").fill("Flow");
  await page.getByLabel("Email", { exact: true }).fill(email);
  // National digits only — the country selector supplies the +258, and the
  // field is required, so omitting it blocks submission at the browser's own
  // validation and the form never reaches the API.
  await page.getByLabel("Mobile number").fill("841234567");
  await page.getByLabel("Password", { exact: true }).fill(password);
  // Required, and validated again on submit. Leaving it unticked blocks the
  // form at the browser's own validation, so the page simply never changes —
  // which is how this spec failed silently once the checkbox was added.
  await page.getByRole("checkbox", { name: /i accept/i }).check();
  await page.getByRole("button", { name: /create account/i }).click();

  // The real POST /api/auth/sign-up/email round-trip completed and the form
  // swapped to the "check your email" view — proves sign-up itself (not
  // just the fixture's own copy of this call) reaches the real API.
  await expect(page.getByText("Check your email")).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  // The way back for a mail that never arrived or a link that expired.
  await expect(page.getByRole("button", { name: "Resend confirmation email" })).toBeVisible();

  // No mailbox this browser can drive — flip verified the same way
  // createVerifiedUser does (see its doc comment) and continue as a plain
  // customer (no role passed, matching what a real signup produces).
  await verifyUserByEmail(email);

  // "Back to sign in" — the link on the check-your-email view, not the
  // "Sign in" one at the foot of the form, which this view has replaced.
  await page.getByRole("link", { name: /back to sign in/i }).click();
  await page.waitForURL(/\/sign-in/);
  await fillSignInForm(page, { email, password });

  // A brand-new customer owns no providers and holds no elevated role, so
  // resolvePostLoginDestination sends them to "/" — the landing page, the
  // only zone a plain customer can reach.
  await page.waitForURL("http://localhost:3000/");
  // The hero's own heading. "Find it." was the slogan until the home refresh
  // removed it, which left this spec failing past every step it exists for.
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Hire someone who knows the work, at the price you see.",
    }),
  ).toBeVisible();
});

test("an unconfirmed account is told so at sign-in, and can ask for a new link", async ({ page }) => {
  // A QA tester signed up, never opened the link, and was shown "Something
  // went wrong" on every sign-in with the right password. This goes through
  // the real API: the code has to be the one the form recognises, and the
  // resend endpoint has to answer the web origin.
  const email = `e2e-unverified-${crypto.randomUUID()}@example.test`;
  const password = "Password123!";
  const res = await fetch("http://localhost:8788/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify({ email, password, name: "Una Verified", firstName: "Una", lastName: "Verified" }),
  });
  expect(res.ok).toBe(true);

  await page.goto("/sign-in");
  await fillSignInForm(page, { email, password });

  await expect(page.getByText(/hasn't been confirmed yet/)).toBeVisible();
  await page.getByRole("button", { name: "Resend confirmation email" }).click();
  await expect(page.getByText(`We sent a new link to ${email}.`)).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in/);
});

test("signing in as a different user shows that user's session, not the previous one's", async ({
  page,
}) => {
  const admin = await createVerifiedUser("admin", { firstName: "Ada", lastName: "Admin" });
  const providerOwner = await createVerifiedUser(undefined, { firstName: "Pia", lastName: "Provider" });

  // Give providerOwner a provider *before* the leak-sensitive part of this
  // test. This test is about session isolation, not about the wizard, so the
  // provider is seeded directly rather than driven through the UI — that
  // also keeps this spec decoupled from provider.spec.ts, which owns
  // exercising the create flow itself.
  await createProvider({
    name: "Pia's Services",
    slug: `pias-services-${crypto.randomUUID()}`,
    ownerUserId: providerOwner.id,
  });

  // Everything from here on reuses ONE page/context with no hard
  // navigation, so the SPA's in-memory QueryClient singleton — where the
  // leak this test exists to catch actually lived — survives the whole
  // sign-out/sign-in cycle, the same as a real user's browser tab would.
  await page.goto("/sign-in");
  await fillSignInForm(page, admin);
  await page.waitForURL(/\/admin/);

  // The admin's own name, not the previous user's — the whole point of this
  // test. Admin is not a segment in the pill any more; it is reached from the
  // account menu, so only the identity assertion belongs here.
  await expect(page.locator('[data-sidebar="menu-button"]').filter({ hasText: admin.name })).toBeVisible();

  await signOutViaSidebar(page, admin.name);
  await page.waitForURL(/\/sign-in/);

  await fillSignInForm(page, providerOwner);
  await page.waitForURL(/\/provider/);

  // The regression: without a full page reload in between, a stale
  // QueryClient entry from `admin`'s session could still be sitting in
  // cache under the same query keys `providerOwner`'s hooks now read.
  await expect(
    page.locator('[data-sidebar="menu-button"]').filter({ hasText: providerOwner.name }),
  ).toBeVisible();
  await expect(page.getByText(admin.name)).toHaveCount(0);

  // The zone-switcher assertions that used to close this test are gone with
  // the component they read: `ac746e4` ("registering as a provider is an
  // application, not a launch") deleted the "Switch view" pill outright, and
  // switching workspace moved into the sidebar's own user menu. Nothing here
  // is lost — the two assertions above ARE the session-isolation proof this
  // test is named for: the signed-in owner's name is on the page and the
  // previous user's is not. The pill was scenery around them.
});
