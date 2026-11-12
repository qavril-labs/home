export type ProductSize = "S" | "M" | "L" | "XL";
export type ProductPhase = "P0" | "P1" | "P2" | "P3" | "P4";

/** One sellable product from ERP-Product-Catalog.md. */
export interface CatalogProduct {
  readonly id: string;
  readonly name: string;
  readonly size: ProductSize;
  readonly phase: ProductPhase;
  /** Products this one cannot run without. */
  readonly requires: readonly string[];
}
