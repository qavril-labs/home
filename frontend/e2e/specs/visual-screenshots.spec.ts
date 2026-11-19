import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotsDir = path.resolve(__dirname, "../../screenshots");

const screens = [
  { slug: "dashboard", hash: "#dashboard", readySelector: '[data-testid="page-dashboard"], h1, h2' },
  { slug: "invoices", hash: "#invoices", readySelector: 'h1:has-text("Sales"), h2:has-text("Invoices"), button:has-text("New Invoice")' },
  { slug: "approvals", hash: "#approvals", readySelector: 'h1:has-text("Approvals"), h2:has-text("Pending Approvals")' },
  { slug: "chase-chloe", hash: "#chase-chloe", readySelector: 'h1:has-text("Chase Chloe")' },
  { slug: "ledger-lou", hash: "#ledger-lou", readySelector: 'h1:has-text("Ledger Lou")' },
  { slug: "forecast-finn", hash: "#forecast-finn", readySelector: 'h1:has-text("Forecast Finn")' },
  { slug: "packs", hash: "#packs", readySelector: 'h1:has-text("Industry Pack Agents")' },
  { slug: "gallery", hash: "#gallery", readySelector: 'h1:has-text("Neo-Brutalist Component Gallery")' },
];

test.describe("Pre-PR Visual Screenshots (375px / 1280px in Light & Dark)", () => {
  test.beforeAll(async () => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  for (const screen of screens) {
    test(`Capture ${screen.slug} screenshots in Light and Dark mode`, async ({ page, isMobile }) => {
      const viewportSize = page.viewportSize();
      const width = viewportSize ? viewportSize.width : isMobile ? 375 : 1280;

      await page.goto(`/${screen.hash}`);

      // On mobile, if needed, handle sidebar or navigation
      if (isMobile) {
        const openNavBtn = page.getByRole("button", { name: "Open navigation sidebar" });
        if (await openNavBtn.isVisible()) {
          // If sidebar is open, close it so it doesn't block the screen
          const closeBtn = page.getByRole("button", { name: /Close navigation sidebar/i });
          if (await closeBtn.isVisible()) {
            await closeBtn.click();
          }
        }
      }

      // Wait for the ready element to appear
      await page.waitForSelector(screen.readySelector, { timeout: 10000 });
      await page.waitForTimeout(400); // Allow lazy renders/animations to settle

      // Ensure light mode first
      const isDarkInitially = await page.evaluate(() =>
        document.documentElement.classList.contains("dark")
      );
      if (isDarkInitially) {
        const toggleBtn = page.locator('button[aria-label*="theme"]');
        if (await toggleBtn.isVisible()) {
          await toggleBtn.click();
          await page.waitForFunction(() => !document.documentElement.classList.contains("dark"));
        }
      }

      // 1. Capture Light Mode Screenshot
      const lightPath = path.join(screenshotsDir, `${screen.slug}-${width}px-light.png`);
      await page.screenshot({ path: lightPath, fullPage: true });
      expect(fs.existsSync(lightPath)).toBe(true);

      // 2. Toggle to Dark Mode
      const toggleToDarkBtn = page.locator('button[aria-label*="theme"]');
      if (await toggleToDarkBtn.isVisible()) {
        await toggleToDarkBtn.click();
        await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
        await page.waitForTimeout(300);

        // 3. Capture Dark Mode Screenshot
        const darkPath = path.join(screenshotsDir, `${screen.slug}-${width}px-dark.png`);
        await page.screenshot({ path: darkPath, fullPage: true });
        expect(fs.existsSync(darkPath)).toBe(true);

        // Reset to light mode for subsequent tests
        await toggleToDarkBtn.click();
        await page.waitForFunction(() => !document.documentElement.classList.contains("dark"));
      }
    });
  }
});
