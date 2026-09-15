import { test, expect } from "@playwright/test";

// AppointmentFormModal's fields are plain <label>+<input> siblings with no
// htmlFor/id (see e2e/patients.spec.ts's New Patient form for the one page
// that does use ids) — getByLabel won't associate them, so these locators
// walk from the label text to its adjacent control instead.
function fieldAfterLabel(page: import("@playwright/test").Page, labelText: string) {
  return page.locator(`label:text-is("${labelText}") + input, label:text-is("${labelText}") + select`);
}

test("books a new appointment for a quick-added patient and sees it on the day view", async ({ page }) => {
  const patientName = `E2E Appt Patient ${Date.now()}`;
  const patientPhone = `9${Date.now().toString().slice(-9)}`;

  await page.goto("/dashboard/appointments");
  await page.getByRole("button", { name: "+ New Appointment" }).click();
  await expect(page.getByRole("heading", { name: "New Appointment" })).toBeVisible();

  await page.getByPlaceholder("Search by name or phone…").fill(patientName);
  // The button's actual text uses typographic quotes (&ldquo;/&rdquo;), not
  // straight ones — match loosely on the stable part instead of the quote
  // glyphs themselves.
  await page.getByRole("button", { name: new RegExp(`Add.*${patientName}.*as a new patient`) }).click();
  await page.getByPlaceholder("Phone number").fill(patientPhone);
  await page.getByRole("button", { name: "Add & Select" }).click();
  await expect(page.getByText(`Selected: ${patientName}`)).toBeVisible({ timeout: 10_000 });

  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  // Every project (desktop/mobile) books against the same seeded clinic in
  // the same run — a fixed time here would make the second project's
  // booking collide with the first's and hit a real double-booking
  // conflict screen instead of saving cleanly. Derive a time from the
  // clock instead, so each run's projects land on different slots.
  const now = Date.now();
  const hour = String(8 + (now % 10)).padStart(2, "0");
  const minute = String(now % 60).padStart(2, "0");
  await fieldAfterLabel(page, "Date").fill(dateStr);
  await fieldAfterLabel(page, "Time").fill(`${hour}:${minute}`);

  await page.getByRole("button", { name: "Save", exact: true }).click();

  // Modal closes on success — its heading disappears.
  await expect(page.getByRole("heading", { name: "New Appointment" })).not.toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(patientName).first()).toBeVisible({ timeout: 10_000 });
});

test("blocks booking with no patient selected", async ({ page }) => {
  await page.goto("/dashboard/appointments");
  await page.getByRole("button", { name: "+ New Appointment" }).click();
  await expect(page.getByRole("heading", { name: "New Appointment" })).toBeVisible();

  // Leave the patient field empty; try to save straight away.
  await page.getByRole("button", { name: "Save", exact: true }).click();

  // Still open — a real save would have closed the modal.
  await expect(page.getByRole("heading", { name: "New Appointment" })).toBeVisible();
});
