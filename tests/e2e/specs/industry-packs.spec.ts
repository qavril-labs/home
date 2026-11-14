import { test, expect } from "@playwright/test";

test.describe("Sprint 6: Industry Pack Agents (GAR & FMCG)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#packs");
  });

  test("Renders Industry Pack header, live indicator, and 4 KPI summary tiles", async ({ page }) => {
    await expect(page.getByTestId("industry-packs-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Industry Pack Agents" })).toBeVisible();
    await expect(page.getByText("TX-01 · TX-02 · DS-01 · DS-02")).toBeVisible();
    await expect(page.getByTestId("packs-live-indicator")).toBeVisible();

    // 4 KPI tiles
    await expect(page.getByText("GAR08 · Style ST-402 Mfg Cost")).toBeVisible();
    await expect(page.getByText("GAR02 · Active Tech Packs")).toBeVisible();
    await expect(page.getByText("FMCG06 · Near-Expiry Exposure")).toBeVisible();
    await expect(page.getByText("FMCG12 · Label Rule Verdict")).toBeVisible();
  });

  test("GAR08 Garment Costing: Displays cost lines with provenance config, tests PARTIAL readiness", async ({ page }) => {
    await page.getByTestId("tab-gar08").click();
    await expect(page.getByTestId("panel-gar08")).toBeVisible();

    // Verify ST-402 is READY
    await expect(page.getByTestId("gar08-readiness-badge")).toContainText("READY");
    await expect(page.getByText("CFG-FAB-2026-04 · v3.1")).toBeVisible();
    await expect(page.getByText("CALC-GAR08-9921")).toBeVisible();
    await expect(page.getByText("$18.45")).toBeVisible();
    await expect(page.getByText("$29.76")).toBeVisible();

    // Switch to Style ST-519 with missing inputs
    await page.getByTestId("select-style-ST-519").click();
    await expect(page.getByTestId("gar08-readiness-badge")).toContainText("PARTIAL");
    await expect(page.getByTestId("gar08-partial-warning")).toBeVisible();
    await expect(page.getByText("PARTIAL DATA READINESS")).toBeVisible();
    await expect(page.getByText(/FIDLOCK magnetic buckle/i)).toBeVisible();
  });

  test("GAR02 Tech Pack Editor: Displays graded XS-XL size curves and allows revision promotion", async ({ page }) => {
    await page.getByTestId("tab-gar02").click();
    await expect(page.getByTestId("panel-gar02")).toBeVisible();

    // Table headers for size curve
    await expect(page.getByText("XS").first()).toBeVisible();
    await expect(page.getByText("M (Base)").first()).toBeVisible();
    await expect(page.getByText("XL").first()).toBeVisible();
    await expect(page.getByText("Organic Cotton Loopback Terry (3-End)")).toBeVisible();

    // Promote revision
    await page.getByRole("button", { name: "Lock & Approve Tech Pack Revision" }).click();
    await expect(page.getByText(/promoted to Gold Seal Approved/i)).toBeVisible();
  });

  test("FMCG06 Shelf Life & Expiry: Displays FEFO priorities and drafts markdown", async ({ page }) => {
    await page.getByTestId("tab-fmcg06").click();
    await expect(page.getByTestId("panel-fmcg06")).toBeVisible();

    // Verify batches
    await expect(page.getByText("LOT-OAT-882A")).toBeVisible();
    await expect(page.getByText("LOT-KMB-410C")).toBeVisible();
    await expect(page.getByText("Barista Edition Oat Milk 1L")).toBeVisible();

    // Markdown action on 14-day batch
    const markdownBtn = page.getByRole("button", { name: "Draft 25% Markdown" }).first();
    await markdownBtn.click();
    await expect(page.getByText(/25% Trade Markdown scheme/i)).toBeVisible();
  });

  test("FMCG12 Regulatory Labelling: Verifies rule set evaluation and BLOCK verdict", async ({ page }) => {
    await page.getByTestId("tab-fmcg12").click();
    await expect(page.getByTestId("panel-fmcg12")).toBeVisible();

    // Check rules
    await expect(page.getByText("EU-1169/2011-Art21")).toBeVisible();
    await expect(page.getByText("Allergen Emphasis in Ingredients List")).toBeVisible();
    await expect(page.getByText("BLOCK").first()).toBeVisible();
    await expect(page.getByText(/Fix: Update 'Oats \(12%\)' to boldface/i)).toBeVisible();
  });
});
