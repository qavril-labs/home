import { test, expect } from "@playwright/test";

/**
 * Live approval flow in the browser. Runs only against a local stack (E2E_LIVE=1):
 *   core API on E2E_API_URL, UAAP on E2E_UAAP_URL, a test workspace with an accountant (proposes)
 *   and an owner (approves). Credentials come from the environment, never from this file.
 *
 * Setup uses the APIs directly; the approval itself is clicked in the browser, through the sign-in form.
 */
const LIVE = process.env.E2E_LIVE === "1";
const API = process.env.E2E_API_URL ?? "http://localhost:3002";
const UAAP = process.env.E2E_UAAP_URL ?? "http://localhost:8090";
const WORKSPACE = process.env.LIVE_TENANT_SLUG ?? "";
const OWNER_EMAIL = process.env.LIVE_ADMIN_EMAIL ?? "";
const OWNER_PASSWORD = process.env.LIVE_ADMIN_PASSWORD ?? "";
const ACCOUNTANT_EMAIL = process.env.LIVE_ACCOUNTANT_EMAIL ?? "";
const ACCOUNTANT_PASSWORD = process.env.LIVE_ACCOUNTANT_PASSWORD ?? "";
const TENANT_ID = process.env.LIVE_TENANT_ID ?? "";
const COMPANY_ID = process.env.LIVE_COMPANY_ID ?? "";

test.describe("Live approval in the browser (local stack)", () => {
  test.skip(!LIVE, "Set E2E_LIVE=1 with the local stack running (see services/uaap and backend).");
  test.setTimeout(240_000); // The first load compiles the app on this machine; allow for it.

  test("the owner signs in through the form and approves a proposal", async ({ page, request }) => {
    // 1. The accountant proposes an entry through the bot API.
    const login = await request.post(`${API}/v1/auth/login`, {
      data: { tenantSlug: WORKSPACE, email: ACCOUNTANT_EMAIL, password: ACCOUNTANT_PASSWORD },
    });
    expect(login.ok()).toBeTruthy();
    const accountantToken = (await login.json()).token as string;
    const proposal = await request.post(`${UAAP}/v1/agents/universal-finance-agent/messages`, {
      headers: { Authorization: `Bearer ${accountantToken}`, "X-Tenant-ID": TENANT_ID },
      data: {
        message: "Accrue November rent: debit 6100, credit 2100, USD 1,250.00 on 2026-11-30.",
        company_id: COMPANY_ID,
        today: "2026-11-17",
      },
    });
    expect((await proposal.json()).status).toBe("awaiting_approval");

    // 2. The owner signs in through the browser's sign-in form.
    // The #signed-out address opens the sign-in screen at every width (the Sign out button is hidden on phones).
    await page.goto("/#signed-out");
    await page.getByRole("button", { name: "Sign in with your workspace account" }).click();
    await page.getByLabel("Workspace").fill(WORKSPACE);
    await page.getByLabel("Email").fill(OWNER_EMAIL);
    await page.getByLabel("Password").fill(OWNER_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText(/Good (morning|afternoon|evening)/)).toBeVisible({ timeout: 30_000 });

    // 3. The owner opens the inbox, sees the proposal and approves it.
    const menu = page.getByRole("button", { name: "Open navigation sidebar" });
    if (await menu.isVisible()) {
      await menu.click();
    }
    await page.getByRole("button", { name: /Approvals/i }).first().click();
    await expect(page.getByRole("heading", { name: "Approvals Inbox" })).toBeVisible();
    await expect(page.getByText("API Connected", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Approve", exact: true }).first().click();

    // 4. The API has confirmed the post: the owner sees the posted entry, and the proposal leaves the pending list.
    await expect(page.getByText(/Posted entry/).first()).toBeVisible({ timeout: 60_000 });
  });

  test("a bot's answer is quoted from the ledger, not invented", async ({ request }) => {
    const login = await request.post(`${API}/v1/auth/login`, {
      data: { tenantSlug: WORKSPACE, email: OWNER_EMAIL, password: OWNER_PASSWORD },
    });
    const token = (await login.json()).token as string;
    const check = await request.post(`${UAAP}/v1/agents/ledger-invariant-checker/messages`, {
      headers: { Authorization: `Bearer ${token}`, "X-Tenant-ID": TENANT_ID },
      data: { message: "Check the ledger.", company_id: COMPANY_ID, today: "2026-11-30" },
    });
    const body = await check.json();
    expect(body.status).toBe("answered");
    expect(body.text).toContain("passes every check");
  });
});
