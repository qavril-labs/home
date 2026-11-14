import { test, expect } from "@playwright/test";

test.describe("Ledger Lou (AGT-03 / FIN-13) Dedicated Screen & Review Drawers", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Navigate to Ledger Lou dedicated screen via top navigation
    await page.getByRole("button", { name: "Ledger Lou (AGT-03)" }).first().click();
  });

  test("Renders Ledger Lou bot header, Lou avatar, and Live indicator", async ({ page }) => {
    // Heading and Role
    await expect(page.getByRole("heading", { name: "Ledger Lou" })).toBeVisible();
    await expect(page.getByText("Month-End Checker").first()).toBeVisible();
    await expect(page.getByText("AGT-03 / FIN-13")).toBeVisible();

    // Live indicator
    await expect(page.getByText(/Live · updated/i)).toBeVisible();

    // Kill switch is active by default
    await expect(page.getByRole("button", { name: /ACTIVE \(ON\)/i })).toBeVisible();
  });

  test("Displays StatusChips: All balanced, 2 unposted items, Period closing pending", async ({ page }) => {
    // 3 StatusChips required by prompt
    await expect(page.getByText("✓ All balanced").first()).toBeVisible();
    await expect(page.getByText(/! 2 unposted items/i).first()).toBeVisible();
    await expect(page.getByText("● Period closing pending").first()).toBeVisible();
  });

  test("Toggles kill switch on/off with audit notice", async ({ page }) => {
    const killSwitch = page.getByRole("button", { name: /ACTIVE \(ON\)/i });
    await killSwitch.click();

    // Kill switch engaged state
    await expect(page.getByText(/OFF \(SUSPENDED\)/i)).toBeVisible();
    await expect(
      page.getByText(/Kill switch is engaged\. Automated invariant checks.*are paused\./i)
    ).toBeVisible();

    // Re-engage kill switch
    await page.getByRole("button", { name: /OFF \(SUSPENDED\)/i }).click();
    await expect(page.getByText(/ACTIVE \(ON\)/i)).toBeVisible();
  });

  test("Opens UnpostedEntriesModal, verifies side-by-side debit/credits, and Approves & Posts with ConfirmDialog", async ({
    page,
  }) => {
    // Click review drafts on checklist item 3
    await page.getByRole("button", { name: /Review 2 Unposted Drafts|Review Drafts/i }).first().click();

    // Modal title & draft banner
    await expect(page.getByRole("heading", { name: "Review Unposted Draft Entries" })).toBeVisible();
    await expect(page.getByText("Draft · Action Required")).toBeVisible();

    // Side-by-side debit/credit table entries
    await expect(page.getByText("DEP-2026-11")).toBeVisible();
    await expect(page.getByText("ACCR-2026-11")).toBeVisible();
    await expect(page.getByText("6900")).toBeVisible();
    await expect(page.getByText("Depreciation expense")).toBeVisible();

    // Grand total & Invariant check
    await expect(page.getByText("$1,250.00").first()).toBeVisible();
    await expect(page.getByText("Zero variance · Ready to post")).toBeVisible();

    // Click Primary Action "Approve & Post"
    await page.getByRole("button", { name: "Approve & Post" }).click();

    // Tier 3 Confirm Dialog appears
    await expect(
      page.getByRole("heading", { name: "Approve & Post Journal Entries" })
    ).toBeVisible();
    await expect(page.getByText(/irreversible/i)).toBeVisible();

    // Confirm action
    await page.getByRole("button", { name: "Post $1,250.00" }).click();

    // Toast confirmation
    const toast = page.locator('[aria-live="polite"]');
    await expect(toast).toContainText("Approve & Post successful");

    // Modal closes and status reflects posted
    await expect(page.getByText("✓ All posted")).toBeVisible();
    await expect(page.getByText("✓ 0 unposted items").first()).toBeVisible();
  });

  test("Opens Bank Reconciliation inspection drawer and verifies zero variance", async ({ page }) => {
    await page.getByRole("button", { name: "View Details" }).first().click();

    // Drawer header
    await expect(page.getByRole("heading", { name: "Bank Reconciliation Inspection" })).toBeVisible();

    // GL 1100 vs Statement equality
    await expect(page.getByText("$42,150.00").first()).toBeVisible();
    await expect(page.getByText("$0.00 (Balanced)")).toBeVisible();

    // Matched statement lines
    await expect(page.getByText(/Matched QE-00012/i)).toBeVisible();

    // Close drawer
    await page.getByRole("button", { name: "Close" }).click();
  });

  test("Locks closed fiscal period with Tier 3 ConfirmDialog", async ({ page }) => {
    await page.getByRole("button", { name: "Lock Period" }).first().click();

    // Confirm dialog
    await expect(
      page.getByRole("heading", { name: "Lock Fiscal Period November 2026?" })
    ).toBeVisible();

    // Confirm lock
    await page.getByRole("button", { name: "Lock Period Nov 2026" }).click();

    // Status updates
    await expect(page.getByText("✓ Period locked").first()).toBeVisible();
  });
});
