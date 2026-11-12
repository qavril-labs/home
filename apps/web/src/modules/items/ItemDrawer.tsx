import React, { useEffect, useState } from "react";
import { Drawer } from "../../components/ui/Drawer";
import type { ItemType, ProductItem } from "../../types";
import {
  UOM_OPTIONS,
  TAX_CODE_OPTIONS,
  CATEGORY_OPTIONS,
  normalizeDecimalString,
  isValidDecimalInput,
  computeItemStatus,
} from "./itemHelpers";
import { AlertCircle, Barcode, Package, Wrench, Layers } from "lucide-react";

export interface ItemDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem?: ProductItem | null;
  defaultType?: ItemType;
  onSave: (item: ProductItem) => void;
}

export const ItemDrawer: React.FC<ItemDrawerProps> = ({
  isOpen,
  onClose,
  editingItem,
  defaultType = "goods",
  onSave,
}) => {
  const [itemType, setItemType] = useState<ItemType>(defaultType);
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Tooling");
  const [uom, setUom] = useState("pcs");
  const [salesPrice, setSalesPrice] = useState("0.00");
  const [purchaseCost, setPurchaseCost] = useState("0.00");
  const [taxCode, setTaxCode] = useState("TAX-STD");
  const [reorderPoint, setReorderPoint] = useState("10");
  const [stockOnHand, setStockOnHand] = useState("0");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);

    if (editingItem) {
      setItemType(editingItem.type || "goods");
      setSku(editingItem.sku);
      setBarcode(editingItem.barcode || "");
      setTitle(editingItem.name);
      setCategory(editingItem.category || "Tooling");
      setUom(editingItem.unit || "pcs");
      setSalesPrice(editingItem.unitPrice || "0.00");
      setPurchaseCost(editingItem.costPrice || "0.00");
      setTaxCode(editingItem.taxCode || "TAX-STD");
      setReorderPoint(String(editingItem.reorderPoint ?? 0));
      setStockOnHand(String(editingItem.stockQuantity ?? 0));
    } else {
      setItemType(defaultType);
      setSku("");
      setBarcode("");
      setTitle("");
      setCategory(
        defaultType === "service"
          ? "Field Service"
          : defaultType === "bundle"
          ? "Bundles"
          : "Tooling"
      );
      setUom(defaultType === "service" ? "hrs" : "pcs");
      setSalesPrice("0.00");
      setPurchaseCost("0.00");
      setTaxCode("TAX-STD");
      setReorderPoint(defaultType === "service" ? "0" : "10");
      setStockOnHand("0");
    }
  }, [isOpen, editingItem, defaultType]);

  const handleTypeSwitch = (nextType: ItemType) => {
    setItemType(nextType);
    if (!editingItem) {
      if (nextType === "service") {
        setUom("hrs");
        setReorderPoint("0");
        setStockOnHand("0");
        setCategory("Field Service");
      } else if (nextType === "bundle") {
        setUom("pcs");
        setCategory("Bundles");
      } else {
        setUom("pcs");
        setCategory("Tooling");
      }
    }
  };

  const handleSubmit = () => {
    const cleanSku = sku.trim().toUpperCase();
    const cleanTitle = title.trim();

    if (!cleanSku) {
      setErrorMsg("SKU code is required.");
      return;
    }
    if (!cleanTitle) {
      setErrorMsg("Item title is required.");
      return;
    }
    if (!isValidDecimalInput(salesPrice)) {
      setErrorMsg("Sales price must be a valid decimal amount (e.g. 48.50).");
      return;
    }
    if (!isValidDecimalInput(purchaseCost)) {
      setErrorMsg("Purchase cost must be a valid decimal amount (e.g. 24.00).");
      return;
    }

    const parsedStock =
      itemType === "service" ? 0 : Math.max(0, parseInt(stockOnHand, 10) || 0);
    const parsedReorder =
      itemType === "service" ? 0 : Math.max(0, parseInt(reorderPoint, 10) || 0);

    const savedItem: ProductItem = {
      id: editingItem?.id || `ITM-${Date.now().toString().slice(-4)}`,
      sku: cleanSku,
      barcode: barcode.trim() || undefined,
      name: cleanTitle,
      type: itemType,
      category: category.trim() || "Tooling",
      unit: uom,
      unitPrice: normalizeDecimalString(salesPrice),
      costPrice: normalizeDecimalString(purchaseCost),
      taxCode,
      stockQuantity: parsedStock,
      reorderPoint: parsedReorder,
      status: computeItemStatus(itemType, parsedStock, parsedReorder),
    };

    onSave(savedItem);
    onClose();
  };

  const isService = itemType === "service";

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={editingItem ? "Edit catalog item" : "Create catalog item"}
      description="Item Master & Product Catalog (MDM-02). Prices are stored as exact decimal strings."
      primaryActionLabel={editingItem ? "Save item" : "Create item"}
      primaryActionVariant="lime"
      onPrimaryAction={handleSubmit}
      secondaryActionLabel="Cancel"
    >
      <div className="space-y-4">
        {errorMsg && (
          <div
            role="alert"
            className="flex items-center gap-2 p-3 bg-cream border-line text-act text-xs font-bold shadow-sm"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Item Type Selector */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
            Item Type
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: "goods", label: "Goods", icon: Package },
                { id: "service", label: "Services", icon: Wrench },
                { id: "bundle", label: "Bundles", icon: Layers },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const active = itemType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleTypeSwitch(opt.id)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold border-line transition-all cursor-pointer ${
                    active
                      ? "bg-lime text-ink shadow-sm -translate-y-0.5"
                      : "bg-page text-muted hover:text-text"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SKU & Barcode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="item-sku"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              SKU Code *
            </label>
            <input
              id="item-sku"
              type="text"
              required
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="e.g. TOOL-CNC-02"
              className="w-full px-3 py-2 text-sm font-mono font-bold uppercase bg-page text-text border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime placeholder:text-muted"
            />
          </div>

          <div>
            <label
              htmlFor="item-barcode"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Barcode / UPC
            </label>
            <div className="relative">
              <input
                id="item-barcode"
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="8901234567890"
                className="w-full pl-8 pr-3 py-2 text-sm font-mono font-bold bg-page text-text border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime placeholder:text-muted"
              />
              <Barcode className="w-4 h-4 text-muted absolute left-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Title */}
        <div>
          <label
            htmlFor="item-title"
            className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
          >
            Title *
          </label>
          <input
            id="item-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Tungsten Carbide Ball Nose End Mill"
            className="w-full px-3 py-2 text-sm font-bold bg-page text-text border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime placeholder:text-muted"
          />
        </div>

        {/* UoM Dropdown & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="item-uom"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Unit of Measure (UoM) *
            </label>
            <select
              id="item-uom"
              value={uom}
              onChange={(e) => setUom(e.target.value)}
              className="w-full px-3 py-2 text-sm font-bold bg-page text-text border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
            >
              {UOM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="item-category"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Catalog Group
            </label>
            <select
              id="item-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm font-bold bg-page text-text border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sales Price & Purchase Cost */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="item-sales-price"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Sales Price *
            </label>
            <div className="flex items-stretch border-line bg-page shadow-sm focus-within:ring-2 focus-within:ring-lime">
              <span className="px-3 py-2 bg-cream text-ink font-mono font-bold text-sm border-r-line flex items-center">
                $
              </span>
              <input
                id="item-sales-price"
                type="text"
                inputMode="decimal"
                value={salesPrice}
                onChange={(e) => setSalesPrice(e.target.value)}
                onBlur={() => {
                  if (isValidDecimalInput(salesPrice) && salesPrice.trim()) {
                    setSalesPrice(normalizeDecimalString(salesPrice));
                  }
                }}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm font-mono font-bold bg-transparent text-text focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="item-purchase-cost"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Purchase Cost
            </label>
            <div className="flex items-stretch border-line bg-page shadow-sm focus-within:ring-2 focus-within:ring-lime">
              <span className="px-3 py-2 bg-cream text-ink font-mono font-bold text-sm border-r-line flex items-center">
                $
              </span>
              <input
                id="item-purchase-cost"
                type="text"
                inputMode="decimal"
                value={purchaseCost}
                onChange={(e) => setPurchaseCost(e.target.value)}
                onBlur={() => {
                  if (isValidDecimalInput(purchaseCost) && purchaseCost.trim()) {
                    setPurchaseCost(normalizeDecimalString(purchaseCost));
                  }
                }}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm font-mono font-bold bg-transparent text-text focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Default Tax Code */}
        <div>
          <label
            htmlFor="item-tax-code"
            className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
          >
            Default Tax Code
          </label>
          <select
            id="item-tax-code"
            value={taxCode}
            onChange={(e) => setTaxCode(e.target.value)}
            className="w-full px-3 py-2 text-sm font-mono font-bold bg-page text-text border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
          >
            {TAX_CODE_OPTIONS.map((tax) => (
              <option key={tax.value} value={tax.value}>
                {tax.label}
              </option>
            ))}
          </select>
        </div>

        {/* Reorder Point & Stock on Hand */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="item-reorder-point"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Reorder Point
            </label>
            <input
              id="item-reorder-point"
              type="number"
              min="0"
              disabled={isService}
              value={isService ? "0" : reorderPoint}
              onChange={(e) => setReorderPoint(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono font-bold bg-page text-text border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label
              htmlFor="item-stock-on-hand"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Stock on Hand
            </label>
            <input
              id="item-stock-on-hand"
              type="number"
              min="0"
              disabled={isService}
              value={isService ? "0" : stockOnHand}
              onChange={(e) => setStockOnHand(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono font-bold bg-page text-text border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {isService && (
          <p className="text-xs text-muted bg-page border-thin border-ink p-2.5">
            Service items do not track physical inventory or trigger low-stock reorder alerts.
          </p>
        )}
      </div>
    </Drawer>
  );
};
