// Builds the product registry from ERP-Product-Catalog.md.
// The catalog is the single source of truth: every product row becomes one registry entry,
// and the registry refuses to write if any row is malformed or depends on an unknown product.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = join(root, "ERP-Product-Catalog.md");
const outputPath = join(root, "packages", "catalog", "src", "products.generated.ts");

const ID = /^[A-Z]{2,3}-\d{2}$/;
const DEPENDENCY = /\b[A-Z]{2,3}-\d{2}\b/g;

const products = [];
const problems = [];
const seen = new Set();

for (const line of readFileSync(catalogPath, "utf8").split(/\r?\n/)) {
  if (!line.startsWith("| ")) continue;
  const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
  if (!ID.test(cells[0] ?? "")) continue;

  const id = cells[0];
  if (cells.length !== 6) {
    problems.push(`${id}: expected 6 columns, found ${cells.length}`);
    continue;
  }
  if (seen.has(id)) {
    problems.push(`${id}: listed more than once`);
    continue;
  }
  seen.add(id);

  const [, name, , sizeCell, phaseCell, dependsCell] = cells;
  const size = sizeCell.match(/^(S|M|L|XL)\b/)?.[1];
  const phase = phaseCell.match(/^(P[0-4])\b/)?.[1];
  if (!size) problems.push(`${id}: unknown size "${sizeCell}"`);
  if (!phase) problems.push(`${id}: unknown phase "${phaseCell}"`);
  const requires = [...new Set(dependsCell.match(DEPENDENCY) ?? [])].sort();
  products.push({ id, name, size, phase, requires });
}

for (const product of products) {
  for (const dependency of product.requires) {
    if (!seen.has(dependency)) problems.push(`${product.id}: depends on unknown product ${dependency}`);
  }
}

if (problems.length > 0) {
  console.error(`Catalog has ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

const entries = products
  .map(
    (product) =>
      `  { id: ${JSON.stringify(product.id)}, name: ${JSON.stringify(product.name)}, size: ${JSON.stringify(product.size)}, phase: ${JSON.stringify(product.phase)}, requires: [${product.requires.map((r) => JSON.stringify(r)).join(", ")}] },`,
  )
  .join("\n");

const source = `// Generated from ERP-Product-Catalog.md by scripts/generate-product-registry.mjs. Do not edit by hand.
import type { CatalogProduct } from "./types";

export const PRODUCTS: readonly CatalogProduct[] = [
${entries}
];
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, source, "utf8");

const byPhase = Object.fromEntries(
  ["P0", "P1", "P2", "P3", "P4"].map((phase) => [phase, products.filter((p) => p.phase === phase).length]),
);
console.log(`Wrote ${products.length} products to ${outputPath}`);
console.log(`By phase: ${Object.entries(byPhase).map(([phase, count]) => `${phase} ${count}`).join(", ")}`);
