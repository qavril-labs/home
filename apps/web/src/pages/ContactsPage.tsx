import React, { useState } from "react";
import { Card } from "../components/ui/Card";
import { DataTable, type Column } from "../components/ui/DataTable";
import { Button } from "../components/ui/Button";
import { StatusChip } from "../components/ui/StatusChip";
import { Drawer } from "../components/ui/Drawer";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useToast } from "../context/ToastContext";
import { formatMoney } from "../lib/currency";
import type { Contact } from "../types";
import { Users, Plus, Search, Mail, Phone, MapPin, Edit3, Trash2 } from "lucide-react";

export interface ContactsPageProps {
  contacts: Contact[];
  onAddContact: (contact: Contact) => void;
  onUpdateContact: (contact: Contact) => void;
  onDeleteContact: (id: string) => void;
}

export const ContactsPage: React.FC<ContactsPageProps> = ({
  contacts,
  onAddContact,
  onUpdateContact,
  onDeleteContact,
}) => {
  const { showToast } = useToast();
  const [filterType, setFilterType] = useState<"all" | "customer" | "supplier">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [type, setType] = useState<"customer" | "supplier" | "both">("customer");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [taxId, setTaxId] = useState("");
  const [balance, setBalance] = useState("0.00");

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    contactId: string;
    contactName: string;
  }>({ isOpen: false, contactId: "", contactName: "" });

  const openCreateDrawer = () => {
    setEditingContact(null);
    setName("");
    setType("customer");
    setEmail("");
    setPhone("");
    setCity("");
    setTaxId("");
    setBalance("0.00");
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (contact: Contact) => {
    setEditingContact(contact);
    setName(contact.name);
    setType(contact.type);
    setEmail(contact.email);
    setPhone(contact.phone);
    setCity(contact.city || "");
    setTaxId(contact.taxId || "");
    setBalance(contact.balance);
    setIsDrawerOpen(true);
  };

  const handleSaveContact = () => {
    if (!name.trim()) return;

    if (editingContact) {
      const updated: Contact = {
        ...editingContact,
        name: name.trim(),
        type,
        email: email.trim(),
        phone: phone.trim(),
        city: city.trim(),
        taxId: taxId.trim(),
        balance,
      };
      onUpdateContact(updated);
      showToast(`Contact updated: ${updated.name}`, { type: "success" });
    } else {
      const newContact: Contact = {
        id: "CNT-" + Math.floor(100 + Math.random() * 900),
        name: name.trim(),
        type,
        email: email.trim(),
        phone: phone.trim(),
        city: city.trim(),
        taxId: taxId.trim(),
        balance: balance || "0.00",
        status: "active",
      };
      onAddContact(newContact);
      showToast(`Contact created: ${newContact.name}`, { type: "success" });
    }

    setIsDrawerOpen(false);
  };

  const filteredContacts = contacts.filter((c) => {
    const matchesType = filterType === "all" || c.type === filterType || c.type === "both";
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const columns: Column<Contact>[] = [
    {
      header: "Contact ID",
      accessorKey: "id",
      cell: (r) => <span className="font-mono font-bold text-xs">{r.id}</span>,
    },
    {
      header: "Business Name",
      accessorKey: "name",
      cell: (r) => (
        <div>
          <div className="font-bold text-sm text-text">{r.name}</div>
          {r.city && (
            <div className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" />
              {r.city}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Type",
      accessorKey: "type",
      cell: (r) => {
        const badgeColor =
          r.type === "customer"
            ? "bg-cyan text-ink"
            : r.type === "supplier"
            ? "bg-yellow text-ink"
            : "bg-lime text-ink";
        return (
          <span
            className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wider border border-ink shadow-[1px_1px_0_var(--q-ink)] ${badgeColor}`}
          >
            {r.type}
          </span>
        );
      },
    },
    {
      header: "Communication",
      cell: (r) => (
        <div className="text-xs space-y-0.5">
          <div className="flex items-center gap-1 text-text">
            <Mail className="w-3 h-3 text-muted" />
            <span>{r.email}</span>
          </div>
          <div className="flex items-center gap-1 text-muted">
            <Phone className="w-3 h-3" />
            <span>{r.phone}</span>
          </div>
        </div>
      ),
    },
    {
      header: "Current Ledger Balance",
      accessorKey: "balance",
      align: "right",
      cell: (r) => {
        const isNegative = r.balance.startsWith("-");
        return (
          <span
            className={`font-mono font-bold text-sm ${
              isNegative ? "text-series-out" : "text-good"
            }`}
          >
            {formatMoney(r.balance, "$")}
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
          status={r.status === "active" ? "good" : "watch"}
          label={r.status === "active" ? "Active" : "On Hold"}
        />
      ),
    },
    {
      header: "Actions",
      align: "right",
      cell: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => openEditDrawer(r)}
            className="p-1.5 bg-page border border-ink shadow-[1px_1px_0_var(--q-ink)] hover:bg-lime text-ink cursor-pointer active:translate-y-0.5"
            title="Edit Contact"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() =>
              setConfirmDialog({
                isOpen: true,
                contactId: r.id,
                contactName: r.name,
              })
            }
            className="p-1.5 bg-page border border-ink shadow-[1px_1px_0_var(--q-ink)] hover:bg-pink hover:text-white text-ink cursor-pointer active:translate-y-0.5"
            title="Archive Contact"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Title Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-pink block">
            Master Data · MDM-01
          </span>
          <h1 className="font-display font-extrabold text-3xl uppercase tracking-tight text-text leading-tight">
            Customers & Suppliers
          </h1>
          <p className="text-xs text-muted mt-1">
            Single shared party directory for customers, suppliers, partners and employees.
          </p>
        </div>

        <Button variant="lime" size="md" onClick={openCreateDrawer}>
          <Plus className="w-4 h-4 mr-1" />
          New contact
        </Button>
      </div>

      {/* Directory Filter & Search Card */}
      <Card>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b-line pb-2 sm:pb-0 sm:border-b-0">
            {(["all", "customer", "supplier"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 text-xs font-bold border-2 transition-all ${
                  filterType === t
                    ? "bg-lime text-ink border-ink shadow-[2px_2px_0_var(--q-ink)] -translate-y-0.5"
                    : "bg-panel text-muted border-transparent hover:border-ink hover:text-text"
                }`}
              >
                {t === "all" ? "All Contacts" : t === "customer" ? "Customers" : "Suppliers"}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-2 bg-page border-line shadow-sm px-3 py-1.5 sm:w-72">
            <Search className="w-4 h-4 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, ID or email…"
              className="w-full bg-transparent border-none outline-none text-xs font-bold text-text placeholder:text-muted"
            />
          </div>
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={filteredContacts}
          emptyTitle="No contacts found"
          emptyDescription="Add your first customer or supplier to link orders and invoices."
          onEmptyAction={openCreateDrawer}
          emptyActionLabel="Add new contact"
        />
      </Card>

      {/* Slide-out Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingContact ? "Edit contact details" : "Add new party record"}
        description="Master Data Management (MDM-01) party profile."
        primaryActionLabel={editingContact ? "Save changes" : "Create contact"}
        primaryActionVariant="lime"
        onPrimaryAction={handleSaveContact}
        secondaryActionLabel="Cancel"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
              Business / Contact Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Industrial Corp"
              className="w-full px-3 py-2 text-sm font-bold bg-page border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
              Party Role / Type *
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-3 py-2 text-sm font-bold bg-page border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
            >
              <option value="customer">Customer (Accounts Receivable)</option>
              <option value="supplier">Supplier (Accounts Payable)</option>
              <option value="both">Both Customer & Supplier</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="billing@company.com"
                className="w-full px-3 py-2 text-xs font-bold bg-page border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555-019-2000"
                className="w-full px-3 py-2 text-xs font-bold bg-page border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                City / Location
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Detroit, MI"
                className="w-full px-3 py-2 text-xs font-bold bg-page border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                Tax ID / Registration
              </label>
              <input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="US-9821034"
                className="w-full px-3 py-2 text-xs font-bold bg-page border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
              Opening Balance (USD)
            </label>
            <input
              type="text"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-xs font-mono font-bold bg-page border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
            />
            <span className="text-[10px] text-muted mt-1 block">
              Positive values represent receivables (they owe you); negative values represent payables.
            </span>
          </div>
        </div>
      </Drawer>

      {/* Confirm Deletion / Archival */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((p) => ({ ...p, isOpen: false }))}
        title="Archive Contact?"
        message={`Are you sure you want to archive "${confirmDialog.contactName}"? Existing ledger journals and historical invoices will be preserved, but new orders will be blocked.`}
        actionVerb="Archive Contact"
        actionVariant="pink"
        onConfirm={() => {
          onDeleteContact(confirmDialog.contactId);
          setConfirmDialog((p) => ({ ...p, isOpen: false }));
          showToast(`Archived contact: ${confirmDialog.contactName}`, { type: "info" });
        }}
      />
    </div>
  );
};
