import { test, expect } from "@playwright/test";

test.describe("QAVRIL LABS Frontend Lane E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Loads dashboard with brand identity and KPI tiles", async ({ page }) => {
    // Brand mark
    await expect(page.locator("header")).toContainText("QAVRIL/LABS");

    // KPI Tiles
    await expect(page.getByText("Cash and bank")).toBeVisible();
    await expect(page.getByText("Sales to date")).toBeVisible();
    await expect(page.getByText("Expenses to date")).toBeVisible();
    await expect(page.getByText("Profit to date")).toBeVisible();
  });

  test("Submits quick entry and verifies instant ledger posting toast", async ({ page }) => {
    // Fill quick entry form
    const amountInput = page.getByPlaceholder("e.g. 1250.00");
    await amountInput.fill("1250.00");

    const partyInput = page.getByPlaceholder("e.g. Acme Corporation");
    await partyInput.fill("Quantum Dyn Corp");

    // Click submit
    await page.getByRole("button", { name: "Post to ledger" }).click();

    // Verify success toast appears with 4s auto-dismiss and Undo option
    const toast = page.locator('[aria-live="polite"]');
    await expect(toast).toContainText("Entry posted");
    await expect(toast).toContainText("Undo");
  });

  test("Toggles theme between light and dark mode", async ({ page }) => {
    const themeBtn = page.getByRole("button", { name: /switch to/i });
    const initialTheme = await page.locator("html").getAttribute("data-theme");

    await themeBtn.click();
    const newTheme = await page.locator("html").getAttribute("data-theme");
    expect(newTheme).not.toEqual(initialTheme);
  });

  test("Opens CommandBar palette with Ctrl+K shortcut", async ({ page }) => {
    await page.keyboard.press("Control+K");
    await expect(page.getByPlaceholder(/Type a command/i)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder(/Type a command/i)).toBeHidden();
  });

  test("Navigates between Master Data, CSV Import, and Component Gallery", async ({ page }) => {
    // Navigate to Contacts
    await page.getByRole("button", { name: "Contacts (MDM-01)" }).first().click();
    await expect(page.getByText("Customers & Suppliers")).toBeVisible();

    // Navigate to Items
    await page.getByRole("button", { name: "Items (MDM-02)" }).first().click();
    await expect(page.getByText("Items & Products")).toBeVisible();

    // Navigate to Import
    await page.getByRole("button", { name: "CSV Import (PLT-14)" }).first().click();
    await expect(page.getByText("CSV & Excel Import")).toBeVisible();

    // Navigate to Gallery
    await page.getByRole("button", { name: "Component Gallery" }).first().click();
    await expect(page.getByText("Quality Assurance & Token Conformance")).toBeVisible();
  });
});
