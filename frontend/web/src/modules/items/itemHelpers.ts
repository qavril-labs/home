import type { ItemType, ProductItem, StatusType } from "../../types";

export type FilterTab = "all" | ItemType;

export const UOM_OPTIONS = [
  { value: "pcs", label: "Pieces (pcs)" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "m", label: "Meters (m)" },
  { value: "hrs", label: "Hours (hrs)" },
] as const;

export const TAX_CODE_OPTIONS = [
  { value: "TAX-STD", label: "TAX-STD · Standard Rate" },
  { value: "TAX-REDUCED", label: "TAX-REDUCED · Reduced Rate" },
  { value: "TAX-ZERO", label: "TAX-ZERO · Zero Rated" },
  { value: "TAX-EXEMPT", label: "TAX-EXEMPT · Exempt" },
] as const;

export const CATEGORY_OPTIONS = [
  "Tooling",
  "Raw Materials",
  "Consumables",
  "Finished Goods",
  "Hardware",
  "Field Service",
  "Consulting",
  "Bundles",
  "Maintenance",
] as const;

/**
 * Pure string normalizer for decimal money inputs (no browser arithmetic).
 * Converts inputs like "120", "120.5", "0048.5" into exact "120.00", "120.50", "48.50".
 */
export function normalizeDecimalString(raw: string): string {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return "0.00";
  const cleaned = trimmed.replace(/[^0-9.]/g, "");
  if (!cleaned) return "0.00";
  const parts = cleaned.split(".");
  const rawInt = parts[0] || "0";
  const intPart = rawInt.replace(/^0+(?=\d)/, "") || "0";
  const decPart = ((parts[1] || "") + "00").slice(0, 2);
  return `${intPart}.${decPart}`;
}

/**
 * Validates that user-entered money input is a non-negative decimal with at most 2 decimal places.
 */
export function isValidDecimalInput(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  return /^\d+(\.\d{0,2})?$/.test(trimmed);
}

/**
 * Determines stock status for a catalog item. Services never go out of stock.
 */
export function computeItemStatus(
  type: ItemType,
  stockQuantity: number,
  reorderPoint: number
): ProductItem["status"] {
  if (type === "service") return "in_stock";
  if (stockQuantity <= 0) return "out_of_stock";
  if (stockQuantity <= reorderPoint) return "low_stock";
  return "in_stock";
}

/**
 * Maps an item's inventory level to its UI StatusChip status and label.
 */
export function getStockChipInfo(item: ProductItem): {
  status: StatusType;
  label: string;
} {
  if (item.type === "service") {
    return { status: "good", label: "Service" };
  }
  if (item.stockQuantity <= 0) {
    return { status: "act", label: "Out of stock" };
  }
  if (item.stockQuantity <= item.reorderPoint) {
    return { status: "watch", label: "Low stock" };
  }
  return { status: "good", label: "In stock" };
}

/**
 * Counts items per filter tab (All, Goods, Services, Bundles).
 */
export function getTabCounts(items: ProductItem[]): Record<FilterTab, number> {
  return {
    all: items.length,
    goods: items.filter((i) => (i.type || "goods") === "goods").length,
    service: items.filter((i) => i.type === "service").length,
    bundle: items.filter((i) => i.type === "bundle").length,
  };
}

/**
 * Filters items by active tab (Goods, Services, Bundles, All) and search string (SKU, barcode, title, category).
 */
export function filterCatalogItems(
  items: ProductItem[],
  activeTab: FilterTab,
  searchQuery: string
): ProductItem[] {
  const q = searchQuery.toLowerCase().trim();
  return items.filter((item) => {
    const itemType = item.type || "goods";
    const matchesTab = activeTab === "all" || itemType === activeTab;
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      (item.barcode && item.barcode.toLowerCase().includes(q)) ||
      (item.category && item.category.toLowerCase().includes(q));

    return matchesTab && matchesSearch;
  });
}

/**
 * Computes empty-state messaging and call-to-action based on active filter tab and search query.
 */
export function getEmptyStateCopy(
  activeTab: FilterTab,
  searchQuery: string
): {
  title: string;
  description: string;
  actionLabel: string;
  isSearchEmpty: boolean;
  createType: ItemType;
} {
  const trimmedSearch = searchQuery.trim();
  if (trimmedSearch.length > 0) {
    return {
      title: "No matching items",
      description: `No catalog records matched "${trimmedSearch}". Clear the search query or create a new item.`,
      actionLabel: "Clear search",
      isSearchEmpty: true,
      createType: activeTab === "all" ? "goods" : activeTab,
    };
  }

  const byTab: Record<
    FilterTab,
    { title: string; description: string; actionLabel: string; createType: ItemType }
  > = {
    all: {
      title: "No catalog items found",
      description:
        "Add goods, services, or bundles to start tracking inventory and issuing quotes.",
      actionLabel: "Add first item",
      createType: "goods",
    },
    goods: {
      title: "No physical goods recorded",
      description: "You have not registered any physical inventory items yet.",
      actionLabel: "Add new goods",
      createType: "goods",
    },
    service: {
      title: "No services recorded",
      description: "Add hourly or fixed-fee services to bill in customer invoices.",
      actionLabel: "Add new service",
      createType: "service",
    },
    bundle: {
      title: "No product bundles defined",
      description: "Group multiple items or services into bundled catalog offerings.",
      actionLabel: "Add new bundle",
      createType: "bundle",
    },
  };

  return {
    ...byTab[activeTab],
    isSearchEmpty: false,
  };
}
