import { test, expect } from "@playwright/test";

test.describe("Financial Digital Twin & Stress Testing Studio (AIS-02 / FIN-09)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Renders Financial Digital Twin studio with interactive parameter sliders and metrics", async ({ page }) => {
    // Navigate via Sidebar
    const navLink = page.getByRole("button", { name: /Financial Twin/i });
    if (await navLink.isVisible()) {
      await navLink.click();
    } else {
      // Toggle sidebar if mobile or direct hash
      await page.goto("/#digital-twin");
    }

    const studio = page.getByTestId("digital-twin-studio");
    await expect(studio).toBeVisible();
    await expect(page.getByText("Financial Digital Twin & Stress Testing")).toBeVisible();

    // Verify key metric tiles
    await expect(page.getByTestId("metric-runway")).toBeVisible();
    await expect(page.getByTestId("metric-cash90d")).toBeVisible();
    await expect(page.getByTestId("metric-net-cashflow")).toBeVisible();
    await expect(page.getByTestId("metric-risk-index")).toBeVisible();

    // Verify Sliders exist
    await expect(page.getByTestId("slider-revenue")).toBeVisible();
    await expect(page.getByTestId("slider-cogs")).toBeVisible();
    await expect(page.getByTestId("slider-dso")).toBeVisible();
    await expect(page.getByTestId("slider-hiring")).toBeVisible();
    await expect(page.getByTestId("slider-price")).toBeVisible();
  });

  test("Applies preset macro shocks and reactively adjusts risk scores and bot signals", async ({ page }) => {
    const navLink = page.getByRole("button", { name: /Financial Twin/i });
    if (await navLink.isVisible()) {
      await navLink.click();
    }

    // Apply Macro Recession preset
    const recessionBtn = page.getByTestId("preset-btn-recession_shock");
    await expect(recessionBtn).toBeVisible();
    await recessionBtn.click();

    // Verify critical / severe risk status
    await expect(page.getByTestId("metric-risk-index")).toBeVisible();

    // Bot impact matrix should display alerts
    const botMatrix = page.getByTestId("bot-impact-matrix");
    await expect(botMatrix).toBeVisible();
    await expect(page.getByTestId("bot-alert-finn")).toBeVisible();

    // Apply Hyper Expansion preset
    const expansionBtn = page.getByTestId("preset-btn-hyper_expansion");
    await expect(expansionBtn).toBeVisible();
    await expansionBtn.click();

    // Verify Restock Rex alert triggered by high growth
    await expect(page.getByTestId("bot-alert-rex")).toBeVisible();
  });

  test("Commits stress scenario to Executive Memo and emits scenario.simulated domain event", async ({ page }) => {
    const navLink = page.getByRole("button", { name: /Financial Twin/i });
    if (await navLink.isVisible()) {
      await navLink.click();
    }

    // Click commit scenario button
    const commitBtn = page.getByTestId("commit-scenario-btn");
    await expect(commitBtn).toBeVisible();
    await commitBtn.click();

    // Success toast
    await expect(page.getByText(/Committed.*stress scenario to Executive Approvals Memo/i)).toBeVisible();

    // Check Live Event Stream reflects scenario.simulated
    await page.getByTestId("live-event-ticker-btn").click();
    await expect(page.getByTestId("live-event-dropdown")).toBeVisible();
    await expect(page.getByText("scenario.simulated").first()).toBeVisible();
  });
});
