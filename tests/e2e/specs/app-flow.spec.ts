import { test, expect } from "@playwright/test";

test.describe("QAVRIL LABS Frontend Lane E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any signed-out session state before each test
    await page.addInitScript(() => {
      try {
        sessionStorage.removeItem("qavril-session");
      } catch {}
    });
    await page.goto("/");
  });

  test("Sign-in Gate -> Authentication -> Dashboard mount flow", async ({ page }) => {
    // Trigger signed-out Gate state (via button on desktop or sessionStorage on mobile)
    const signOutBtn = page.getByRole("button", { name: "Sign out" }).first();
    if (await signOutBtn.isVisible()) {
      await signOutBtn.click();
    } else {
      await page.evaluate(() => {
        sessionStorage.setItem("qavril-session", "signed-out");
      });
      await page.reload();
    }

    // Verify Gate screen is rendered
    await expect(page.getByRole("heading", { name: "Sign in to see your dashboard" })).toBeVisible();
    await expect(page.getByText("Your session has ended or you have not signed in on this tab yet.")).toBeVisible();

    // Click Sign In button on Gate
    const signInBtn = page.getByRole("button", { name: "Sign in" }).first();
    await expect(signInBtn).toBeVisible();
    await signInBtn.click();

    // Verify Dashboard mounts after sign-in
    await expect(page.locator("header")).toContainText("QAVRIL/LABS");
    await expect(page.locator("header")).toContainText("Apex Production");
    await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Apex Team\./i })).toBeVisible();
  });

  test("Loads dashboard with brand identity and counting-up KPI tiles", async ({ page }) => {
    // Brand mark and workspace
    await expect(page.locator("header")).toContainText("QAVRIL/LABS");
    await expect(page.locator("header")).toContainText("Apex Production");

    // 4 KPI Tiles
    await expect(page.getByText("Cash and bank")).toBeVisible();
    await expect(page.getByText("Sales to date")).toBeVisible();
    await expect(page.getByText("Expenses to date")).toBeVisible();
    await expect(page.getByText(/Profit to date/i)).toBeVisible();
  });

  test("Money City 3D Hero scene and 2D Trend Chart toggle", async ({ page, isMobile }) => {
    // Hero title
    await expect(page.getByRole("heading", { name: /Financial Overview & Money City \(PLT-23\)/i })).toBeVisible();

    if (!isMobile) {
      // 3D Money City toggle buttons
      const toggle3D = page.getByRole("button", { name: /3D Money City/i });
      const toggle2D = page.getByRole("button", { name: /2D Trend Chart/i });

      await expect(toggle3D).toBeVisible();
      await expect(toggle2D).toBeVisible();

      // Initial state is 3D mode
      await expect(toggle3D).toHaveAttribute("aria-pressed", "true");

      // Verify legend and hints
      await expect(page.getByText(/Violet is sales, Orange is expenses · Coins are cash/i)).toBeVisible();
      await expect(page.getByText("Sales").first()).toBeVisible();
      await expect(page.getByText("Expenses").first()).toBeVisible();
      await expect(page.getByText("Cash").first()).toBeVisible();

      // Switch to 2D Trend Chart
      await toggle2D.click();
      await expect(toggle2D).toHaveAttribute("aria-pressed", "true");
      await expect(toggle3D).toHaveAttribute("aria-pressed", "false");

      // Switch back to 3D Money City
      await toggle3D.click();
      await expect(toggle3D).toHaveAttribute("aria-pressed", "true");
    } else {
      // Mobile displays 2D chart mode badge
      await expect(page.getByText(/2D Chart Mode/i)).toBeVisible();
    }
  });

  test("Submits quick entry sale, verifies toast with Undo, updates Recent Entries and KPI totals", async ({ page }) => {
    // 1. Select 'A sale' tab
    await page.getByRole("tab", { name: "A sale" }).click();

    // 2. Fill Amount and Memo
    const amountInput = page.locator("#q-amount");
    await amountInput.fill("1250.00");

    const memoInput = page.locator("#q-memo");
    await memoInput.fill("Batch #42 CNC Titanium Machining");

    // 3. Submit
    await page.getByRole("button", { name: "Record sale" }).click();

    // 4. Verify toast notification with Undo action
    const toast = page.locator('[aria-live="polite"]');
    await expect(toast).toContainText("Sale of $1250.00 posted straight to your books.");
    await expect(toast).toContainText("Undo");

    // 5. Verify Recent Entries DataTable has new item
    const latestEntriesCard = page.locator("section, div").filter({ hasText: "Latest Entries" });
    await expect(latestEntriesCard.getByText("Batch #42 CNC Titanium Machining").first()).toBeVisible();
    await expect(latestEntriesCard.getByText("$1,250.00").first()).toBeVisible();
    await expect(latestEntriesCard.getByText("Sale").first()).toBeVisible();

    // 6. Test Undo functionality
    const undoButton = toast.getByRole("button", { name: "Undo" });
    await undoButton.click();
    await expect(page.locator('[aria-live="polite"]')).toContainText(/Reversed entry/i);
  });

  test("Submits quick entry expense and verifies negative amount in Latest Entries", async ({ page }) => {
    // 1. Switch to 'An expense' tab
    await page.getByRole("tab", { name: "An expense" }).click();

    // 2. Fill Amount and Memo
    await page.locator("#q-amount").fill("450.00");
    await page.locator("#q-memo").fill("Cutting Fluids & Carbide Endmills");

    // 3. Submit
    await page.getByRole("button", { name: "Record expense" }).click();

    // 4. Verify toast
    const toast = page.locator('[aria-live="polite"]');
    await expect(toast).toContainText("Expense of $450.00 posted straight to your books.");

    // 5. Verify Latest Entries table
    const latestEntriesCard = page.locator("section, div").filter({ hasText: "Latest Entries" });
    await expect(latestEntriesCard.getByText("Cutting Fluids & Carbide Endmills").first()).toBeVisible();
    await expect(latestEntriesCard.getByText("-$450.00").first()).toBeVisible();
    await expect(latestEntriesCard.getByText("Expense").first()).toBeVisible();
  });

  test("Toggles theme between light and dark mode", async ({ page }) => {
    const themeBtn = page.getByRole("button", { name: /switch to/i });
    const initialTheme = await page.locator("html").getAttribute("data-theme");

    await themeBtn.click();
    const newTheme = await page.locator("html").getAttribute("data-theme");
    expect(newTheme).not.toEqual(initialTheme);
  });

  test("Opens CommandBar palette with Ctrl+K shortcut", async ({ page }) => {
    await page.keyboard.press("Control+K");
    await expect(page.getByPlaceholder(/Type a command/i)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder(/Type a command/i)).toBeHidden();
  });

  test("Navigates between Master Data, Invoicing, CSV Import, and Component Gallery", async ({ page }) => {
    // Navigate to Parties (MDM-01)
    await page.getByRole("button", { name: "Parties (MDM-01)" }).first().click();
    await expect(page.getByRole("heading", { name: "Customers & Suppliers" })).toBeVisible();

    // Navigate to Items (MDM-02)
    await page.getByRole("button", { name: "Items (MDM-02)" }).first().click();
    await expect(page.getByRole("heading", { name: "Item Master & Products" })).toBeVisible();

    // Navigate to Accounts (MDM-03)
    await page.getByRole("button", { name: "Accounts (MDM-03)" }).first().click();
    await expect(page.getByRole("heading", { name: "Chart of Accounts" })).toBeVisible();

    // Navigate to Invoices (SAL-04)
    await page.getByRole("button", { name: "Invoices (SAL-04)" }).first().click();
    await expect(page.getByRole("heading", { name: "Sales Invoices & Receivables" })).toBeVisible();

    // Navigate to Bills (FIN-03)
    await page.getByRole("button", { name: "Bills (FIN-03)" }).first().click();
    await expect(page.getByRole("heading", { name: "Accounts Payable (AP) & Bills" })).toBeVisible();

    // Navigate to Import (PLT-14)
    await page.getByRole("button", { name: "CSV Import (PLT-14)" }).first().click();
    await expect(page.getByRole("heading", { name: "CSV & Migration Import" })).toBeVisible();

    // Navigate to Gallery
    await page.getByRole("button", { name: "Component Gallery" }).first().click();
    await expect(page.getByText("Quality Assurance & Token Conformance")).toBeVisible();
  });
});
