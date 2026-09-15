import { chromium, type FullConfig } from "@playwright/test";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { createTestClinic } from "./testClinic";

// Runs once before the whole e2e/ suite: seeds one throwaway clinic (see
// testClinic.ts — same pattern this repo's manual UI sweeps have used all
// along, just reusable) and logs its owner in through the REAL /login UI
// once, saving the resulting session cookie as Playwright storageState so
// every spec file starts already signed in instead of re-doing this login
// flow per test. global-teardown.ts is what removes the clinic again.
export default async function globalSetup(config: FullConfig) {
  const clinic = await createTestClinic();

  const authDir = path.join(__dirname, ".auth");
  mkdirSync(authDir, { recursive: true });
  writeFileSync(path.join(authDir, "clinic.json"), JSON.stringify(clinic, null, 2));

  const baseURL = config.projects[0]?.use?.baseURL as string;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${baseURL}/login`);
  await page.locator("#email").fill(clinic.email);
  await page.locator("#password").fill(clinic.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(`${baseURL}/dashboard`, { timeout: 30_000 });

  await page.context().storageState({ path: path.join(authDir, "owner.json") });
  await browser.close();
}
