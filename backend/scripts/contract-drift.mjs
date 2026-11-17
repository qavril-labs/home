// Compares the routes the API registers with the operations in contracts/openapi.yaml.
// Exit 1 if either side has an operation the other lacks. Run by the drift test and by CI.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const backend = resolve(here, "..");
const contractPath = resolve(backend, "..", "contracts", "openapi.yaml");
const routesDir = join(backend, "apps", "api", "src");

const normalise = (path) => path.replace(/:(\w+)/g, "{$1}");

export function registeredRoutes() {
  const found = new Set();
  for (const name of readdirSync(routesDir).filter((f) => f.endsWith(".ts"))) {
    const source = readFileSync(join(routesDir, name), "utf8");
    for (const m of source.matchAll(/app\.(get|post|put|patch|delete)\(\s*"(\/v1[^"]*)"/g)) {
      found.add(`${m[1].toUpperCase()} ${normalise(m[2])}`);
    }
    for (const m of source.matchAll(/app\.route\(\{[^}]*?method:\s*"(\w+)"[^}]*?url:\s*"(\/v1[^"]*)"/gs)) {
      found.add(`${m[1].toUpperCase()} ${normalise(m[2])}`);
    }
  }
  return found;
}

export function contractOperations() {
  const found = new Set();
  let path = null;
  for (const line of readFileSync(contractPath, "utf8").split("\n")) {
    const p = line.match(/^ {2}(\/v1\S*):\s*$/);
    if (p) { path = p[1]; continue; }
    const m = line.match(/^ {4}(get|post|put|patch|delete):\s*$/);
    if (m && path) found.add(`${m[1].toUpperCase()} ${path}`);
  }
  return found;
}

// The bot API is served by the Python agent service (backend/services/uaap), not by apps/api, so
// these prefixes are documented in the contract but are not expected to be registered here.
export const UAAP_SERVED_PREFIXES = ["/v1/agents", "/v1/approvals"];

export function drift() {
  const code = registeredRoutes();
  const contract = new Set(
    [...contractOperations()].filter((op) => !UAAP_SERVED_PREFIXES.some((p) => op.split(" ")[1].startsWith(p))),
  );
  return {
    undocumented: [...code].filter((x) => !contract.has(x)).sort(),
    missing: [...contract].filter((x) => !code.has(x)).sort(),
    codeCount: code.size,
    contractCount: contract.size,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = drift();
  console.log(`registered routes: ${r.codeCount}, contract operations: ${r.contractCount}`);
  console.log(`in code but not in contract (${r.undocumented.length}):`);
  r.undocumented.forEach((x) => console.log("  " + x));
  console.log(`in contract but not in code (${r.missing.length}):`);
  r.missing.forEach((x) => console.log("  " + x));
  process.exit(r.undocumented.length || r.missing.length ? 1 : 0);
}
