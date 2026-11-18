import { test, expect } from "@playwright/test";

/**
 * Approvals inbox against the UAAP API (docs/ui-contract.md section 5: every figure comes from the API).
 *
 * The demo session cannot call UAAP (its token has no tenant prefix), so these tests check the honest
 * "not connected" state: no invented approvals, no Approve button, no invented bots, and a clear message.
 * The live approve flow needs a real tenant session and is covered by the API tests in services/uaap.
 */
test.describe("Approvals inbox, connected to the UAAP API", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    const menu = page.getByRole("button", { name: "Open navigation sidebar" });
    if (await menu.isVisible()) {
      await menu.click();
    }
    await page.getByRole("button", { name: /Approvals/i }).first().click();
    await expect(page.getByRole("heading", { name: "Approvals Inbox" })).toBeVisible();
  });

  test("shows the connection state, not sample data", async ({ page }) => {
    await expect(page.getByText("Not connected").first()).toBeVisible();
    await expect(page.getByText(/Mock Fixture/i)).toHaveCount(0);
  });

  test("invents no approvals when the bot service is unreachable", async ({ page }) => {
    // Sample proposals used to appear here; none of their amounts or names may show.
    await expect(page.getByText("$850.00")).toHaveCount(0);
    await expect(page.getByText("Post Monthly Depreciation Schedule")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
  });

  test("shows the reason when the approvals cannot be loaded", async ({ page }) => {
    await expect(page.getByRole("alert")).toContainText(/Nothing shown here is a sample/i);
  });

  test("invents no bots when none are connected", async ({ page }) => {
    await expect(page.getByText("No bots are connected yet")).toBeVisible();
    await expect(page.getByLabel("Bots", { exact: true })).toHaveCount(0);
  });
});
