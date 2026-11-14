import React, { useMemo, useState } from "react";
import { Card } from "../../components/ui/Card";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { Button } from "../../components/ui/Button";
import { StatusChip } from "../../components/ui/StatusChip";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { formatMoney } from "../../lib/currency";
import type { Account, AccountType } from "../../types";
import {
  Edit3,
  Power,
  Search,
  Trash2,
  Lock,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";

export type AccountTypeFilter = "all" | AccountType;

export interface AccountListProps {
  accounts: Account[];
  onOpenCreate: (defaultType?: AccountType) => void;
  onOpenEdit: (account: Account) => void;
  onToggleStatus?: (code: string) => void;
  onDeleteAccount?: (code: string) => void;
}

const TYPE_CONFIGS: Record<
  AccountType,
  { label: string; badgeClass: string; normalBalance: "Debit" | "Credit" }
> = {
  ASSET: {
    label: "Asset",
    badgeClass: "bg-lime text-ink",
    normalBalance: "Debit",
  },
  LIABILITY: {
    label: "Liability",
    badgeClass: "bg-yellow text-ink",
    normalBalance: "Credit",
  },
  EQUITY: {
    label: "Equity",
    badgeClass: "bg-cyan text-ink",
    normalBalance: "Credit",
  },
  REVENUE: {
    label: "Revenue",
    badgeClass: "bg-violet text-white",
    normalBalance: "Credit",
  },
  EXPENSE: {
    label: "Expense",
    badgeClass: "bg-orange text-white",
    normalBalance: "Debit",
  },
};

export const AccountList: React.FC<AccountListProps> = ({
  accounts,
  onOpenCreate,
  onOpenEdit,
  onToggleStatus,
  onDeleteAccount,
}) => {
  const [activeTab, setActiveTab] = useState<AccountTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<Account | null>(null);

  const tabs: { id: AccountTypeFilter; label: string }[] = [
    { id: "all", label: "All Accounts" },
    { id: "ASSET", label: "Assets" },
    { id: "LIABILITY", label: "Liabilities" },
    { id: "EQUITY", label: "Equity" },
    { id: "REVENUE", label: "Revenue" },
    { id: "EXPENSE", label: "Expenses" },
  ];

  const tabCounts = useMemo(() => {
    return {
      all: accounts.length,
      ASSET: accounts.filter((a) => a.type === "ASSET").length,
      LIABILITY: accounts.filter((a) => a.type === "LIABILITY").length,
      EQUITY: accounts.filter((a) => a.type === "EQUITY").length,
      REVENUE: accounts.filter((a) => a.type === "REVENUE").length,
      EXPENSE: accounts.filter((a) => a.type === "EXPENSE").length,
    };
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return accounts.filter((account) => {
      const matchesType = activeTab === "all" || account.type === activeTab;
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
          ? account.active
          : !account.active;

      const matchesSearch =
        !q ||
        account.code.toLowerCase().includes(q) ||
        account.name.toLowerCase().includes(q) ||
        (account.subtype && account.subtype.toLowerCase().includes(q)) ||
        (account.description && account.description.toLowerCase().includes(q));

      return matchesType && matchesStatus && matchesSearch;
    });
  }, [accounts, activeTab, statusFilter, searchQuery]);

  const columns: Column<Account>[] = [
    {
      header: "Code",
      accessorKey: "code",
      width: "110px",
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-bold text-xs bg-page px-2 py-0.5 border border-grid text-text">
            {r.code}
          </span>
          {r.isSystem && (
            <span title="System control account (protected)" className="text-muted">
              <Lock className="w-3 h-3 text-muted" />
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Account Name & Subtype",
      accessorKey: "name",
      cell: (r) => (
        <div className="min-w-[200px]">
          <div className="font-bold text-sm text-text leading-tight">{r.name}</div>
          {r.subtype && (
            <div className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
              <Layers className="w-3 h-3" />
              <span>{r.subtype}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Classification",
      accessorKey: "type",
      cell: (r) => {
        const config = TYPE_CONFIGS[r.type];
        return (
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border border-ink shadow-[1px_1px_0_var(--q-ink)] ${config.badgeClass}`}
          >
            {config.label}
          </span>
        );
      },
    },
    {
      header: "Normal Balance",
      width: "120px",
      cell: (r) => {
        const isDebit = TYPE_CONFIGS[r.type].normalBalance === "Debit";
        return (
          <span className="text-xs font-mono font-medium flex items-center gap-1 text-muted">
            {isDebit ? (
              <ArrowDownRight className="w-3 h-3 text-good" />
            ) : (
              <ArrowUpRight className="w-3 h-3 text-watch" />
            )}
            {TYPE_CONFIGS[r.type].normalBalance}
          </span>
        );
      },
    },
    {
      header: "Ledger Balance",
      accessorKey: "balance",
      align: "right",
      cell: (r) => {
        const isNegative = r.balance.startsWith("-");
        return (
          <div className="text-right whitespace-nowrap">
            <span
              className={`font-mono font-bold text-sm block ${
                isNegative ? "text-series-out" : "text-good"
              }`}
            >
              {formatMoney(r.balance, "$")}
            </span>
            <span className="text-[10px] font-mono text-muted block">{r.currency}</span>
          </div>
        );
      },
    },
    {
      header: "Status",
      accessorKey: "active",
      align: "center",
      cell: (r) => (
        <StatusChip
          status={r.active ? "good" : "idle"}
          label={r.active ? "Active" : "Inactive"}
        />
      ),
    },
    {
      header: "Actions",
      align: "right",
      cell: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => onOpenEdit(r)}
            className="p-1.5 bg-page border border-ink shadow-[1px_1px_0_var(--q-ink)] hover:bg-lime hover:text-ink text-text cursor-pointer active:translate-y-0.5 transition-colors"
            title={`Edit Account ${r.code}`}
            aria-label={`Edit Account ${r.code}`}
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          {onToggleStatus && !r.isSystem && (
            <button
              type="button"
              onClick={() => onToggleStatus(r.code)}
              className="p-1.5 bg-page border border-ink shadow-[1px_1px_0_var(--q-ink)] hover:bg-yellow hover:text-ink text-text cursor-pointer active:translate-y-0.5 transition-colors"
              title={r.active ? `Deactivate Account ${r.code}` : `Activate Account ${r.code}`}
              aria-label={r.active ? `Deactivate Account ${r.code}` : `Activate Account ${r.code}`}
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          )}
          {onDeleteAccount && !r.isSystem && (
            <button
              type="button"
              onClick={() => setDeleteCandidate(r)}
              className="p-1.5 bg-page border border-ink shadow-[1px_1px_0_var(--q-ink)] hover:bg-pink hover:text-white text-text cursor-pointer active:translate-y-0.5 transition-colors"
              title={`Archive Account ${r.code}`}
              aria-label={`Archive Account ${r.code}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setActiveTab("all");
  };

  const defaultCreateType: AccountType | undefined =
    activeTab === "all" ? undefined : activeTab;

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Type Tabs */}
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="tablist"
          aria-label="Account classification tabs"
        >
          {tabs.map((tab) => {
            const count = tabCounts[tab.id];
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`neo-btn py-1.5 px-3 text-xs font-bold transition-all ${
                  isActive
                    ? "bg-lime text-ink border-line shadow-sm -translate-y-0.5"
                    : "bg-panel text-text border-line hover:bg-cream"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`ml-1 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full border border-ink ${
                    isActive ? "bg-panel text-ink" : "bg-page text-muted"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right side: Search & Status Filter */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Pills */}
          <div className="flex items-center gap-1 bg-page border-line p-0.5 shadow-sm">
            {(["all", "active", "inactive"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-colors ${
                  statusFilter === s
                    ? "bg-lime text-ink border border-ink shadow-[1px_1px_0_var(--q-ink)]"
                    : "text-muted hover:text-text"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="flex items-center gap-1.5 bg-page border-line shadow-sm px-2.5 py-1.5 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-muted flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code or name…"
              className="w-full bg-transparent border-none outline-none text-xs font-bold text-text placeholder:text-muted"
            />
          </div>

          {/* Primary CTA */}
          <Button variant="lime" size="md" onClick={() => onOpenCreate(defaultCreateType)}>
            + New Account
          </Button>
        </div>
      </div>

      {/* Table Card */}
      <Card>
        <DataTable
          columns={columns}
          data={filteredAccounts}
          emptyTitle="No accounts found"
          emptyDescription={
            searchQuery
              ? `No ledger accounts matched "${searchQuery}". Clear your search to see all accounts.`
              : "No accounts found under this classification. Add your first account to build your chart."
          }
          emptyActionLabel={searchQuery ? "Clear search" : "+ New Account"}
          onEmptyAction={searchQuery ? clearFilters : () => onOpenCreate(defaultCreateType)}
        />
      </Card>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteCandidate)}
        onClose={() => setDeleteCandidate(null)}
        title="Archive Account?"
        message={`Are you sure you want to deactivate and archive account ${deleteCandidate?.code} (${deleteCandidate?.name})? Existing ledger journals will retain this code, but new entries cannot select it.`}
        actionVerb="Archive Account"
        actionVariant="pink"
        onConfirm={() => {
          if (deleteCandidate && onDeleteAccount) {
            onDeleteAccount(deleteCandidate.code);
            setDeleteCandidate(null);
          }
        }}
      />
    </div>
  );
};
