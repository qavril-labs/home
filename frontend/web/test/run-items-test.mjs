import test from "node:test";
import assert from "node:assert/strict";
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
} from "../src/modules/items/itemHelpers.ts";
import { formatMoney } from "../src/lib/currency.ts";
import { initialMockItems } from "../src/lib/api-mock.ts";

test("MDM-02: Empty states for All, Goods, Services, Bundles, and Search", () => {
  assert.equal(filterCatalogItems([], "all", "").length, 0);
  const copyAll = getEmptyStateCopy("all", "");
  assert.equal(copyAll.title, "No catalog items found");
  assert.equal(copyAll.actionLabel, "Add first item");

  const copyGoods = getEmptyStateCopy("goods", "");
  assert.equal(copyGoods.title, "No physical goods recorded");
  assert.equal(copyGoods.createType, "goods");

  const copyService = getEmptyStateCopy("service", "");
  assert.equal(copyService.title, "No services recorded");
  assert.equal(copyService.createType, "service");

  const copyBundle = getEmptyStateCopy("bundle", "");
  assert.equal(copyBundle.title, "No product bundles defined");
  assert.equal(copyBundle.createType, "bundle");

  const copySearch = getEmptyStateCopy("all", "NON-EXISTENT-SKU");
  assert.equal(copySearch.title, "No matching items");
  assert.equal(copySearch.isSearchEmpty, true);
});

test("MDM-02: Filter tabs and search across SKU, barcode, and name", () => {
  const counts = getTabCounts(initialMockItems);
  assert.equal(counts.all, initialMockItems.length);
  assert.ok(counts.goods > 0);
  assert.ok(counts.service > 0);
  assert.ok(counts.bundle > 0);

  assert.ok(filterCatalogItems(initialMockItems, "goods", "").every((i) => i.type === "goods"));
  assert.ok(filterCatalogItems(initialMockItems, "service", "").every((i) => i.type === "service"));
  assert.ok(filterCatalogItems(initialMockItems, "bundle", "").every((i) => i.type === "bundle"));

  assert.equal(filterCatalogItems(initialMockItems, "all", "TOOL-CNC-01").length, 1);
  assert.equal(filterCatalogItems(initialMockItems, "all", "8901234567895").length, 1);
  assert.equal(filterCatalogItems(initialMockItems, "all", "Calibration").length, 1);
});

test("MDM-02: Stock status & low-stock warning chips", () => {
  assert.equal(computeItemStatus("goods", 0, 10), "out_of_stock");
  assert.equal(computeItemStatus("goods", 5, 10), "low_stock");
  assert.equal(computeItemStatus("goods", 25, 10), "in_stock");
  assert.equal(computeItemStatus("service", 0, 0), "in_stock");

  const lowItem = {
    id: "1",
    sku: "LOW-1",
    name: "Low Part",
    type: "goods",
    category: "Parts",
    unit: "pcs",
    unitPrice: "10.00",
    stockQuantity: 4,
    reorderPoint: 10,
    status: "low_stock",
  };
  const chip = getStockChipInfo(lowItem);
  assert.equal(chip.status, "watch");
  assert.ok(chip.label.includes("Low stock"));
});

test("MDM-02: Decimal formatting and UOM / Tax Code options", () => {
  assert.equal(isValidDecimalInput("145.00"), true);
  assert.equal(isValidDecimalInput("0"), true);
  assert.equal(isValidDecimalInput("abc"), false);
  assert.equal(normalizeDecimalString("145"), "145.00");
  assert.equal(formatMoney("1234.50"), "$1,234.50");
  assert.ok(UOM_OPTIONS.length >= 4);
  assert.ok(TAX_CODE_OPTIONS.length >= 3);
});
