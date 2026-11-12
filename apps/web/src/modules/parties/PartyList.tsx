import React, { useMemo, useState } from "react";
import { Card } from "../../components/ui/Card";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { Button } from "../../components/ui/Button";
import { StatusChip } from "../../components/ui/StatusChip";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { formatMoney } from "../../lib/currency";
import type { Party, PartyStatus, PartyType } from "../../types";
import {
  Building2,
  Edit3,
  Power,
  Search,
  Trash2,
  Truck,
  Users,
  X,
} from "lucide-react";

export type PartyTypeFilter = "all" | "customer" | "supplier";
export type PartyStatusFilter = "all" | PartyStatus;

export interface PartyListProps {
  parties: Party[];
  onOpenCreate: (defaultType?: PartyType) => void;
  onOpenEdit: (party: Party) => void;
  onToggleStatus?: (id: string) => void;
  onDeleteParty?: (id: string) => void;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$",
  INR: "₹",
};

const TYPE_BADGE_MAP: Record<
  PartyType,
  { label: string; className: string }
> = {
  customer: {
    label: "Customer",
    className: "bg-cyan text-ink",
  },
  supplier: {
    label: "Supplier",
    className: "bg-yellow text-ink",
  },
  both: {
    label: "Both",
    className: "bg-violet text-white",
  },
};

function getBalanceToneClass(amountStr: string): string {
  const trimmed = amountStr.trim();
  if (trimmed.startsWith("-")) {
    return "text-series-out";
  }
  if (/^0+(?:\.0+)?$/.test(trimmed)) {
    return "text-muted";
  }
  return "text-good";
}

export const PartyList: React.FC<PartyListProps> = ({
  parties,
  onOpenCreate,
  onOpenEdit,
  onToggleStatus,
  onDeleteParty,
}) => {
  const [activeTab, setActiveTab] = useState<PartyTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<PartyStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<Party | null>(null);

  const typeTabs: {
    id: PartyTypeFilter;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "all", label: "All", icon: Users },
    { id: "customer", label: "Customers", icon: Building2 },
    { id: "supplier", label: "Suppliers", icon: Truck },
  ];

  const statusOptions: { id: PartyStatusFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "inactive", label: "Inactive" },
  ];

  // Counts per type tab (a party with type "both" counts toward both Customers and Suppliers)
  const tabCounts = useMemo(() => {
    return {
      all: parties.length,
      customer: parties.filter((p) => p.type === "customer" || p.type === "both").length,
      supplier: parties.filter((p) => p.type === "supplier" || p.type === "both").length,
    };
  }, [parties]);

  const filteredParties = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return parties.filter((party) => {
      const matchesType =
        activeTab === "all" ||
        party.type === activeTab ||
        party.type === "both";

      const matchesStatus =
        statusFilter === "all" || party.status === statusFilter;

      const matchesSearch =
        !q ||
        party.tradeName.toLowerCase().includes(q) ||
        party.legalName.toLowerCase().includes(q) ||
        party.contactPerson.toLowerCase().includes(q) ||
        party.email.toLowerCase().includes(q) ||
        party.taxRegistrationNumber.toLowerCase().includes(q) ||
        party.id.toLowerCase().includes(q);

      return matchesType && matchesStatus && matchesSearch;
    });
  }, [parties, activeTab, statusFilter, searchQuery]);

  const columns: Column<Party>[] = [
    {
      header: "Company Name",
      accessorKey: "tradeName",
      cell: (r) => {
        const displayName = r.tradeName || r.legalName;
        const badge = TYPE_BADGE_MAP[r.type];
        return (
          <div className="min-w-[200px]">
            <div className="font-bold text-sm text-text leading-tight">
              {displayName}
            </div>
            {r.legalName && r.legalName !== displayName && (
              <div className="text-[11px] text-muted mt-0.5 leading-snug">
                {r.legalName}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 border border-ink shadow-[1px_1px_0_var(--q-ink)] ${badge.className}`}
              >
                {badge.label}
              </span>
              <span className="text-[10px] font-mono font-bold text-muted bg-page px-1.5 py-0.5 border border-grid">
                {r.id}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      header: "Contact Person",
      accessorKey: "contactPerson",
      cell: (r) => (
        <div className="min-w-[140px]">
          <div className="font-bold text-xs text-text">{r.contactPerson}</div>
          {r.phone && (
            <div className="text-[11px] font-mono text-muted mt-0.5">
              {r.phone}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Email",
      accessorKey: "email",
      cell: (r) => (
        <span className="text-xs font-medium text-text break-all">
          {r.email}
        </span>
      ),
    },
    {
      header: "Tax ID / VAT Number",
      accessorKey: "taxRegistrationNumber",
      cell: (r) => (
        <span className="font-mono font-bold text-xs text-text bg-page px-2 py-0.5 border border-grid inline-block whitespace-nowrap">
          {r.taxRegistrationNumber}
        </span>
      ),
    },
    {
      header: "Outstanding Balance",
      accessorKey: "outstandingBalance",
      align: "right",
      cell: (r) => {
        const symbol = CURRENCY_SYMBOLS[r.currency] ?? "$";
        return (
          <div className="text-right whitespace-nowrap">
            <span
              className={`font-mono font-bold text-sm block ${getBalanceToneClass(
                r.outstandingBalance
              )}`}
            >
              {formatMoney(r.outstandingBalance, symbol)}
            </span>
            <span className="text-[10px] font-mono text-muted block">
              {r.currency} · {r.paymentTerms}
            </span>
          </div>
        );
      },
    },
    {
      header: "Status",
      accessorKey: "status",
      align: "center",
      cell: (r) => (
        <StatusChip
          status={r.status === "active" ? "good" : "idle"}
          label={r.status === "active" ? "Active" : "Inactive"}
        />
      ),
    },
    {
      header: "Actions",
      align: "right",
      cell: (r) => {
        const partyLabel = r.tradeName || r.legalName;
        return (
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => onOpenEdit(r)}
              className="p-1.5 bg-page border border-ink shadow-[1px_1px_0_var(--q-ink)] hover:bg-lime hover:text-ink text-text cursor-pointer active:translate-y-0.5 transition-colors"
              title={`Edit ${partyLabel}`}
              aria-label={`Edit ${partyLabel}`}
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            {onToggleStatus && (
              <button
                type="button"
                onClick={() => onToggleStatus(r.id)}
                className="p-1.5 bg-page border border-ink shadow-[1px_1px_0_var(--q-ink)] hover:bg-yellow hover:text-ink text-text cursor-pointer active:translate-y-0.5 transition-colors"
                title={
                  r.status === "active"
                    ? `Deactivate ${partyLabel}`
                    : `Activate ${partyLabel}`
                }
                aria-label={
                  r.status === "active"
                    ? `Deactivate ${partyLabel}`
                    : `Activate ${partyLabel}`
                }
              >
                <Power className="w-3.5 h-3.5" />
              </button>
            )}
            {onDeleteParty && (
              <button
                type="button"
                onClick={() => setDeleteCandidate(r)}
                className="p-1.5 bg-page border border-ink shadow-[1px_1px_0_var(--q-ink)] hover:bg-pink hover:text-white text-text cursor-pointer active:translate-y-0.5 transition-colors"
                title={`Delete ${partyLabel}`}
                aria-label={`Delete ${partyLabel}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const hasSearchOrStatusFilter =
    searchQuery.trim().length > 0 || statusFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    if (activeTab !== "all" && parties.length > 0) {
      setActiveTab("all");
    }
  };

  const defaultCreateType: PartyType | undefined =
    activeTab === "all" ? undefined : activeTab;

  const emptyStateConfig = useMemo(() => {
    if (hasSearchOrStatusFilter) {
      return {
        title: "No matching parties found",
        description: searchQuery.trim()
          ? `No customers or suppliers matched "${searchQuery.trim()}". Clear filters to see all records.`
          : `No ${statusFilter} parties match the selected filters. Clear filters to view all records.`,
        actionLabel: "Clear filters",
        onAction: clearFilters,
      };
    }

    if (activeTab === "customer") {
      return {
        title: "No customers recorded",
        description:
          "Add a customer (or a party marked Both) to start invoicing and tracking receivables.",
        actionLabel: "+ New Customer/Supplier",
        onAction: () => onOpenCreate("customer"),
      };
    }

    if (activeTab === "supplier") {
      return {
        title: "No suppliers recorded",
        description:
          "Add a supplier (or a party marked Both) to manage vendor bills, tax IDs, and payment terms.",
        actionLabel: "+ New Customer/Supplier",
        onAction: () => onOpenCreate("supplier"),
      };
    }

    return {
      title: "No customers or suppliers yet",
      description:
        "Create your first customer or supplier record with tax IDs, payment terms, and billing addresses.",
      actionLabel: "+ New Customer/Supplier",
      onAction: () => onOpenCreate(defaultCreateType),
    };
  }, [
    hasSearchOrStatusFilter,
    searchQuery,
    statusFilter,
    activeTab,
    defaultCreateType,
    onOpenCreate,
  ]);

  return (
    <div className="space-y-4">
      {/* Controls Bar: Type Tabs, Status Pills, Search & Primary Action */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Type Filter Tabs */}
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="tablist"
            aria-label="Party type filters"
          >
            {typeTabs.map((tab) => {
              const Icon = tab.icon;
              const count = tabCounts[tab.id];
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border-thin transition-all cursor-pointer ${
                    isActive
                      ? "bg-lime text-ink border-ink shadow-[2px_2px_0_var(--q-ink)] -translate-y-0.5"
                      : "bg-panel text-muted border-transparent hover:border-ink hover:text-text"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
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

          {/* Status Filter Pills */}
          <div
            className="flex items-center gap-1 bg-page p-1 border-thin border-ink"
            role="group"
            aria-label="Party status filters"
          >
            {statusOptions.map((opt) => {
              const isActive = statusFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setStatusFilter(opt.id)}
                  className={`px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer ${
                    isActive
                      ? "bg-yellow text-ink border border-ink shadow-[1px_1px_0_var(--q-ink)]"
                      : "text-muted hover:text-text border border-transparent"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search & Create Button */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-2 bg-page border-line shadow-sm px-3 py-1.5 w-full sm:w-64">
            <Search className="w-4 h-4 text-muted flex-shrink-0" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, contact, email, tax ID…"
              aria-label="Search customers and suppliers"
              className="w-full bg-transparent border-none outline-none text-xs font-bold text-text placeholder:text-muted"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search query"
                className="text-muted hover:text-text cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <Button
            type="button"
            variant="lime"
            size="sm"
            className="whitespace-nowrap"
            onClick={() => onOpenCreate(defaultCreateType)}
          >
            + New Customer/Supplier
          </Button>
        </div>
      </div>

      {/* Main DataTable Card */}
      <Card>
        <DataTable
          columns={columns}
          data={filteredParties}
          emptyTitle={emptyStateConfig.title}
          emptyDescription={emptyStateConfig.description}
          emptyActionLabel={emptyStateConfig.actionLabel}
          onEmptyAction={emptyStateConfig.onAction}
        />
      </Card>

      {/* Delete Confirmation Dialog */}
      {onDeleteParty && (
        <ConfirmDialog
          isOpen={Boolean(deleteCandidate)}
          onClose={() => setDeleteCandidate(null)}
          title="Delete Party Record?"
          message={`Are you sure you want to delete "${
            deleteCandidate?.tradeName || deleteCandidate?.legalName
          }" (${deleteCandidate?.id})? This record will be permanently removed from master data.`}
          actionVerb="Delete Party"
          actionVariant="pink"
          onConfirm={() => {
            if (deleteCandidate) {
              onDeleteParty(deleteCandidate.id);
              setDeleteCandidate(null);
            }
          }}
        />
      )}
    </div>
  );
};
