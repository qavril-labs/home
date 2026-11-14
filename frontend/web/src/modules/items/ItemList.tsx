import React, { useState, useMemo } from "react";
import { Card } from "../../components/ui/Card";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { Button } from "../../components/ui/Button";
import { StatusChip } from "../../components/ui/StatusChip";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { formatMoney } from "../../lib/currency";
import type { ItemType, ProductItem } from "../../types";
import {
  type FilterTab,
  getStockChipInfo,
  getTabCounts,
  filterCatalogItems,
  getEmptyStateCopy,
} from "./itemHelpers";
import {
  Package,
  Wrench,
  Layers,
  Plus,
  Search,
  Barcode,
  Edit3,
  Trash2,
} from "lucide-react";

export type { FilterTab };

export interface ItemListProps {
  items: ProductItem[];
  onOpenCreate: (defaultType?: ItemType) => void;
  onOpenEdit: (item: ProductItem) => void;
  onDeleteItem: (id: string) => void;
  initialFilter?: FilterTab;
}

export const ItemList: React.FC<ItemListProps> = ({
  items,
  onOpenCreate,
  onOpenEdit,
  onDeleteItem,
  initialFilter = "all",
}) => {
  const [activeTab, setActiveTab] = useState<FilterTab>(initialFilter);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<ProductItem | null>(null);

  const filterTabs: { id: FilterTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "all", label: "All Items", icon: Package },
    { id: "goods", label: "Goods", icon: Package },
    { id: "service", label: "Services", icon: Wrench },
    { id: "bundle", label: "Bundles", icon: Layers },
  ];

  const tabCounts = useMemo(() => getTabCounts(items), [items]);

  const filteredData = useMemo(
    () => filterCatalogItems(items, activeTab, searchQuery),
    [items, activeTab, searchQuery]
  );

  const emptyStateCopy = useMemo(
    () => getEmptyStateCopy(activeTab, searchQuery),
    [activeTab, searchQuery]
  );

  const columns: Column<ProductItem>[] = [
    {
      header: "SKU / Barcode",
      accessorKey: "sku",
      cell: (r) => (
        <div>
          <span className="font-mono font-bold text-xs text-text bg-page px-2 py-0.5 border border-grid inline-block">
            {r.sku}
          </span>
          {r.barcode && (
            <div className="flex items-center gap-1 text-[11px] font-mono text-muted mt-1">
              <Barcode className="w-3 h-3 text-muted" />
              <span>{r.barcode}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Item Name",
      accessorKey: "name",
      cell: (r) => {
        const itemType = r.type || "goods";
        return (
          <div className="min-w-[180px]">
            <div className="font-bold text-sm text-text leading-tight">{r.name}</div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 border border-ink ${
                  itemType === "goods"
                    ? "bg-page text-muted"
                    : itemType === "service"
                    ? "bg-violet text-white"
                    : "bg-cyan text-ink"
                }`}
              >
                {itemType}
              </span>
              {r.category && (
                <span className="text-[11px] text-muted truncate max-w-[150px]">
                  {r.category}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: "UoM",
      accessorKey: "unit",
      align: "center",
      cell: (r) => (
        <span className="font-mono text-xs font-bold px-2 py-0.5 bg-page border-thin border-ink text-text inline-block shadow-[1px_1px_0_var(--q-ink)]">
          {r.unit}
        </span>
      ),
    },
    {
      header: "Sale Price",
      accessorKey: "unitPrice",
      align: "right",
      cell: (r) => (
        <span className="font-mono font-bold text-sm text-series-in">
          {formatMoney(r.unitPrice, "$")}
        </span>
      ),
    },
    {
      header: "Cost Price",
      accessorKey: "costPrice",
      align: "right",
      cell: (r) => (
        <span className="font-mono font-bold text-sm text-series-out">
          {r.costPrice ? formatMoney(r.costPrice, "$") : "—"}
        </span>
      ),
    },
    {
      header: "Stock on Hand",
      align: "right",
      cell: (r) => {
        if (r.type === "service") {
          return (
            <span className="text-xs font-mono text-muted italic" title="Services do not carry physical stock">
              N/A (service)
            </span>
          );
        }
        return (
          <div className="text-right">
            <span className="font-mono font-bold text-sm text-text block">
              {r.stockQuantity} {r.unit}
            </span>
            <span className="text-[10px] font-mono text-muted block">
              Reorder: {r.reorderPoint}
            </span>
          </div>
        );
      },
    },
    {
      header: "Stock Status",
      align: "center",
      cell: (r) => {
        const chip = getStockChipInfo(r);
        return <StatusChip status={chip.status} label={chip.label} />;
      },
    },
    {
      header: "Actions",
      align: "right",
      cell: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => onOpenEdit(r)}
            className="p-1.5 bg-page border border-ink shadow-[1px_1px_0_var(--q-ink)] hover:bg-lime text-ink cursor-pointer active:translate-y-0.5 transition-colors"
            title="Edit item"
            aria-label={`Edit ${r.name}`}
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteCandidate(r)}
            className="p-1.5 bg-page border border-ink shadow-[1px_1px_0_var(--q-ink)] hover:bg-pink hover:text-white text-ink cursor-pointer active:translate-y-0.5 transition-colors"
            title="Delete item"
            aria-label={`Delete ${r.name}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Controls Bar: Tabs & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Filter Tabs: Goods, Services, Bundles */}
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Item category filters">
          {filterTabs.map((tab) => {
            const Icon = tab.icon;
            const count = tabCounts[tab.id];
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border-2 transition-all cursor-pointer ${
                  isActive
                    ? "bg-lime text-ink border-ink shadow-[2px_2px_0_var(--q-ink)] -translate-y-0.5"
                    : "bg-panel text-muted border-transparent hover:border-ink hover:text-text"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-mono font-bold ${
                    isActive ? "bg-ink text-white" : "bg-page text-muted"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Action Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-page border-line shadow-sm px-3 py-1.5 w-full sm:w-64">
            <Search className="w-4 h-4 text-muted flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search SKU, barcode, title…"
              aria-label="Search catalog items"
              className="w-full bg-transparent border-none outline-none text-xs font-bold text-text placeholder:text-muted"
            />
          </div>

          <Button
            variant="lime"
            size="sm"
            onClick={() => onOpenCreate(activeTab === "all" ? "goods" : activeTab)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            New item
          </Button>
        </div>
      </div>

      {/* Main Table Card */}
      <Card>
        <DataTable
          columns={columns}
          data={filteredData}
          emptyTitle={emptyStateCopy.title}
          emptyDescription={emptyStateCopy.description}
          onEmptyAction={
            emptyStateCopy.isSearchEmpty
              ? () => setSearchQuery("")
              : () => onOpenCreate(emptyStateCopy.createType)
          }
          emptyActionLabel={emptyStateCopy.actionLabel}
        />
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteCandidate)}
        onClose={() => setDeleteCandidate(null)}
        title="Delete Catalog Item?"
        message={`Are you sure you want to delete "${deleteCandidate?.name}" (${deleteCandidate?.sku})? This record will be permanently removed from master data.`}
        actionVerb="Delete Item"
        actionVariant="pink"
        onConfirm={() => {
          if (deleteCandidate) {
            onDeleteItem(deleteCandidate.id);
            setDeleteCandidate(null);
          }
        }}
      />
    </div>
  );
};
