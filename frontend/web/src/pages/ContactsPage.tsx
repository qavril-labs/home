import React, { useState, useMemo } from "react";
import { PartyList } from "../modules/parties/PartyList";
import { PartyDrawer } from "../modules/parties/PartyDrawer";
import { CustomerStatementDrawer } from "../modules/bots/CustomerStatementDrawer";
import { Button } from "../components/ui/Button";
import { useToast } from "../context/ToastContext";
import { apiClient } from "../lib/api-client";
import type { CustomerStatement, Party, PartyType } from "../types";
import { Plus, Radio } from "lucide-react";

export interface ContactsPageProps {
  parties: Party[];
  isLiveApi?: boolean;
  onAddParty: (party: Party) => void;
  onUpdateParty: (party: Party) => void;
  onDeleteParty: (id: string) => void;
  onToggleStatusParty?: (id: string) => void;
}

export const ContactsPage: React.FC<ContactsPageProps> = ({
  parties,
  isLiveApi = false,
  onAddParty,
  onUpdateParty,
  onDeleteParty,
  onToggleStatusParty,
}) => {
  const { showToast } = useToast();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [drawerDefaultType, setDrawerDefaultType] = useState<PartyType>("customer");
  const [activeStatement, setActiveStatement] = useState<CustomerStatement | null>(null);

  const handleOpenStatement = async (partyId: string) => {
    const party = parties.find((p) => p.id === partyId);
    const res = await apiClient.getCustomerStatement(partyId, party);
    setActiveStatement(res.data);
  };

  // KPI summaries
  const kpis = useMemo(() => {
    const total = parties.length;
    const customerCount = parties.filter((p) => p.type === "customer" || p.type === "both").length;
    const supplierCount = parties.filter((p) => p.type === "supplier" || p.type === "both").length;
    const activeCount = parties.filter((p) => p.status === "active").length;

    return { total, customerCount, supplierCount, activeCount };
  }, [parties]);

  const handleOpenCreate = (type?: PartyType) => {
    setEditingParty(null);
    setDrawerDefaultType(type || "customer");
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (party: Party) => {
    setEditingParty(party);
    setDrawerDefaultType(party.type);
    setIsDrawerOpen(true);
  };

  const handleSave = (party: Party) => {
    const isExisting = parties.some((p) => p.id === party.id);
    if (isExisting) {
      onUpdateParty(party);
      showToast(`Updated party: ${party.tradeName || party.legalName}`, { type: "success" });
    } else {
      onAddParty(party);
      showToast(`Created party: ${party.tradeName || party.legalName}`, { type: "success" });
    }
    setIsDrawerOpen(false);
  };

  const handleDelete = (id: string) => {
    const target = parties.find((p) => p.id === id);
    onDeleteParty(id);
    showToast(`Archived party: ${target?.tradeName || target?.legalName || id}`, { type: "info" });
  };

  const handleToggleStatus = (id: string) => {
    if (onToggleStatusParty) {
      onToggleStatusParty(id);
      const target = parties.find((p) => p.id === id);
      const nextStatus = target?.status === "active" ? "inactive" : "active";
      showToast(
        `${target?.tradeName || target?.legalName || "Party"} set to ${nextStatus}`,
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
              Master Data · MDM-01
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold border border-ink ${
                isLiveApi ? "bg-lime text-ink" : "bg-cream text-ink"
              }`}
            >
              <Radio className="w-3 h-3" />
              {isLiveApi ? "LIVE HTTP · /v1/master-data/parties" : "CONTRACT CLIENT · /v1/master-data/parties"}
            </span>
          </div>
          <h1 className="font-display font-extrabold text-3xl uppercase tracking-tight text-text leading-tight">
            Customers & Suppliers
          </h1>
          <p className="text-xs text-muted mt-1 max-w-xl">
            Unified party directory for customers, suppliers, and trading partners.
            Controls billing/shipping addresses, tax IDs, and payment terms across sales and procurement.
          </p>
        </div>

        <Button variant="lime" size="md" onClick={() => handleOpenCreate("customer")}>
          <Plus className="w-4 h-4 mr-1" />
          New Customer/Supplier
        </Button>
      </div>

      {/* KPI Tiles row per UI Contract */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="neo-card p-4 bg-panel">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
            Total Directory
          </span>
          <div className="font-display font-extrabold text-2xl lg:text-3xl text-text mt-1">
            {kpis.total}
          </div>
          <span className="text-[11px] text-muted font-medium mt-1 block">
            Master party records
          </span>
        </div>

        <div className="neo-card p-4 bg-cyan text-ink">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink/80 block">
            Customers
          </span>
          <div className="font-display font-extrabold text-2xl lg:text-3xl mt-1">
            {kpis.customerCount}
          </div>
          <span className="text-[11px] text-ink/80 font-medium mt-1 block">
            Accounts receivable
          </span>
        </div>

        <div className="neo-card p-4 bg-yellow text-ink">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink/80 block">
            Suppliers
          </span>
          <div className="font-display font-extrabold text-2xl lg:text-3xl mt-1">
            {kpis.supplierCount}
          </div>
          <span className="text-[11px] text-ink/80 font-medium mt-1 block">
            Accounts payable
          </span>
        </div>

        <div className="neo-card p-4 bg-lime text-ink">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink/80 block">
            Active Accounts
          </span>
          <div className="font-display font-extrabold text-2xl lg:text-3xl mt-1">
            {kpis.activeCount}
          </div>
          <span className="text-[11px] text-ink/80 font-medium mt-1 block">
            Ready for transacting
          </span>
        </div>
      </div>

      {/* Party List Module */}
      <PartyList
        parties={parties}
        onOpenCreate={handleOpenCreate}
        onOpenEdit={handleOpenEdit}
        onToggleStatus={handleToggleStatus}
        onDeleteParty={handleDelete}
        onOpenStatement={(partyId) => void handleOpenStatement(partyId)}
      />

      {/* Slide-out Drawer */}
      <PartyDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        editingParty={editingParty}
        defaultType={drawerDefaultType}
        onSave={handleSave}
      />

      {/* Customer Statement Viewer Drawer (FIN-02) */}
      <CustomerStatementDrawer
        isOpen={Boolean(activeStatement)}
        onClose={() => setActiveStatement(null)}
        statement={activeStatement}
      />
    </div>
  );
};

export default ContactsPage;
