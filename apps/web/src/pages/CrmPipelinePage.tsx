import React, { useState, useMemo } from "react";
import { Button } from "../components/ui/Button";
import { Drawer } from "../components/ui/Drawer";
import { PipelineFunnel3D } from "../scenes/PipelineFunnel3D";
import { useToast } from "../context/ToastContext";
import { formatMoney } from "../lib/currency";
import type { PipelineDeal, DealStage, SalesQuote, Invoice } from "../types";
import {
  TrendingUp,
  DollarSign,
  Award,
  Plus,
  Send,
  CheckCircle2,
  Filter,
  FileText,
  Clock,
  ArrowRight,
  Sliders,
  Box,
} from "lucide-react";

export interface CrmPipelinePageProps {
  deals: PipelineDeal[];
  quotes: SalesQuote[];
  onAddDeal?: (deal: PipelineDeal) => void;
  onUpdateDealStage?: (dealId: string, stage: DealStage) => void;
  onAddQuote?: (quote: SalesQuote) => void;
  onUpdateQuoteStatus?: (quoteId: string, status: "Draft" | "Sent" | "Accepted" | "Expired") => void;
  onConvertToInvoice?: (invoice: Invoice) => void;
}

const STAGES: DealStage[] = ["Lead", "Discovery", "Proposal", "Negotiation", "Closed Won"];

export const CrmPipelinePage: React.FC<CrmPipelinePageProps> = ({
  deals: initialDeals,
  quotes: initialQuotes,
  onAddDeal,
  onUpdateDealStage,
  onAddQuote,
  onUpdateQuoteStatus,
  onConvertToInvoice,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"pipeline" | "quotes">("pipeline");
  const [activeView, setActiveView] = useState<"3D" | "2D">("3D");
  const [deals, setDeals] = useState<PipelineDeal[]>(initialDeals);
  const [quotes, setQuotes] = useState<SalesQuote[]>(initialQuotes);
  const [selectedStageFilter, setSelectedStageFilter] = useState<DealStage | "ALL">("ALL");

  // Deal Drawer State
  const [isDealDrawerOpen, setIsDealDrawerOpen] = useState(false);
  const [dealTitle, setDealTitle] = useState("");
  const [dealCustomer, setDealCustomer] = useState("");
  const [dealContact, setDealContact] = useState("");
  const [dealAmount, setDealAmount] = useState("15000.00");
  const [dealStage, setDealStage] = useState<DealStage>("Discovery");
  const [dealProb, setDealProb] = useState(0.5);

  // Quote Drawer State
  const [isQuoteDrawerOpen, setIsQuoteDrawerOpen] = useState(false);
  const [quoteCustomer, setQuoteCustomer] = useState("Vanguard Aerospace");
  const [quoteContact, setQuoteContact] = useState("Hannah Abbott");
  const [quoteSubtotal, setQuoteSubtotal] = useState("18000.00");
  const [quoteDiscountPct, setQuoteDiscountPct] = useState(5);
  const [quoteTax, setQuoteTax] = useState("1500.00");
  const [quoteNotes, setQuoteNotes] = useState("");

  // KPIs
  const kpis = useMemo(() => {
    const totalPipeline = deals.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
    const weighted = deals.reduce(
      (sum, d) => sum + (parseFloat(d.amount) || 0) * d.probability,
      0
    );
    const activeCount = deals.filter((d) => d.stage !== "Closed Won" && d.stage !== "Closed Lost").length;
    const wonCount = deals.filter((d) => d.stage === "Closed Won").length;
    const winRate = deals.length > 0 ? Math.round((wonCount / deals.length) * 100) : 0;

    return {
      totalPipeline: totalPipeline.toFixed(2),
      weighted: weighted.toFixed(2),
      activeCount,
      winRate: `${winRate}%`,
    };
  }, [deals]);

  // Handlers for Deals
  const handleCreateDeal = () => {
    if (!dealTitle.trim() || !dealCustomer.trim()) {
      showToast({
        title: "Required Fields Missing",
        description: "Please provide a deal title and customer name.",
        variant: "error",
      });
      return;
    }

    const newDeal: PipelineDeal = {
      id: `DEAL-${Date.now().toString().slice(-4)}`,
      title: dealTitle.trim(),
      customer: dealCustomer.trim(),
      contactPerson: dealContact.trim() || "Operations Lead",
      amount: parseFloat(dealAmount).toFixed(2),
      stage: dealStage,
      probability: dealProb,
      expectedClose: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0] || "2026-12-14",
      daysQuiet: 0,
      needsFollowUp: false,
    };

    setDeals((prev) => [newDeal, ...prev]);
    onAddDeal?.(newDeal);
    setIsDealDrawerOpen(false);
    setDealTitle("");
    setDealCustomer("");

    showToast({
      title: "Deal Created",
      description: `${newDeal.title} added to ${newDeal.stage} pipeline.`,
      variant: "success",
    });
  };

  const handleAdvanceStage = (dealId: string, nextStage: DealStage) => {
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage: nextStage } : d))
    );
    onUpdateDealStage?.(dealId, nextStage);

    showToast({
      title: "Stage Advanced",
      description: `Deal moved to ${nextStage}.`,
      variant: "success",
    });
  };

  // Handlers for Quotes
  const handleCreateQuote = () => {
    const sub = parseFloat(quoteSubtotal) || 0;
    const disc = (sub * quoteDiscountPct) / 100;
    const tax = parseFloat(quoteTax) || 0;
    const grand = sub - disc + tax;

    const newQuote: SalesQuote = {
      id: `quo-${Date.now()}`,
      quoteNumber: `QUO-2026-${String(quotes.length + 304).padStart(3, "0")}`,
      customerName: quoteCustomer,
      contactPerson: quoteContact,
      issuedAt: new Date().toISOString().split("T")[0] || "2026-11-14",
      validUntil: new Date(Date.now() + 21 * 86400000).toISOString().split("T")[0] || "2026-12-05",
      status: "Draft",
      subtotal: sub.toFixed(2),
      discountPercent: quoteDiscountPct,
      taxTotal: tax.toFixed(2),
      grandTotal: grand.toFixed(2),
      itemsCount: 3,
      notes: quoteNotes || "Configured engineering parts quote",
    };

    setQuotes((prev) => [newQuote, ...prev]);
    onAddQuote?.(newQuote);
    setIsQuoteDrawerOpen(false);
    setQuoteNotes("");

    showToast({
      title: "Quote Created (SAL-02)",
      description: `${newQuote.quoteNumber} drafted for ${newQuote.customerName}.`,
      variant: "success",
    });
  };

  const handleQuoteStatusChange = (
    quoteId: string,
    status: "Draft" | "Sent" | "Accepted" | "Expired"
  ) => {
    setQuotes((prev) =>
      prev.map((q) => (q.id === quoteId ? { ...q, status } : q))
    );
    onUpdateQuoteStatus?.(quoteId, status);

    showToast({
      title: "Quote Status Updated",
      description: `Quote is now ${status}.`,
      variant: "success",
    });
  };

  const handleConvertToInvoice = (quote: SalesQuote) => {
    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-2026-${String(Math.floor(Math.random() * 900) + 100)}`,
      customerName: quote.customerName,
      customerEmail: "finance@" + quote.customerName.toLowerCase().replace(/\s+/g, "") + ".com",
      status: "draft",
      issueDate: new Date().toISOString().split("T")[0] || "2026-11-14",
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0] || "2026-12-14",
      lineItems: [
        {
          id: "li-1",
          description: `Quote Fulfillment: ${quote.quoteNumber}`,
          quantity: 1,
          unitPrice: quote.grandTotal,
          lineTotal: quote.grandTotal,
        },
      ],
      subtotal: quote.subtotal,
      taxAmount: quote.taxTotal,
      discountAmount: "0.00",
      totalAmount: quote.grandTotal,
      paidAmount: "0.00",
      notes: `Converted from accepted quote ${quote.quoteNumber}.`,
    };

    onConvertToInvoice?.(newInvoice);

    showToast({
      title: "Invoice Generated (SAL-04)",
      description: `Created ${newInvoice.invoiceNumber} from ${quote.quoteNumber} for ${formatMoney(quote.grandTotal, "$")}.`,
      variant: "success",
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-line">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[11px] font-black uppercase tracking-wider bg-lime text-ink border border-ink">
              SAL-01 & SAL-02
            </span>
            <span className="text-xs font-bold text-muted">Revenue & Pipeline Engine</span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl uppercase tracking-tight text-text mt-1">
            CRM Pipeline & Quotes
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Stage deals, forecast pipeline values in 3D, and generate CPQ sales quotes ready for invoicing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === "pipeline" ? (
            <Button
              variant="lime"
              size="sm"
              onClick={() => setIsDealDrawerOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Deal</span>
            </Button>
          ) : (
            <Button
              variant="lime"
              size="sm"
              onClick={() => setIsQuoteDrawerOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Quote</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Switcher: Pipeline vs Quotes */}
      <div className="flex items-center gap-2 border-b-2 border-line pb-2">
        <button
          onClick={() => setActiveTab("pipeline")}
          className={`px-4 py-2 text-xs font-black uppercase transition-all ${
            activeTab === "pipeline"
              ? "bg-lime text-ink border-2 border-ink shadow-[2px_2px_0_var(--q-ink)] -translate-y-0.5"
              : "text-muted hover:text-text border-2 border-transparent"
          }`}
        >
          Deals & Funnel Pipeline (SAL-01)
        </button>
        <button
          onClick={() => setActiveTab("quotes")}
          className={`px-4 py-2 text-xs font-black uppercase transition-all ${
            activeTab === "quotes"
              ? "bg-lime text-ink border-2 border-ink shadow-[2px_2px_0_var(--q-ink)] -translate-y-0.5"
              : "text-muted hover:text-text border-2 border-transparent"
          }`}
        >
          Quotes & CPQ Builder (SAL-02)
        </button>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-panel border-line p-4 shadow-card">
          <div className="flex items-center justify-between text-muted text-xs font-bold uppercase mb-1">
            <span>Total Pipeline Value</span>
            <DollarSign className="w-4 h-4 text-lime" />
          </div>
          <p className="font-display font-black text-2xl text-text">
            {formatMoney(kpis.totalPipeline, "$")}
          </p>
          <span className="text-[11px] font-bold text-muted">All active stages</span>
        </div>

        <div className="bg-panel border-line p-4 shadow-card">
          <div className="flex items-center justify-between text-muted text-xs font-bold uppercase mb-1">
            <span>Weighted Forecast</span>
            <TrendingUp className="w-4 h-4 text-cyan" />
          </div>
          <p className="font-display font-black text-2xl text-text">
            {formatMoney(kpis.weighted, "$")}
          </p>
          <span className="text-[11px] font-bold text-muted">Probability adjusted</span>
        </div>

        <div className="bg-panel border-line p-4 shadow-card">
          <div className="flex items-center justify-between text-muted text-xs font-bold uppercase mb-1">
            <span>Active Deals</span>
            <Filter className="w-4 h-4 text-violet" />
          </div>
          <p className="font-display font-black text-2xl text-text">{kpis.activeCount}</p>
          <span className="text-[11px] font-bold text-muted">In progression</span>
        </div>

        <div className="bg-panel border-line p-4 shadow-card">
          <div className="flex items-center justify-between text-muted text-xs font-bold uppercase mb-1">
            <span>Win Rate</span>
            <Award className="w-4 h-4 text-pink" />
          </div>
          <p className="font-display font-black text-2xl text-good">{kpis.winRate}</p>
          <span className="text-[11px] font-bold text-muted">Closed won ratio</span>
        </div>
      </div>

      {activeTab === "pipeline" ? (
        <div className="space-y-6">
          {/* 3D Funnel / 2D Toggle */}
          <div className="bg-panel border-line p-4 shadow-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
              <div className="flex items-center gap-3">
                <span className="text-xs font-black uppercase text-muted">Filter Stage:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setSelectedStageFilter("ALL")}
                    className={`px-3 py-1 text-xs font-bold border-2 ${
                      selectedStageFilter === "ALL"
                        ? "bg-lime text-ink border-ink shadow-[2px_2px_0_var(--q-ink)]"
                        : "bg-page text-text border-line hover:bg-cream"
                    }`}
                  >
                    All Stages
                  </button>
                  {STAGES.map((stg) => (
                    <button
                      key={stg}
                      onClick={() => setSelectedStageFilter(stg)}
                      className={`px-3 py-1 text-xs font-bold border-2 ${
                        selectedStageFilter === stg
                          ? "bg-lime text-ink border-ink shadow-[2px_2px_0_var(--q-ink)]"
                          : "bg-page text-text border-line hover:bg-cream"
                      }`}
                    >
                      {stg}
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
                  <Box className="w-3.5 h-3.5 text-lime" />
                  <span>3D Funnel View</span>
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
                  <span>2D Stage Table</span>
                </button>
              </div>
            </div>

            {activeView === "3D" ? (
              <PipelineFunnel3D
                deals={deals}
                onSelectStage={(stg) => setSelectedStageFilter(stg)}
              />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {STAGES.map((stage) => {
                  const stageDeals = deals.filter((d) => d.stage === stage);
                  const stageSum = stageDeals.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
                  return (
                    <div key={stage} className="p-3 bg-page border-line shadow-sm">
                      <p className="text-[10px] font-black uppercase text-muted">{stage}</p>
                      <p className="font-display font-black text-lg text-text mt-1">
                        {formatMoney(stageSum.toFixed(2), "$")}
                      </p>
                      <p className="text-[11px] font-bold text-muted">{stageDeals.length} deals</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Kanban Deal Stages Board */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {STAGES.map((stage) => {
              const stageDeals = deals.filter(
                (d) => d.stage === stage && (selectedStageFilter === "ALL" || selectedStageFilter === stage)
              );

              return (
                <div key={stage} className="bg-panel border-line p-3 shadow-card space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-line">
                    <span className="font-black text-xs uppercase tracking-wider text-text">
                      {stage}
                    </span>
                    <span className="px-1.5 py-0.5 bg-page border border-line text-[10px] font-bold">
                      {stageDeals.length}
                    </span>
                  </div>

                  <div className="space-y-2.5 min-h-[160px]">
                    {stageDeals.length === 0 ? (
                      <p className="text-muted text-[11px] italic p-3 text-center">No deals in stage</p>
                    ) : (
                      stageDeals.map((deal) => (
                        <div
                          key={deal.id}
                          className="p-3 bg-page border-line hover:border-ink transition-colors shadow-sm space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] font-bold text-pink">{deal.id}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-panel border border-line">
                              {Math.round(deal.probability * 100)}%
                            </span>
                          </div>

                          <h3 className="font-bold text-xs text-text leading-tight">{deal.title}</h3>
                          <p className="text-[11px] text-muted">{deal.customer}</p>

                          <div className="flex items-baseline justify-between pt-1 border-t border-line/60">
                            <span className="font-display font-black text-sm text-text">
                              {formatMoney(deal.amount, "$")}
                            </span>
                            <span className="text-[10px] text-muted">
                              {deal.daysQuiet}d quiet
                            </span>
                          </div>

                          {/* Stage Advance Buttons */}
                          {stage !== "Closed Won" && (
                            <div className="pt-2 flex justify-end">
                              <button
                                onClick={() => {
                                  const curIdx = STAGES.indexOf(stage);
                                  const next = STAGES[curIdx + 1];
                                  if (next) handleAdvanceStage(deal.id, next);
                                }}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-black uppercase bg-lime text-ink border border-ink hover:bg-lime/80 shadow-[1px_1px_0_var(--q-ink)]"
                              >
                                <span>Advance</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Quotes & CPQ Tab (SAL-02) */
        <div className="bg-panel border-line p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div>
              <h2 className="font-display font-black text-lg uppercase tracking-tight text-text flex items-center gap-2">
                <FileText className="w-5 h-5 text-lime" />
                <span>Sales Quotes & CPQ Configurations (SAL-02)</span>
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Generate tailored sales quotes, apply volume discounts, and convert accepted quotes into invoices.
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 bg-page border border-line">
              {quotes.length} Quotes
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-line bg-page text-muted uppercase font-black text-[10px]">
                  <th className="p-3">Quote #</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Issued</th>
                  <th className="p-3">Valid Until</th>
                  <th className="p-3 text-right">Subtotal</th>
                  <th className="p-3 text-right">Discount</th>
                  <th className="p-3 text-right">Grand Total</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-medium text-text">
                {quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-cream/40 transition-colors">
                    <td className="p-3 font-mono font-black text-text">{q.quoteNumber}</td>
                    <td className="p-3 font-bold">{q.customerName}</td>
                    <td className="p-3 text-muted">{q.contactPerson}</td>
                    <td className="p-3 text-muted">{q.issuedAt}</td>
                    <td className="p-3 text-muted">{q.validUntil}</td>
                    <td className="p-3 text-right font-mono">{formatMoney(q.subtotal, "$")}</td>
                    <td className="p-3 text-right font-mono text-pink">
                      {q.discountPercent > 0 ? `-${q.discountPercent}%` : "0%"}
                    </td>
                    <td className="p-3 text-right font-mono font-black text-sm">
                      {formatMoney(q.grandTotal, "$")}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black uppercase border border-ink ${
                          q.status === "Accepted"
                            ? "bg-good text-panel"
                            : q.status === "Sent"
                            ? "bg-yellow text-panel"
                            : "bg-muted/20 text-muted"
                        }`}
                      >
                        {q.status === "Accepted" && <CheckCircle2 className="w-3 h-3" />}
                        {q.status === "Sent" && <Clock className="w-3 h-3" />}
                        {q.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {q.status === "Draft" && (
                          <Button
                            variant="yellow"
                            size="sm"
                            onClick={() => handleQuoteStatusChange(q.id, "Sent")}
                            className="text-[11px] py-1 px-2"
                          >
                            <Send className="w-3 h-3 mr-1" />
                            Send
                          </Button>
                        )}
                        {q.status === "Sent" && (
                          <Button
                            variant="lime"
                            size="sm"
                            onClick={() => handleQuoteStatusChange(q.id, "Accepted")}
                            className="text-[11px] py-1 px-2"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Accept
                          </Button>
                        )}
                        {q.status === "Accepted" && (
                          <Button
                            variant="lime"
                            size="sm"
                            onClick={() => handleConvertToInvoice(q)}
                            className="text-[11px] py-1 px-2 font-black"
                          >
                            Convert to Invoice
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Deal Drawer */}
      <Drawer
        isOpen={isDealDrawerOpen}
        onClose={() => setIsDealDrawerOpen(false)}
        title="Add Pipeline Deal (SAL-01)"
        description="Record a new opportunity and place it in the CRM deal funnel."
        primaryActionLabel="Save Deal"
        onPrimaryAction={handleCreateDeal}
        primaryActionVariant="lime"
      >
        <div className="space-y-4 text-xs font-bold text-text">
          <div>
            <label className="block uppercase text-[10px] text-muted mb-1">Deal Title</label>
            <input
              type="text"
              value={dealTitle}
              onChange={(e) => setDealTitle(e.target.value)}
              placeholder="e.g. Avionics Wiring Harness Batch"
              className="w-full p-2.5 bg-page border-line text-text focus:outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="block uppercase text-[10px] text-muted mb-1">Customer / Company</label>
            <input
              type="text"
              value={dealCustomer}
              onChange={(e) => setDealCustomer(e.target.value)}
              placeholder="e.g. Lockheed Martin Space"
              className="w-full p-2.5 bg-page border-line text-text focus:outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="block uppercase text-[10px] text-muted mb-1">Contact Person</label>
            <input
              type="text"
              value={dealContact}
              onChange={(e) => setDealContact(e.target.value)}
              placeholder="e.g. Robert Drake"
              className="w-full p-2.5 bg-page border-line text-text focus:outline-none focus:border-ink"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block uppercase text-[10px] text-muted mb-1">Amount ($)</label>
              <input
                type="text"
                value={dealAmount}
                onChange={(e) => setDealAmount(e.target.value)}
                className="w-full p-2.5 bg-page border-line text-text font-mono focus:outline-none focus:border-ink"
              />
            </div>

            <div>
              <label className="block uppercase text-[10px] text-muted mb-1">Stage</label>
              <select
                value={dealStage}
                onChange={(e) => setDealStage(e.target.value as DealStage)}
                className="w-full p-2.5 bg-page border-line text-text font-bold focus:outline-none focus:border-ink"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block uppercase text-[10px] text-muted mb-1">
              Win Probability: {Math.round(dealProb * 100)}%
            </label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={dealProb}
              onChange={(e) => setDealProb(parseFloat(e.target.value))}
              className="w-full cursor-pointer accent-lime"
            />
          </div>
        </div>
      </Drawer>

      {/* Create Quote Drawer */}
      <Drawer
        isOpen={isQuoteDrawerOpen}
        onClose={() => setIsQuoteDrawerOpen(false)}
        title="Create Sales Quote & CPQ (SAL-02)"
        description="Draft a configurable price quote with volume discount and tax parameters."
        primaryActionLabel="Generate Quote"
        onPrimaryAction={handleCreateQuote}
        primaryActionVariant="lime"
      >
        <div className="space-y-4 text-xs font-bold text-text">
          <div>
            <label className="block uppercase text-[10px] text-muted mb-1">Customer Name</label>
            <input
              type="text"
              value={quoteCustomer}
              onChange={(e) => setQuoteCustomer(e.target.value)}
              className="w-full p-2.5 bg-page border-line text-text focus:outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="block uppercase text-[10px] text-muted mb-1">Contact Person</label>
            <input
              type="text"
              value={quoteContact}
              onChange={(e) => setQuoteContact(e.target.value)}
              className="w-full p-2.5 bg-page border-line text-text focus:outline-none focus:border-ink"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block uppercase text-[10px] text-muted mb-1">Subtotal ($)</label>
              <input
                type="text"
                value={quoteSubtotal}
                onChange={(e) => setQuoteSubtotal(e.target.value)}
                className="w-full p-2.5 bg-page border-line text-text font-mono focus:outline-none focus:border-ink"
              />
            </div>

            <div>
              <label className="block uppercase text-[10px] text-muted mb-1">Discount %</label>
              <input
                type="number"
                min="0"
                max="50"
                value={quoteDiscountPct}
                onChange={(e) => setQuoteDiscountPct(parseInt(e.target.value) || 0)}
                className="w-full p-2.5 bg-page border-line text-text font-mono focus:outline-none focus:border-ink"
              />
            </div>
          </div>

          <div>
            <label className="block uppercase text-[10px] text-muted mb-1">Tax Total ($)</label>
            <input
              type="text"
              value={quoteTax}
              onChange={(e) => setQuoteTax(e.target.value)}
              className="w-full p-2.5 bg-page border-line text-text font-mono focus:outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="block uppercase text-[10px] text-muted mb-1">Notes & Engineering Scope</label>
            <textarea
              rows={3}
              value={quoteNotes}
              onChange={(e) => setQuoteNotes(e.target.value)}
              placeholder="e.g. Includes CNC calibration, delivery to Newark hub, and warranty terms"
              className="w-full p-2.5 bg-page border-line text-text text-xs focus:outline-none focus:border-ink"
            />
          </div>
        </div>
      </Drawer>
    </div>
  );
};
