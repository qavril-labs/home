import { test, expect } from "@playwright/test";

test.describe("Approvals Platform & Inbox (PLT-07, AGT-01, AGT-06)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Navigate to Approvals Platform via top navigation
    await page.getByRole("button", { name: "Approvals (PLT-07)" }).first().click();
  });

  test("Renders Approvals Inbox header, role badges, and live indicator", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Approvals Inbox" })).toBeVisible();
    await expect(page.getByText("Human-in-the-Loop Engine").first()).toBeVisible();
    await expect(page.getByText("PLT-07").first()).toBeVisible();
    await expect(page.getByText(/Live · updated/i)).toBeVisible();
  });

  test("Displays 4 KPI tiles and filter tabs", async ({ page }) => {
    await expect(page.getByText("Pending Proposals")).toBeVisible();
    await expect(page.getByText("Dual-Control Enforced").first()).toBeVisible();
    await expect(page.getByText("Total Value Under Review")).toBeVisible();
    await expect(page.getByText("Approval SLA Performance")).toBeVisible();

    // Status filter buttons
    await expect(page.getByRole("button", { name: /Pending \(\d+\)/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Approved \(\d+\)/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Rejected \(\d+\)/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /All History \(\d+\)/i })).toBeVisible();
  });

  test("Opens Cryptographic Hash Verification modal and validates SHA-256 digest", async ({ page }) => {
    // Click hash verify button
    const hashBtn = page.getByTitle("Verify SHA-256 Digest").first();
    await hashBtn.click();

    // Verify modal elements
    await expect(page.getByRole("heading", { name: "Cryptographic Hash Verification" })).toBeVisible();
    await expect(page.getByText("SHA-256 Digest Match Verified")).toBeVisible();
    await expect(page.getByText("IMMUTABLE")).toBeVisible();
    await expect(page.getByText(/sha256:[a-f0-9]{64}/i)).toBeVisible();

    // Close modal
    await page.getByRole("button", { name: "Close Verification" }).click();
    await expect(page.getByRole("heading", { name: "Cryptographic Hash Verification" })).not.toBeVisible();
  });

  test("Opens ApprovalDetailModal, verifies Dual-Control, and approves action", async ({ page }) => {
    // Review first pending Tier 3 approval (Ledger Lou DEP-2026-11)
    await page.getByRole("button", { name: "Review" }).first().click();

    // Modal verification
    await expect(page.getByText(/Post Monthly Depreciation Schedule/i)).toBeVisible();
    await expect(page.getByText("Tier 3 Action").first()).toBeVisible();
    await expect(page.getByText("Dual-Control Enforced").first()).toBeVisible();
    await expect(page.getByText("$850.00").first()).toBeVisible();

    // Click Approve Action
    await page.getByRole("button", { name: "Approve Action" }).click();

    // Modal closes and item shows Approved
    await expect(page.getByText("Approval APPR-8491 signed off")).toBeVisible();
  });

  test("Rejects a proposal with mandatory audit reason", async ({ page }) => {
    // Review second pending approval
    const reviewButtons = page.getByRole("button", { name: "Review" });
    await reviewButtons.nth(1).click();

    // Click Reject
    await page.getByRole("button", { name: "Reject" }).click();

    // Rejection reason input appears
    await expect(page.getByText(/Reason for Rejection/i)).toBeVisible();
    const reasonInput = page.getByPlaceholder(/Breaches 18% margin threshold/i);
    await reasonInput.fill("Purchase order exceeds weekly shop tooling budget limit.");

    // Confirm Rejection
    await page.getByRole("button", { name: "Confirm Rejection" }).click();

    // Verify rejection toast
    await expect(page.getByText(/Proposal.*rejected.*Reason logged/i)).toBeVisible();
  });

  test("Toggles agent kill switch in governance card", async ({ page }) => {
    await expect(page.getByText("Agent Governance & Kill Switches")).toBeVisible();

    // Toggle Ledger Lou off
    const louToggle = page.getByTitle("Click to suspend agent").first();
    await louToggle.click();

    // Notice appears
    await expect(page.getByText(/suspended \(kill switch engaged\)/i)).toBeVisible();

    // Toggle back on
    const louResume = page.getByTitle("Click to resume agent").first();
    await louResume.click();
    await expect(page.getByText(/execution enabled/i)).toBeVisible();
  });
});
