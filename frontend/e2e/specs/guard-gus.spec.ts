import { test, expect } from "@playwright/test";

test.describe("Guard Gus (AI-04 / AUD-01) Dedicated Screen & Anomaly Inspection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Navigate to Guard Gus screen
    await page.getByRole("button", { name: "Guard Gus (AI-04)" }).first().click();
  });

  test("Renders Guard Gus header, avatar, and live indicator", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Guard Gus" })).toBeVisible();
    await expect(page.getByText("Anomaly Sentinel").first()).toBeVisible();
    await expect(page.getByText("AI-04 / AUD-01", { exact: true })).toBeVisible();
    await expect(page.getByText(/Live · updated/i)).toBeVisible();

    // Kill switch active
    await expect(page.getByRole("button", { name: /ACTIVE \(ON\)/i })).toBeVisible();
  });

  test("Displays StatusChips: Zero fraud, anomalies flagged, and audit inspection required", async ({
    page,
  }) => {
    await expect(page.getByText("✓ Zero fraud detected").first()).toBeVisible();
    await expect(page.getByText(/! 2 anomalies flagged/i).first()).toBeVisible();
    await expect(page.getByText(/● 1 audit inspection required/i).first()).toBeVisible();
  });

  test("Toggles kill switch with warning notice", async ({ page }) => {
    const killSwitch = page.getByRole("button", { name: /ACTIVE \(ON\)/i });
    await killSwitch.click();

    // Suspended state
    await expect(page.getByText(/OFF \(SUSPENDED\)/i)).toBeVisible();
    await expect(page.getByText(/Kill switch is engaged\. Automated duplicate invoice/i)).toBeVisible();

    // Resume
    await page.getByRole("button", { name: /OFF \(SUSPENDED\)/i }).click();
    await expect(page.getByText(/ACTIVE \(ON\)/i)).toBeVisible();
  });

  test("Opens AnomalyInspectionModal, inspects side-by-side records, and quarantines record", async ({
    page,
  }) => {
    // Click inspect on first anomaly (Steel Corp duplicate bill)
    await page.getByRole("button", { name: "Inspect" }).first().click();

    // Modal elements
    await expect(page.getByRole("heading", { name: /Suspected Duplicate Supplier Invoice/i })).toBeVisible();
    await expect(page.getByText("INV-8921").first()).toBeVisible();
    await expect(page.getByText("INV-8890").first()).toBeVisible();
    await expect(page.getByText("98% Match Confidence")).toBeVisible();

    // Click Quarantine & Block Record
    await page.getByRole("button", { name: "Quarantine & Block Record" }).click();

    // Toast appears
    await expect(page.getByText(/Record ANOM-104 quarantined and blocked/i)).toBeVisible();
  });
});
