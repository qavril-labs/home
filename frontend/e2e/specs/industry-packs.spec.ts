import { test, expect } from "@playwright/test";

test.describe("Industry Packs Hub (GAR/FMCG) & AI-09 CommandBar Operations Assistant", () => {
  test.beforeEach(async ({ page, isMobile }) => {
    await page.goto("/#packs", { waitUntil: "domcontentloaded" });
    if (isMobile) {
      const openBtn = page.getByRole("button", { name: "Open navigation sidebar" });
      if (await openBtn.isVisible()) {
        await openBtn.click();
        const navBtn = page.getByRole("button", { name: /Industry Packs/i }).first();
        if (await navBtn.isVisible()) {
          await navBtn.click();
        }
      }
    } else {
      const navBtn = page.getByRole("button", { name: /Industry Packs/i }).first();
      if (await navBtn.isVisible()) {
        await navBtn.click();
      }
    }
    await expect(page.getByRole("heading", { name: /Industry Pack Agents/i })).toBeVisible();
  });

  test("Renders Industry Packs header, active packs indicator, and 4 KPI cards", async ({ page }) => {
    // Heading & Subtitle
    await expect(page.getByRole("heading", { name: /Industry Pack Agents/i })).toBeVisible();
    await expect(page.getByText(/Garment Costing & Tech Packs/i)).toBeVisible();
    await expect(page.locator('[data-testid="packs-live-indicator"]')).toBeVisible();

    // 4 KPI Cards
    await expect(page.getByText(/GAR08 · Style ST-402 Mfg Cost/i)).toBeVisible();
    await expect(page.getByText(/GAR02 · Active Tech Packs/i)).toBeVisible();
    await expect(page.getByText(/FMCG06 · Near-Expiry Exposure/i)).toBeVisible();
    await expect(page.getByText(/FMCG12 · Label Rule Verdict/i)).toBeVisible();
  });

  test("Switches between Garment Costing, Tech Pack Editor, Expiry Risk, and Labelling tabs", async ({ page }) => {
    // 1. GAR08 (Default)
    await expect(page.locator('[data-testid="panel-gar08"]')).toBeVisible();
    await expect(page.getByText("ST-402").first()).toBeVisible();

    // 2. GAR02 Tech Pack Editor
    const tabGar02 = page.locator('[data-testid="tab-gar02"]');
    await tabGar02.click();
    await expect(page.locator('[data-testid="panel-gar02"]')).toBeVisible();
    await expect(page.getByText("Gold Seal").first()).toBeVisible();

    // 3. FMCG06 Shelf Life & Expiry
    const tabFmcg06 = page.locator('[data-testid="tab-fmcg06"]');
    await tabFmcg06.click();
    await expect(page.locator('[data-testid="panel-fmcg06"]')).toBeVisible();
    await expect(page.getByText("LOT-OAT-882A").first()).toBeVisible();

    // 4. FMCG12 Labelling Check
    const tabFmcg12 = page.locator('[data-testid="tab-fmcg12"]');
    await tabFmcg12.click();
    await expect(page.locator('[data-testid="panel-fmcg12"]')).toBeVisible();
    await expect(page.getByText("EU-1169 Allergen Bolding")).toBeVisible();
  });

  test("Opens CommandBar AI-09 Chat, sends an inquiry, and verifies assistant response with provenance link", async ({
    page,
  }) => {
    // Open CommandBar via search button or keyboard shortcut
    const searchBtn = page.locator('button[title*="command palette"]');
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
    } else {
      await page.keyboard.press("Control+k");
    }

    await expect(page.locator('[data-testid="commandbar-overlay"]')).toBeVisible();

    // Switch to AI-09 Chat tab
    const chatTab = page.locator('[data-testid="commandbar-tab-ai09"]');
    await chatTab.click();
    await expect(page.locator('[data-testid="commandbar-ai09-panel"]')).toBeVisible();

    // Type a query regarding Industry Packs
    const chatInput = page.locator('[data-testid="ai09-chat-input"]');
    await chatInput.fill("What is the status of the garment tech pack and cost sheet?");
    await page.locator('[data-testid="ai09-send-btn"]').click();

    // Verify turn appears and response includes provenance reference
    await expect(page.getByText("What is the status of the garment tech pack and cost sheet?")).toBeVisible();
    await expect(page.getByText(/Industry Pack agents active: GAR08 Style ST-402/i)).toBeVisible();
    await expect(page.getByText("Open Industry Packs Hub")).toBeVisible();

    // Close CommandBar
    await page.locator('[data-testid="commandbar-close-btn"]').click();
    await expect(page.locator('[data-testid="commandbar-overlay"]')).not.toBeVisible();
  });
});
