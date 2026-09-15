import { defineConfig, devices } from "@playwright/test";

// A separate port (not 3000) and its own `next dev` process on purpose —
// the Claude Browser tool's own dev-server preview binds to port 3000 from
// .claude/launch.json, and this session already ran into two agents'
// dev servers fighting over the same port/cookies during the mobile UI
// sweep. Keeping Playwright's server independent means `npm run test:e2e`
// never collides with whatever's open in the Browser pane.
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // every test shares one seeded clinic (see e2e/fixtures) — avoid cross-test races on its data
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: BASE_URL,
    storageState: "./e2e/.auth/owner.json",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Chromium-based on purpose, not iPhone/WebKit — this repo only has
      // the chromium browser installed (see the UI sweep's own notes on
      // testing at real mobile widths), and the app's only native mobile
      // build is Android/Capacitor anyway, not iOS.
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
