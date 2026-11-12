import React, { useState, useMemo } from "react";
import { ItemList } from "../modules/items/ItemList";
import { ItemDrawer } from "../modules/items/ItemDrawer";
import { Button } from "../components/ui/Button";
import { useToast } from "../context/ToastContext";
import type { ItemType, ProductItem } from "../types";
import { Plus, AlertTriangle } from "lucide-react";

export interface ItemsPageProps {
  items: ProductItem[];
  onAddItem: (item: ProductItem) => void;
  onUpdateItem: (item: ProductItem) => void;
  onDeleteItem: (id: string) => void;
}

export const ItemsPage: React.FC<ItemsPageProps> = ({
  items,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
}) => {
  const { showToast } = useToast();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductItem | null>(null);
  const [drawerDefaultType, setDrawerDefaultType] = useState<ItemType>("goods");

  // KPI summaries
  const kpis = useMemo(() => {
    const total = items.length;
    const goodsCount = items.filter((i) => (i.type || "goods") === "goods").length;
    const servicesCount = items.filter((i) => i.type === "service").length;
    const bundlesCount = items.filter((i) => i.type === "bundle").length;
    const lowStockCount = items.filter(
      (i) => i.type !== "service" && (i.stockQuantity <= i.reorderPoint || i.stockQuantity <= 0)
    ).length;

    return { total, goodsCount, servicesCount, bundlesCount, lowStockCount };
  }, [items]);

  const handleOpenCreate = (type: ItemType = "goods") => {
    setEditingItem(null);
    setDrawerDefaultType(type);
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (item: ProductItem) => {
    setEditingItem(item);
    setDrawerDefaultType(item.type || "goods");
    setIsDrawerOpen(true);
  };

  const handleSave = (item: ProductItem) => {
    const isExisting = items.some((i) => i.id === item.id);
    if (isExisting) {
      onUpdateItem(item);
      showToast(`Updated item: ${item.name}`, { type: "success" });
    } else {
      onAddItem(item);
      showToast(`Created item: ${item.name}`, { type: "success" });
    }
    setIsDrawerOpen(false);
  };

  const handleDelete = (id: string) => {
    const candidate = items.find((i) => i.id === id);
    onDeleteItem(id);
    showToast(`Deleted item: ${candidate?.name || id}`, { type: "info" });
  };

  return (
    <div className="space-y-6">
      {/* Title Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-pink block">
            Master Data · MDM-02
          </span>
          <h1 className="font-display font-extrabold text-3xl uppercase tracking-tight text-text leading-tight">
            Item Master & Products
          </h1>
          <p className="text-xs text-muted mt-1 max-w-xl">
            Single central catalog for physical goods, hourly & fixed services, and product bundles
            with SKU codes, barcodes, UoM conversion, and reorder alerts.
          </p>
        </div>

        <Button variant="lime" size="md" onClick={() => handleOpenCreate("goods")}>
          <Plus className="w-4 h-4 mr-1" />
          New item
        </Button>
      </div>

      {/* KPI Tiles row per UI Contract */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="neo-card p-4 bg-panel">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
            Total Catalog Items
          </span>
          <div className="font-display font-extrabold text-2xl lg:text-3xl text-text mt-1">
            {kpis.total}
          </div>
          <span className="text-[11px] text-muted font-medium mt-1 block">
            Across all categories
          </span>
        </div>

        <div className="neo-card p-4 bg-lime text-ink">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink/80 block">
            Physical Goods
          </span>
          <div className="font-display font-extrabold text-2xl lg:text-3xl mt-1">
            {kpis.goodsCount}
          </div>
          <span className="text-[11px] text-ink/80 font-medium mt-1 block">
            Tracked in inventory
          </span>
        </div>

        <div className="neo-card p-4 bg-cyan text-ink">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink/80 block">
            Services & Bundles
          </span>
          <div className="font-display font-extrabold text-2xl lg:text-3xl mt-1">
            {kpis.servicesCount + kpis.bundlesCount}
          </div>
          <span className="text-[11px] text-ink/80 font-medium mt-1 block">
            {kpis.servicesCount} services · {kpis.bundlesCount} bundles
          </span>
        </div>

        <div
          className={`neo-card p-4 transition-colors ${
            kpis.lowStockCount > 0 ? "bg-cream text-act" : "bg-panel text-good"
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
            Stock Attention
          </span>
          <div className="font-display font-extrabold text-2xl lg:text-3xl mt-1 flex items-center gap-1.5">
            {kpis.lowStockCount > 0 && <AlertTriangle className="w-5 h-5 text-act flex-shrink-0" />}
            <span>{kpis.lowStockCount}</span>
          </div>
          <span className="text-[11px] text-muted font-medium mt-1 block">
            {kpis.lowStockCount > 0 ? "Items at or below reorder point" : "All goods healthy"}
          </span>
        </div>
      </div>

      {/* Item List module */}
      <ItemList
        items={items}
        onOpenCreate={handleOpenCreate}
        onOpenEdit={handleOpenEdit}
        onDeleteItem={handleDelete}
      />

      {/* Slide-out Item Drawer */}
      <ItemDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        editingItem={editingItem}
        defaultType={drawerDefaultType}
        onSave={handleSave}
      />
    </div>
  );
};
