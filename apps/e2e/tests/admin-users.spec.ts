import { test, expect } from "@playwright/test";
import { createVerifiedUser, type VerifiedUser } from "../fixtures/auth";
import { fillSignInForm } from "../fixtures/ui";
import { sql } from "../fixtures/db";

async function cleanup(users: readonly VerifiedUser[]): Promise<void> {
  for (const user of users) {
    await sql()`DELETE FROM ntizo_activity.activity WHERE actor_user_id = ${user.id}`.catch((err) =>
      console.error("[e2e] admin-users cleanup: activity", err),
    );
    // Cascades to ntizo_user.profile.
    await sql()`DELETE FROM ntizo_user."user" WHERE id = ${user.id}`.catch((err) =>
      console.error("[e2e] admin-users cleanup: user", err),
    );
  }
}

test("an admin grants admin access from a person's page", async ({ page }) => {
  const admin = await createVerifiedUser("admin", { firstName: "Ada", lastName: "Admin" });
  const customer = await createVerifiedUser(undefined, { firstName: "Cora", lastName: "Customer" });

  try {
    await page.goto("/sign-in");
    await fillSignInForm(page, admin);
    await page.waitForURL(/\/admin/);

    await page.goto(`/admin/users/${customer.id}`);
    await expect(page.getByRole("heading", { name: customer.name })).toBeVisible();
    // apps/e2e/screenshots/ is not git-ignored (only test-results/ is per the
    // repo's root .gitignore), so screenshots go to test-results/ instead.
    await page.screenshot({ path: "test-results/admin-user-detail-desktop.png", fullPage: true });

    await page.getByRole("button", { name: "Make admin" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(`Give ${customer.name} admin access?`)).toBeVisible();
    await page.screenshot({ path: "test-results/admin-user-detail-confirm.png" });

    await dialog.getByRole("button", { name: "Give access" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Remove admin" })).toBeVisible();

    const [ntizo] = await sql()`SELECT role FROM ntizo_user."user" WHERE id = ${customer.id}`;
    const [auth] = await sql()`SELECT role FROM better_auth."user" WHERE id = ${customer.id}`;
    expect(ntizo?.role).toBe("admin");
    expect(auth?.role).toBe("admin");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "test-results/admin-user-detail-phone.png", fullPage: true });
  } finally {
    await cleanup([customer, admin]);
  }
});
