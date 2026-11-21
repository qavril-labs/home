import { test, expect } from "@playwright/test";

test.describe("Chase Chloe (AGT-02 / FIN-14) Dedicated Screen & Reminder Review", () => {
  test.beforeEach(async ({ page, isMobile }) => {
    await page.goto("/");
    if (isMobile) {
      const openBtn = page.getByRole("button", { name: "Open navigation sidebar" });
      if (await openBtn.isVisible()) {
        await openBtn.click();
      }
    }
    await page.getByRole("button", { name: "Chase Chloe (FIN-14)" }).first().click();
    await expect(page.getByRole("heading", { name: "Chase Chloe" })).toBeVisible();
  });

  test("Renders Chase Chloe bot header, avatar, and Live indicator", async ({ page }) => {
    // Heading and Role
    await expect(page.getByRole("heading", { name: "Chase Chloe" })).toBeVisible();
    await expect(page.getByText("Invoice Chaser").first()).toBeVisible();
    await expect(page.getByText("AGT-02 / FIN-14", { exact: true })).toBeVisible();

    // Live indicator
    await expect(page.getByText(/Live · updated/i)).toBeVisible();

    // Kill switch is active by default
    await expect(page.getByRole("button", { name: /ACTIVE \(ON\)/i })).toBeVisible();
  });

  test("Displays StatusChips: Zero bad debt, overdue invoices, and reminder drafts pending", async ({
    page,
  }) => {
    // 3 StatusChips required
    await expect(page.getByText("✓ Zero bad debt").first()).toBeVisible();
    await expect(page.getByText(/! \d+ overdue invoices/i).first()).toBeVisible();
    await expect(page.getByText(/● \d+ reminder drafts pending/i).first()).toBeVisible();
  });

  test("Toggles kill switch on/off with audit notice", async ({ page }) => {
    const killSwitch = page.getByRole("button", { name: /ACTIVE \(ON\)/i });
    await killSwitch.click();

    // Kill switch engaged state
    await expect(page.getByText(/OFF \(SUSPENDED\)/i)).toBeVisible();
    await expect(
      page.getByText(/Kill switch is engaged\. Automated AR aging calculations.*are paused\./i)
    ).toBeVisible();

    // Re-engage kill switch
    await page.getByRole("button", { name: /OFF \(SUSPENDED\)/i }).click();
    await expect(page.getByText(/ACTIVE \(ON\)/i)).toBeVisible();
  });

  test("Opens SendReminderModal, switches tone/channel, and Approves & Delivers Reminder", async ({
    page,
  }) => {
    // Click review draft for Delta Dynamics
    await page.getByRole("button", { name: "Review Draft" }).first().click();

    // Modal title & content
    await expect(page.getByRole("heading", { name: "Review Payment Reminder Draft" })).toBeVisible();
    await expect(page.getByText(/Delta Dynamics/i).first()).toBeVisible();
    await expect(page.getByText("$2,850.00").first()).toBeVisible();

    // Switch tone to Firm
    await page.getByRole("button", { name: "FIRM" }).click();
    await expect(page.getByText(/Attention Accounts Payable/i)).toBeVisible();

    // Switch channel to Email
    await page.getByRole("button", { name: "Email" }).click();
    await expect(page.getByText("Subject Line")).toBeVisible();

    // Approve & Deliver
    await page.getByRole("button", { name: "Approve & Deliver Reminder" }).click();

    // Modal closes and reminder status updates
    await expect(page.getByRole("heading", { name: "Review Payment Reminder Draft" })).not.toBeVisible();
    await expect(page.getByText("✓ Reminder Sent").first()).toBeVisible();
  });

  test("Opens Customer Statement Drawer and views transaction history", async ({ page }) => {
    // Click statement button on first invoice
    const stmtBtn = page.getByRole("button", { name: "Statement", exact: true }).first();
    await stmtBtn.dispatchEvent("click");

    // Drawer opens
    await expect(page.getByRole("heading", { name: /Statement of Account/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Payment Terms:").first()).toBeVisible();
    await expect(page.getByText("INV-2026-052").first()).toBeVisible();
    await expect(page.getByText("PAY-2026-041").first()).toBeVisible();

    // Close drawer
    await page.getByRole("button", { name: "Close Statement" }).click();
    await expect(page.getByRole("heading", { name: /Statement of Account/i })).not.toBeVisible();
  });
});
