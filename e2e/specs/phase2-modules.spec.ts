import { test, expect } from "@playwright/test";

test.describe("Phase 2 Modules: Inventory, CRM Pipeline, and Bank Reconciliation", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any signed-out session state before each test
    await page.addInitScript(() => {
      try {
        sessionStorage.removeItem("qavril-session");
      } catch {}
    });
    await page.goto("/");
  });

  test("Inventory & Warehouses (INV-01) shows live stock only, and no invented figures", async ({ page }) => {
    // 1. Navigate to Inventory
    await page.getByRole("button", { name: "Inventory (INV-01)" }).first().click();
    await expect(page.getByRole("heading", { name: "Inventory & Warehouses" })).toBeVisible();

    // 2. Without a live session the screen says so and shows no stock figures. The demo sign-in is not a live session.
    await expect(page.getByRole("heading", { name: "Sign in to see live stock" })).toBeVisible();
    await expect(page.getByText("Total Units In Stock")).toHaveCount(0);
    await expect(page.getByText("Automated E2E Transfer Test")).toHaveCount(0);

    // 3. The section tabs are there once the screen is connected; without a session only the header shows.
    await expect(page.getByRole("button", { name: "Receive stock" })).toHaveCount(0);
  });

  test("Till (POS-01) opens and, without a live session, shows no sale figures", async ({ page }) => {
    await page.getByRole("button", { name: "Till (POS-01)" }).first().click();
    await expect(page.getByRole("heading", { name: "Till" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sign in to see live stock" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Complete the sale" })).toHaveCount(0);
  });

  test("CRM Pipeline & Quotes (SAL-01 & SAL-02) Flow", async ({ page }) => {
    // 1. Navigate to CRM Pipeline
    await page.getByRole("button", { name: "CRM Pipeline (SAL-01)" }).first().click();
    await expect(page.getByRole("heading", { name: "CRM Pipeline & Quotes" })).toBeVisible();

    // 2. Verify 4 KPI cards
    await expect(page.getByText("Total Pipeline Value")).toBeVisible();
    await expect(page.getByText("Weighted Forecast")).toBeVisible();
    await expect(page.getByText("Active Deals")).toBeVisible();
    await expect(page.getByText("Win Rate")).toBeVisible();

    // 3. Verify Kanban Columns
    await expect(page.getByText("Discovery", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Proposal", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Negotiation", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Closed Won", { exact: false }).first()).toBeVisible();

    // 4. Advance a deal stage
    const advanceBtn = page.getByRole("button", { name: "Advance" }).first();
    if (await advanceBtn.isVisible()) {
      await advanceBtn.click();
      const toast = page.locator('[aria-live="polite"]');
      await expect(toast).toContainText(/Stage Advanced/i);
    }

    // 5. Switch to Quotes & CPQ Builder (SAL-02) Tab
    await page.getByRole("button", { name: /Quotes & CPQ Builder/i }).click();
    await expect(page.getByRole("heading", { name: /Sales Quotes & CPQ Configurations/i })).toBeVisible();

    // Verify Quote records exist
    await expect(page.getByText("QUO-2026-301")).toBeVisible();
    await expect(page.getByText("QUO-2026-302")).toBeVisible();

    // Convert accepted quote to invoice
    const convertBtn = page.getByRole("button", { name: "Convert to Invoice" }).first();
    if (await convertBtn.isVisible()) {
      await convertBtn.click();
      const toast = page.locator('[aria-live="polite"]');
      await expect(toast).toContainText(/Invoice Generated/i);
    }
  });

  test("Bank & Cash Reconciliation (FIN-04) Flow", async ({ page }) => {
    // 1. Navigate to Bank Rec
    await page.getByRole("button", { name: "Bank Rec (FIN-04)" }).first().click();
    await expect(page.getByRole("heading", { name: "Bank & Cash Reconciliation" })).toBeVisible();

    // 2. Verify 4 KPI cards
    await expect(page.getByText("Bank Feed Balance")).toBeVisible();
    await expect(page.getByText("GL Cash Balance")).toBeVisible();
    await expect(page.getByText("Unmatched Items")).toBeVisible();
    await expect(page.getByText("Reconciled Ratio")).toBeVisible();

    // 3. Confirm match on a Suggested bank feed line
    const confirmMatchBtn = page.getByRole("button", { name: "Confirm Match" }).first();
    if (await confirmMatchBtn.isVisible()) {
      await confirmMatchBtn.click();
      const toast = page.locator('[aria-live="polite"]');
      await expect(toast).toContainText(/Bank Line Reconciled/i);
    }

    // 4. Import Statement Feed
    const importFeedBtn = page.getByRole("button", { name: "Import Statement Feed" });
    await expect(importFeedBtn).toBeVisible();
    await importFeedBtn.click();

    const toast = page.locator('[aria-live="polite"]');
    await expect(toast).toContainText(/Statement Imported/i);
  });
});
