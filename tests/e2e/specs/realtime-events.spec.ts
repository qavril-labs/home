import { test, expect } from "@playwright/test";

test.describe("Real-Time Event Bus & Zero-Polling Live Streaming (contracts/events.md)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Renders live event stream ticker in header with pulsating status indicator", async ({ page }) => {
    const ticker = page.getByTestId("live-event-ticker");
    await expect(ticker).toBeVisible();

    const tickerBtn = page.getByTestId("live-event-ticker-btn");
    await expect(tickerBtn).toBeVisible();
    await expect(tickerBtn).toContainText(/Stream:/i);
  });

  test("Opens live event dropdown, renders domain event list, and simulates reactive events", async ({ page }) => {
    // Open dropdown
    await page.getByTestId("live-event-ticker-btn").click();
    await expect(page.getByTestId("live-event-dropdown")).toBeVisible();
    await expect(page.getByText("Live Domain Event Bus (SSE)")).toBeVisible();
    await expect(page.getByText("contracts/events.md")).toBeVisible();

    // Verify simulation buttons
    await expect(page.getByTestId("simulate-sale-btn")).toBeVisible();
    await expect(page.getByTestId("simulate-anomaly-btn")).toBeVisible();
    await expect(page.getByTestId("simulate-reorder-btn")).toBeVisible();
    await expect(page.getByTestId("simulate-period-lock-btn")).toBeVisible();

    // Simulate Quick Sale event
    await page.getByTestId("simulate-sale-btn").click();
    await expect(page.getByText(/Domain Event Emitted: ledger\.entry\.posted/i)).toBeVisible();
    await expect(page.getByText("ledger.entry.posted").first()).toBeVisible();

    // Simulate Guard Gus Anomaly event
    await page.getByTestId("simulate-anomaly-btn").click();
    await expect(page.getByText(/Domain Event Emitted: bot\.signal\.detected/i)).toBeVisible();
    await expect(page.getByText("services/uaap/guard_gus").first()).toBeVisible();

    // Simulate Period Closing Lock event
    await page.getByTestId("simulate-period-lock-btn").click();
    await expect(page.getByText(/Domain Event Emitted: ledger\.period\.locked/i)).toBeVisible();
    await expect(page.getByText("ledger.period.locked").first()).toBeVisible();
  });
});
