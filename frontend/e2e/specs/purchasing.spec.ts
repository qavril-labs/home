import { test, expect } from "@playwright/test";

test.describe("Purchasing & 3-Way Matching (PRC-01 to PRC-04)", () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page, isMobile }) => {
    await page.goto("/#purchasing");
    if (isMobile) {
      const openBtn = page.getByRole("button", { name: "Open navigation sidebar" });
      if (await openBtn.isVisible().catch(() => false)) {
        await openBtn.click();
        const navBtn = page.getByRole("button", { name: /Purchasing & 3-Way/i }).first();
        if (await navBtn.isVisible().catch(() => false)) {
          await navBtn.click();
        }
      }
    } else {
      const navBtn = page.getByRole("button", { name: /Purchasing & 3-Way/i }).first();
      if (await navBtn.isVisible().catch(() => false)) {
        await navBtn.click();
      }
    }
    await expect(page.getByRole("heading", { name: "Purchasing & 3-Way Matching" })).toBeVisible();
  });

  test("Renders 3-way matching summary KPIs and tabs", async ({ page }) => {
    await expect(page.getByText("3-Way Matching Matrix").first()).toBeVisible();
    await expect(page.getByText(/Purchase Orders/i).first()).toBeVisible();
    await expect(page.getByText(/Goods Receipts \/ GRN/i).first()).toBeVisible();

    await expect(page.getByText("Match Accuracy").first()).toBeVisible();
    await expect(page.getByText("Variances Under Review").first()).toBeVisible();
  });

  test("Can switch between Matching, Purchase Orders, and Receipts tabs", async ({ page }) => {
    // Switch to Purchase Orders
    await page.getByRole("button", { name: /Purchase Orders \(\d+\)/i }).click();
    await expect(page.getByRole("button", { name: "New Purchase Order" }).first()).toBeVisible();

    // Switch to Goods Receipts
    await page.getByRole("button", { name: /Goods Receipts \/ GRN/i }).click();
    await expect(page.getByRole("button", { name: "Dock Receipt (GRN)" }).first()).toBeVisible();

    // Switch back to Matching
    await page.getByRole("button", { name: /3-Way Matching Matrix/i }).click();
    await expect(page.getByPlaceholder("Search PO, GRN, bill or supplier...")).toBeVisible();
  });

  test("Opens New Purchase Order modal and validates form fields", async ({ page }) => {
    await page.getByRole("button", { name: "New Purchase Order" }).first().click();

    await expect(page.getByRole("heading", { name: "Create Purchase Order (PRC-01)" })).toBeVisible();
    await expect(page.getByText("Supplier").first()).toBeVisible();
    await expect(page.getByText("Catalog Item").first()).toBeVisible();
    await expect(page.getByText("Order Quantity").first()).toBeVisible();

    // Close modal
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: "Create Purchase Order (PRC-01)" })).not.toBeVisible();
  });
});
