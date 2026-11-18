import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Test Configuration for QAVRIL LABS
 * Tests sign-in, quick entry posting, bot reviews, and theme toggling
 * Runs against Vite dev server or npm run dev:all
 */
// The web app is served under /app/ (apps/web/vite.config.ts). E2E_PORT lets a run use a free port
// when another dev server already holds the default one, so the tests never reach a different checkout.
const port = Number(process.env.E2E_PORT || 5180);
// 127.0.0.1 rather than localhost: on Windows localhost can resolve to IPv6 first, which the dev server may not answer.
const appUrl = `http://127.0.0.1:${port}/app/`;

export default defineConfig({
  testDir: "./specs",
  globalSetup: "./fixtures/global-setup.ts",
  fullyParallel: true,
  // The first request to a dev server compiles its modules, which can take well over the default 30 seconds.
  timeout: 90 * 1000,
  expect: { timeout: 15 * 1000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || appUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "Desktop Chrome (1280px)",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "Mobile Safari (375px)",
      use: {
        ...devices["iPhone 13"],
        viewport: { width: 375, height: 667 },
      },
    },
  ],
  webServer: {
    command: `npm run dev -w @erp/web -- --port ${port} --strictPort`,
    cwd: "../..",
    // The dev proxy forwards /v1 to the API the tests seed and sign in to (see fixtures/live-session.ts).
    env: { VITE_DEV_API: process.env.E2E_API_URL || "http://127.0.0.1:3012" },
    url: appUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
