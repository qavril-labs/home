import { test, expect } from "@playwright/test";

test.describe("Forecast Finn (AIS-02 / FIN-15) Dedicated Screen & Cash River", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Navigate to Forecast Finn screen
    await page.getByRole("button", { name: "Forecast Finn (AIS-02)" }).first().click();
  });

  test("Renders Forecast Finn header, violet avatar, and live indicator", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Forecast Finn" })).toBeVisible();
    await expect(page.getByText("Cash Flow Forecaster").first()).toBeVisible();
    await expect(page.getByText("AIS-02 / FIN-15")).toBeVisible();
    await expect(page.getByText(/Live · updated/i)).toBeVisible();

    // Kill switch active
    await expect(page.getByRole("button", { name: /ACTIVE \(ON\)/i })).toBeVisible();
  });

  test("Displays StatusChips: Cash runway positive, tax outlay dip, working capital healthy", async ({
    page,
  }) => {
    await expect(page.getByText("✓ Cash runway positive").first()).toBeVisible();
    await expect(page.getByText(/! 60-day tax outlay dip/i).first()).toBeVisible();
    await expect(page.getByText(/● Net working capital healthy/i).first()).toBeVisible();
  });

  test("Toggles kill switch with warning notice", async ({ page }) => {
    const killSwitch = page.getByRole("button", { name: /ACTIVE \(ON\)/i });
    await killSwitch.click();

    // Suspended state
    await expect(page.getByText(/OFF \(SUSPENDED\)/i)).toBeVisible();
    await expect(page.getByText(/Kill switch is engaged\. Automated cash river/i)).toBeVisible();

    // Resume
    await page.getByRole("button", { name: /OFF \(SUSPENDED\)/i }).click();
    await expect(page.getByText(/ACTIVE \(ON\)/i)).toBeVisible();
  });

  test("Switches between Conservative, Expected, and Optimistic Cash River scenarios", async ({
    page,
  }) => {
    // Expected is default
    await expect(page.getByText("EXPECTED").first()).toBeVisible();

    // Switch to Conservative
    await page.getByRole("button", { name: "CONSERVATIVE" }).click();
    await expect(page.getByText("CONSERVATIVE").first()).toBeVisible();

    // Switch to Optimistic
    await page.getByRole("button", { name: "OPTIMISTIC" }).click();
    await expect(page.getByText("OPTIMISTIC").first()).toBeVisible();
  });

  test("Renders scheduled inflow and outflow milestones table", async ({ page }) => {
    await expect(page.getByText("Today (Current)")).toBeVisible();
    await expect(page.getByText("Day 30 (Month Close)")).toBeVisible();
    await expect(page.getByText("Day 60 (Tax Outlay)")).toBeVisible();
    await expect(page.getByText("Quarterly corporate tax and supplier Net 90 payment")).toBeVisible();
  });
});
