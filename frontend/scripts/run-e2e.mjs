#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDir = join(__dirname, "..");
const e2eDir = join(frontendDir, "e2e");

async function isServerReady(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isServerReady(url)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function main() {
  const url = "http://127.0.0.1:5173/";
  let devProcess = null;

  if (!(await isServerReady(url))) {
    console.log("[run-e2e] Starting Vite dev server...");
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    devProcess = spawn(npmCmd, ["run", "dev:web"], {
      cwd: frontendDir,
      stdio: "pipe",
      shell: process.platform === "win32",
    });

    const ready = await waitForServer(url);
    if (!ready) {
      console.error("[run-e2e] Vite server failed to become ready within timeout.");
      if (devProcess) devProcess.kill();
      process.exit(1);
    }
    console.log("[run-e2e] Vite dev server ready at " + url);
  } else {
    console.log("[run-e2e] Reusing existing server at " + url);
  }

  const userArgs = process.argv.slice(2);
  const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";

  const testProcess = spawn(npxCmd, ["playwright", "test", ...userArgs], {
    cwd: e2eDir,
    stdio: "inherit",
    env: { ...process.env, E2E_BASE_URL: "http://127.0.0.1:5173", E2E_EXTERNAL_SERVER: "1" },
    shell: process.platform === "win32",
  });

  const exitCode = await new Promise((resolve) => {
    testProcess.on("exit", (code) => resolve(code || 0));
  });

  if (devProcess) {
    if (process.platform === "win32" && devProcess.pid) {
      spawn("taskkill", ["/pid", String(devProcess.pid), "/f", "/t"]);
    } else {
      devProcess.kill();
    }
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
