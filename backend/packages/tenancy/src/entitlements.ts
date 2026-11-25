import { DomainError } from "@erp/kernel";

/** A sellable product from the catalog, with the products it cannot run without. */
export interface ProductDefinition {
  readonly id: string;
  readonly name: string;
  readonly requires: readonly string[];
}

/**
 * Products in `selection` whose required products are missing from it.
 * Throws if the selection names a product the catalog does not know.
 */
export function missingDependencies(
  selection: readonly string[],
  catalog: ReadonlyMap<string, ProductDefinition>,
): string[] {
  const chosen = new Set(selection);
  const missing = new Set<string>();
  for (const productId of selection) {
    const product = catalog.get(productId);
    if (!product) {
      throw new DomainError("VALIDATION", `Unknown product ${productId}`);
    }
    for (const dependency of product.requires) {
      if (!chosen.has(dependency)) {
        missing.add(dependency);
      }
    }
  }
  return [...missing].sort();
}

/** Throws NOT_LICENSED unless the tenant's entitlements include the product. */
export function assertEntitled(entitlements: ReadonlySet<string>, productId: string): void {
  if (!entitlements.has(productId)) {
    throw new DomainError("NOT_LICENSED", `Product ${productId} is not enabled for this tenant`);
  }
}
