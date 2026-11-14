import { test, expect } from "@playwright/test";

test.describe("AI-09 Conversational Operations in CommandBar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Opens CommandBar via shortcut button and switches to AI-09 Chat", async ({ page }) => {
    // Open CommandBar via header trigger
    await page.getByTitle(/Open quick command palette/i).click();
    await expect(page.getByTestId("commandbar-tab-actions")).toBeVisible();
    await expect(page.getByTestId("commandbar-tab-ai09")).toBeVisible();

    // Switch to AI-09 tab
    await page.getByTestId("commandbar-tab-ai09").click();
    await expect(page.getByTestId("commandbar-ai09-panel")).toBeVisible();
    await expect(page.getByText("AI-09 Co-Pilot").first()).toBeVisible();
    await expect(page.getByText(/Every query and command here uses the exact same permissions/i)).toBeVisible();
  });

  test("Queries 30-day cash forecast and receives exact ledger figures with provenance citation", async ({ page }) => {
    await page.getByTitle(/Open quick command palette/i).click();
    await page.getByTestId("commandbar-tab-ai09").click();

    // Click quick prompt "30d Cash Runway"
    await page.getByRole("button", { name: "30d Cash Runway" }).click();

    // Check response containing deterministic figures and provenance
    await expect(page.getByText(/\$42,150\.00 with a monthly burn of \$14,200\.00/i)).toBeVisible();
    await expect(page.getByText(/30-day projected cash reaches \$48,750\.00/i)).toBeVisible();
    await expect(page.getByText(/Provenance: LEDGER-STORE-v1\.0/i)).toBeVisible();

    // Action button to jump to Forecast Finn
    await page.getByRole("button", { name: "Open Forecast Finn River" }).click();
    await expect(page.getByRole("heading", { name: "Forecast Finn" })).toBeVisible();
  });

  test("Queries Industry Pack status and navigates to Industry Packs Hub", async ({ page }) => {
    await page.getByTitle(/Open quick command palette/i).click();
    await page.getByTestId("commandbar-tab-ai09").click();

    // Type query in chat input
    const input = page.getByTestId("ai09-chat-input");
    await input.fill("Tell me about garment costing and FMCG shelf life");
    await page.getByTestId("ai09-send-btn").click();

    // Check response
    await expect(page.getByText(/GAR08 Style ST-402 cost sheet is READY at \$18\.45/i)).toBeVisible();
    await expect(page.getByText(/FMCG06 reports 2 batches near expiry/i)).toBeVisible();
    await expect(page.getByText(/CFG-FAB-2026-04 · RULE-FMCG06-SL-v2\.1/i)).toBeVisible();

    // Action button to jump to Industry Packs Hub
    await page.getByRole("button", { name: "Open Industry Packs Hub" }).click();
    await expect(page.getByRole("heading", { name: "Industry Pack Agents" })).toBeVisible();
  });
});
