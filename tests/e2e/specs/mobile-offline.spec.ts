import { test, expect } from "@playwright/test";

test.describe("Mobile & Offline Operations Shell (PLT-19)", () => {
  test("Opens offline operations drawer, queues offline sale, and synchronizes to ledger", async ({ page }) => {
    await page.goto("/");

    // Open mobile offline drawer
    const offlineNavBtn = page.getByTestId("mobile-nav-offline-btn");
    if (await offlineNavBtn.isVisible()) {
      await offlineNavBtn.click();
    } else {
      // In desktop view, trigger via CommandBar or evaluate open
      await page.keyboard.press("Control+k");
      await expect(page.getByTestId("command-bar")).toBeVisible();
      // Close command bar and open directly via simulated resize or test hook
      await page.keyboard.press("Escape");
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();
      await page.getByTestId("mobile-nav-offline-btn").click();
    }

    const drawer = page.getByTestId("offline-queue-drawer");
    await expect(drawer).toBeVisible();

    // Simulate Offline Sale
    const simBtn = page.getByTestId("simulate-offline-entry-btn");
    await expect(simBtn).toBeVisible();
    await simBtn.click();

    // Toast feedback
    await expect(page.getByText(/Recorded \$850\.00 field sale to offline local queue/i)).toBeVisible();

    // Flush and synchronize queue
    const syncBtn = page.getByTestId("flush-offline-queue-btn");
    await expect(syncBtn).toBeVisible();
    await syncBtn.click();

    // Success sync feedback
    await expect(page.getByText(/Synchronized.*queued transaction\(s\) to General Ledger/i)).toBeVisible({ timeout: 5000 });
  });
});
