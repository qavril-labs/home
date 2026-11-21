import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Test Configuration for QAVRIL LABS
 * Tests sign-in, quick entry posting, bot reviews, and theme toggling
 * Runs against Vite dev server or npm run dev:all
 */
export default defineConfig({
  testDir: "./specs",
  timeout: 60 * 1000,
  expect: {
    timeout: 15 * 1000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:5173",
    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000,
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
        browserName: "chromium",
        viewport: { width: 375, height: 667 },
      },
    },
  ],
  webServer: process.env.E2E_EXTERNAL_SERVER === "1" ? undefined : {
    command: process.platform === "win32" ? "npm.cmd run dev:web" : "npm run dev:web",
    cwd: "..",
    url: "http://127.0.0.1:5173/",
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120 * 1000,
  },
});
