import React, { useState, useEffect, useCallback } from "react";
import { StatusChip } from "../../components/ui/StatusChip";
import { Button } from "../../components/ui/Button";
import { CreatePODrawer } from "./CreatePODrawer";
import { useToast } from "../../context/ToastContext";
import { formatMoney } from "../../lib/currency";
import {
  initialRestockRexData,
  initialReplenishmentItems,
  initialDraftPO,
} from "../../lib/api-mock";
import type {
  RestockRexData,
  StockReplenishmentItem,
  DraftPurchaseOrder,
} from "../../types";
import {
  Power,
  RotateCw,
  AlertTriangle,
  ShoppingCart,
  Boxes,
  ShieldCheck,
  Layers,
} from "lucide-react";

export interface RestockRexProps {
  onNavigateBack?: () => void;
  onNavigateToApprovals?: () => void;
}

export const RestockRex: React.FC<RestockRexProps> = ({
  onNavigateBack,
}) => {
  const { showToast } = useToast();

  // State
  const [data] = useState<RestockRexData>(initialRestockRexData);
  const [items] = useState<StockReplenishmentItem[]>(initialReplenishmentItems);
  const [draftPO, setDraftPO] = useState<DraftPurchaseOrder | null>(initialDraftPO);
  const [isKillSwitchActive, setIsKillSwitchActive] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"reorder" | "all" | "warehouse">("reorder");
  const [isPODrawerOpen, setIsPODrawerOpen] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLiveApi, setIsLiveApi] = useState<boolean>(false);

  // Sync / Refresh
  const fetchBotInsights = useCallback(async () => {
    setIsLoading(true);
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    try {
      const apiBase = (window as any).ERP_CONFIG?.apiBase || "http://localhost:3002";
      const res = await fetch(`${apiBase}/v1/workspace/insights`, {
        headers: { "Content-Type": "application/json" },
      }).catch(() => null);

      if (res && res.ok) {
        setIsLiveApi(true);
      } else {
        setIsLiveApi(false);
      }
    } catch {
      setIsLiveApi(false);
    } finally {
      setIsLoading(false);
      setLastUpdated(timeStr);
    }
  }, []);

  useEffect(() => {
    fetchBotInsights();
  }, [fetchBotInsights]);

  // Kill Switch Toggle
  const handleToggleKillSwitch = () => {
    const nextState = !isKillSwitchActive;
    setIsKillSwitchActive(nextState);

    showToast(
      nextState
        ? "Restock Rex resumed: Inventory reorder analysis and purchase order drafting are active."
        : "Restock Rex kill switch engaged: Automated replenishment evaluations and PO drafts are suspended.",
      { type: nextState ? "success" : "warning" }
    );
  };

  // Submit PO Draft to Approvals Inbox
  const handleSubmitForApproval = (poId: string) => {
    if (draftPO) {
      setDraftPO({ ...draftPO, status: "submitted" });
    }
    setIsPODrawerOpen(false);

    showToast(
      `Purchase Order ${poId} submitted to Approvals Inbox (PLT-07) for Dual-Control sign-off.`,
      {
        type: "success",
        undoAction: () => {
          if (draftPO) {
            setDraftPO({ ...draftPO, status: "draft" });
          }
          showToast(`Reversed submission of ${poId}. Returned to draft.`, {
            type: "info",
          });
        },
      }
    );
  };

  const lowStockItems = items.filter((i) => i.status === "low_stock");
  const stockoutItems = items.filter((i) => i.status === "stockout");
  const displayedItems =
    activeTab === "reorder"
      ? items.filter((i) => i.status !== "healthy")
      : items;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Breadcrumbs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onNavigateBack && (
            <button
              type="button"
              onClick={onNavigateBack}
              className="text-xs font-bold text-muted hover:text-text flex items-center gap-1 transition-colors"
            >
              ← Back to Dashboard
            </button>
          )}
          <span className="text-muted text-xs">/</span>
          <span className="text-xs font-mono font-bold text-muted uppercase">
            Agents & Automated Bots
          </span>
          <span className="text-muted text-xs">/</span>
          <span className="text-xs font-bold text-text">Restock Rex (AGT-04)</span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold border-line ${
              isLiveApi ? "bg-lime text-ink" : "bg-cream text-ink"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLiveApi ? "bg-good" : "bg-watch"}`} />
            {isLiveApi ? "API Connected" : "Mock Fixture"}
          </span>
          <span className="text-xs font-mono font-bold text-muted">
            Agent Card: AGT-04 · INV-05
          </span>
        </div>
      </div>

      {/* 2. Bot Header with Rex Avatar, Role, Kill Switch, and Live Pulse */}
      <section
        className="neo-card p-6 bg-panel border-line shadow-card"
        aria-label="Restock Rex Agent Header"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Avatar & Identity */}
          <div className="flex items-start sm:items-center gap-4">
            {/* Avatar strictly following design/tokens.json: bot.restock-rex (orange token #ff8a3d) */}
            <div className="w-16 h-16 bg-orange text-ink border-line shadow-[3px_3px_0_var(--q-ink)] flex items-center justify-center select-none flex-shrink-0 relative">
              <svg className="w-12 h-12" viewBox="0 0 80 80" aria-hidden="true">
                <line x1="40" y1="8" x2="40" y2="16" stroke="var(--q-ink)" strokeWidth="3" />
                <rect x="36" y="5" width="8" height="8" rx="2" fill="var(--q-yellow)" stroke="var(--q-ink)" strokeWidth="2" />
                <rect x="16" y="16" width="48" height="40" rx="6" fill="var(--q-orange)" stroke="var(--q-ink)" strokeWidth="3" />
                <circle cx="32" cy="34" r="5" fill="var(--q-ink)" />
                <circle cx="48" cy="34" r="5" fill="var(--q-ink)" />
                <path d="M30 46 H50" stroke="var(--q-ink)" strokeWidth="3" strokeLinecap="round" />
                <rect x="22" y="58" width="36" height="14" rx="4" fill="var(--q-lime)" stroke="var(--q-ink)" strokeWidth="3" />
              </svg>
              {isKillSwitchActive && (
                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-good rounded-full border-2 border-ink" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="font-display font-extrabold text-2xl sm:text-3xl uppercase tracking-tight text-text leading-tight">
                  Restock Rex
                </h1>
                <span className="px-2 py-0.5 bg-orange/20 border border-orange text-[11px] font-bold text-ink uppercase tracking-wider">
                  Inventory Replenisher
                </span>
                <span className="px-1.5 py-0.5 bg-page border border-grid text-[10px] font-mono text-muted">
                  AGT-04 / INV-05
                </span>
              </div>

              <p className="text-xs sm:text-sm text-muted max-w-2xl leading-normal">
                Continuous replenishment sentinel: calculates dynamic reorder points, tracks supplier lead time variances, automates multi-line PO drafting, and prevents factory production stockouts.
              </p>
            </div>
          </div>

          {/* Right: Kill Switch & Live Indicator */}
          <div className="flex flex-wrap lg:flex-col items-start lg:items-end justify-between gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 border-grid">
            <div className="flex items-center gap-2 bg-page px-3 py-1.5 border-line shadow-sm">
              <span
                className={`w-2 h-2 rounded-full ${
                  isKillSwitchActive ? "bg-good animate-ping" : "bg-watch"
                }`}
              />
              <span className="text-xs font-bold text-text">
                Live · updated {lastUpdated || "just now"}
              </span>
              <button
                type="button"
                onClick={fetchBotInsights}
                disabled={isLoading}
                title="Sync from API"
                className="ml-1 text-muted hover:text-text disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold text-muted uppercase tracking-wider">
                Kill Switch:
              </span>
              <button
                type="button"
                onClick={handleToggleKillSwitch}
                aria-pressed={isKillSwitchActive}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold border-line shadow-[2px_2px_0_var(--q-ink)] transition-transform active:translate-y-0.5 ${
                  isKillSwitchActive
                    ? "bg-lime text-ink hover:bg-lime/90"
                    : "bg-act text-white hover:bg-act/90"
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{isKillSwitchActive ? "ACTIVE (ON)" : "OFF (SUSPENDED)"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Kill Switch Alert Banner when suspended */}
        {!isKillSwitchActive && (
          <div className="mt-4 p-3 bg-cream border-line flex items-center gap-3 text-xs text-ink font-semibold shadow-sm">
            <AlertTriangle className="w-4 h-4 text-act flex-shrink-0" />
            <span>
              Kill switch is engaged. Automated inventory consumption audits, safety reorder calculations, and PO proposal drafts are paused.
            </span>
          </div>
        )}
      </section>

      {/* 3. StatusChip Display Section */}
      <section
        className="neo-card p-4 bg-page border-line shadow-card"
        aria-label="Restock Rex Status Overview"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-2 border-b border-grid">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
              Live Replenishment & Stock Levels
            </h2>
            <p className="text-xs text-text font-medium mt-0.5">
              Monitoring shop floor raw materials and standard cutting tool inventories.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusChip
              status={lowStockItems.length > 0 ? "watch" : "good"}
              label={
                lowStockItems.length > 0
                  ? `! ${lowStockItems.length} items below reorder point`
                  : "✓ Stock healthy"
              }
            />

            <StatusChip
              status={stockoutItems.length > 0 ? "act" : "good"}
              label={
                stockoutItems.length > 0
                  ? `! ${stockoutItems.length} critical stockout`
                  : "✓ Zero stockouts"
              }
            />

            <StatusChip
              status={draftPO?.status === "draft" ? "watch" : "good"}
              label={
                draftPO?.status === "draft"
                  ? "● 1 PO draft pending approval"
                  : "✓ 0 drafts pending"
              }
            />
          </div>
        </div>

        {/* 4 Mini KPI Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              Items Below Safety Reorder
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                {lowStockItems.length} SKUs
              </span>
              <span className="text-xs font-mono font-bold text-watch">Action Required</span>
            </div>
            <p className="text-[11px] text-muted mt-1">Aluminum, coolant & fasteners</p>
          </div>

          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              Critical Zero-Stock Items
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                {stockoutItems.length} SKU
              </span>
              <span className="text-xs font-mono font-bold text-act">Zero Units</span>
            </div>
            <p className="text-[11px] text-muted mt-1">Titanium Grade 5 Billet</p>
          </div>

          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              Draft PO Commitment
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                {formatMoney(data.pendingDraftTotal)}
              </span>
              <span className="text-xs font-mono font-bold text-orange">3 Lines Queued</span>
            </div>
            <p className="text-[11px] text-muted mt-1">PO-2026-004 to Industrial Supply</p>
          </div>

          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              Average Supplier Lead Time
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                {data.avgLeadDays} Days
              </span>
              <span className="text-xs font-mono font-bold text-good">Within Buffer</span>
            </div>
            <p className="text-[11px] text-muted mt-1">Express supplier delivery verified</p>
          </div>
        </div>
      </section>

      {/* 4. Sub-Tabs & Inventory Replenishment Table */}
      <section
        className="neo-card p-4 bg-panel border-line shadow-card space-y-4"
        aria-label="Replenishment Schedule"
      >
        {/* Sub-tab selection */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-grid">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("reorder")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border-line transition-all ${
                activeTab === "reorder"
                  ? "bg-orange text-ink shadow-[2px_2px_0_var(--q-ink)]"
                  : "bg-page text-muted hover:text-text hover:bg-page/80"
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Reorder Queue ({items.filter((i) => i.status !== "healthy").length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border-line transition-all ${
                activeTab === "all"
                  ? "bg-orange text-ink shadow-[2px_2px_0_var(--q-ink)]"
                  : "bg-page text-muted hover:text-text hover:bg-page/80"
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>All Stock Levels ({items.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("warehouse")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border-line transition-all ${
                activeTab === "warehouse"
                  ? "bg-orange text-ink shadow-[2px_2px_0_var(--q-ink)]"
                  : "bg-page text-muted hover:text-text hover:bg-page/80"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>2D Warehouse Bin Map</span>
            </button>
          </div>

          {draftPO && (
            <Button
              variant="yellow"
              size="sm"
              onClick={() => setIsPODrawerOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Review PO-2026-004 ({formatMoney(draftPO.totalAmount)})</span>
            </Button>
          )}
        </div>

        {/* Tab Content: Inventory Table (Tabs 'reorder' & 'all') */}
        {activeTab !== "warehouse" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-line bg-page text-muted uppercase text-[10px] tracking-wider font-bold">
                  <th className="py-2.5 px-3">Item Name & SKU</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Stock vs Reorder Threshold</th>
                  <th className="py-2.5 px-3 text-center">Suggested PO Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Cost</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grid">
                {displayedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-page/70 transition-colors">
                    {/* Item Name & SKU */}
                    <td className="py-3 px-3 align-top">
                      <div className="font-bold text-sm text-text leading-tight">
                        {item.name}
                      </div>
                      <div className="font-mono text-xs text-muted mt-0.5">
                        {item.sku}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-3 align-top font-semibold text-text">
                      <span className="px-2 py-0.5 bg-page border border-grid text-[11px]">
                        {item.category}
                      </span>
                    </td>

                    {/* Stock vs Reorder Bar */}
                    <td className="py-3 px-3 align-top">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-mono font-bold text-text">
                          {item.currentStock} {item.unit}
                        </span>
                        <span className="text-[11px] text-muted">
                          Reorder Point: {item.reorderPoint} {item.unit}
                        </span>
                      </div>
                      <div className="w-full bg-page border-line h-2.5 overflow-hidden">
                        <div
                          className={`h-full ${
                            item.status === "stockout"
                              ? "bg-act w-0"
                              : item.status === "low_stock"
                              ? "bg-watch w-1/3"
                              : "bg-good w-4/5"
                          }`}
                        />
                      </div>
                    </td>

                    {/* Suggested PO Qty */}
                    <td className="py-3 px-3 align-top text-center">
                      {item.suggestedReorder > 0 ? (
                        <span className="px-2 py-0.5 bg-orange/20 border border-orange font-mono font-bold text-xs text-ink">
                          +{item.suggestedReorder} {item.unit}
                        </span>
                      ) : (
                        <span className="text-muted text-xs">Adequate</span>
                      )}
                    </td>

                    {/* Unit Cost */}
                    <td className="py-3 px-3 align-top font-mono font-bold text-right text-xs text-text">
                      {formatMoney(item.unitCost)}
                    </td>

                    {/* Action Button */}
                    <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                      {item.suggestedReorder > 0 ? (
                        <Button
                          size="sm"
                          variant="yellow"
                          onClick={() => setIsPODrawerOpen(true)}
                          className="text-xs py-1 px-2.5 font-bold"
                        >
                          <span>Draft PO</span>
                        </Button>
                      ) : (
                        <span className="text-[11px] text-muted">In Stock</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab Content: 2D Warehouse Bin Map */}
        {activeTab === "warehouse" && (
          <div className="space-y-4">
            <div className="p-3 bg-page border-line flex items-center justify-between text-xs">
              <span className="text-muted font-medium">
                Warehouse 2D Location Map: Zone A (Metals), Zone B (Consumables), Zone C (Fasteners).
              </span>
              <span className="font-mono font-bold text-good">
                5 Active Bin Locations
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { bin: "BIN-A01", item: "6061-T6 Aluminum", stock: "4 / 12m", status: "low_stock" },
                { bin: "BIN-A02", item: "Titanium Billet", stock: "0 / 5 units", status: "stockout" },
                { bin: "BIN-B01", item: "Synthetic Coolant", stock: "1 / 4 drums", status: "low_stock" },
                { bin: "BIN-B02", item: "Carbide End Mills", stock: "18 / 10 pcs", status: "healthy" },
                { bin: "BIN-C01", item: "Hex Bolts M6", stock: "8 / 25 pks", status: "low_stock" },
              ].map((bin, idx) => (
                <div
                  key={idx}
                  className={`p-3 border-line ${
                    bin.status === "stockout"
                      ? "bg-act/10 border-act"
                      : bin.status === "low_stock"
                      ? "bg-yellow/15 border-yellow"
                      : "bg-lime/15 border-lime"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono font-bold mb-1">
                    <span>{bin.bin}</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        bin.status === "stockout"
                          ? "bg-act"
                          : bin.status === "low_stock"
                          ? "bg-watch"
                          : "bg-good"
                      }`}
                    />
                  </div>
                  <h4 className="font-bold text-xs text-text">{bin.item}</h4>
                  <p className="font-mono text-[11px] text-muted mt-1">{bin.stock}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 5. Activity Log & Guardrails */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Rex Activity Feed */}
        <div className="lg:col-span-7 neo-card p-4 bg-panel border-line shadow-card">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-grid">
            <div>
              <h3 className="font-display font-extrabold text-sm uppercase tracking-tight text-text">
                Rex Stock Activity Stream
              </h3>
              <p className="text-[11px] text-muted">
                Audit trail of inventory consumption events and safety reorder trigger evaluations.
              </p>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-page border border-grid text-muted">
              Live Monitoring
            </span>
          </div>

          <div className="space-y-2">
            {[
              {
                time: "08:15",
                event: "Daily stock consumption calculation",
                result: "3 SKUs dropped below target safety reorder thresholds",
                type: "watch",
              },
              {
                time: "08:30",
                event: "Purchase order PO-2026-004 generated",
                result: "Prepared $3,417.50 order for Industrial Supply Co.",
                type: "good",
              },
              {
                time: "10:10",
                event: "Supplier lead time variance check",
                result: "Industrial Supply Co. delivery reliability rated 98.4%",
                type: "good",
              },
            ].map((feed, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-2.5 bg-page border-line text-xs hover:bg-page/80 transition-colors"
              >
                <span className="font-mono font-bold text-muted text-[11px] px-1.5 py-0.5 bg-panel border border-grid flex-shrink-0">
                  {feed.time}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-text truncate">{feed.event}</p>
                  <p className="text-[11px] text-muted mt-0.5">{feed.result}</p>
                </div>
                <span
                  className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    feed.type === "good" ? "bg-good" : "bg-watch"
                  }`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Agent Guardrails Card */}
        <div className="lg:col-span-5 neo-card p-4 bg-panel border-line shadow-card space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-grid">
            <ShieldCheck className="w-4 h-4 text-good" />
            <h3 className="font-display font-extrabold text-sm uppercase tracking-tight text-text">
              Agent Guardrails (AGT-04)
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-page border-line">
              <span className="font-bold text-text block mb-0.5">Non-Autonomous PO Dispatch</span>
              <p className="text-[11px] text-muted leading-relaxed">
                Rex drafts purchase orders but cannot place them directly with suppliers. Orders require Tier 3 supervisor sign-off in the Approvals Inbox.
              </p>
            </div>

            <div className="p-2.5 bg-page border-line">
              <span className="font-bold text-text block mb-0.5">Design Token Conformance</span>
              <p className="text-[11px] text-muted leading-relaxed">
                Rex strictly uses <code className="font-bold">var(--q-orange)</code> (orange design token) for avatar and interface accents per <code>tokens.json</code>.
              </p>
            </div>

            <div className="p-2.5 bg-page border-line">
              <span className="font-bold text-text block mb-0.5">Lead-Time Safety Buffering</span>
              <p className="text-[11px] text-muted leading-relaxed">
                Reorder calculations incorporate standard deviation buffer days to absorb carrier freight delays.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Purchase Order Review Drawer */}
      <CreatePODrawer
        isOpen={isPODrawerOpen}
        onClose={() => setIsPODrawerOpen(false)}
        draftPO={draftPO}
        onSubmitForApproval={handleSubmitForApproval}
      />
    </div>
  );
};

export default RestockRex;
