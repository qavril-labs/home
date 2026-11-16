import { test, expect } from "@playwright/test";

test.describe("Autonomous Autopilot Sentinel & Inter-Agent Swarm Mission Control (PLT-07 / AGT-01)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Renders Autopilot Sentinel banner on Dashboard and header status trigger", async ({ page }) => {
    // Check Dashboard banner
    const banner = page.getByTestId("dashboard-autopilot-banner");
    await expect(banner).toBeVisible();
    await expect(page.getByText("Autonomous Autopilot Sentinel · Active Swarm")).toBeVisible();

    // Check Header Autopilot trigger button
    const headerBtn = page.getByTestId("header-autopilot-btn");
    await expect(headerBtn).toBeVisible();

    // Check Audio feedback toggle button
    const soundBtn = page.getByTestId("header-sound-btn");
    await expect(soundBtn).toBeVisible();
    await soundBtn.click(); // toggle mute/unmute
  });

  test("Opens Autopilot Mission Control Drawer and adjusts policy limits", async ({ page }) => {
    const headerBtn = page.getByTestId("header-autopilot-btn");
    await headerBtn.click();

    // Verify Drawer is visible
    const missionControl = page.getByTestId("autopilot-mission-control");
    await expect(missionControl).toBeVisible();
    await expect(page.getByText("Autonomous Autopilot Mission Control (PLT-07 / AGT-01)")).toBeVisible();

    // Verify 8 cooperating bots in the swarm matrix
    await expect(page.getByText("Ledger Lou")).toBeVisible();
    await expect(page.getByText("Ticket Tess")).toBeVisible();
    await expect(page.getByText("Onboard Ola")).toBeVisible();
    await expect(page.getByText("Guard Gus")).toBeVisible();
    await expect(page.getByText("Restock Rex")).toBeVisible();

    // Switch Autopilot modes
    await page.getByTestId("mode-manual-btn").click();
    await expect(page.getByText("Manual Mode")).toBeVisible();

    await page.getByTestId("mode-full-btn").click();
    await expect(page.getByText("Full Swarm Autopilot")).toBeVisible();

    await page.getByTestId("mode-supervised-btn").click();
    await expect(page.getByText("Supervised Autopilot")).toBeVisible();
  });

  test("Simulates 5-event swarm cascade, updates telemetry terminal, and increments counter", async ({ page }) => {
    // Open from dashboard banner
    await page.getByTestId("dashboard-mission-control-btn").click();
    await expect(page.getByTestId("autopilot-mission-control")).toBeVisible();

    // Capture initial count
    const statTile = page.getByTestId("stat-action-count");
    await expect(statTile).toBeVisible();

    // Click Simulate Swarm Cascade
    const cascadeBtn = page.getByTestId("simulate-cascade-btn");
    await expect(cascadeBtn).toBeVisible();
    await cascadeBtn.click();

    // Wait for the cascade events to stream into terminal
    await expect(page.getByText(/Visual OCR captured Supplier Bill/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Guard Gus verified cryptographic SHA-256/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Restock Rex cross-checked warehouse stock/i)).toBeVisible({ timeout: 5000 });

    // Toast feedback after completion
    await expect(page.getByText(/Autopilot Swarm Cascade completed/i)).toBeVisible({ timeout: 6000 });
  });
});
