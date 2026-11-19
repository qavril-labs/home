#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pyScript = join(__dirname, "generate_api_client.py");

const res = spawnSync("python", [pyScript], { stdio: "inherit" });
if (res.status !== 0) {
  process.exit(res.status || 1);
}
