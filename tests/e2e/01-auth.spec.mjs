import { test, expect } from "@playwright/test";
import { CLIENT, SUPER, MASTER, loginClient, loginSuper, loginMaster } from "../fixtures.mjs";

test.describe("Authentication", () => {
  test("login page renders the brand panel and all three fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Sign in to your Command Center/i })).toBeVisible();
    await expect(page.locator("#client_id")).toBeVisible();
    await expect(page.locator("#username")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByText(/HIPAA Secured/i)).toBeVisible();
    // provider-perspective marketing copy
    await expect(page.getByText(/Your practice's onboarding/i)).toBeVisible();
  });

  test("rejects bad credentials without revealing which field was wrong", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#client_id", CLIENT.code);
    await page.fill("#username", CLIENT.username);
    await page.fill("#password", "totally-wrong");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/Invalid Client ID, username or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("client user signs in and lands on the dashboard", async ({ page }) => {
    await loginClient(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("button", { name: /Raise a New Request/i })).toBeVisible();
  });

  test("super admin signs in (blank Client ID) and lands on the admin portal", async ({ page }) => {
    await loginSuper(page);
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("heading", { name: "Control Center" })).toBeVisible();
  });

  test("master admin sees the master-only Super Admins nav; plain super admin does not", async ({ page }) => {
    await loginMaster(page);
    await expect(page.getByRole("link", { name: /Super Admins/i })).toBeVisible();
    await expect(page.locator("header").getByText("Master Admin", { exact: true }).first()).toBeVisible();

    await page.context().clearCookies();
    await loginSuper(page);
    await expect(page.getByRole("link", { name: /Super Admins/i })).toHaveCount(0);
    await expect(page.locator("header").getByText("Super Admin", { exact: true }).first()).toBeVisible();
  });

  test("client user cannot reach the admin portal", async ({ page }) => {
    await loginClient(page);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("logout clears the session", async ({ page }) => {
    await loginClient(page);
    await page.getByRole("button", { name: /Log out/i }).click();
    await page.waitForURL(/\/login/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
