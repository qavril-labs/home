import React, { useState, useEffect, useCallback } from "react";
import { StatusChip } from "../../components/ui/StatusChip";
import { Button } from "../../components/ui/Button";
import { useToast } from "../../context/ToastContext";
import { formatMoney } from "../../lib/currency";
import { initialIndustryPacksData } from "../../lib/api-mock";
import type {
  IndustryPacksData,
  GarmentCostSheet,
  GarmentTechPack,
  FmcgExpiryBatch,
  FmcgLabelReport,
} from "../../types";
import {
  RotateCw,
  ShieldCheck,
  Scissors,
  Layers,
  Clock,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

export interface IndustryPacksHubProps {
  onNavigateBack?: () => void;
  onNavigateToApprovals?: () => void;
}

export const IndustryPacksHub: React.FC<IndustryPacksHubProps> = ({
  onNavigateBack,
  onNavigateToApprovals,
}) => {
  const { showToast } = useToast();
  const [packData] = useState<IndustryPacksData>(initialIndustryPacksData);
  const [costSheets, setCostSheets] = useState<GarmentCostSheet[]>(
    initialIndustryPacksData.garmentCostSheets
  );
  const [techPacks, setTechPacks] = useState<GarmentTechPack[]>(
    initialIndustryPacksData.techPacks
  );
  const [fmcgBatches, setFmcgBatches] = useState<FmcgExpiryBatch[]>(
    initialIndustryPacksData.fmcgBatches
  );
  const [labelReports] = useState<FmcgLabelReport[]>(
    initialIndustryPacksData.fmcgLabelReports
  );

  const [activePackTab, setActivePackTab] = useState<
    "gar08" | "gar02" | "fmcg06" | "fmcg12"
  >("gar08");
  const [selectedStyleId, setSelectedStyleId] = useState<string>("CS-2026-801");
  const [selectedTechPackId, setSelectedTechPackId] = useState<string>("TP-ST-402");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const formatCurrentTime = useCallback(() => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }, []);

  useEffect(() => {
    setLastUpdated(formatCurrentTime());
  }, [formatCurrentTime]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastUpdated(formatCurrentTime());
      setIsRefreshing(false);
      showToast("Industry Pack signals & versioned rule sets synced", { type: "success" });
    }, 250);
  };

  const activeCostSheet =
    costSheets.find((c) => c.id === selectedStyleId) || costSheets[0];
  const activeTechPack =
    techPacks.find((t) => t.id === selectedTechPackId) || techPacks[0];
  const activeLabelReport = labelReports[0];

  const handleApproveCostSheet = (sheetId: string) => {
    setCostSheets((prev) =>
      prev.map((cs) => (cs.id === sheetId ? { ...cs, status: "approved" } : cs))
    );
    showToast(
      `Cost sheet ${sheetId} routed to Approvals Inbox (Tier 2)`,
      { type: "success" }
    );
  };

  const handlePromoteTechPack = (tpId: string) => {
    setTechPacks((prev) =>
      prev.map((tp) =>
        tp.id === tpId
          ? { ...tp, readiness: "READY", missingInputs: [], sampleStatus: "Gold Seal Approved" }
          : tp
      )
    );
    showToast(`Tech Pack ${tpId} promoted to Gold Seal Approved`, { type: "success" });
  };

  const handleBatchAction = (batchId: string, nextStatus: "markdown_drafted" | "quarantined") => {
    setFmcgBatches((prev) =>
      prev.map((b) => (b.id === batchId ? { ...b, status: nextStatus } : b))
    );
    if (nextStatus === "markdown_drafted") {
      showToast(
        `25% Trade Markdown scheme (DS-02) drafted for batch ${batchId}`,
        { type: "success" }
      );
    } else {
      showToast(`Batch ${batchId} placed in warehouse quarantine hold`, { type: "warning" });
    }
  };

  return (
    <div className="space-y-6 pb-12" data-testid="industry-packs-page">
      {/* 1. Breadcrumb & Page Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-muted uppercase tracking-wider">
          {onNavigateBack && (
            <>
              <button
                type="button"
                onClick={onNavigateBack}
                className="hover:text-text underline cursor-pointer"
              >
                Dashboard
              </button>
              <span>/</span>
            </>
          )}
          <span className="text-text">Sprint 6 · Industry Pack Bots (GAR &amp; FMCG)</span>
        </div>

        <div className="flex items-center gap-3">
          {onNavigateToApprovals && (
            <Button size="sm" variant="ghost" onClick={onNavigateToApprovals}>
              <span>View Approvals Inbox</span>
            </Button>
          )}
          <span
            data-testid="packs-live-indicator"
            className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-muted bg-panel px-2.5 py-1 border-line"
          >
            <span className="w-2 h-2 rounded-full bg-good animate-pulse" />
            Live · updated {lastUpdated || "00:00:00"}
          </span>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 bg-panel border-line shadow-tile hover:bg-page transition-transform active:translate-y-0.5 cursor-pointer"
            title="Sync Pack SDK & Rule Sets"
            aria-label="Sync Pack SDK"
          >
            <RotateCw className={`w-4 h-4 text-text ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 2. Hero Header Banner */}
      <section
        className="neo-card p-6 bg-panel border-line shadow-card"
        style={{ borderTop: "6px solid var(--q-cyan)" }}
        aria-label="Industry Pack Bots Header"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div
              className="w-16 h-16 flex-shrink-0 flex items-center justify-center border-line shadow-tile"
              style={{ backgroundColor: "var(--q-cyan)" }}
              aria-hidden="true"
            >
              <Sparkles className="w-9 h-9 text-ink" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display font-extrabold text-2xl sm:text-3xl uppercase tracking-tight text-text">
                  Industry Pack Agents
                </h1>
                <span className="text-xs font-mono font-bold uppercase px-2 py-0.5 bg-cyan text-ink border border-ink">
                  TX-01 · TX-02 · DS-01 · DS-02
                </span>
              </div>
              <p className="text-sm text-muted font-medium mt-1">
                Garment Costing &amp; Tech Packs (GAR08, GAR02) · FMCG Shelf-Life FEFO &amp; Regulatory Labelling (FMCG06, FMCG12)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status="good" label="✓ Pack SDK v1.0 Ready" />
            <StatusChip status="watch" label="! 1 Partial Input (ST-519)" />
            <StatusChip status="act" label="● 1 Label Rule Block (FMCG12)" />
          </div>
        </div>

        {/* 4 Summary KPI Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-4 border-t border-grid">
          <div className="bg-page p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              GAR08 · Style ST-402 Mfg Cost
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                {formatMoney("18.45")}
              </span>
              <span className="text-xs font-mono font-bold text-good">READY</span>
            </div>
            <p className="text-[11px] text-muted mt-1">Wholesale: {formatMoney("29.76")} (38% margin)</p>
          </div>

          <div className="bg-page p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              GAR02 · Active Tech Packs
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                {packData.techPacks.length} Styles
              </span>
              <span className="text-xs font-mono font-bold text-cyan">XS–XL Graded</span>
            </div>
            <p className="text-[11px] text-muted mt-1">Gold Seal &amp; PP Sample specs</p>
          </div>

          <div className="bg-page p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              FMCG06 · Near-Expiry Exposure
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                {formatMoney("5880.00")}
              </span>
              <span className="text-xs font-mono font-bold text-watch">2 Batches &lt; 15d</span>
            </div>
            <p className="text-[11px] text-muted mt-1">FEFO dispatch &amp; markdown ready</p>
          </div>

          <div className="bg-page p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              FMCG12 · Label Rule Verdict
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-act">
                1 BLOCK
              </span>
              <span className="text-xs font-mono font-bold text-muted">v4.2 Rules</span>
            </div>
            <p className="text-[11px] text-muted mt-1">EU-1169 allergen bolding check</p>
          </div>
        </div>
      </section>

      {/* 3. Pack Agent Selector Tabs */}
      <section className="neo-card p-6 bg-panel border-line shadow-card space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-grid">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="tab-gar08"
              onClick={() => setActivePackTab("gar08")}
              className={`px-3.5 py-2 text-xs font-bold uppercase border-line flex items-center gap-2 cursor-pointer transition-all ${
                activePackTab === "gar08"
                  ? "bg-lime text-ink shadow-[2px_2px_0_var(--q-ink)]"
                  : "bg-page text-muted hover:text-text"
              }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>GAR08 · Garment Costing (TX-01)</span>
            </button>

            <button
              type="button"
              data-testid="tab-gar02"
              onClick={() => setActivePackTab("gar02")}
              className={`px-3.5 py-2 text-xs font-bold uppercase border-line flex items-center gap-2 cursor-pointer transition-all ${
                activePackTab === "gar02"
                  ? "bg-cyan text-ink shadow-[2px_2px_0_var(--q-ink)]"
                  : "bg-page text-muted hover:text-text"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>GAR02 · Tech Pack Editor (TX-02)</span>
            </button>

            <button
              type="button"
              data-testid="tab-fmcg06"
              onClick={() => setActivePackTab("fmcg06")}
              className={`px-3.5 py-2 text-xs font-bold uppercase border-line flex items-center gap-2 cursor-pointer transition-all ${
                activePackTab === "fmcg06"
                  ? "bg-yellow text-ink shadow-[2px_2px_0_var(--q-ink)]"
                  : "bg-page text-muted hover:text-text"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>FMCG06 · Shelf Life &amp; Expiry (DS-01)</span>
            </button>

            <button
              type="button"
              data-testid="tab-fmcg12"
              onClick={() => setActivePackTab("fmcg12")}
              className={`px-3.5 py-2 text-xs font-bold uppercase border-line flex items-center gap-2 cursor-pointer transition-all ${
                activePackTab === "fmcg12"
                  ? "bg-pink text-ink shadow-[2px_2px_0_var(--q-ink)]"
                  : "bg-page text-muted hover:text-text"
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>FMCG12 · Labelling Check (DS-02)</span>
            </button>
          </div>
        </div>

        {/* TAB 1: GAR08 GARMENT COSTING */}
        {activePackTab === "gar08" && activeCostSheet && (
          <div className="space-y-4" data-testid="panel-gar08">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-page border-line">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 bg-panel border border-ink">
                    {activeCostSheet.styleCode}
                  </span>
                  <h2 className="font-display font-extrabold text-base uppercase text-text">
                    {activeCostSheet.styleName} ({activeCostSheet.season})
                  </h2>
                  <span
                    data-testid="gar08-readiness-badge"
                    className={`text-[11px] font-mono font-bold px-2 py-0.5 border border-ink ${
                      activeCostSheet.readiness === "READY"
                        ? "bg-lime text-ink"
                        : "bg-yellow text-ink"
                    }`}
                  >
                    Readiness: {activeCostSheet.readiness}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1">
                  Formula: <code className="font-mono">cost = Σ(consumption × rate) + SAM × labour rate + overhead</code> · Provenance ID:{" "}
                  <strong className="font-mono text-text">{activeCostSheet.calcId}</strong> · Linked Tech Pack:{" "}
                  <strong className="font-mono text-text">
                    {activeCostSheet.techPackId} ({activeCostSheet.techPackVersion})
                  </strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                {costSheets.map((cs) => (
                  <button
                    key={cs.id}
                    type="button"
                    data-testid={`select-style-${cs.styleCode}`}
                    onClick={() => setSelectedStyleId(cs.id)}
                    className={`px-3 py-1.5 text-xs font-mono font-bold border-line cursor-pointer ${
                      selectedStyleId === cs.id
                        ? "bg-ink text-panel"
                        : "bg-panel text-text hover:bg-page"
                    }`}
                  >
                    {cs.styleCode} ({cs.readiness})
                  </button>
                ))}
              </div>
            </div>

            {activeCostSheet.readiness === "PARTIAL" &&
              activeCostSheet.missingInputs.length > 0 && (
                <div
                  data-testid="gar08-partial-warning"
                  className="p-3 bg-warn/15 border-2 border-warn flex items-start gap-2.5 text-xs font-bold text-text"
                >
                  <AlertTriangle className="w-4 h-4 text-watch flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="uppercase tracking-wider block">
                      PARTIAL DATA READINESS — Bot Never Guesses Missing Rates:
                    </span>
                    <ul className="list-disc list-inside font-medium mt-1">
                      {activeCostSheet.missingInputs.map((mi, i) => (
                        <li key={i}>{mi}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

            {/* Cost Breakdown Table */}
            <div className="overflow-x-auto border-line bg-page">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-ink bg-panel text-[11px] font-bold uppercase tracking-wider text-muted">
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Component / Operation</th>
                    <th className="py-2.5 px-3">Consumption / SAM</th>
                    <th className="py-2.5 px-3 text-right">Approved Rate</th>
                    <th className="py-2.5 px-3 text-right">Line Cost</th>
                    <th className="py-2.5 px-3">Provenance Config</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-grid text-xs">
                  {activeCostSheet.lines.map((line) => (
                    <tr key={line.id} className="hover:bg-panel/60">
                      <td className="py-2.5 px-3 font-bold text-text">{line.category}</td>
                      <td className="py-2.5 px-3 text-text">{line.componentName}</td>
                      <td className="py-2.5 px-3 font-mono">
                        {line.consumptionOrSam} {line.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {formatMoney(line.approvedRate)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-text">
                        {formatMoney(line.lineCost)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-muted">
                        {line.configId} · {line.configVersion}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary & Action Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-page border-line">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted block">
                    Total Mfg Cost
                  </span>
                  <span className="font-display font-black text-lg text-text">
                    {formatMoney(activeCostSheet.totalManufacturingCost)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted block">
                    Suggested FOB (24%)
                  </span>
                  <span className="font-display font-black text-lg text-text">
                    {formatMoney(activeCostSheet.suggestedFobPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted block">
                    Suggested Wholesale ({activeCostSheet.targetMarginPct})
                  </span>
                  <span className="font-display font-black text-lg text-good">
                    {formatMoney(activeCostSheet.suggestedWholesalePrice)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {activeCostSheet.status === "approved" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-good bg-panel px-3 py-1.5 border border-ink">
                    <CheckCircle2 className="w-4 h-4" />
                    Routed to Approvals Inbox
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="lime"
                    onClick={() => handleApproveCostSheet(activeCostSheet.id)}
                    disabled={activeCostSheet.readiness !== "READY"}
                  >
                    <span>Submit Cost Sheet Draft (Tier 2)</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GAR02 TECH PACK EDITOR */}
        {activePackTab === "gar02" && activeTechPack && (
          <div className="space-y-4" data-testid="panel-gar02">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-page border-line">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 bg-panel border border-ink">
                    {activeTechPack.id} ({activeTechPack.version})
                  </span>
                  <h2 className="font-display font-extrabold text-base uppercase text-text">
                    {activeTechPack.styleName}
                  </h2>
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-cyan text-ink border border-ink">
                    {activeTechPack.sampleStatus}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1">
                  Buyer: <strong className="text-text">{activeTechPack.buyerName}</strong> · Fabric Weight:{" "}
                  <strong className="font-mono text-text">{activeTechPack.fabricWeightGsm} GSM</strong> · Standard Allowed Minutes:{" "}
                  <strong className="font-mono text-text">{activeTechPack.samMinutes} SAM</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                {techPacks.map((tp) => (
                  <button
                    key={tp.id}
                    type="button"
                    onClick={() => setSelectedTechPackId(tp.id)}
                    className={`px-3 py-1.5 text-xs font-mono font-bold border-line cursor-pointer ${
                      selectedTechPackId === tp.id
                        ? "bg-ink text-panel"
                        : "bg-panel text-text hover:bg-page"
                    }`}
                  >
                    {tp.styleCode} ({tp.version})
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto border-line bg-page">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-ink bg-panel text-[11px] font-bold uppercase tracking-wider text-muted">
                    <th className="py-2.5 px-3">Item Code</th>
                    <th className="py-2.5 px-3">Material Description &amp; Placement</th>
                    <th className="py-2.5 px-3">Nominated Mill / Supplier</th>
                    <th className="py-2.5 px-3 text-center">XS</th>
                    <th className="py-2.5 px-3 text-center">S</th>
                    <th className="py-2.5 px-3 text-center">M (Base)</th>
                    <th className="py-2.5 px-3 text-center">L</th>
                    <th className="py-2.5 px-3 text-center">XL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-grid text-xs">
                  {activeTechPack.bom.map((row) => (
                    <tr key={row.id} className="hover:bg-panel/60">
                      <td className="py-2.5 px-3 font-mono font-bold text-text">{row.itemCode}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-text">{row.description}</div>
                        <div className="text-[11px] text-muted">{row.placement}</div>
                      </td>
                      <td className="py-2.5 px-3 text-text">{row.supplier}</td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {row.sizeCurveConsumption.XS} {row.unit}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {row.sizeCurveConsumption.S} {row.unit}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold bg-lime/20">
                        {row.sizeCurveConsumption.M} {row.unit}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {row.sizeCurveConsumption.L} {row.unit}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {row.sizeCurveConsumption.XL} {row.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between p-4 bg-page border-line">
              <span className="text-xs text-muted font-medium">
                Size curve consumption feeds directly into <strong className="text-text">GAR08 Garment Costing</strong> and <strong className="text-text">Restock Rex</strong> raw fabric BOM reservations.
              </span>
              <Button
                size="sm"
                variant="cyan"
                onClick={() => handlePromoteTechPack(activeTechPack.id)}
              >
                <span>Lock &amp; Approve Tech Pack Revision</span>
              </Button>
            </div>
          </div>
        )}

        {/* TAB 3: FMCG06 SHELF LIFE & EXPIRY BOARD */}
        {activePackTab === "fmcg06" && (
          <div className="space-y-4" data-testid="panel-fmcg06">
            <div className="p-4 bg-page border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-extrabold text-base uppercase text-text">
                  FMCG06 · Batch Shelf-Life &amp; FEFO Dispatch Priority Board
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Deterministic batch aging evaluated against approved shelf-life policy{" "}
                  <strong className="font-mono text-text">RULE-FMCG06-SL · v2.1</strong>.
                </p>
              </div>
              <StatusChip status="watch" label="! 2 Batches Require FEFO / Clearance Action" />
            </div>

            <div className="overflow-x-auto border-line bg-page">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-ink bg-panel text-[11px] font-bold uppercase tracking-wider text-muted">
                    <th className="py-2.5 px-3">Batch / Lot</th>
                    <th className="py-2.5 px-3">SKU &amp; Product</th>
                    <th className="py-2.5 px-3">Bin</th>
                    <th className="py-2.5 px-3">Expiry Date</th>
                    <th className="py-2.5 px-3 text-right">Days Left</th>
                    <th className="py-2.5 px-3 text-right">Batch Value</th>
                    <th className="py-2.5 px-3">FEFO Policy Recommendation</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-grid text-xs">
                  {fmcgBatches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-panel/60">
                      <td className="py-2.5 px-3 font-mono font-bold text-text">
                        {batch.batchNumber}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-text">{batch.productName}</div>
                        <div className="text-[11px] font-mono text-muted">
                          {batch.sku} · {batch.totalUnits} cases @ {formatMoney(batch.unitValue)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono">{batch.warehouseBin}</td>
                      <td className="py-2.5 px-3 font-mono">{batch.expiryDate}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        <span
                          className={
                            batch.daysRemaining <= 7
                              ? "text-act"
                              : batch.daysRemaining <= 21
                              ? "text-watch"
                              : "text-good"
                          }
                        >
                          {batch.daysRemaining}d
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-text">
                        {formatMoney(batch.totalBatchValue)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-[11px] px-2 py-0.5 bg-panel border border-ink font-bold">
                          {batch.fefoPriority}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {batch.status === "markdown_drafted" ? (
                          <span className="text-[11px] font-bold text-good">
                            ✓ Markdown Drafted
                          </span>
                        ) : batch.status === "quarantined" ? (
                          <span className="text-[11px] font-bold text-act">
                            ● Quarantined
                          </span>
                        ) : batch.daysRemaining <= 7 ? (
                          <Button
                            size="sm"
                            variant="pink"
                            onClick={() => handleBatchAction(batch.id, "quarantined")}
                          >
                            <span>Quarantine Batch</span>
                          </Button>
                        ) : batch.daysRemaining <= 21 ? (
                          <Button
                            size="sm"
                            variant="yellow"
                            onClick={() => handleBatchAction(batch.id, "markdown_drafted")}
                          >
                            <span>Draft 25% Markdown</span>
                          </Button>
                        ) : (
                          <span className="text-[11px] font-mono text-muted">FEFO Active</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: FMCG12 LABELLING CHECK */}
        {activePackTab === "fmcg12" && activeLabelReport && (
          <div className="space-y-4" data-testid="panel-fmcg12">
            <div className="p-4 bg-page border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 bg-panel border border-ink">
                    {activeLabelReport.sku}
                  </span>
                  <h2 className="font-display font-extrabold text-base uppercase text-text">
                    {activeLabelReport.productName} · Artwork {activeLabelReport.artworkVersion}
                  </h2>
                </div>
                <p className="text-xs text-muted mt-1">
                  Evaluated against versioned regulatory rule set{" "}
                  <strong className="font-mono text-text">
                    {activeLabelReport.ruleSetId} ({activeLabelReport.ruleSetVersion})
                  </strong>{" "}
                  — Bot checks approved rules; never invents or reinterprets regulations.
                </p>
              </div>

              <StatusChip
                status={activeLabelReport.overallVerdict === "COMPLIANT" ? "good" : "act"}
                label={
                  activeLabelReport.overallVerdict === "COMPLIANT"
                    ? "✓ Artwork Compliant"
                    : "● NON-COMPLIANT (1 Block)"
                }
              />
            </div>

            <div className="overflow-x-auto border-line bg-page">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-ink bg-panel text-[11px] font-bold uppercase tracking-wider text-muted">
                    <th className="py-2.5 px-3">Rule Code &amp; Jurisdiction</th>
                    <th className="py-2.5 px-3">Check Name</th>
                    <th className="py-2.5 px-3">Extracted Artwork Text</th>
                    <th className="py-2.5 px-3">Mandatory Requirement</th>
                    <th className="py-2.5 px-3">Verdict</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-grid text-xs">
                  {activeLabelReport.checks.map((chk) => (
                    <tr key={chk.id} className="hover:bg-panel/60">
                      <td className="py-3 px-3 align-top">
                        <div className="font-mono font-bold text-text">{chk.ruleCode}</div>
                        <div className="text-[11px] text-muted">
                          {chk.jurisdiction} · {chk.ruleSetVersion}
                        </div>
                        <div className="text-[10px] text-muted mt-0.5">
                          Sign-off: {chk.approvedBy}
                        </div>
                      </td>
                      <td className="py-3 px-3 align-top font-bold text-text">
                        {chk.checkName}
                      </td>
                      <td className="py-3 px-3 align-top font-mono text-[11px] text-text">
                        {chk.extractedText}
                      </td>
                      <td className="py-3 px-3 align-top">
                        <div className="text-text">{chk.expectedRequirement}</div>
                        {chk.remediationNote && (
                          <div className="mt-1 p-1.5 bg-panel border border-ink text-[11px] font-bold text-text">
                            Fix: {chk.remediationNote}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top">
                        <span
                          className={`inline-block font-mono text-[11px] font-bold px-2 py-0.5 border border-ink ${
                            chk.result === "PASS"
                              ? "bg-lime text-ink"
                              : chk.result === "WARN"
                              ? "bg-yellow text-ink"
                              : "bg-pink text-ink"
                          }`}
                        >
                          {chk.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* 4. UAAP Pack Governance Footer */}
      <section className="neo-card p-4 bg-page border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-good flex-shrink-0" />
          <div>
            <span className="font-bold text-text uppercase tracking-wider">
              UAAP Industry Pack SDK Guarantee (F2 / F3):
            </span>{" "}
            <span className="text-muted">
              Every figure cites its ERP transaction or approved configuration version. Missing inputs return PARTIAL or BLOCKED — never hallucinated.
            </span>
          </div>
        </div>
        <span className="font-mono text-[11px] font-bold text-muted whitespace-nowrap">
          PACK-SDK · GAR08 · GAR02 · FMCG06 · FMCG12
        </span>
      </section>
    </div>
  );
};
