import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import path from "path";
import type { TestClinic } from "./testClinic";

// The rest of the suite reuses global-setup's already-authenticated
// storageState (see playwright.config.ts) for speed — this file is the one
// place that deliberately starts signed OUT, to cover the actual login
// form itself.
test.use({ storageState: { cookies: [], origins: [] } });

function readTestClinic(): TestClinic {
  return JSON.parse(readFileSync(path.join(__dirname, ".auth", "clinic.json"), "utf-8"));
}

test("signs in with valid credentials and reaches the dashboard", async ({ page }) => {
  const clinic = readTestClinic();

  await page.goto("/login");
  await page.locator("#email").fill(clinic.email);
  await page.locator("#password").fill(clinic.password);
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.waitForURL("/dashboard");
  await expect(page.locator("body")).not.toContainText("Sign in to your clinic's portal");
});

test("shows an error for the wrong password instead of silently failing", async ({ page }) => {
  const clinic = readTestClinic();

  await page.goto("/login");
  await page.locator("#email").fill(clinic.email);
  await page.locator("#password").fill("definitely-the-wrong-password");
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page.getByText(/incorrect|invalid|wrong|no account/i)).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/login/);
});

test("redirects an unauthenticated visit to /dashboard back to /login", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForURL(/\/login/);
});
