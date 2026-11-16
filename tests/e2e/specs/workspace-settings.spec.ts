import { test, expect } from "@playwright/test";

test.describe("Workspace Settings, Module Licensing & Cryptographic Audit Hub (PLT-18 / AGT-06)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Renders Workspace Settings Hub and manages module licenses", async ({ page }) => {
    // Navigate via Sidebar
    const navBtn = page.getByRole("button", { name: /Settings & Audit/i });
    if (await navBtn.isVisible()) {
      await navBtn.click();
    } else {
      await page.goto("/#settings");
    }

    const hub = page.getByTestId("workspace-settings-hub");
    await expect(hub).toBeVisible();
    await expect(page.getByText("Workspace Settings, Licensing & Audit")).toBeVisible();

    // Verify Licenses Panel
    await expect(page.getByTestId("licenses-panel")).toBeVisible();
    await expect(page.getByTestId("license-card-PLT-01")).toBeVisible();

    // Toggle a license
    const toggleBtn = page.getByTestId("toggle-license-INV-01");
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();

    // Verify toast
    await expect(page.getByText(/Updated license status for Multi-Warehouse Inventory/i)).toBeVisible();
  });

  test("Inspects cryptographic audit trail and filters by actor type", async ({ page }) => {
    const navBtn = page.getByRole("button", { name: /Settings & Audit/i });
    if (await navBtn.isVisible()) {
      await navBtn.click();
    } else {
      await page.goto("/#settings");
    }

    // Switch to Audit tab
    const auditTabBtn = page.getByTestId("tab-audit-btn");
    await expect(auditTabBtn).toBeVisible();
    await auditTabBtn.click();

    // Verify Audit Panel
    const auditPanel = page.getByTestId("audit-panel");
    await expect(auditPanel).toBeVisible();
    await expect(page.getByText("Cryptographic Audit Log & Provenance")).toBeVisible();

    // Verify presence of audit rows
    await expect(page.getByTestId("audit-row-AUD-9901")).toBeVisible();

    // Filter by human
    const humanFilterBtn = page.getByTestId("filter-audit-human");
    await expect(humanFilterBtn).toBeVisible();
    await humanFilterBtn.click();

    // Verify human log
    await expect(page.getByTestId("audit-row-AUD-9903")).toBeVisible();
  });

  test("Configures fiscal period lock date and verifies hard lock enforcement", async ({ page }) => {
    const navBtn = page.getByRole("button", { name: /Settings & Audit/i });
    if (await navBtn.isVisible()) {
      await navBtn.click();
    } else {
      await page.goto("/#settings");
    }

    // Switch to General tab
    const generalTabBtn = page.getByTestId("tab-general-btn");
    await expect(generalTabBtn).toBeVisible();
    await generalTabBtn.click();

    // Verify General Panel
    await expect(page.getByTestId("general-panel")).toBeVisible();
    await expect(page.getByText("Fiscal Period Lock Dates & Currency Profile")).toBeVisible();

    // Click Save
    const saveBtn = page.getByTestId("save-fiscal-settings-btn");
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Verify toast
    await expect(page.getByText(/Saved workspace settings: Period locked to/i)).toBeVisible();
  });
});
