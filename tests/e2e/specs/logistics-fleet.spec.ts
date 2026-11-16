import { test, expect } from "@playwright/test";

test.describe("Logistics, Shipping & 3D Fleet Map (LOG-01 / LOG-04)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Renders Logistics Hub with 3D Fleet Map canvas, stats, and consignments table", async ({ page }) => {
    // Navigate via Sidebar
    const navBtn = page.getByRole("button", { name: /Logistics & Fleet/i });
    if (await navBtn.isVisible()) {
      await navBtn.click();
    } else {
      await page.goto("/#logistics");
    }

    const hub = page.getByTestId("logistics-hub");
    await expect(hub).toBeVisible();
    await expect(page.getByText("Logistics, Shipping & Fleet Telemetry")).toBeVisible();

    // Check KPI Stat
    await expect(page.getByTestId("stat-active-shipments")).toBeVisible();

    // Toggle 3D map vs 2D table
    const toggle3D = page.getByTestId("toggle-3d-map");
    const toggle2D = page.getByTestId("toggle-2d-table");
    await expect(toggle3D).toBeVisible();
    await expect(toggle2D).toBeVisible();

    await toggle2D.click();
    await toggle3D.click();

    // Check consignments table
    const table = page.getByTestId("consignments-table");
    await expect(table).toBeVisible();
    await expect(page.getByText("TRK-APX-8821")).toBeVisible();
    await expect(page.getByText("TRK-APX-8822")).toBeVisible();
  });

  test("Authorizes Proof-of-Delivery (POD) and emits consignment.delivered domain event", async ({ page }) => {
    const navBtn = page.getByRole("button", { name: /Logistics & Fleet/i });
    if (await navBtn.isVisible()) {
      await navBtn.click();
    } else {
      await page.goto("/#logistics");
    }

    // Open POD modal for TRK-APX-8822
    const podBtn = page.getByTestId("pod-btn-SHP-7702");
    await expect(podBtn).toBeVisible();
    await podBtn.click();

    // Verify modal
    await expect(page.getByTestId("pod-modal")).toBeVisible();
    await expect(page.getByText("TRK-APX-8822")).toBeVisible();

    // Confirm sign-off
    const signBtn = page.getByRole("button", { name: /Authorize Delivery & Post POD/i });
    await expect(signBtn).toBeVisible();
    await signBtn.click();

    // Verify toast
    await expect(page.getByText(/Proof of Delivery verified for TRK-APX-8822/i)).toBeVisible();

    // Check Live Event Ticker reflects consignment.delivered
    await page.getByTestId("live-event-ticker-btn").click();
    await expect(page.getByTestId("live-event-dropdown")).toBeVisible();
    await expect(page.getByText("consignment.delivered").first()).toBeVisible();
  });
});
