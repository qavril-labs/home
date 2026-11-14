import React, { useState, useMemo } from "react";
import { Button } from "../components/ui/Button";
import { Drawer } from "../components/ui/Drawer";
import { StockWarehouse3D } from "../scenes/StockWarehouse3D";
import { useToast } from "../context/ToastContext";
import { formatMoney } from "../lib/currency";
import type { WarehouseLocation, WarehouseStockSlot, StockTransfer } from "../types";
import {
  Boxes,
  Warehouse,
  AlertTriangle,
  ArrowRightLeft,
  Plus,
  Box,
  CheckCircle2,
  Clock,
  Sliders,
} from "lucide-react";

export interface InventoryPageProps {
  warehouses: WarehouseLocation[];
  stockSlots: WarehouseStockSlot[];
  transfers: StockTransfer[];
  onAddTransfer?: (transfer: StockTransfer) => void;
  onUpdateTransferStatus?: (transferId: string, status: "Draft" | "In Transit" | "Completed") => void;
}

export const InventoryPage: React.FC<InventoryPageProps> = ({
  warehouses,
  stockSlots: initialStockSlots,
  transfers: initialTransfers,
  onAddTransfer,
  onUpdateTransferStatus,
}) => {
  const { showToast } = useToast();
  const [stockSlots] = useState<WarehouseStockSlot[]>(initialStockSlots);
  const [transfers, setTransfers] = useState<StockTransfer[]>(initialTransfers);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("ALL");
  const [activeView, setActiveView] = useState<"3D" | "2D">("3D");
  const [isTransferDrawerOpen, setIsTransferDrawerOpen] = useState(false);

  // Transfer form state
  const [transferSku, setTransferSku] = useState("SKU-101");
  const [fromWh, setFromWh] = useState("WH-MAIN");
  const [toWh, setToWh] = useState("WH-EAST");
  const [transferQty, setTransferQty] = useState(5);
  const [transferNotes, setTransferNotes] = useState("");

  // KPIs
  const kpis = useMemo(() => {
    const totalUnits = stockSlots.reduce((acc, s) => acc + s.quantity, 0);
    const activeWhCount = warehouses.length;
    const lowStockCount = stockSlots.filter((s) => s.quantity <= s.reorderPoint).length;
    const inTransitCount = transfers.filter((t) => t.status === "In Transit").length;
    return { totalUnits, activeWhCount, lowStockCount, inTransitCount };
  }, [stockSlots, warehouses, transfers]);

  // Filtered stock slots
  const filteredSlots = useMemo(() => {
    if (selectedWarehouse === "ALL") return stockSlots;
    return stockSlots.filter((s) => s.warehouseCode === selectedWarehouse);
  }, [stockSlots, selectedWarehouse]);

  const handleCreateTransfer = () => {
    if (fromWh === toWh) {
      showToast({
        title: "Invalid Transfer",
        description: "Source and destination warehouses cannot be the same.",
        variant: "error",
      });
      return;
    }

    const item = stockSlots.find((s) => s.sku === transferSku);
    const itemName = item ? item.itemName : "Industrial Component";
    const uom = item ? item.uom : "pcs";

    const newTransfer: StockTransfer = {
      id: `trf-${Date.now()}`,
      transferNumber: `TRF-2026-${String(transfers.length + 83).padStart(3, "0")}`,
      sku: transferSku,
      itemName,
      fromWarehouse: fromWh,
      toWarehouse: toWh,
      quantity: Number(transferQty) || 1,
      uom,
      status: "In Transit",
      requestedAt: new Date().toISOString().split("T")[0] || "2026-11-14",
      notes: transferNotes || "Inter-warehouse replenishment",
    };

    setTransfers((prev) => [newTransfer, ...prev]);
    onAddTransfer?.(newTransfer);
    setIsTransferDrawerOpen(false);
    setTransferNotes("");

    showToast({
      title: "Stock Transfer Dispatched",
      description: `${newTransfer.transferNumber}: Dispatched ${newTransfer.quantity} ${newTransfer.uom} of ${newTransfer.sku} from ${newTransfer.fromWarehouse} to ${newTransfer.toWarehouse}.`,
      variant: "success",
    });
  };

  const handleUpdateStatus = (transferId: string, status: "Draft" | "In Transit" | "Completed") => {
    setTransfers((prev) =>
      prev.map((t) => (t.id === transferId ? { ...t, status } : t))
    );
    onUpdateTransferStatus?.(transferId, status);

    showToast({
      title: "Transfer Updated",
      description: `Transfer updated to status: ${status}`,
      variant: "success",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-line">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[11px] font-black uppercase tracking-wider bg-violet text-cream border border-ink">
              INV-01 to INV-05
            </span>
            <span className="text-xs font-bold text-muted">Stock Management & Movement</span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl uppercase tracking-tight text-text mt-1">
            Inventory & Warehouses
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Real-time multi-location warehouse tracking, visual 3D rack allocation, and stock transfers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="lime"
            size="sm"
            onClick={() => setIsTransferDrawerOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Stock Transfer</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-panel border-line p-4 shadow-card">
          <div className="flex items-center justify-between text-muted text-xs font-bold uppercase mb-1">
            <span>Total Units In Stock</span>
            <Boxes className="w-4 h-4 text-violet" />
          </div>
          <p className="font-display font-black text-2xl text-text">{kpis.totalUnits.toLocaleString()}</p>
          <span className="text-[11px] font-bold text-muted">Across 3 facilities</span>
        </div>

        <div className="bg-panel border-line p-4 shadow-card">
          <div className="flex items-center justify-between text-muted text-xs font-bold uppercase mb-1">
            <span>Active Warehouses</span>
            <Warehouse className="w-4 h-4 text-cyan" />
          </div>
          <p className="font-display font-black text-2xl text-text">{kpis.activeWhCount}</p>
          <span className="text-[11px] font-bold text-muted">100% operational</span>
        </div>

        <div className="bg-panel border-line p-4 shadow-card">
          <div className="flex items-center justify-between text-muted text-xs font-bold uppercase mb-1">
            <span>Low Stock Warnings</span>
            <AlertTriangle className="w-4 h-4 text-pink" />
          </div>
          <p className={`font-display font-black text-2xl ${kpis.lowStockCount > 0 ? "text-pink" : "text-good"}`}>
            {kpis.lowStockCount}
          </p>
          <span className="text-[11px] font-bold text-muted">At or below reorder pt</span>
        </div>

        <div className="bg-panel border-line p-4 shadow-card">
          <div className="flex items-center justify-between text-muted text-xs font-bold uppercase mb-1">
            <span>In-Transit Transfers</span>
            <ArrowRightLeft className="w-4 h-4 text-yellow" />
          </div>
          <p className="font-display font-black text-2xl text-text">{kpis.inTransitCount}</p>
          <span className="text-[11px] font-bold text-muted">Inter-facility transfers</span>
        </div>
      </div>

      {/* Warehouse Selector & 3D / 2D View Controls */}
      <div className="bg-panel border-line p-4 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase text-muted">Warehouse:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setSelectedWarehouse("ALL")}
                className={`px-3 py-1 text-xs font-bold border-2 ${
                  selectedWarehouse === "ALL"
                    ? "bg-lime text-ink border-ink shadow-[2px_2px_0_var(--q-ink)]"
                    : "bg-page text-text border-line hover:bg-cream"
                }`}
              >
                All Facilities
              </button>
              {warehouses.map((wh) => (
                <button
                  key={wh.code}
                  onClick={() => setSelectedWarehouse(wh.code)}
                  className={`px-3 py-1 text-xs font-bold border-2 ${
                    selectedWarehouse === wh.code
                      ? "bg-lime text-ink border-ink shadow-[2px_2px_0_var(--q-ink)]"
                      : "bg-page text-text border-line hover:bg-cream"
                  }`}
                >
                  {wh.code} ({wh.name.split(" ")[0]})
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1 bg-page border border-line p-1">
            <button
              onClick={() => setActiveView("3D")}
              aria-pressed={activeView === "3D"}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold border ${
                activeView === "3D"
                  ? "bg-panel text-text border-ink shadow-sm"
                  : "text-muted border-transparent hover:text-text"
              }`}
            >
              <Box className="w-3.5 h-3.5 text-pink" />
              <span>3D Warehouse View</span>
            </button>
            <button
              onClick={() => setActiveView("2D")}
              aria-pressed={activeView === "2D"}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold border ${
                activeView === "2D"
                  ? "bg-panel text-text border-ink shadow-sm"
                  : "text-muted border-transparent hover:text-text"
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-cyan" />
              <span>2D Stock Grid</span>
            </button>
          </div>
        </div>

        {/* 3D Warehouse Scene */}
        {activeView === "3D" ? (
          <div>
            <StockWarehouse3D
              stockSlots={stockSlots}
              selectedWarehouse={selectedWarehouse === "ALL" ? undefined : selectedWarehouse}
            />
          </div>
        ) : (
          /* 2D Multi-Location Stock Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-line bg-page text-muted uppercase font-black text-[10px]">
                  <th className="p-3">SKU</th>
                  <th className="p-3">Item Description</th>
                  <th className="p-3">Warehouse</th>
                  <th className="p-3">Location</th>
                  <th className="p-3 text-right">Stock Qty</th>
                  <th className="p-3 text-right">Reorder Pt</th>
                  <th className="p-3 text-right">Unit Value</th>
                  <th className="p-3 text-right">Total Value</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-medium text-text">
                {filteredSlots.map((slot) => {
                  const isLow = slot.quantity <= slot.reorderPoint;
                  return (
                    <tr key={slot.id} className="hover:bg-cream/40 transition-colors">
                      <td className="p-3 font-mono font-bold text-violet">{slot.sku}</td>
                      <td className="p-3 font-bold">{slot.itemName}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-page border border-line text-[11px] font-bold">
                          {slot.warehouseCode}
                        </span>
                      </td>
                      <td className="p-3 text-muted">
                        Aisle {slot.aisle} · Shelf {slot.shelf}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-sm">
                        {slot.quantity} <span className="text-[10px] text-muted">{slot.uom}</span>
                      </td>
                      <td className="p-3 text-right font-mono text-muted">
                        {slot.reorderPoint} {slot.uom}
                      </td>
                      <td className="p-3 text-right font-mono">{formatMoney(slot.unitValue, "$")}</td>
                      <td className="p-3 text-right font-mono font-black">{formatMoney(slot.totalValue, "$")}</td>
                      <td className="p-3 text-center">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase bg-pink text-panel border border-ink">
                            <AlertTriangle className="w-3 h-3" />
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase bg-good/20 text-good border border-good">
                            <CheckCircle2 className="w-3 h-3" />
                            Adequate
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stock Transfers Section (INV-02) */}
      <div className="bg-panel border-line p-5 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h2 className="font-display font-black text-lg uppercase tracking-tight text-text flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-yellow" />
              <span>Stock Transfers & Movements (INV-02)</span>
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Scheduled and in-transit replenishment orders between warehouses.
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 bg-page border border-line">
            {transfers.length} records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-line bg-page text-muted uppercase font-black text-[10px]">
                <th className="p-3">Transfer #</th>
                <th className="p-3">Date</th>
                <th className="p-3">Item Details</th>
                <th className="p-3">From</th>
                <th className="p-3">To</th>
                <th className="p-3 text-right">Quantity</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3">Notes</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line font-medium text-text">
              {transfers.map((t) => (
                <tr key={t.id} className="hover:bg-cream/40 transition-colors">
                  <td className="p-3 font-mono font-black text-text">{t.transferNumber}</td>
                  <td className="p-3 text-muted">{t.requestedAt}</td>
                  <td className="p-3">
                    <span className="font-mono text-xs font-bold text-violet mr-1.5">{t.sku}</span>
                    <span className="font-bold">{t.itemName}</span>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 bg-page border border-line font-bold text-[11px]">
                      {t.fromWarehouse}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 bg-page border border-line font-bold text-[11px]">
                      {t.toWarehouse}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono font-black text-sm">
                    {t.quantity} <span className="text-[10px] text-muted">{t.uom}</span>
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black uppercase border border-ink ${
                        t.status === "Completed"
                          ? "bg-good text-panel"
                          : t.status === "In Transit"
                          ? "bg-yellow text-panel"
                          : "bg-muted/20 text-muted"
                      }`}
                    >
                      {t.status === "Completed" && <CheckCircle2 className="w-3 h-3" />}
                      {t.status === "In Transit" && <Clock className="w-3 h-3" />}
                      {t.status}
                    </span>
                  </td>
                  <td className="p-3 text-muted text-xs max-w-xs truncate">{t.notes || "—"}</td>
                  <td className="p-3 text-right">
                    {t.status === "In Transit" && (
                      <Button
                        variant="lime"
                        size="sm"
                        onClick={() => handleUpdateStatus(t.id, "Completed")}
                        className="text-[11px] py-1 px-2.5"
                      >
                        Receive Stock
                      </Button>
                    )}
                    {t.status === "Draft" && (
                      <Button
                        variant="yellow"
                        size="sm"
                        onClick={() => handleUpdateStatus(t.id, "In Transit")}
                        className="text-[11px] py-1 px-2.5"
                      >
                        Dispatch
                      </Button>
                    )}
                    {t.status === "Completed" && (
                      <span className="text-[11px] font-bold text-good flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Received
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Stock Transfer Drawer */}
      <Drawer
        isOpen={isTransferDrawerOpen}
        onClose={() => setIsTransferDrawerOpen(false)}
        title="Initiate Stock Transfer (INV-02)"
        description="Allocate inventory and dispatch stock movement between authorized warehouses."
        primaryActionLabel="Dispatch Transfer"
        onPrimaryAction={handleCreateTransfer}
        primaryActionVariant="lime"
      >
        <div className="space-y-4 text-xs font-bold text-text">
          <div>
            <label className="block uppercase text-[10px] text-muted mb-1">Select Item SKU</label>
            <select
              value={transferSku}
              onChange={(e) => setTransferSku(e.target.value)}
              className="w-full p-2.5 bg-page border-line text-text font-mono focus:outline-none focus:border-ink"
            >
              <option value="SKU-101">SKU-101 - Industrial Servo Motor 5kW</option>
              <option value="SKU-102">SKU-102 - Hydraulic Control Valve V2</option>
              <option value="SKU-104">SKU-104 - Titanium Fastener Kit M8</option>
              <option value="SKU-105">SKU-105 - Braided Steel Hydraulic Hose</option>
              <option value="SKU-106">SKU-106 - High-Temp Silicone Sealant</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block uppercase text-[10px] text-muted mb-1">From Facility</label>
              <select
                value={fromWh}
                onChange={(e) => setFromWh(e.target.value)}
                className="w-full p-2.5 bg-page border-line text-text font-bold focus:outline-none focus:border-ink"
              >
                {warehouses.map((wh) => (
                  <option key={wh.code} value={wh.code}>
                    {wh.code} - {wh.city}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block uppercase text-[10px] text-muted mb-1">To Facility</label>
              <select
                value={toWh}
                onChange={(e) => setToWh(e.target.value)}
                className="w-full p-2.5 bg-page border-line text-text font-bold focus:outline-none focus:border-ink"
              >
                {warehouses.map((wh) => (
                  <option key={wh.code} value={wh.code}>
                    {wh.code} - {wh.city}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block uppercase text-[10px] text-muted mb-1">Quantity to Transfer</label>
            <input
              type="number"
              min="1"
              value={transferQty}
              onChange={(e) => setTransferQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full p-2.5 bg-page border-line text-text font-mono font-bold focus:outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="block uppercase text-[10px] text-muted mb-1">Transfer Notes & Reason</label>
            <textarea
              rows={3}
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
              placeholder="e.g. Replenishment for Vanguard aerospace assembly order"
              className="w-full p-2.5 bg-page border-line text-text text-xs focus:outline-none focus:border-ink"
            />
          </div>
        </div>
      </Drawer>
    </div>
  );
};
