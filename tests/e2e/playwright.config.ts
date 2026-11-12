import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Test Configuration for QAVRIL LABS
 * Tests sign-in, quick entry posting, bot reviews, and theme toggling
 * Runs against Vite dev server or npm run dev:all
 */
export default defineConfig({
  testDir: "./specs",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
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
    command: "npm run dev -w @erp/web",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
