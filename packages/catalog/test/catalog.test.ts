import { describe, expect, it } from "vitest";
import { PRODUCTS, buildRegistry, isFoundation, type CatalogProduct } from "../src";

describe("product registry", () => {
  const registry = buildRegistry();

  it("holds every product in the catalog", () => {
    expect(registry.size).toBe(320);
  });

  it("matches the catalog's phase split", () => {
    const count = (phase: string) => PRODUCTS.filter((product) => product.phase === phase).length;
    expect({ P0: count("P0"), P1: count("P1"), P2: count("P2"), P3: count("P3"), P4: count("P4") }).toEqual({
      P0: 23,
      P1: 30,
      P2: 48,
      P3: 184,
      P4: 35,
    });
  });

  it("only refers to products that exist", () => {
    for (const product of PRODUCTS) {
      for (const dependency of product.requires) {
        expect(registry.has(dependency), `${product.id} requires ${dependency}`).toBe(true);
      }
    }
  });

  it("has no dependency cycles", () => {
    const state = new Map<string, "visiting" | "done">();
    const visit = (id: string, trail: string[]): void => {
      if (state.get(id) === "done") return;
      if (state.get(id) === "visiting") throw new Error(`Cycle: ${[...trail, id].join(" -> ")}`);
      state.set(id, "visiting");
      for (const dependency of registry.get(id)?.requires ?? []) visit(dependency, [...trail, id]);
      state.set(id, "done");
    };
    for (const id of registry.keys()) visit(id, []);
    expect(state.size).toBe(320);
  });

  it("records the dependencies the general ledger needs", () => {
    expect(registry.get("FIN-01")?.requires).toEqual(["MDM-03", "PLT-05"]);
    expect(registry.get("FIN-01")?.phase).toBe("P1");
  });

  it("treats only P0 products as foundation", () => {
    expect(isFoundation({ phase: "P0" })).toBe(true);
    expect(isFoundation({ phase: "P1" })).toBe(false);
  });

  it("rejects duplicate IDs", () => {
    const product: CatalogProduct = { id: "X-01", name: "X", size: "S", phase: "P1", requires: [] };
    expect(() => buildRegistry([product, product])).toThrow(/Duplicate product X-01/);
  });
});
