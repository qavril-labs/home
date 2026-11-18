import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

// Written by global-setup.ts before the tests run. Local development only.
const here = dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = resolve(here, "../.auth/live.json");

interface LiveAuth {
  token: string;
  companyId: string;
}

function readAuth(): LiveAuth {
  if (!existsSync(AUTH_FILE)) {
    throw new Error("No live sign-in on file. global-setup.ts writes it; check that the API is running and the tenant is seeded.");
  }
  return JSON.parse(readFileSync(AUTH_FILE, "utf8")) as LiveAuth;
}

/**
 * Makes the browser's session the live one, the same way the app stores it, so the stock and till screens show the
 * figures the server returns. Call it before page.goto(). Requests reach the API through the Vite dev proxy.
 */
export async function useLiveSession(page: Page): Promise<void> {
  const session = readAuth();
  await page.addInitScript(
    ([storedToken, storedCompany]) => {
      try {
        sessionStorage.setItem("qavril-session", JSON.stringify({ token: storedToken, companyId: storedCompany }));
      } catch {
        // Private windows can refuse storage; the screens then show their signed-out message.
      }
    },
    [session.token, session.companyId] as const,
  );
}

/** Opens a screen from the navigation. On a phone the sidebar is closed until its menu button opens it. */
export async function openScreen(page: Page, name: string): Promise<void> {
  const menu = page.getByRole("button", { name: "Open navigation sidebar" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name }).first().click();
}
