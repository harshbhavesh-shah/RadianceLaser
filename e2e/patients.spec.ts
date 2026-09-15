import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" }); // second test depends on the patient the first one created

const patientName = `E2E Patient ${Date.now()}`;
const patientPhone = `9${Date.now().toString().slice(-9)}`;

test("creates a new patient and lands on their record page", async ({ page }) => {
  await page.goto("/dashboard/patients/new");

  await page.getByLabel("Full Name").fill(patientName);
  await page.getByLabel("Contact Number").fill(patientPhone);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Save Patient" }).click();

  await page.waitForURL(/\/dashboard\/patients\/[^/]+$/, { timeout: 15_000 });
  await expect(page.getByText(patientName).first()).toBeVisible();
});

test("finds the newly created patient by search on the patients list", async ({ page }) => {
  await page.goto("/dashboard/patients");

  await page.getByPlaceholder("Search by name, phone, or patient ID…").fill(patientName);
  const row = page.getByRole("link", { name: new RegExp(patientName) });
  await expect(row).toBeVisible({ timeout: 10_000 });

  await row.click();
  await page.waitForURL(/\/dashboard\/patients\/[^/]+$/);
  await expect(page.getByText(patientName).first()).toBeVisible();
});

test("rejects an empty-name submission instead of silently creating a blank patient", async ({ page }) => {
  await page.goto("/dashboard/patients/new");

  await page.getByLabel("Contact Number").fill(`9${Date.now().toString().slice(-9)}`);
  await page.getByRole("checkbox").check();
  // Deliberately leave Full Name empty and try to submit.
  await page.getByRole("button", { name: "Save Patient" }).click();

  // The browser's own required-field validation should block the submit —
  // still on the same page, not redirected to a new patient record.
  await expect(page).toHaveURL(/\/dashboard\/patients\/new$/);
});
