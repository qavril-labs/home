import React, { useState, useEffect, useCallback } from "react";
import { StatusChip } from "../../components/ui/StatusChip";
import { Button } from "../../components/ui/Button";
import { AgentAssistanceBanner } from "../../components/ui/AgentAssistanceBanner";
import { SendReminderModal } from "./SendReminderModal";
import { CustomerStatementDrawer } from "./CustomerStatementDrawer";
import { useToast } from "../../context/ToastContext";
import { formatMoney } from "../../lib/currency";
import { apiClient, describeReminderOutcome } from "../../lib/api-client";
import {
  initialChaseChloeData,
  initialOverdueInvoices,
  mockCustomerStatements,
} from "../../lib/api-mock";
import type {
  ChaseChloeData,
  OverdueInvoice,
  ReminderDraft,
  CustomerStatement,
} from "../../types";
import {
  Power,
  RotateCw,
  AlertTriangle,
  Send,
  FileText,
  ShieldCheck,
  Clock,
  MessageSquare,
  Mail,
} from "lucide-react";

export interface ChaseChloeProps {
  onNavigateBack?: () => void;
}

export const ChaseChloe: React.FC<ChaseChloeProps> = ({ onNavigateBack }) => {
  const { showToast } = useToast();

  // State
  const [data] = useState<ChaseChloeData>(initialChaseChloeData);
  const [invoices, setInvoices] = useState<OverdueInvoice[]>(initialOverdueInvoices);
  const [isKillSwitchActive, setIsKillSwitchActive] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLiveApi, setIsLiveApi] = useState<boolean>(false);

  // Filters & Selected Modals
  const [selectedAgingFilter, setSelectedAgingFilter] = useState<string>("all");
  const [activeReminderInvoice, setActiveReminderInvoice] = useState<OverdueInvoice | null>(null);
  const [activeStatement, setActiveStatement] = useState<CustomerStatement | null>(null);

  // Fetch bot responses reflecting GET /v1/workspace/insights
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
        ? "Chase Chloe resumed: Automated invoice aging analysis and reminder drafting are active."
        : "Chase Chloe kill switch engaged: Automated reminders and aging evaluations paused.",
      { type: nextState ? "success" : "warning" }
    );
  };

  // Reminder Dispatch Handler (Tier 2 Supervisor Action)
  const handleSendReminder = async (draft: ReminderDraft) => {
    const result = await apiClient.sendPaymentReminder(draft.invoiceId, draft);
    const outcome = describeReminderOutcome(result, draft.recipientName);
    if (!result.isLive) {
      // Nothing reached the server: keep the draft as it was so it can be retried.
      showToast(outcome.text, { type: "warning" });
      return;
    }
    const delivered = result.data.status === "sent";
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === draft.invoiceId
          ? {
              ...inv,
              status: delivered ? "reminder_sent" : inv.status,
              draftReminder: { ...draft, status: delivered ? "sent" : "approved" },
            }
          : inv
      )
    );
    setActiveReminderInvoice(null);
    // A queued email cannot be taken back, so there is no undo here.
    showToast(outcome.text, { type: outcome.type });
  };

  // Open Statement Drawer
  const handleOpenStatement = (inv: OverdueInvoice) => {
    const stmt = mockCustomerStatements[inv.partyId] || {
      partyId: inv.partyId,
      partyName: inv.partyName,
      email: "billing@customer.com",
      phone: "+1 555-010-0000",
      paymentTerms: "Net 30",
      currentBalance: inv.amountDue,
      overdueBalance: inv.amountDue,
      transactions: [
        {
          id: `TX-${inv.id}`,
          date: inv.issueDate,
          type: "Invoice",
          reference: inv.id,
          amount: inv.amountDue,
          balance: inv.amountDue,
        },
      ],
    };
    setActiveStatement(stmt);
  };

  // Filtered invoices
  const filteredInvoices = invoices.filter((inv) => {
    if (selectedAgingFilter === "all") return true;
    if (selectedAgingFilter === "overdue") return inv.daysOverdue > 0;
    return inv.agingBucket === selectedAgingFilter;
  });

  const pendingDraftCount = invoices.filter(
    (inv) => inv.draftReminder && inv.draftReminder.status === "draft"
  ).length;

  const overdueInvoicesCount = invoices.filter((inv) => inv.daysOverdue > 0).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Breadcrumb / Navigation */}
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
          <span className="text-xs font-bold text-text">Chase Chloe (FIN-14)</span>
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
            Agent Card: AGT-02 · FIN-14
          </span>
        </div>
      </div>

      {/* 2. Bot Header with Chloe Avatar, role, kill switch, and live indicator */}
      <section
        className="neo-card p-6 bg-panel border-line shadow-card"
        aria-label="Chase Chloe Agent Header"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Chloe Avatar & Identity */}
          <div className="flex items-start sm:items-center gap-4">
            {/* Avatar strictly following design/tokens.json: bot.chase-chloe (yellow token #ffe14d) */}
            <div className="w-16 h-16 bg-yellow text-ink border-line shadow-[3px_3px_0_var(--q-ink)] flex items-center justify-center select-none flex-shrink-0 relative">
              <svg className="w-12 h-12" viewBox="0 0 80 80" aria-hidden="true">
                <line x1="40" y1="8" x2="40" y2="16" stroke="var(--q-ink)" strokeWidth="3" />
                <circle cx="40" cy="7" r="4" fill="var(--q-cyan)" stroke="var(--q-ink)" strokeWidth="2" />
                <rect x="16" y="16" width="48" height="40" rx="14" fill="var(--q-yellow)" stroke="var(--q-ink)" strokeWidth="3" />
                <circle cx="30" cy="34" r="5" fill="var(--q-ink)" />
                <circle cx="50" cy="34" r="5" fill="var(--q-ink)" />
                <path d="M30 46 Q40 54 50 46" fill="none" stroke="var(--q-ink)" strokeWidth="3" strokeLinecap="round" />
                <rect x="26" y="58" width="28" height="14" rx="5" fill="var(--q-cyan)" stroke="var(--q-ink)" strokeWidth="3" />
              </svg>
              {isKillSwitchActive && (
                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-good rounded-full border-2 border-ink" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="font-display font-extrabold text-2xl sm:text-3xl uppercase tracking-tight text-text leading-tight break-words">
                  Chase Chloe
                </h1>
                <span className="px-2 py-0.5 bg-yellow/30 border border-yellow text-[11px] font-bold text-ink uppercase tracking-wider">
                  Invoice Chaser
                </span>
                <span className="px-1.5 py-0.5 bg-page border border-grid text-[10px] font-mono text-muted">
                  AGT-02 / FIN-14
                </span>
              </div>

              <p className="text-xs sm:text-sm text-muted max-w-2xl leading-normal break-words">
                Continuous accounts receivable assistant: monitors invoice aging schedules, prepares friendly reminders across WhatsApp & Email, prevents bad debt, and tracks debtor payment velocity.
              </p>
            </div>
          </div>

          {/* Right: Kill Switch & Live Indicator */}
          <div className="flex flex-wrap lg:flex-col items-start lg:items-end justify-between gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 border-grid">
            {/* Live Indicator */}
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

            {/* On/Off Kill Switch */}
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
              Kill switch is engaged. Automated AR aging calculations, debtor follow-ups, and reminder draft proposals are paused.
            </span>
          </div>
        )}
      </section>

      {/* 3. StatusChip Display Section */}
      <section
        className="neo-card p-4 bg-page border-line shadow-card"
        aria-label="Chase Chloe Status Overview"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-2 border-b border-grid">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted break-words">
              Live Receivables Health Status
            </h2>
            <p className="text-xs text-text font-medium mt-0.5 break-words">
              Continuous monitoring of receivables aging and debtor follow-up queues.
            </p>
          </div>

          {/* 3 StatusChips */}
          <div className="flex flex-wrap items-center gap-2">
            {/* StatusChip: ✓ Zero bad debt */}
            <StatusChip
              status={data.zeroBadDebt ? "good" : "act"}
              label="✓ Zero bad debt"
            />

            {/* StatusChip: ! 3 overdue invoices */}
            <StatusChip
              status={overdueInvoicesCount > 0 ? "watch" : "good"}
              label={
                overdueInvoicesCount > 0
                  ? `! ${overdueInvoicesCount} overdue invoices`
                  : "✓ All invoices current"
              }
            />

            {/* StatusChip: ● Reminder drafts pending */}
            <StatusChip
              status={pendingDraftCount > 0 ? "watch" : "good"}
              label={
                pendingDraftCount > 0
                  ? `● ${pendingDraftCount} reminder drafts pending`
                  : "✓ 0 drafts pending"
              }
            />
          </div>
        </div>

        {/* 4 Mini KPI Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              Overdue Receivables
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                {formatMoney(data.totalOverdue)}
              </span>
              <span className="text-xs font-mono font-bold text-act">Past Due</span>
            </div>
            <p className="text-[11px] text-muted mt-1 break-words">3 client accounts</p>
          </div>

          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              Invoices Past Due
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                {overdueInvoicesCount} Invoices
              </span>
              <span className="text-xs font-mono font-bold text-watch">Actionable</span>
            </div>
            <p className="text-[11px] text-muted mt-1 break-words">1 to 30 days overdue</p>
          </div>

          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              Reminder Drafts Prepared
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                {pendingDraftCount} Drafts
              </span>
              <span className="text-xs font-mono font-bold text-good">Ready to send</span>
            </div>
            <p className="text-[11px] text-muted mt-1 break-words">WhatsApp & Email queued</p>
          </div>

          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              Average Days Overdue
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                {data.avgDaysOverdue} Days
              </span>
              <span className="text-xs font-mono font-bold text-good">&lt; 30d SLA</span>
            </div>
            <p className="text-[11px] text-muted mt-1 break-words">Zero debt &gt; 60 days</p>
          </div>
        </div>
      </section>

      {/* 3b. Proactive Copilot Human-In-The-Loop Task Assistance */}
      {pendingDraftCount > 0 && isKillSwitchActive && (
        <AgentAssistanceBanner
          botName="Chase Chloe"
          catalogId="AGT-02 / FIN-14"
          accentColor="yellow"
          taskSummary={`${pendingDraftCount} Overdue Reminder Drafts Pre-Generated`}
          recommendation="Chloe has parsed AR aging buckets and pre-composed tailored payment reminders. Approving this dispatch saves an estimated 25 minutes of manual collections follow-up while allowing full human review and tone customization."
          evidencePoints={[
            `Total Overdue: ${formatMoney(data.totalOverdue)}`,
            `Oldest: Delta Dynamics (14d)`,
            "Delivery: Multi-channel (WhatsApp / Email)",
          ]}
          primaryActionLabel="Review & Dispatch Priority Draft"
          onPrimaryAction={() => {
            const firstDraftInv = invoices.find((inv) => inv.draftReminder);
            if (firstDraftInv) {
              setActiveReminderInvoice(firstDraftInv);
            }
          }}
          secondaryActionLabel="Dismiss Copilot Banner"
          onSecondaryAction={() => {
            showToast("Copilot reminder suggestion minimized for this session.", { type: "info" });
          }}
        />
      )}

      {/* 4. AR Aging Schedule & Invoice Review Table */}
      <section
        className="neo-card p-4 bg-panel border-line shadow-card"
        aria-label="AR Aging Schedule and Follow-up Table"
      >
        {/* Header & Aging Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-grid">
          <div>
            <h2 className="font-display font-extrabold text-lg uppercase tracking-tight text-text leading-tight break-words">
              Accounts Receivable Aging Schedule (FIN-14)
            </h2>
            <p className="text-xs text-muted mt-0.5 break-words">
              Review overdue debtor invoices and approve Chloe's personalized collection reminders.
            </p>
          </div>

          {/* Aging Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedAgingFilter("all")}
              className={`px-2.5 py-1 text-xs font-bold border-line transition-all ${
                selectedAgingFilter === "all"
                  ? "bg-yellow text-ink shadow-[2px_2px_0_var(--q-ink)]"
                  : "bg-page text-muted hover:text-text"
              }`}
            >
              All ({invoices.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedAgingFilter("overdue")}
              className={`px-2.5 py-1 text-xs font-bold border-line transition-all ${
                selectedAgingFilter === "overdue"
                  ? "bg-yellow text-ink shadow-[2px_2px_0_var(--q-ink)]"
                  : "bg-page text-muted hover:text-text"
              }`}
            >
              Overdue ({overdueInvoicesCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedAgingFilter("1-30")}
              className={`px-2.5 py-1 text-xs font-bold border-line transition-all ${
                selectedAgingFilter === "1-30"
                  ? "bg-yellow text-ink shadow-[2px_2px_0_var(--q-ink)]"
                  : "bg-page text-muted hover:text-text"
              }`}
            >
              1-30 Days ({invoices.filter((i) => i.agingBucket === "1-30").length})
            </button>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-line bg-page text-muted uppercase text-[10px] tracking-wider font-bold">
                <th className="py-2.5 px-3">Invoice & Customer</th>
                <th className="py-2.5 px-3">Due Date & Aging</th>
                <th className="py-2.5 px-3 text-right">Balance Due</th>
                <th className="py-2.5 px-3 text-center">Chloe Draft Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid">
              {filteredInvoices.map((inv) => {
                const hasPendingDraft = inv.draftReminder && inv.draftReminder.status === "draft";
                const isSent = inv.draftReminder && inv.draftReminder.status === "sent";

                return (
                  <tr key={inv.id} className="hover:bg-page/70 transition-colors">
                    {/* Invoice ID & Customer */}
                    <td className="py-3 px-3 align-top break-words">
                      <div className="font-mono font-bold text-sm text-text">
                        {inv.id}
                      </div>
                      <div className="font-bold text-xs text-text mt-0.5">
                        {inv.partyName}
                      </div>
                    </td>

                    {/* Due Date & Aging Tag */}
                    <td className="py-3 px-3 align-top break-words">
                      <div className="font-mono text-xs text-text font-semibold">
                        {inv.dueDate}
                      </div>
                      <div className="mt-1">
                        {inv.daysOverdue > 0 ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-watch/20 text-watch border border-watch">
                            <Clock className="w-3 h-3" />
                            <span>{inv.daysOverdue} days overdue</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-lime/30 text-ink border border-lime">
                            ✓ Current
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Amount Due */}
                    <td className="py-3 px-3 align-top font-mono font-bold text-right text-sm text-text break-words">
                      {formatMoney(inv.amountDue)}
                    </td>

                    {/* Draft Status */}
                    <td className="py-3 px-3 align-top text-center whitespace-nowrap">
                      {hasPendingDraft && (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-yellow/30 border border-yellow text-ink text-[11px] font-bold">
                          {inv.draftReminder?.channel === "whatsapp" ? (
                            <MessageSquare className="w-3 h-3" />
                          ) : (
                            <Mail className="w-3 h-3" />
                          )}
                          <span>Draft Ready ({inv.draftReminder?.tone})</span>
                        </div>
                      )}
                      {isSent && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-good/20 text-good border border-good text-[11px] font-bold">
                          ✓ Reminder Sent
                        </span>
                      )}
                      {!inv.draftReminder && (
                        <span className="text-[11px] text-muted">No draft needed</span>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {hasPendingDraft && (
                          <Button
                            size="sm"
                            variant="yellow"
                            onClick={() => setActiveReminderInvoice(inv)}
                            className="text-xs py-1 px-2.5 flex items-center gap-1 font-bold"
                          >
                            <Send className="w-3 h-3" />
                            <span>Review Draft</span>
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenStatement(inv)}
                          className="text-xs py-1 px-2.5 flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Statement</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. Activity Log & Guardrails Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Chloe Activity Feed (7 cols) */}
        <div className="lg:col-span-7 neo-card p-4 bg-panel border-line shadow-card">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-grid">
            <div>
              <h3 className="font-display font-extrabold text-sm uppercase tracking-tight text-text break-words">
                Chloe Activity Stream
              </h3>
              <p className="text-[11px] text-muted break-words">
                Audit trail of recent AR aging evaluations and payment follow-ups.
              </p>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-page border border-grid text-muted">
              Live Feed
            </span>
          </div>

          <div className="space-y-2">
            {[
              {
                time: "09:15",
                event: "Invoice aging evaluation completed",
                result: "3 invoices flagged past due (Titan, Acme, Vanguard)",
                type: "watch",
              },
              {
                time: "09:20",
                event: "Polite reminder drafts generated",
                result: "2 WhatsApp drafts & 1 Email draft prepared for approval",
                type: "good",
              },
              {
                time: "11:45",
                event: "Customer payment received: Delta Dynamics LLC",
                result: "$8,120.00 settled against INV-2026-088",
                type: "good",
              },
              {
                time: "14:00",
                event: "Bad debt exposure check",
                result: "Zero invoices past 60 days; bad debt risk remains 0.0%",
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
                  <p className="text-[11px] text-muted mt-0.5 break-words">{feed.result}</p>
                </div>
                <span
                  className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    feed.type === "good"
                      ? "bg-good"
                      : feed.type === "watch"
                      ? "bg-watch"
                      : "bg-act"
                  }`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Agent Guardrails & Governance (5 cols) */}
        <div className="lg:col-span-5 neo-card p-4 bg-panel border-line shadow-card space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-grid">
            <ShieldCheck className="w-4 h-4 text-good" />
            <h3 className="font-display font-extrabold text-sm uppercase tracking-tight text-text break-words">
              Agent Guardrails (FIN-14)
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-page border-line">
              <span className="font-bold text-text block mb-0.5">Strict Non-Harassment Rule</span>
              <p className="text-[11px] text-muted leading-relaxed break-words">
                Chloe never sends automated messages unreviewed. Messages adhere to courteous commercial standards and minimum 7-day cadence.
              </p>
            </div>

            <div className="p-2.5 bg-page border-line">
              <span className="font-bold text-text block mb-0.5">Design Token Conformance</span>
              <p className="text-[11px] text-muted leading-relaxed break-words">
                Chloe strictly employs <code className="font-bold">var(--q-yellow)</code> (yellow design token) for avatar, badges, and accents.
              </p>
            </div>

            <div className="p-2.5 bg-page border-line">
              <span className="font-bold text-text block mb-0.5">Tier 2 Human Approval</span>
              <p className="text-[11px] text-muted leading-relaxed break-words">
                Every draft is delivered only upon explicit supervisor sign-off, maintaining complete operational and legal control.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Review Reminder Modal */}
      <SendReminderModal
        isOpen={Boolean(activeReminderInvoice)}
        onClose={() => setActiveReminderInvoice(null)}
        invoice={activeReminderInvoice}
        onSendReminder={handleSendReminder}
      />

      {/* 7. Customer Statement Drawer */}
      <CustomerStatementDrawer
        isOpen={Boolean(activeStatement)}
        onClose={() => setActiveStatement(null)}
        statement={activeStatement}
      />
    </div>
  );
};

export default ChaseChloe;
