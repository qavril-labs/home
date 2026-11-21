import { test, expect, type Page } from "@playwright/test";

async function clickNav(page: Page, name: RegExp) {
  await page.locator("header").waitFor({ state: "visible" });
  const openBtn = page.getByRole("button", { name: "Open navigation sidebar" });
  if (await openBtn.isVisible()) {
    await openBtn.click();
  }
  await page.getByRole("button", { name }).first().click();
}

test.describe("Phase 2 Modules: Inventory, CRM Pipeline, and Bank Reconciliation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Inventory & Warehouses (INV-01 to INV-05) Flow", async ({ page, isMobile }) => {
    // 1. Navigate to Inventory
    await clickNav(page, /Inventory/i);
    await expect(page.getByRole("heading", { name: "Inventory & Warehouses" })).toBeVisible();

    // 2. Verify 4 KPI cards
    await expect(page.getByText("Total Units In Stock")).toBeVisible();
    await expect(page.getByText("Active Warehouses")).toBeVisible();
    await expect(page.getByText("Low Stock Warnings")).toBeVisible();
    await expect(page.getByText("In-Transit Transfers")).toBeVisible();

    // 3. Test 2D / 3D view toggle
    const toggle2D = page.getByRole("button", { name: /2D Stock Grid/i });
    await expect(toggle2D).toBeVisible();
    await toggle2D.click();

    // Verify 2D Table headers
    await expect(page.getByRole("columnheader", { name: "SKU" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Item Description" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Stock Qty" })).toBeVisible();

    // Filter by specific warehouse
    const eastDepotBtn = page.getByRole("button", { name: /WH-EAST/i });
    if (await eastDepotBtn.isVisible()) {
      await eastDepotBtn.click();
      await expect(page.getByText("WH-EAST").first()).toBeVisible();
    }

    if (!isMobile) {
      // Switch back to 3D View
      const toggle3D = page.getByRole("button", { name: /3D Warehouse View/i });
      await toggle3D.click();
    }

    // 4. Test Stock Transfers (INV-02)
    await expect(page.getByRole("heading", { name: /Stock Transfers & Movements/i })).toBeVisible();

    // Open Transfer Drawer
    await page.getByRole("button", { name: "New Stock Transfer" }).click();
    await expect(page.getByRole("heading", { name: /Initiate Stock Transfer/i })).toBeVisible();

    // Fill transfer notes and submit
    const notesInput = page.getByPlaceholder(/Replenishment for Vanguard aerospace/i);
    await notesInput.fill("Automated E2E Transfer Test");
    await page.getByRole("button", { name: "Dispatch Transfer" }).click();

    // Verify toast
    const toast = page.locator('.fixed[aria-live="polite"]');
    await expect(toast).toContainText(/Stock Transfer Dispatched/i);

    // Verify record in table
    await expect(page.getByText("Automated E2E Transfer Test").first()).toBeVisible();
  });

  test("CRM Pipeline & Quotes (SAL-01 & SAL-02) Flow", async ({ page }) => {
    // 1. Navigate to CRM Pipeline
    await clickNav(page, /CRM Pipeline/i);
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
      await advanceBtn.scrollIntoViewIfNeeded();
      await advanceBtn.click({ force: true });
      const toast = page.locator('.fixed[aria-live="polite"]');
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
      await convertBtn.dispatchEvent("click");
      const toast = page.locator('.fixed[aria-live="polite"]');
      await expect(toast).toContainText(/Invoice Generated/i);
    }
  });

  test("Bank & Cash Reconciliation (FIN-04) Flow", async ({ page }) => {
    // 1. Navigate to Bank Rec
    await clickNav(page, /Bank Rec/i);
    await expect(page.getByRole("heading", { name: "Bank & Cash Reconciliation" })).toBeVisible();

    // 2. Verify 4 KPI cards
    await expect(page.getByText("Bank Feed Balance")).toBeVisible();
    await expect(page.getByText("GL Cash Balance")).toBeVisible();
    await expect(page.getByText("Unmatched Items")).toBeVisible();
    await expect(page.getByText("Reconciled Ratio")).toBeVisible();

    // 3. Confirm match on a Suggested bank feed line
    const confirmMatchBtn = page.getByRole("button", { name: "Confirm Match" }).first();
    if (await confirmMatchBtn.isVisible()) {
      await confirmMatchBtn.dispatchEvent("click");
      const toast = page.locator('.fixed[aria-live="polite"]');
      await expect(toast).toContainText(/Bank Line Reconciled/i);
    }

    // 4. Import Statement Feed
    const importFeedBtn = page.getByRole("button", { name: "Import Statement Feed" });
    await expect(importFeedBtn).toBeVisible();
    await importFeedBtn.click();

    const toast = page.locator('.fixed[aria-live="polite"]');
    await expect(toast).toContainText(/Statement Imported/i);
  });

  test("Financial Statements (FIN-05 / FIN-06) Flow", async ({ page }) => {
    // 1. Navigate to Financial Statements
    await clickNav(page, /Financial Statements/i);
    await expect(page.getByRole("heading", { name: "Financial Statements" })).toBeVisible();

    // 2. Verify P&L and Balance Sheet Tabs
    await expect(page.getByRole("button", { name: /Profit & Loss/i })).toBeVisible();
    const balanceSheetTab = page.getByRole("button", { name: /Balance Sheet/i });
    await expect(balanceSheetTab).toBeVisible();

    // 3. Switch to Balance Sheet Tab
    await balanceSheetTab.click();
    await expect(page.getByText(/Assets \(.*\) = Liabilities \(.*\) \+ Equity \(.*\)/)).toBeVisible();
    await expect(page.getByText("Balanced")).toBeVisible();

    // 4. Test Export triggers
    const exportCsvBtn = page.getByRole("button", { name: /Export CSV/i });
    await expect(exportCsvBtn).toBeVisible();
    await exportCsvBtn.click();

    const toast = page.locator('.fixed[aria-live="polite"]');
    await expect(toast).toContainText(/Financial Statement exported/i);
  });

  test("Purchasing & 3-Way Matching (PRC-01 to PRC-04) Flow", async ({ page }) => {
    // 1. Navigate to Purchasing
    await clickNav(page, /Purchasing & 3-Way/i);
    await expect(page.getByRole("heading", { name: "Purchasing & 3-Way Matching" })).toBeVisible();

    // 2. Verify KPI summary cards
    await expect(page.getByText("Purchase Orders", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Dock Receipts", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Match Accuracy", { exact: false })).toBeVisible();
    await expect(page.getByText("Variances Under Review", { exact: false })).toBeVisible();

    // 3. Verify 3-Way Matching Matrix table
    await expect(page.getByText("Matched Triad")).toBeVisible();
    await expect(page.getByText("PO Order")).toBeVisible();
    await expect(page.getByText("GRN Dock")).toBeVisible();
    await expect(page.getByText("AP Bill")).toBeVisible();
    await expect(page.getByText("100% Matched")).toBeVisible();

    // 4. Switch to Purchase Orders Tab (PRC-01)
    await page.getByRole("button", { name: /Purchase Orders/i }).first().click();
    await expect(page.getByText("PO Reference")).toBeVisible();
    await expect(page.getByText("PO-2026-001")).toBeVisible();

    // 5. Switch to Goods Receipts Tab (PRC-02)
    await page.getByRole("button", { name: /Goods Receipts/i }).first().click();
    await expect(page.getByText("GRN Number")).toBeVisible();
    await expect(page.getByText("GRN-2026-001")).toBeVisible();
  });
});
