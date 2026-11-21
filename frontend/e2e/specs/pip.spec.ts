import { test, expect } from "@playwright/test";

test.describe("Pip (AGT-02 / SAL-02) Dedicated Screen & Follow-Up Modal", () => {
  test.beforeEach(async ({ page, isMobile }) => {
    await page.goto("/");
    if (isMobile) {
      const openBtn = page.getByRole("button", { name: "Open navigation sidebar" });
      if (await openBtn.isVisible()) {
        await openBtn.click();
      }
    }
    await page.getByRole("button", { name: "Pip (AGT-02)" }).first().click();
    await expect(page.getByRole("heading", { name: "Pip", exact: true })).toBeVisible();
  });

  test("Renders Pip header, lime avatar, and live indicator", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Pip", exact: true })).toBeVisible();
    await expect(page.getByText("Deal Closer").first()).toBeVisible();
    await expect(page.getByText("AGT-02 / SAL-02", { exact: true })).toBeVisible();
    await expect(page.getByText(/Live · updated/i)).toBeVisible();

    // Kill switch active
    await expect(page.getByRole("button", { name: /ACTIVE \(ON\)/i })).toBeVisible();
  });

  test("Displays StatusChips: Pipeline active, quiet deals needing follow-up, discount approval", async ({
    page,
  }) => {
    await expect(page.getByText("✓ Pipeline active").first()).toBeVisible();
    await expect(page.getByText(/! 2 quiet deals needing follow-up/i).first()).toBeVisible();
    await expect(page.getByText(/● 1 discount exception approval/i).first()).toBeVisible();
  });

  test("Toggles kill switch with warning notice", async ({ page }) => {
    const killSwitch = page.getByRole("button", { name: /ACTIVE \(ON\)/i });
    await killSwitch.click();

    // Suspended state
    await expect(page.getByText(/OFF \(SUSPENDED\)/i)).toBeVisible();
    await expect(page.getByText(/Kill switch is engaged\. Automated quiet deal reminders/i)).toBeVisible();

    // Resume
    await page.getByRole("button", { name: /OFF \(SUSPENDED\)/i }).click();
    await expect(page.getByText(/ACTIVE \(ON\)/i)).toBeVisible();
  });

  test("Renders pipeline funnel stages and active opportunities", async ({ page }) => {
    await expect(page.getByText("Vanguard Aerospace Titanium Machining Tender")).toBeVisible();
    await expect(page.getByText("Kinetics Robotics Joint Actuator Brackets")).toBeVisible();
    await expect(page.getByText("Discovery").first()).toBeVisible();
    await expect(page.getByText("Negotiation").first()).toBeVisible();
  });

  test("Opens DealFollowUpModal and sends follow-up outreach message", async ({ page }) => {
    // Click Draft Follow-Up on first quiet deal
    const draftBtn = page.getByRole("button", { name: "Draft Follow-Up" }).first();
    await draftBtn.dispatchEvent("click");

    // Modal elements
    await expect(page.getByRole("heading", { name: "Review Sales Follow-Up Draft" })).toBeVisible();
    await expect(page.getByText("Vanguard Aerospace Titanium Machining Tender").first()).toBeVisible();
    await expect(page.getByText("Personalized Outreach Message")).toBeVisible();

    // Click Send Follow-Up Message
    await page.getByRole("button", { name: "Send Follow-Up Message" }).click();

    // Toast appears
    await expect(page.getByText(/Follow-up outreach sent to Hannah Abbott/i)).toBeVisible();
  });
});
