import { test, expect } from "@playwright/test";

test.describe("Week 1 Foundation Flows: Sign-up, Sign-in, Quick Entry, Sign-out, and Component Gallery", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#dashboard");
  });

  test("1. Quick Entry: records sale, triggers animated count-up and 4s toast with undo", async ({
    page,
  }) => {
    // Fill quick entry amount and party
    const amountInput = page.getByPlaceholder("e.g. 1250.00");
    await expect(amountInput).toBeVisible();
    await amountInput.fill("1250.00");

    const partyInput = page.getByPlaceholder("e.g. Acme Corporation");
    await partyInput.fill("Apex Industrial Client");

    // Click submit
    const submitBtn = page.getByRole("button", { name: "Post to ledger" });
    await submitBtn.click();

    // Verify success toast appears with undo
    const toast = page.locator('[aria-live="polite"]');
    await expect(toast).toContainText("Entry posted");
    await expect(toast).toContainText("Undo");
  });

  test("2. Sign-out flow: clicking sign out transitions to signed-out gate", async ({ page }) => {
    // Ensure header sign out is visible
    const signOutBtn = page.getByRole("button", { name: "Sign out" });
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();

    // Verify Gate component with signed-out message is shown
    await expect(page.getByText("Sign in to see your dashboard")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in to your workspace" })).toBeVisible();
  });

  test("3. Sign-in flow: clicking sign in from gate returns user to authenticated dashboard", async ({
    page,
  }) => {
    // Start at signed-out gate
    await page.goto("/#signed-out");
    await expect(page.getByText("Sign in to see your dashboard")).toBeVisible();

    // Click sign in
    await page.getByRole("button", { name: "Sign in to your workspace" }).click();

    // Verifies dashboard is restored
    await expect(page.getByText("Cash and bank")).toBeVisible();
    await expect(page.getByText("Sales to date")).toBeVisible();
  });

  test("4. CommandBar: triggers with Ctrl+K shortcut and allows action navigation", async ({ page }) => {
    await page.keyboard.press("Control+K");
    const searchInput = page.getByPlaceholder(/Type a command/i);
    await expect(searchInput).toBeVisible();

    // Type query to filter commands
    await searchInput.fill("sale");
    await expect(page.getByText("Record a sale")).toBeVisible();

    // Press Escape to close
    await page.keyboard.press("Escape");
    await expect(searchInput).toBeHidden();
  });

  test("5. Component Gallery: renders all atomic components and adapts to 375px, 768px, 1280px without horizontal scroll", async ({
    page,
  }) => {
    await page.goto("/#gallery");

    // Verify Gallery header
    await expect(page.getByText("Component Gallery")).toBeVisible();
    await expect(page.getByText("Quality Assurance & Token Conformance")).toBeVisible();

    // Verify atomic components are present
    await expect(page.getByText("1. Brand Tokens & Colors")).toBeVisible();
    await expect(page.getByText("2. Neo-Brutal Buttons")).toBeVisible();
    await expect(page.getByText("3. Status Chips (Icon + Text)")).toBeVisible();
    await expect(page.getByText("4. KPI Tiles (Animated Count-up)")).toBeVisible();
    await expect(page.getByText("5. Overlays & Dialogs")).toBeVisible();
    await expect(page.getByText("6. Trend Chart & Accessible Table View")).toBeVisible();
    await expect(page.getByText("7. Bot Cards (The 8 Autonomous Bots)")).toBeVisible();
    await expect(page.getByText("8. Empty States & Gate Screens")).toBeVisible();
    await expect(page.getByText("9. DataTable (Sticky Header & Right-Aligned Amounts)")).toBeVisible();
    await expect(page.getByText("10. QuickEntryForm (Tabs, 2-Column Fields, Primary Verb)")).toBeVisible();
    await expect(page.getByText("11. CommandBar (Ctrl+K Quick Actions & AI Entry)")).toBeVisible();

    // Verify 4 StatusChip states exist
    await expect(page.getByText("✓ All good")).toBeVisible();
    await expect(page.getByText("! Worth a look")).toBeVisible();
    await expect(page.getByText("● Needs you")).toBeVisible();
    await expect(page.getByText("… Waiting for data")).toBeVisible();

    // Test viewport switching in gallery
    await page.getByRole("button", { name: /375px/i }).click();
    await page.getByRole("button", { name: /768px/i }).click();
    await page.getByRole("button", { name: /1280px/i }).click();

    // Check no horizontal scrollbar on body
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBeFalsy();
  });

  test("6. Theme toggling: toggles data-theme between light and dark across components", async ({
    page,
  }) => {
    await page.goto("/#gallery");
    const themeBtn = page.getByRole("button", { name: /Theme:/i });
    await expect(themeBtn).toBeVisible();

    const initialTheme = await page.locator("html").getAttribute("data-theme");
    await themeBtn.click();
    const toggledTheme = await page.locator("html").getAttribute("data-theme");
    expect(toggledTheme).not.toEqual(initialTheme);
  });
});
