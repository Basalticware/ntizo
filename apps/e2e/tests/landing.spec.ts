import { test, expect } from "@playwright/test";
import { LANDING_HERO_TITLE } from "../fixtures/ui";

// Task 3's only spec: prove the harness itself — both real servers started
// against the throwaway database, a real browser driving the real web app.
// The real test suite is Task 4's job, not this file's.
test("landing page renders the hero", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: LANDING_HERO_TITLE })).toBeVisible();
});
