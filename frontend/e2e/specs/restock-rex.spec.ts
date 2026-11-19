import { test, expect } from "@playwright/test";

test.describe("Restock Rex (AGT-04 / INV-05) Dedicated Screen & PO Drawer", () => {
  test.beforeEach(async ({ page, isMobile }) => {
    await page.goto("/");
    if (isMobile) {
      const openBtn = page.getByRole("button", { name: "Open navigation sidebar" });
      if (await openBtn.isVisible()) {
        await openBtn.click();
      }
    }
    await page.getByRole("button", { name: "Restock Rex (AGT-04)" }).first().click();
    await expect(page.getByRole("heading", { name: "Restock Rex" })).toBeVisible();
  });

  test("Renders Restock Rex header, avatar, and live indicator", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Restock Rex" })).toBeVisible();
    await expect(page.getByText("Inventory Replenisher").first()).toBeVisible();
    await expect(page.getByText("AGT-04 / INV-05")).toBeVisible();
    await expect(page.getByText(/Live · updated/i)).toBeVisible();

    // Kill switch active
    await expect(page.getByRole("button", { name: /ACTIVE \(ON\)/i })).toBeVisible();
  });

  test("Displays StatusChips: items below reorder, critical stockout, and PO draft pending", async ({
    page,
  }) => {
    await expect(page.getByText(/! 3 items below reorder point/i).first()).toBeVisible();
    await expect(page.getByText(/! 1 critical stockout/i).first()).toBeVisible();
    await expect(page.getByText(/● 1 PO draft pending approval/i).first()).toBeVisible();
  });

  test("Toggles kill switch with warning notice", async ({ page }) => {
    const killSwitch = page.getByRole("button", { name: /ACTIVE \(ON\)/i });
    await killSwitch.click();

    // Suspended state
    await expect(page.getByText(/OFF \(SUSPENDED\)/i)).toBeVisible();
    await expect(page.getByText(/Kill switch is engaged\. Automated inventory/i)).toBeVisible();

    // Resume
    await page.getByRole("button", { name: /OFF \(SUSPENDED\)/i }).click();
    await expect(page.getByText(/ACTIVE \(ON\)/i)).toBeVisible();
  });

  test("Switches sub-tabs between Reorder Queue, All Stock, and 2D Warehouse Bin Map", async ({
    page,
  }) => {
    // Reorder tab is active by default
    await expect(page.getByText("6061-T6 Aluminum Round Bar").first()).toBeVisible();

    // Click All Stock Levels
    await page.getByRole("button", { name: /All Stock Levels/i }).click();
    await expect(page.getByText("Solid Carbide End Mill 8mm")).toBeVisible();

    // Click 2D Warehouse Bin Map
    await page.getByRole("button", { name: /2D Warehouse Bin Map/i }).click();
    await expect(page.getByText("BIN-A01")).toBeVisible();
    await expect(page.getByText("BIN-B01")).toBeVisible();
  });

  test("Opens CreatePODrawer, verifies lines and submits PO draft to Approvals Inbox", async ({
    page,
  }) => {
    // Click review PO
    await page.getByRole("button", { name: /Review PO-2026-004/i }).click();

    // Drawer opens
    await expect(page.getByRole("heading", { name: /Draft Replenishment PO: PO-2026-004/i })).toBeVisible();
    await expect(page.getByText("Industrial Supply Co.").first()).toBeVisible();
    await expect(page.getByText("$3,417.50").first()).toBeVisible();

    // Click Submit PO for Approval
    await page.getByRole("button", { name: "Submit PO for Approval" }).click();

    // Toast appears
    await expect(page.getByText(/Purchase Order PO-2026-004 submitted to Approvals Inbox/i)).toBeVisible();
  });
});
