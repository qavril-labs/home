import { test, expect } from "@playwright/test";

test.describe("Autonomous 8-Bot Crew Completion: Ticket Tess (AGT-05) & Onboard Ola (HRM-10)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Renders full 8-agent crew on Dashboard including Ticket Tess and Onboard Ola", async ({ page }) => {
    await expect(page.getByText("Ticket Tess").first()).toBeVisible();
    await expect(page.getByText("Customer support").first()).toBeVisible();

    await expect(page.getByText("Onboard Ola").first()).toBeVisible();
    await expect(page.getByText("Staff onboarding").first()).toBeVisible();
  });

  test("Ticket Tess (AGT-05 / SAL-11): Reviews support draft, dispatches reply, and emits domain event", async ({ page }) => {
    // Navigate via Sidebar
    const tessNav = page.getByRole("button", { name: /Ticket Tess/i });
    if (await tessNav.isVisible()) {
      await tessNav.click();
    } else {
      await page.goto("/#ticket-tess");
    }

    const pageContainer = page.getByTestId("ticket-tess-page");
    await expect(pageContainer).toBeVisible();
    await expect(page.getByText("Ticket Tess (AGT-05)")).toBeVisible();

    // Verify kill switch
    const killSwitch = page.getByTestId("tess-kill-switch-btn");
    await expect(killSwitch).toBeVisible();

    // Verify ticket queue item (TCK-1092)
    const ticketRow = page.getByTestId("ticket-row-TCK-1092");
    await expect(ticketRow).toBeVisible();
    await expect(page.getByText("Nexus Precision Tools")).toBeVisible();

    // Click Review & Dispatch Reply
    const reviewBtn = page.getByTestId("review-ticket-TCK-1092");
    await expect(reviewBtn).toBeVisible();
    await reviewBtn.click();

    // Modal should be visible
    await expect(page.getByTestId("tess-review-modal")).toBeVisible();
    await expect(page.getByText(/Spindle assembly #BRG-440 has been staged/i)).toBeVisible();

    // Approve & Dispatch
    const approveBtn = page.getByRole("button", { name: /Approve & Dispatch Reply/i });
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // Toast feedback
    await expect(page.getByText(/Dispatched resolution reply for TCK-1092/i)).toBeVisible();

    // Live Event Stream verification
    await page.getByTestId("live-event-ticker-btn").click();
    await expect(page.getByTestId("live-event-dropdown")).toBeVisible();
    await expect(page.getByText("support.ticket.resolved").first()).toBeVisible();
  });

  test("Onboard Ola (HRM-10 / PLT-01): Reviews staged joiner, provisions system access, and emits domain event", async ({ page }) => {
    // Navigate via Sidebar
    const olaNav = page.getByRole("button", { name: /Onboard Ola/i });
    if (await olaNav.isVisible()) {
      await olaNav.click();
    } else {
      await page.goto("/#onboard-ola");
    }

    const pageContainer = page.getByTestId("onboard-ola-page");
    await expect(pageContainer).toBeVisible();
    await expect(page.getByText("Onboard Ola (HRM-10)")).toBeVisible();

    // Verify kill switch
    const killSwitch = page.getByTestId("ola-kill-switch-btn");
    await expect(killSwitch).toBeVisible();

    // Verify joiner row for Elena Rostova
    const joinerRow = page.getByTestId("onboard-row-ONB-801");
    await expect(joinerRow).toBeVisible();
    await expect(page.getByText("Elena Rostova")).toBeVisible();
    await expect(page.getByText("Lead Mechanical CAD Engineer")).toBeVisible();

    // Click Approve System Grants
    const provisionBtn = page.getByTestId("provision-btn-ONB-801");
    await expect(provisionBtn).toBeVisible();
    await provisionBtn.click();

    // Modal should be visible
    await expect(page.getByTestId("ola-provision-modal")).toBeVisible();
    await expect(page.getByText("MFG-03 Production Orders")).toBeVisible();

    // Click Authorize
    const authBtn = page.getByRole("button", { name: /Authorize All Provisioning Grants/i });
    await expect(authBtn).toBeVisible();
    await authBtn.click();

    // Toast feedback
    await expect(page.getByText(/Approved access grants & hardware dispatch for Elena Rostova/i)).toBeVisible();

    // Live Event Stream verification
    await page.getByTestId("live-event-ticker-btn").click();
    await expect(page.getByTestId("live-event-dropdown")).toBeVisible();
    await expect(page.getByText("hr.onboarding.provisioned").first()).toBeVisible();
  });
});
