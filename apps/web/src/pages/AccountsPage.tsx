import React, { useState, useMemo } from "react";
import { AccountList } from "../modules/accounts/AccountList";
import { AccountDrawer } from "../modules/accounts/AccountDrawer";
import { Button } from "../components/ui/Button";
import { useToast } from "../context/ToastContext";
import type { Account, AccountType } from "../types";
import { Plus, Radio } from "lucide-react";

export interface AccountsPageProps {
  accounts: Account[];
  isLiveApi?: boolean;
  onAddAccount: (account: Account) => void;
  onUpdateAccount: (account: Account) => void;
  onDeleteAccount: (code: string) => void;
  onToggleStatusAccount?: (code: string) => void;
}

export const AccountsPage: React.FC<AccountsPageProps> = ({
  accounts,
  isLiveApi = false,
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount,
  onToggleStatusAccount,
}) => {
  const { showToast } = useToast();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [drawerDefaultType, setDrawerDefaultType] = useState<AccountType>("ASSET");

  // KPI summaries
  const kpis = useMemo(() => {
    const assets = accounts.filter((a) => a.type === "ASSET");
    const liabilities = accounts.filter((a) => a.type === "LIABILITY");
    const equity = accounts.filter((a) => a.type === "EQUITY");
    const revenue = accounts.filter((a) => a.type === "REVENUE");
    const expenses = accounts.filter((a) => a.type === "EXPENSE");

    return {
      assetsCount: assets.length,
      liabilitiesCount: liabilities.length,
      equityCount: equity.length,
      revenueCount: revenue.length,
      expensesCount: expenses.length,
    };
  }, [accounts]);

  const handleOpenCreate = (type?: AccountType) => {
    setEditingAccount(null);
    setDrawerDefaultType(type || "ASSET");
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (account: Account) => {
    setEditingAccount(account);
    setDrawerDefaultType(account.type);
    setIsDrawerOpen(true);
  };

  const handleSave = (account: Account) => {
    const isExisting = accounts.some((a) => a.code === account.code);
    if (isExisting) {
      onUpdateAccount(account);
      showToast(`Updated account: ${account.code} · ${account.name}`, { type: "success" });
    } else {
      onAddAccount(account);
      showToast(`Created account: ${account.code} · ${account.name}`, { type: "success" });
    }
    setIsDrawerOpen(false);
  };

  const handleDelete = (code: string) => {
    const target = accounts.find((a) => a.code === code);
    onDeleteAccount(code);
    showToast(`Archived account: ${code} · ${target?.name || ""}`, { type: "info" });
  };

  const handleToggleStatus = (code: string) => {
    if (onToggleStatusAccount) {
      onToggleStatusAccount(code);
      const target = accounts.find((a) => a.code === code);
      const nextStatus = target?.active ? "inactive" : "active";
      showToast(
        `Account ${code} set to ${nextStatus}`,
        { type: "info" }
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-pink">
              Master Data · MDM-03
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold border border-ink ${
                isLiveApi ? "bg-lime text-ink" : "bg-cream text-ink"
              }`}
            >
              <Radio className="w-3 h-3" />
              {isLiveApi ? "LIVE HTTP · /v1/master-data/accounts" : "CONTRACT CLIENT · /v1/master-data/accounts"}
            </span>
          </div>
          <h1 className="font-display font-extrabold text-3xl uppercase tracking-tight text-text leading-tight">
            Chart of Accounts
          </h1>
          <p className="text-xs text-muted mt-1 max-w-xl">
            Single master ledger structure governing double-entry bookkeeping across Assets, Liabilities,
            Equity, Revenue, and Expenses with multi-currency tracking.
          </p>
        </div>

        <Button variant="lime" size="md" onClick={() => handleOpenCreate("ASSET")}>
          <Plus className="w-4 h-4 mr-1" />
          New Account
        </Button>
      </div>

      {/* KPI Tiles row per UI Contract */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="neo-card p-3 bg-lime text-ink">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink/80 block">
            1000s · Assets
          </span>
          <div className="font-display font-extrabold text-2xl mt-0.5">
            {kpis.assetsCount}
          </div>
          <span className="text-[10px] text-ink/80 font-medium block">
            Normal: Debit
          </span>
        </div>

        <div className="neo-card p-3 bg-yellow text-ink">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink/80 block">
            2000s · Liabilities
          </span>
          <div className="font-display font-extrabold text-2xl mt-0.5">
            {kpis.liabilitiesCount}
          </div>
          <span className="text-[10px] text-ink/80 font-medium block">
            Normal: Credit
          </span>
        </div>

        <div className="neo-card p-3 bg-cyan text-ink">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink/80 block">
            3000s · Equity
          </span>
          <div className="font-display font-extrabold text-2xl mt-0.5">
            {kpis.equityCount}
          </div>
          <span className="text-[10px] text-ink/80 font-medium block">
            Normal: Credit
          </span>
        </div>

        <div className="neo-card p-3 bg-violet text-white">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/80 block">
            4000s · Revenue
          </span>
          <div className="font-display font-extrabold text-2xl mt-0.5">
            {kpis.revenueCount}
          </div>
          <span className="text-[10px] text-white/80 font-medium block">
            Normal: Credit
          </span>
        </div>

        <div className="neo-card p-3 bg-orange text-white">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/80 block">
            5000–6000s · Expenses
          </span>
          <div className="font-display font-extrabold text-2xl mt-0.5">
            {kpis.expensesCount}
          </div>
          <span className="text-[10px] text-white/80 font-medium block">
            Normal: Debit
          </span>
        </div>
      </div>

      {/* Account List Module */}
      <AccountList
        accounts={accounts}
        onOpenCreate={handleOpenCreate}
        onOpenEdit={handleOpenEdit}
        onToggleStatus={handleToggleStatus}
        onDeleteAccount={handleDelete}
      />

      {/* Slide-out Drawer */}
      <AccountDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        editingAccount={editingAccount}
        defaultType={drawerDefaultType}
        onSave={handleSave}
      />
    </div>
  );
};

export default AccountsPage;
