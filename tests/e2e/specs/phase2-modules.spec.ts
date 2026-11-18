import { test, expect } from "@playwright/test";
import { openScreen, useLiveSession } from "../fixtures/live-session";

test.describe("Phase 2 Modules: Inventory, Till, CRM Pipeline, and Bank Reconciliation", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any signed-out session state before each test
    await page.addInitScript(() => {
      try {
        sessionStorage.removeItem("qavril-session");
      } catch {}
    });
    // The first load of a dev server compiles its modules, so wait for the document, not for every asset.
    await page.goto("/app/", { waitUntil: "domcontentloaded" });
  });

  test("Inventory (INV-01) without a live session says so and shows no figures", async ({ page }) => {
    await openScreen(page, "Inventory (INV-01)");
    await expect(page.getByRole("heading", { name: "Inventory & Warehouses" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sign in to see live stock" })).toBeVisible();
    await expect(page.getByText("Expired stock, at cost")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Receive stock" })).toHaveCount(0);
  });

  test("Inventory (INV-01) shows the live figures, the stock list and the receive drawer", async ({ page }) => {
    await useLiveSession(page);
    await page.goto("/app/", { waitUntil: "domcontentloaded" });
    await openScreen(page, "Inventory (INV-01)");
    await expect(page.getByRole("heading", { name: "Inventory & Warehouses" })).toBeVisible();

    // The four figures come from the server.
    await expect(page.getByText("Expired stock, at cost")).toBeVisible();
    await expect(page.getByText("Expiring within 30 days")).toBeVisible();
    await expect(page.getByText("Waiting for approval", { exact: true })).toBeVisible();
    await expect(page.getByText("Counts in progress")).toBeVisible();

    // The seeded batches are in the stock list.
    await expect(page.getByText("PX-2026-03").first()).toBeVisible();
    await expect(page.getByText("PX-2027").first()).toBeVisible();

    // Receive stock opens its drawer, and Escape closes it.
    await page.getByRole("button", { name: "Receive stock" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("Till (POS-01) without a live session says so and shows no sale figures", async ({ page }) => {
    await openScreen(page, "Till (POS-01)");
    await expect(page.getByRole("heading", { name: "Till", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sign in to see live stock" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Complete the sale" })).toHaveCount(0);
  });

  test("Till (POS-01) lists the sale kept for review, from the live API", async ({ page }) => {
    await useLiveSession(page);
    await page.goto("/app/", { waitUntil: "domcontentloaded" });
    await openScreen(page, "Till (POS-01)");
    await expect(page.getByRole("heading", { name: "Till", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Review and approvals" }).click();
    await expect(page.getByRole("heading", { name: "Sales waiting for a decision" })).toBeVisible();
    await expect(page.getByText("KES 23.80").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Post now" }).first()).toBeVisible();
  });

  test("CRM Pipeline & Quotes (SAL-01 & SAL-02) Flow", async ({ page }) => {
    // 1. Navigate to CRM Pipeline
    await openScreen(page, "CRM Pipeline (SAL-01)");
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
    await openScreen(page, "Bank Rec (FIN-04)");
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
