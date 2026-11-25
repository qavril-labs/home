import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM script shared with the CI check; it has no type declarations.
import { drift } from "../../../scripts/contract-drift.mjs";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The contract gate. Every route the API serves must be in contracts/openapi.yaml, and every
 * operation in the contract must be served (except the UAAP prefixes). A short list of routes is
 * still undocumented; it is recorded in contract-undocumented.txt. The list may only shrink:
 * documenting a route means removing it from the list, and a new undocumented route fails here.
 */
describe("API contract", () => {
  const result = drift() as { undocumented: string[]; missing: string[] };

  it("has no contract operation that the API does not serve", () => {
    expect(result.missing).toEqual([]);
  });

  it("documents every route not on the recorded allowlist, and nothing new", () => {
    const allowed = readFileSync(join(here, "contract-undocumented.txt"), "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .sort();
    expect(result.undocumented).toEqual(allowed);
  });
});
