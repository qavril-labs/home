import React, { useState } from "react";
import { KpiTile } from "../components/ui/KpiTile";
import { Card } from "../components/ui/Card";
import { TrendChart } from "../components/ui/TrendChart";
import { BotCard } from "../components/ui/BotCard";
import { QuickEntryForm } from "../components/ui/QuickEntryForm";
import { DataTable, type Column } from "../components/ui/DataTable";
import { StatusChip } from "../components/ui/StatusChip";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { MoneyCity3D } from "../scenes/MoneyCity3D";
import { useToast } from "../context/ToastContext";
import { formatMoney } from "../lib/currency";
import type {
  WorkspaceInsights,
  RecentEntry,
  BotInsight,
  QuickEntryPayload,
} from "../types";
import { Plus, Sparkles, RefreshCw, Send, CheckCircle2 } from "lucide-react";

export interface DashboardPageProps {
  insights: WorkspaceInsights;
  entries: RecentEntry[];
  onAddEntry: (entry: QuickEntryPayload) => void;
  onOpenQuickModal: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  insights,
  entries,
  onAddEntry,
  onOpenQuickModal,
}) => {
  const { showToast } = useToast();
  const [activeBotModal, setActiveBotModal] = useState<BotInsight | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionVerb: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    actionVerb: "",
    onConfirm: () => {},
  });

  const columns: Column<RecentEntry>[] = [
    {
      header: "Entry ID",
      accessorKey: "id",
      cell: (r) => <span className="font-mono font-bold text-xs">{r.id}</span>,
    },
    {
      header: "Date",
      accessorKey: "date",
      cell: (r) => <span className="text-xs text-muted font-medium">{r.date}</span>,
    },
    {
      header: "Kind",
      accessorKey: "kind",
      cell: (r) => (
        <span className="font-bold text-xs bg-page px-2 py-0.5 border border-grid">
          {r.kind}
        </span>
      ),
    },
    {
      header: "Description & Party",
      cell: (r) => (
        <div>
          <div className="font-bold text-xs text-text">{r.description}</div>
          <div className="text-[11px] text-muted">{r.party}</div>
        </div>
      ),
    },
    {
      header: "Amount",
      accessorKey: "amount",
      align: "right",
      cell: (r) => {
        const isNegative = r.amount.startsWith("-");
        return (
          <span
            className={`font-mono font-bold text-xs ${
              isNegative ? "text-series-out" : "text-series-in"
            }`}
          >
            {formatMoney(r.amount, "$")}
          </span>
        );
      },
    },
    {
      header: "Status",
      accessorKey: "status",
      align: "center",
      cell: (r) => (
        <StatusChip
          status={r.status === "posted" ? "good" : "watch"}
          label={r.status === "posted" ? "Posted" : "Draft"}
        />
      ),
    },
  ];

  const handleBotAction = (bot: BotInsight) => {
    setActiveBotModal(bot);
  };

  const executeBotDraft = (bot: BotInsight) => {
    setActiveBotModal(null);
    showToast(
      `Approved ${bot.draftLabel || "draft"} for ${bot.name}. Dispatched to delivery queue.`,
      {
        type: "success",
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Greeting, 3D Money City & Header info */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Left greeting & ledger metadata */}
        <div className="lg:col-span-5 space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-pink block">
            {insights.company}
          </span>
          <h1 className="font-display font-black text-3xl sm:text-4xl uppercase tracking-tight text-text leading-none">
            Good to see you
          </h1>
          <p className="text-xs text-muted leading-relaxed font-medium">
            Figures in <span className="font-bold text-text">{insights.currency}</span>, as at{" "}
            <span className="font-bold text-text">{insights.asOf}</span>. Every number below comes straight from your ledger.
          </p>
        </div>

        {/* Right 3D Money City Scene */}
        <div className="lg:col-span-7">
          <MoneyCity3D
            trendData={insights.trend}
            cashAmount={insights.totals.cash}
            currencySymbol="$"
          />
        </div>
      </div>

      {/* KPI Tiles Row (4 tiles) */}
      <section aria-label="Key ledger figures">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile
            label="Cash and bank"
            value={insights.totals.cash}
            variant="lime"
            helperText="Reconciled across checking & reserve accounts"
          />
          <KpiTile
            label="Sales to date"
            value={insights.totals.revenue}
            variant="panel"
            helperText="Total recognized revenue in fiscal year"
          />
          <KpiTile
            label="Expenses to date"
            value={insights.totals.expenses}
            variant="panel"
            helperText="Total posted vendor bills & operating costs"
          />
          <KpiTile
            label="Profit to date"
            value={insights.totals.profit}
            variant="yellow"
            helperText="Net operating income before tax accrual"
          />
        </div>
      </section>

      {/* Main Grid: 12 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 cols: 6-Month Trend Chart */}
        <div className="lg:col-span-7 space-y-6">
          <Card
            title="Sales and expenses, last six months"
            subtitle="Grouped comparisons of money in versus money out"
            featured
          >
            <TrendChart data={insights.trend} />
          </Card>

          {/* Recent Ledger Entries */}
          <Card
            title="Recent ledger entries"
            subtitle="The latest immutable transactions posted to your books"
            action={
              <Button size="sm" variant="lime" onClick={onOpenQuickModal}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Record entry
              </Button>
            }
          >
            <DataTable
              columns={columns}
              data={entries}
              emptyTitle="No recent entries"
              emptyDescription="Record your first sale or expense to see it post to the ledger."
            />
          </Card>
        </div>

        {/* Right 5 cols: Bot Crew & Quick Entry Form */}
        <div className="lg:col-span-5 space-y-6">
          {/* Bot Crew Section */}
          <Card
            title="Your bot crew"
            subtitle="Autonomous agents checking signals and drafting actions"
            action={
              <span className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold bg-page border border-ink text-good">
                <span className="w-2 h-2 rounded-full bg-good animate-ping"></span>
                Live · updated 16:40:00
              </span>
            }
          >
            <div className="space-y-3">
              {insights.bots.map((bot) => (
                <BotCard key={bot.id} bot={bot} onAction={handleBotAction} />
              ))}
            </div>
          </Card>

          {/* Quick Entry Form */}
          <Card
            title="Record something"
            subtitle="Post directly to your general ledger without complex forms"
          >
            <QuickEntryForm onEntryPosted={onAddEntry} />
          </Card>
        </div>
      </div>

      {/* Bot Review Modal */}
      {activeBotModal && (
        <Modal
          isOpen={!!activeBotModal}
          onClose={() => setActiveBotModal(null)}
          title={`Review ${activeBotModal.name}'s proposal`}
          description={activeBotModal.role}
          primaryActionLabel={activeBotModal.actionVerb || "Approve & Execute"}
          primaryActionVariant="lime"
          onPrimaryAction={() => {
            setConfirmDialog({
              isOpen: true,
              title: `Approve draft by ${activeBotModal.name}?`,
              message: `This will dispatch the drafted ${
                activeBotModal.draftLabel || "action"
              } to the transactional queue with your digital signature.`,
              actionVerb: "Confirm & Dispatch",
              onConfirm: () => {
                setConfirmDialog((p) => ({ ...p, isOpen: false }));
                executeBotDraft(activeBotModal);
              },
            });
          }}
          secondaryActionLabel="Dismiss"
        >
          <div className="space-y-4">
            <div className="bg-page p-3 border-line">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
                Signals Found
              </span>
              <p className="text-xs text-text font-medium leading-relaxed">
                {activeBotModal.foundText}
              </p>
            </div>

            <div className="bg-[#f7f6ff] dark:bg-[#1f1b3b] p-3 border-line">
              <span className="text-[11px] font-bold uppercase tracking-wider text-pink block mb-1">
                Draft Content Prepared
              </span>
              <p className="text-xs text-text font-bold leading-relaxed">
                {activeBotModal.nextText}
              </p>
            </div>

            <div className="text-[11px] text-muted italic">
              Audit notice: Once approved, this action is permanently recorded in the immutable agent audit trail (PLT-16 / AGT-06).
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((p) => ({ ...p, isOpen: false }))}
        title={confirmDialog.title}
        message={confirmDialog.message}
        actionVerb={confirmDialog.actionVerb}
        actionVariant="lime"
        onConfirm={confirmDialog.onConfirm}
      />
    </div>
  );
};
