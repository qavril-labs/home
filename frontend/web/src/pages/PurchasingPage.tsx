import React, { useState } from "react";
import { Button } from "../components/ui/Button";
import { useToast } from "../context/ToastContext";
import { formatMoney } from "../lib/currency";
import type {
  PurchaseOrder,
  GoodsReceiptNote,
  ThreeWayMatchItem,
  ThreeWayMatchSummary,
  Party,
  ProductItem,
} from "../types";
import {
  ShoppingCart,
  Truck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Plus,
  ArrowRight,
  ShieldCheck,
  PackageCheck,
  ExternalLink,
  Search,
  Filter,
  Check,
  Boxes,
} from "lucide-react";

export interface PurchasingPageProps {
  purchaseOrders: PurchaseOrder[];
  goodsReceiptNotes: GoodsReceiptNote[];
  threeWayMatches: ThreeWayMatchItem[];
  threeWaySummary: ThreeWayMatchSummary;
  suppliers: Party[];
  catalogItems: ProductItem[];
  onAddPurchaseOrder: (po: PurchaseOrder) => void;
  onUpdatePurchaseOrderStatus: (id: string, status: PurchaseOrder["status"]) => void;
  onAddGoodsReceipt: (grn: GoodsReceiptNote) => void;
  onApproveMatchOverride: (matchId: string, note: string) => void;
  onNavigateToPayables?: () => void;
  onNavigateToInventory?: () => void;
  onNavigateToGuardGus?: () => void;
}

export const PurchasingPage: React.FC<PurchasingPageProps> = ({
  purchaseOrders,
  goodsReceiptNotes,
  threeWayMatches,
  threeWaySummary,
  suppliers,
  catalogItems,
  onAddPurchaseOrder,
  onUpdatePurchaseOrderStatus,
  onAddGoodsReceipt,
  onApproveMatchOverride,
  onNavigateToPayables,
  onNavigateToInventory,
  onNavigateToGuardGus,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"matching" | "orders" | "receipts">("matching");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // New PO modal state
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState(suppliers[0]?.id || "CNT-003");
  const [poItemId, setPoItemId] = useState(catalogItems[0]?.id || "ITM-003");
  const [poQuantity, setPoQuantity] = useState("10");
  const [poNotes, setPoNotes] = useState("");

  // Override match modal state
  const [overrideMatch, setOverrideMatch] = useState<ThreeWayMatchItem | null>(null);
  const [overrideNote, setOverrideNote] = useState("Approved minor price/quantity tolerance by Purchasing Lead");

  // New GRN modal state
  const [isGrnModalOpen, setIsGrnModalOpen] = useState(false);
  const [selectedPoIdForGrn, setSelectedPoIdForGrn] = useState(purchaseOrders[0]?.id || "PO-2026-001");
  const [grnCarrier, setGrnCarrier] = useState("FedEx Freight");
  const [grnTracking, setGrnTracking] = useState("FX-9920194");
  const [grnLot, setGrnLot] = useState("LOT-DOCK-2026-99");
  const [grnQty, setGrnQty] = useState("4");

  const handleCreatePo = (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === poSupplierId);
    const item = catalogItems.find((i) => i.id === poItemId);
    const qty = parseInt(poQuantity, 10) || 1;
    const unitPrice = item?.costPrice || item?.unitPrice || "100.00";
    const totalNum = (parseFloat(unitPrice) * qty).toFixed(2);

    const newPoId = `PO-2026-${String(purchaseOrders.length + 1).padStart(3, "0")}`;
    const newPo: PurchaseOrder = {
      id: newPoId,
      supplierId: poSupplierId,
      supplierName: sup?.legalName || sup?.tradeName || "Selected Supplier",
      orderDate: new Date().toISOString().slice(0, 10),
      expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      status: "issued",
      currency: "USD",
      total: totalNum,
      notes: poNotes || "Standard stock replenishment order",
      approvedBy: "Procurement Lead (Alex Chen)",
      lines: [
        {
          id: `pol-${Date.now()}`,
          itemId: poItemId,
          sku: item?.sku || "SKU-GEN",
          description: item?.name || "Stock Item",
          quantityOrdered: qty,
          quantityReceived: 0,
          quantityBilled: 0,
          unitPrice,
          lineTotal: totalNum,
        },
      ],
    };

    onAddPurchaseOrder(newPo);
    setIsPoModalOpen(false);
    showToast(`Purchase Order ${newPoId} created and issued to supplier.`, { type: "success" });
  };

  const handleCreateGrn = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPo = purchaseOrders.find((p) => p.id === selectedPoIdForGrn);
    if (!targetPo || targetPo.lines.length === 0) return;
    const poLine = targetPo.lines[0];
    if (!poLine) return;
    const qtyRec = parseInt(grnQty, 10) || 1;

    const newGrnId = `GRN-2026-${String(goodsReceiptNotes.length + 1).padStart(3, "0")}`;
    const newGrn: GoodsReceiptNote = {
      id: newGrnId,
      poId: targetPo.id,
      poRef: targetPo.id,
      supplierId: targetPo.supplierId,
      supplierName: targetPo.supplierName,
      receiptDate: new Date().toISOString().slice(0, 10),
      receivedBy: "Dock Receiving Team",
      status: "inspected",
      carrier: grnCarrier,
      trackingNumber: grnTracking,
      lines: [
        {
          id: `grnl-${Date.now()}`,
          poLineId: poLine.id,
          sku: poLine.sku,
          description: poLine.description,
          quantityReceived: qtyRec,
          quantityRejected: 0,
          batchLotNumber: grnLot,
          warehouseId: "wh-01",
          warehouseName: "Main Warehouse (Austin)",
        },
      ],
    };

    onAddGoodsReceipt(newGrn);
    onUpdatePurchaseOrderStatus(targetPo.id, qtyRec >= poLine.quantityOrdered ? "received" : "partially_received");
    setIsGrnModalOpen(false);
    showToast(`Dock Goods Receipt ${newGrnId} logged and inspected into Main Warehouse.`, { type: "success" });
  };

  const handleConfirmOverride = () => {
    if (!overrideMatch) return;
    onApproveMatchOverride(overrideMatch.id, overrideNote);
    showToast(`3-Way Match override recorded for ${overrideMatch.poRef}. Bill unlocked for payment.`, {
      type: "success",
    });
    setOverrideMatch(null);
  };

  const filteredMatches = threeWayMatches.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      m.poRef.toLowerCase().includes(q) ||
      m.supplierName.toLowerCase().includes(q) ||
      m.sku.toLowerCase().includes(q) ||
      m.billRef.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "ALL" || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: ThreeWayMatchItem["status"], overrideApproved?: boolean) => {
    if (overrideApproved) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold uppercase border-2 border-ink bg-lime shadow-neo-sm">
          <Check className="w-3.5 h-3.5" />
          Override Approved
        </span>
      );
    }
    switch (status) {
      case "MATCHED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold uppercase border-2 border-ink bg-lime text-ink shadow-neo-sm">
            <CheckCircle2 className="w-3.5 h-3.5" />
            100% Matched
          </span>
        );
      case "PRICE_VARIANCE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold uppercase border-2 border-ink bg-yellow text-ink shadow-neo-sm">
            <AlertTriangle className="w-3.5 h-3.5" />
            Price Variance
          </span>
        );
      case "QUANTITY_VARIANCE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold uppercase border-2 border-ink bg-orange text-ink shadow-neo-sm">
            <AlertTriangle className="w-3.5 h-3.5" />
            Qty Variance
          </span>
        );
      case "UNMATCHED_GRN":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold uppercase border-2 border-ink bg-cyan text-ink shadow-neo-sm">
            <Truck className="w-3.5 h-3.5" />
            Awaiting Bill
          </span>
        );
      case "UNMATCHED_BILL":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold uppercase border-2 border-ink bg-pink text-ink shadow-neo-sm">
            <XCircle className="w-3.5 h-3.5" />
            Unmatched Bill
          </span>
        );
    }
  };

  const getPoStatusBadge = (status: PurchaseOrder["status"]) => {
    const styleMap: Record<PurchaseOrder["status"], string> = {
      draft: "bg-surface-elevated text-muted",
      issued: "bg-cyan text-ink",
      partially_received: "bg-yellow text-ink",
      received: "bg-lime text-ink",
      billed: "bg-violet text-white",
      closed: "bg-surface-elevated text-ink",
      cancelled: "bg-pink text-ink",
    };
    return (
      <span
        className={`px-2 py-0.5 text-xs font-bold uppercase border border-ink shadow-neo-sm ${
          styleMap[status] || "bg-card text-ink"
        }`}
      >
        {status.replace("_", " ")}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="neo-tag bg-yellow text-ink">PRC-01 · PRC-02 · PRC-03</span>
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Procurement & Payables Control
            </span>
          </div>
          <h1 className="font-display font-extrabold text-2xl uppercase tracking-tight flex items-center gap-3">
            <ShoppingCart className="w-7 h-7 text-ink" />
            Purchasing & 3-Way Matching
          </h1>
          <p className="text-sm text-muted">
            Automated verification comparing Purchase Orders (PO), Dock Receipts (GRN), and Vendor Bills (AP).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToInventory && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateToInventory}
              className="flex items-center gap-1.5"
            >
              <Boxes className="w-4 h-4" />
              Warehouse Stock
            </Button>
          )}
          <Button
            variant="yellow"
            size="sm"
            onClick={() => setIsGrnModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Truck className="w-4 h-4" />
            Dock Receipt (GRN)
          </Button>
          <Button
            variant="lime"
            size="sm"
            onClick={() => setIsPoModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            New Purchase Order
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="neo-card p-4 bg-card">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-muted mb-1">
            <span>Purchase Orders</span>
            <ShoppingCart className="w-4 h-4 text-cyan" />
          </div>
          <div className="font-display font-extrabold text-2xl text-ink">
            {purchaseOrders.length}
          </div>
          <div className="text-xs text-muted mt-1 font-mono">
            {purchaseOrders.filter((p) => p.status === "issued" || p.status === "partially_received").length} Active in flight
          </div>
        </div>

        <div className="neo-card p-4 bg-card">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-muted mb-1">
            <span>Dock Receipts (GRN)</span>
            <Truck className="w-4 h-4 text-lime" />
          </div>
          <div className="font-display font-extrabold text-2xl text-ink">
            {goodsReceiptNotes.length}
          </div>
          <div className="text-xs text-muted mt-1 font-mono">
            {goodsReceiptNotes.filter((g) => g.status === "inspected").length} Inspected & Stocked
          </div>
        </div>

        <div className="neo-card p-4 bg-card">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-muted mb-1">
            <span>Match Accuracy</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="font-display font-extrabold text-2xl text-ink">
            {threeWaySummary.matchedCount} / {threeWaySummary.totalItems}
          </div>
          <div className="text-xs text-muted mt-1 font-mono">
            {((threeWaySummary.matchedCount / Math.max(1, threeWaySummary.totalItems)) * 100).toFixed(0)}% Zero Variance
          </div>
        </div>

        <div className="neo-card p-4 bg-card border-l-4 border-yellow">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-muted mb-1">
            <span>Variances Under Review</span>
            <AlertTriangle className="w-4 h-4 text-yellow" />
          </div>
          <div className="font-display font-extrabold text-2xl text-ink">
            ${formatMoney(threeWaySummary.totalValueUnderReview, "")}
          </div>
          <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 font-bold">
            {threeWaySummary.varianceCount} items hold AP payment
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b-2 border-ink gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("matching")}
          className={`px-4 py-2 text-sm font-bold uppercase transition-colors border-t-2 border-x-2 border-ink -mb-[2px] ${
            activeTab === "matching"
              ? "bg-card text-ink shadow-neo-sm font-extrabold"
              : "bg-surface-elevated text-muted hover:text-ink"
          }`}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-lime" />
            3-Way Matching Matrix ({threeWayMatches.length})
          </div>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("orders")}
          className={`px-4 py-2 text-sm font-bold uppercase transition-colors border-t-2 border-x-2 border-ink -mb-[2px] ${
            activeTab === "orders"
              ? "bg-card text-ink shadow-neo-sm font-extrabold"
              : "bg-surface-elevated text-muted hover:text-ink"
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan" />
            Purchase Orders ({purchaseOrders.length})
          </div>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("receipts")}
          className={`px-4 py-2 text-sm font-bold uppercase transition-colors border-t-2 border-x-2 border-ink -mb-[2px] ${
            activeTab === "receipts"
              ? "bg-card text-ink shadow-neo-sm font-extrabold"
              : "bg-surface-elevated text-muted hover:text-ink"
          }`}
        >
          <div className="flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-yellow" />
            Goods Receipts / GRN ({goodsReceiptNotes.length})
          </div>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="neo-card p-3 bg-card flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search PO, GRN, bill or supplier..."
            className="w-full pl-9 pr-3 py-1.5 text-xs font-mono bg-canvas border-2 border-ink shadow-neo-sm focus:outline-none"
          />
        </div>

        {activeTab === "matching" && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-muted" />
            <span className="text-xs font-bold uppercase text-muted">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-bold uppercase bg-canvas border-2 border-ink py-1 px-2 shadow-neo-sm focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="MATCHED">Matched</option>
              <option value="PRICE_VARIANCE">Price Variance</option>
              <option value="QUANTITY_VARIANCE">Quantity Variance</option>
              <option value="UNMATCHED_GRN">Awaiting Bill</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: 3-Way Matching Matrix */}
      {activeTab === "matching" && (
        <div className="neo-card overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-elevated border-b-2 border-ink font-display uppercase tracking-wider text-muted">
                  <th className="p-3">Matched Triad</th>
                  <th className="p-3">Item / SKU</th>
                  <th className="p-3 text-right">PO Order</th>
                  <th className="p-3 text-right">GRN Dock</th>
                  <th className="p-3 text-right">AP Bill</th>
                  <th className="p-3 text-right">Variance</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y border-ink">
                {filteredMatches.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted">
                      No matching records found.
                    </td>
                  </tr>
                ) : (
                  filteredMatches.map((m) => (
                    <tr key={m.id} className="hover:bg-surface-elevated transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-ink font-mono">{m.supplierName}</div>
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted mt-0.5">
                          <span className="text-cyan font-bold">{m.poRef}</span>
                          <span>•</span>
                          <span className="text-lime font-bold">{m.grnRef}</span>
                          <span>•</span>
                          <span className="text-pink font-bold">{m.billRef || "No Bill"}</span>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-ink">{m.description}</div>
                        <div className="text-[11px] font-mono text-muted">{m.sku}</div>
                      </td>

                      <td className="p-3 text-right font-mono">
                        <div className="font-bold text-ink">{m.orderedQty} pcs</div>
                        <div className="text-[11px] text-muted">@ ${formatMoney(m.agreedUnitPrice, "")}</div>
                        <div className="text-[11px] text-muted font-bold">${formatMoney(m.poTotal, "")}</div>
                      </td>

                      <td className="p-3 text-right font-mono">
                        <div className="font-bold text-ink">{m.receivedQty} pcs</div>
                        <div className="text-[11px] text-muted">Dock Inspected</div>
                      </td>

                      <td className="p-3 text-right font-mono">
                        <div className="font-bold text-ink">{m.billedQty} pcs</div>
                        <div className="text-[11px] text-muted">
                          {m.billedUnitPrice !== "0.00" ? `@ $${formatMoney(m.billedUnitPrice, "")}` : "—"}
                        </div>
                        <div className="text-[11px] text-muted font-bold">
                          {m.billTotal !== "0.00" ? `$${formatMoney(m.billTotal, "")}` : "—"}
                        </div>
                      </td>

                      <td className="p-3 text-right font-mono">
                        {m.qtyVariance !== 0 && (
                          <div className="text-orange font-bold">
                            {m.qtyVariance > 0 ? `+${m.qtyVariance} pcs billed` : `${m.qtyVariance} pcs dock`}
                          </div>
                        )}
                        {m.priceVariance !== "0.00" && (
                          <div className="text-yellow-600 dark:text-yellow-400 font-bold">
                            +${formatMoney(m.priceVariance, "")} unit diff
                          </div>
                        )}
                        {m.qtyVariance === 0 && m.priceVariance === "0.00" && (
                          <div className="text-emerald-500 font-bold">$0.00 diff</div>
                        )}
                      </td>

                      <td className="p-3 text-center">{getStatusBadge(m.status, m.overrideApproved)}</td>

                      <td className="p-3 text-right">
                        {m.status === "MATCHED" || m.overrideApproved ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (onNavigateToPayables) onNavigateToPayables();
                              else showToast("Bill is released and ready in AP Bills module.", { type: "info" });
                            }}
                            className="neo-btn bg-lime text-ink text-xs uppercase font-bold py-1 px-2.5 flex items-center gap-1 ml-auto"
                          >
                            Release AP
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setOverrideMatch(m)}
                              className="neo-btn bg-yellow text-ink text-xs uppercase font-bold py-1 px-2"
                            >
                              Review & Override
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-surface-elevated border-t-2 border-ink flex flex-col md:flex-row items-center justify-between text-xs text-muted gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-lime" />
              <span>
                Guard Gus Anomaly Sentinel actively cross-checks AP payment queues against dock GRNs.
              </span>
            </div>
            {onNavigateToGuardGus && (
              <button
                type="button"
                onClick={onNavigateToGuardGus}
                className="font-bold text-ink underline uppercase flex items-center gap-1"
              >
                Inspect Guard Gus (AI-04)
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Purchase Orders */}
      {activeTab === "orders" && (
        <div className="neo-card overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-elevated border-b-2 border-ink font-display uppercase tracking-wider text-muted">
                  <th className="p-3">PO Reference</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3">Order Date</th>
                  <th className="p-3">Expected Dock</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Total Amount</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y border-ink font-mono">
                {purchaseOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-surface-elevated transition-colors">
                    <td className="p-3 font-bold text-ink">{po.id}</td>
                    <td className="p-3 font-sans font-medium text-ink">{po.supplierName}</td>
                    <td className="p-3 text-muted">{po.orderDate}</td>
                    <td className="p-3 text-muted">{po.expectedDeliveryDate}</td>
                    <td className="p-3">{getPoStatusBadge(po.status)}</td>
                    <td className="p-3 text-right font-bold text-ink">${formatMoney(po.total, "")}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPoIdForGrn(po.id);
                          setIsGrnModalOpen(true);
                        }}
                        className="neo-btn bg-surface-elevated text-ink text-xs uppercase font-bold py-1 px-2.5 hover:bg-yellow"
                      >
                        Receive to Dock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Goods Receipts / GRN */}
      {activeTab === "receipts" && (
        <div className="neo-card overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-elevated border-b-2 border-ink font-display uppercase tracking-wider text-muted">
                  <th className="p-3">GRN Number</th>
                  <th className="p-3">Linked PO</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3">Carrier / Tracking</th>
                  <th className="p-3">Receipt Date</th>
                  <th className="p-3">Warehouse & Lot</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y border-ink font-mono">
                {goodsReceiptNotes.map((grn) => (
                  <tr key={grn.id} className="hover:bg-surface-elevated transition-colors">
                    <td className="p-3 font-bold text-ink">{grn.id}</td>
                    <td className="p-3 text-cyan font-bold">{grn.poRef}</td>
                    <td className="p-3 font-sans font-medium text-ink">{grn.supplierName}</td>
                    <td className="p-3 text-muted">
                      {grn.carrier} ({grn.trackingNumber})
                    </td>
                    <td className="p-3 text-muted">{grn.receiptDate}</td>
                    <td className="p-3">
                      <div className="font-sans font-bold text-ink">
                        {grn.lines[0]?.warehouseName || "Main Warehouse"}
                      </div>
                      <div className="text-[11px] text-muted">
                        Lot: {grn.lines[0]?.batchLotNumber || "N/A"}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 text-xs font-bold uppercase border border-ink bg-lime text-ink shadow-neo-sm">
                        {grn.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: New Purchase Order */}
      {isPoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className="neo-card bg-card p-6 max-w-lg w-full border-[3px] border-ink shadow-neo">
            <h2 className="font-display font-extrabold text-xl uppercase mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-cyan" />
              Create Purchase Order (PRC-01)
            </h2>
            <form onSubmit={handleCreatePo} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-1">Supplier</label>
                <select
                  value={poSupplierId}
                  onChange={(e) => setPoSupplierId(e.target.value)}
                  className="w-full text-xs font-mono bg-canvas border-2 border-ink p-2 shadow-neo-sm"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.legalName || s.tradeName || s.id} ({s.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase mb-1">Catalog Item</label>
                <select
                  value={poItemId}
                  onChange={(e) => setPoItemId(e.target.value)}
                  className="w-full text-xs font-mono bg-canvas border-2 border-ink p-2 shadow-neo-sm"
                >
                  {catalogItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku} - {item.name} (${item.costPrice || item.unitPrice})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase mb-1">Order Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={poQuantity}
                  onChange={(e) => setPoQuantity(e.target.value)}
                  className="w-full text-xs font-mono bg-canvas border-2 border-ink p-2 shadow-neo-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase mb-1">Order Notes / Certifications</label>
                <input
                  type="text"
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="e.g. Mill Cert 3.1, Aerospace spec..."
                  className="w-full text-xs font-mono bg-canvas border-2 border-ink p-2 shadow-neo-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t-2 border-ink">
                <Button variant="ghost" size="sm" onClick={() => setIsPoModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="lime" size="sm" type="submit">
                  Issue Purchase Order
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Goods Receipt Dock Logging */}
      {isGrnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className="neo-card bg-card p-6 max-w-lg w-full border-[3px] border-ink shadow-neo">
            <h2 className="font-display font-extrabold text-xl uppercase mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-yellow" />
              Dock Goods Receipt (PRC-02)
            </h2>
            <form onSubmit={handleCreateGrn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-1">Target Purchase Order</label>
                <select
                  value={selectedPoIdForGrn}
                  onChange={(e) => setSelectedPoIdForGrn(e.target.value)}
                  className="w-full text-xs font-mono bg-canvas border-2 border-ink p-2 shadow-neo-sm"
                >
                  {purchaseOrders.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.id} - {po.supplierName} (${po.total})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase mb-1">Carrier</label>
                  <input
                    type="text"
                    value={grnCarrier}
                    onChange={(e) => setGrnCarrier(e.target.value)}
                    className="w-full text-xs font-mono bg-canvas border-2 border-ink p-2 shadow-neo-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-1">Tracking Number</label>
                  <input
                    type="text"
                    value={grnTracking}
                    onChange={(e) => setGrnTracking(e.target.value)}
                    className="w-full text-xs font-mono bg-canvas border-2 border-ink p-2 shadow-neo-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase mb-1">Batch / Heat / Lot</label>
                  <input
                    type="text"
                    value={grnLot}
                    onChange={(e) => setGrnLot(e.target.value)}
                    className="w-full text-xs font-mono bg-canvas border-2 border-ink p-2 shadow-neo-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-1">Dock Received Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={grnQty}
                    onChange={(e) => setGrnQty(e.target.value)}
                    className="w-full text-xs font-mono bg-canvas border-2 border-ink p-2 shadow-neo-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t-2 border-ink">
                <Button variant="ghost" size="sm" onClick={() => setIsGrnModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="lime" size="sm" type="submit">
                  Log Dock Receipt
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Override 3-Way Match Variance */}
      {overrideMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className="neo-card bg-card p-6 max-w-lg w-full border-[3px] border-ink shadow-neo">
            <h2 className="font-display font-extrabold text-xl uppercase mb-2 flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="w-5 h-5" />
              Override 3-Way Match Variance
            </h2>
            <p className="text-xs text-muted mb-4">
              Releasing this bill allows AP disbursement. An audit log entry will be permanently linked to{" "}
              <span className="font-mono font-bold text-ink">{overrideMatch.poRef}</span> and{" "}
              <span className="font-mono font-bold text-ink">{overrideMatch.billRef}</span>.
            </p>

            <div className="p-3 bg-surface-elevated border-2 border-ink mb-4 font-mono text-xs space-y-1">
              <div>Supplier: {overrideMatch.supplierName}</div>
              <div>SKU: {overrideMatch.sku} - {overrideMatch.description}</div>
              <div className="text-yellow-600 font-bold">
                Price Diff: ${overrideMatch.priceVariance} | Qty Diff: {overrideMatch.qtyVariance} pcs
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold uppercase mb-1">Justification / Approval Memo</label>
              <textarea
                value={overrideNote}
                onChange={(e) => setOverrideNote(e.target.value)}
                rows={3}
                className="w-full text-xs font-mono bg-canvas border-2 border-ink p-2 shadow-neo-sm"
              />
            </div>

            <div className="flex justify-end gap-2 border-t-2 border-ink pt-3">
              <Button variant="ghost" size="sm" onClick={() => setOverrideMatch(null)}>
                Cancel
              </Button>
              <Button variant="yellow" size="sm" onClick={handleConfirmOverride} className="text-ink">
                Approve & Unlock Bill
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
