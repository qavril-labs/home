import { PRODUCTS } from "./products.generated";
import type { CatalogProduct } from "./types";

/** Product ID to definition. Throws if the catalog lists a product twice. */
export function buildRegistry(products: readonly CatalogProduct[] = PRODUCTS): Map<string, CatalogProduct> {
  const registry = new Map<string, CatalogProduct>();
  for (const product of products) {
    if (registry.has(product.id)) {
      throw new Error(`Duplicate product ${product.id}`);
    }
    registry.set(product.id, product);
  }
  return registry;
}

/**
 * Foundation products (phase P0) ship with every tenant and are not sold separately, so
 * dependency checks ignore them.
 */
export function isFoundation(product: Pick<CatalogProduct, "phase">): boolean {
  return product.phase === "P0";
}
