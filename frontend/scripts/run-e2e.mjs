#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDir = join(__dirname, "..");
const webDir = join(frontendDir, "web");
const e2eDir = join(frontendDir, "e2e");
const viteEntry = pathToFileURL(join(frontendDir, "node_modules", "vite", "dist", "node", "index.js")).href;
const playwrightCli = join(frontendDir, "node_modules", "@playwright", "test", "cli.js");

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const netServer = createNetServer();
    netServer.unref();
    netServer.on("error", reject);
    netServer.listen(0, "127.0.0.1", () => {
      const addr = netServer.address();
      const freePort = typeof addr === "object" && addr ? addr.port : 5599;
      netServer.close(() => resolve(freePort));
    });
  });
}

async function isServerReady(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

async function main() {
  const customBaseUrl = process.env.E2E_BASE_URL;
  let server = null;
  let targetUrl = customBaseUrl;
  const originalCwd = process.cwd();
  let changedCwd = false;

  try {
    if (!targetUrl) {
      const port = Number(process.env.E2E_PORT) || (await getFreePort());
      console.log(`[run-e2e] Starting in-process Vite dev server on port ${port}...`);
      process.chdir(webDir);
      changedCwd = true;
      const { createServer } = await import(viteEntry);
      server = await createServer({
        root: webDir,
        configFile: join(webDir, "vite.config.ts"),
        server: {
          port,
          host: "127.0.0.1",
          strictPort: false,
        },
      });
      await server.listen();
      const actualPort = server.httpServer.address().port;
      targetUrl = `http://127.0.0.1:${actualPort}/`;
      console.log(`[run-e2e] Vite dev server listening at ${targetUrl}`);

      console.log("[run-e2e] Warming up bundle...");
      try {
        await fetch(targetUrl);
        await fetch(`${targetUrl}src/main.tsx`);
        await fetch(`${targetUrl}src/App.tsx`);
        await Promise.all([
          fetch(`${targetUrl}src/modules/auth/SignInForm.tsx`),
          fetch(`${targetUrl}src/pages/Dashboard.tsx`),
          fetch(`${targetUrl}src/pages/ItemsPage.tsx`),
          fetch(`${targetUrl}src/pages/ContactsPage.tsx`),
          fetch(`${targetUrl}src/pages/AccountsPage.tsx`),
          fetch(`${targetUrl}src/pages/InvoicesPage.tsx`),
          fetch(`${targetUrl}src/modules/invoicing/PayablesManager.tsx`),
          fetch(`${targetUrl}src/pages/LedgerPage.tsx`),
          fetch(`${targetUrl}src/pages/InventoryPage.tsx`),
          fetch(`${targetUrl}src/pages/CrmPipelinePage.tsx`),
          fetch(`${targetUrl}src/pages/BankReconciliationPage.tsx`),
          fetch(`${targetUrl}src/pages/FinancialStatementsPage.tsx`),
          fetch(`${targetUrl}src/pages/PurchasingPage.tsx`),
          fetch(`${targetUrl}src/pages/ImportPage.tsx`),
          fetch(`${targetUrl}src/pages/GalleryPage.tsx`),
          fetch(`${targetUrl}src/modules/packs/IndustryPacksHub.tsx`),
          fetch(`${targetUrl}src/modules/approvals/ApprovalsInbox.tsx`),
          fetch(`${targetUrl}src/modules/bots/ChaseChloe.tsx`),
          fetch(`${targetUrl}src/modules/bots/ForecastFinn.tsx`),
          fetch(`${targetUrl}src/modules/bots/GuardGus.tsx`),
          fetch(`${targetUrl}src/modules/bots/LedgerLou.tsx`),
          fetch(`${targetUrl}src/modules/bots/Pip.tsx`),
          fetch(`${targetUrl}src/modules/bots/RestockRex.tsx`),
          fetch(`${targetUrl}src/components/ui/CommandBar.tsx`),
        ]);
        console.log("[run-e2e] Warmup completed.");
      } catch (err) {
        console.warn("[run-e2e] Warmup warning:", err.message);
      }
    }

    const cleanBaseUrl = targetUrl.replace(/\/$/, "");
    const userArgs = process.argv.slice(2);

    console.log(`[run-e2e] Running Playwright against ${cleanBaseUrl}...`);

    const testProcess = spawn(process.execPath, [playwrightCli, "test", ...userArgs], {
      cwd: e2eDir,
      stdio: "inherit",
      env: {
        ...process.env,
        E2E_BASE_URL: cleanBaseUrl,
        E2E_EXTERNAL_SERVER: "1",
      },
    });

    const exitCode = await new Promise((resolve) => {
      testProcess.on("exit", (code) => resolve(code ?? 0));
    });

    if (server) {
      console.log("[run-e2e] Shutting down in-process Vite server...");
      await server.close();
      server = null;
    }

    process.exit(exitCode);
  } finally {
    if (server) {
      await server.close();
    }
    if (changedCwd) {
      process.chdir(originalCwd);
    }
  }
}

main().catch((err) => {
  console.error("[run-e2e] Uncaught error:", err);
  process.exit(1);
});
