import { describe, expect, it } from "vitest";
import {
  UOM_OPTIONS,
  TAX_CODE_OPTIONS,
  normalizeDecimalString,
  isValidDecimalInput,
  computeItemStatus,
  getStockChipInfo,
  getTabCounts,
  filterCatalogItems,
  getEmptyStateCopy,
} from "../src/modules/items/itemHelpers";
import { formatMoney } from "../src/lib/currency";
import { initialMockItems } from "../src/lib/api-mock";
import type { ProductItem } from "../src/types";

describe("MDM-02 Item Master & Product Catalog", () => {
  describe("Empty states", () => {
    it("returns empty catalog copy and create CTA when no items exist", () => {
      const filtered = filterCatalogItems([], "all", "");
      expect(filtered).toHaveLength(0);

      const copy = getEmptyStateCopy("all", "");
      expect(copy.title).toBe("No catalog items found");
      expect(copy.actionLabel).toBe("Add first item");
      expect(copy.isSearchEmpty).toBe(false);
    });

    it("returns Goods empty state when only services exist", () => {
      const servicesOnly = initialMockItems.filter((i) => i.type === "service");
      const filtered = filterCatalogItems(servicesOnly, "goods", "");
      expect(filtered).toHaveLength(0);

      const copy = getEmptyStateCopy("goods", "");
      expect(copy.title).toBe("No physical goods recorded");
      expect(copy.actionLabel).toBe("Add new goods");
      expect(copy.createType).toBe("goods");
    });

    it("returns Services empty state when no services exist", () => {
      const goodsOnly = initialMockItems.filter((i) => i.type === "goods");
      const filtered = filterCatalogItems(goodsOnly, "service", "");
      expect(filtered).toHaveLength(0);

      const copy = getEmptyStateCopy("service", "");
      expect(copy.title).toBe("No services recorded");
      expect(copy.actionLabel).toBe("Add new service");
      expect(copy.createType).toBe("service");
    });

    it("returns Bundles empty state when no bundles exist", () => {
      const goodsOnly = initialMockItems.filter((i) => i.type === "goods");
      const filtered = filterCatalogItems(goodsOnly, "bundle", "");
      expect(filtered).toHaveLength(0);

      const copy = getEmptyStateCopy("bundle", "");
      expect(copy.title).toBe("No product bundles defined");
      expect(copy.actionLabel).toBe("Add new bundle");
      expect(copy.createType).toBe("bundle");
    });

    it("returns search empty state with Clear search action when query matches nothing", () => {
      const filtered = filterCatalogItems(initialMockItems, "all", "NON-EXISTENT-SKU");
      expect(filtered).toHaveLength(0);

      const copy = getEmptyStateCopy("all", "NON-EXISTENT-SKU");
      expect(copy.title).toBe("No matching items");
      expect(copy.actionLabel).toBe("Clear search");
      expect(copy.isSearchEmpty).toBe(true);
    });
  });

  describe("Filter tabs and search", () => {
    it("computes accurate counts for All, Goods, Services, and Bundles", () => {
      const counts = getTabCounts(initialMockItems);
      expect(counts.all).toBe(initialMockItems.length);
      expect(counts.goods).toBe(5);
      expect(counts.service).toBe(2);
      expect(counts.bundle).toBe(2);
    });

    it("filters items by Goods, Services, and Bundles tabs", () => {
      expect(filterCatalogItems(initialMockItems, "goods", "").every((i) => i.type === "goods")).toBe(true);
      expect(filterCatalogItems(initialMockItems, "service", "").every((i) => i.type === "service")).toBe(true);
      expect(filterCatalogItems(initialMockItems, "bundle", "").every((i) => i.type === "bundle")).toBe(true);
    });

    it("filters items by SKU, barcode, and item title", () => {
      expect(filterCatalogItems(initialMockItems, "all", "TOOL-CNC-01")).toHaveLength(1);
      expect(filterCatalogItems(initialMockItems, "all", "8901234567895")).toHaveLength(1);
      expect(filterCatalogItems(initialMockItems, "all", "Calibration")).toHaveLength(1);
    });
  });

  describe("Low-stock warning chips", () => {
    it("flags out-of-stock, low-stock, healthy stock, and service items correctly", () => {
      const lowStockItem: ProductItem = {
        id: "T-1",
        sku: "LOW-1",
        name: "Low Stock Part",
        type: "goods",
        category: "Tooling",
        unit: "pcs",
        unitPrice: "10.00",
        stockQuantity: 5,
        reorderPoint: 10,
        status: computeItemStatus("goods", 5, 10),
      };
      expect(getStockChipInfo(lowStockItem)).toEqual({ status: "watch", label: "Low stock" });

      const outOfStockItem: ProductItem = {
        ...lowStockItem,
        stockQuantity: 0,
        status: computeItemStatus("goods", 0, 10),
      };
      expect(getStockChipInfo(outOfStockItem)).toEqual({ status: "act", label: "Out of stock" });

      const healthyItem: ProductItem = {
        ...lowStockItem,
        stockQuantity: 25,
        status: computeItemStatus("goods", 25, 10),
      };
      expect(getStockChipInfo(healthyItem)).toEqual({ status: "good", label: "In stock" });

      const serviceItem: ProductItem = {
        ...lowStockItem,
        type: "service",
        unit: "hrs",
        stockQuantity: 0,
        reorderPoint: 0,
        status: computeItemStatus("service", 0, 0),
      };
      expect(getStockChipInfo(serviceItem)).toEqual({ status: "good", label: "Service" });
    });
  });

  describe("ItemDrawer options & decimal string prices", () => {
    it("includes required UoM dropdown options (pcs, kg, m, hrs) and tax codes", () => {
      const uomValues = UOM_OPTIONS.map((o) => o.value);
      expect(uomValues).toEqual(["pcs", "kg", "m", "hrs"]);
      expect(TAX_CODE_OPTIONS.length).toBeGreaterThanOrEqual(4);
    });

    it("normalizes and formats decimal strings without browser arithmetic", () => {
      expect(normalizeDecimalString("1234.5")).toBe("1234.50");
      expect(normalizeDecimalString("48")).toBe("48.00");
      expect(normalizeDecimalString("0018.25")).toBe("18.25");
      expect(normalizeDecimalString("")).toBe("0.00");

      expect(isValidDecimalInput("1234.50")).toBe(true);
      expect(isValidDecimalInput("1234.567")).toBe(false);
      expect(isValidDecimalInput("abc")).toBe(false);

      expect(formatMoney("1234.50", "$")).toBe("$1,234.50");
      expect(formatMoney("48.50", "$")).toBe("$48.50");
    });
  });
});
