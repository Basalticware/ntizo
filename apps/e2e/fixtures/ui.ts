import type { Page } from "@playwright/test";

/**
 * The landing page's own heading, in English (the harness's browser locale).
 *
 * One constant rather than a string in each spec: the home refresh replaced
 * the old slogan ("Find it."), and four specs that asserted it failed on copy
 * rather than on behaviour — for weeks, past every step they exist for. Copy
 * source: `apps/frontend/web/src/shared/locales/en-US/landing.json`, `hero.heroTitle`.
 */
export const LANDING_HERO_TITLE = "Hire someone who knows the work, at the price you see.";

/**
 * Fills and submits the real sign-in form. Assumes the caller is already on
 * `/sign-in` (either via `page.goto("/sign-in")` for a first navigation, or
 * because the app's own sign-out flow just client-side-navigated there) and
 * does not itself navigate or assert a destination — callers know (via
 * `resolvePostLoginDestination`) where a given user should land and should
 * assert that themselves.
 *
 * Deliberately never calls `page.goto("/sign-in")` itself: a spec proving
 * the query-cache stays scoped to the signed-in user across a sign-out +
 * sign-in cycle (auth.spec.ts) must keep reusing the same in-memory SPA —
 * `page.goto` is a hard navigation that would reset the very
 * `QueryClient` singleton the regression lives in, silently making the test
 * pass for the wrong reason.
 */
export async function fillSignInForm(
  page: Page,
  user: { email: string; password: string },
): Promise<void> {
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
}

/**
 * Opens the signed-in user's account menu and clicks "Sign out". Both zones
 * render the trigger through the same
 * `src/shared/components/console/console-user-menu.tsx`, at the right of the
 * console's top bar, as `<button data-slot="console-account">` named with the
 * person's name. Matching on that name is also the assertion that matters
 * here: the button we click is provably *this* user's, not a leftover from
 * whoever was signed in before. The name is the button's `aria-label`
 * because the visible name is hidden below `lg`.
 */
export async function signOutViaSidebar(page: Page, currentUserName: string): Promise<void> {
  await page.locator(`[data-slot="console-account"][aria-label="${currentUserName}"]`).click();
  await page.getByRole("menuitem", { name: /sign out/i }).click();
}
