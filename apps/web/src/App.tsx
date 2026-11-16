import React, { useEffect, useState } from "react";
import { AppHeader } from "./components/ui/AppHeader";
import { Sidebar } from "./components/ui/Sidebar";
import { CommandBar } from "./components/ui/CommandBar";
import { ToastContainer } from "./components/ui/Toast";
import { Gate } from "./components/ui/Gate";
import { Dashboard } from "./pages/Dashboard";
import { ItemsPage } from "./pages/ItemsPage";
import { ContactsPage } from "./pages/ContactsPage";
import { AccountsPage } from "./pages/AccountsPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { PayablesManager } from "./modules/invoicing/PayablesManager";
import { LedgerPage } from "./pages/LedgerPage";
import { InventoryPage } from "./pages/InventoryPage";
import { CrmPipelinePage } from "./pages/CrmPipelinePage";
import { BankReconciliationPage } from "./pages/BankReconciliationPage";
import { ImportPage } from "./pages/ImportPage";
import { GalleryPage } from "./pages/GalleryPage";
import { IndustryPacksHub } from "./modules/packs/IndustryPacksHub";
import { DocumentIntelligenceDrawer } from "./modules/documents/DocumentIntelligenceDrawer";
import { FinancialDigitalTwinStudio } from "./modules/simulation/FinancialDigitalTwinStudio";
import { AutopilotMissionControlDrawer } from "./modules/autopilot/AutopilotMissionControlDrawer";
import { LedgerLou } from "./modules/bots/LedgerLou";
import { ChaseChloe } from "./modules/bots/ChaseChloe";
import { RestockRex } from "./modules/bots/RestockRex";
import { GuardGus } from "./modules/bots/GuardGus";
import { ForecastFinn } from "./modules/bots/ForecastFinn";
import { Pip } from "./modules/bots/Pip";
import { TicketTess } from "./modules/bots/TicketTess";
import { OnboardOla } from "./modules/bots/OnboardOla";
import { ApprovalsInbox } from "./modules/approvals/ApprovalsInbox";
import { apiClient } from "./lib/api-client";
import {
  initialMockAccounts,
  initialMockBills,
  initialMockInvoices,
  initialMockInvoicesSummary,
  initialMockItems,
  initialMockJournals,
  initialMockParties,
  initialWarehouses,
  initialWarehouseStock,
  initialStockTransfers,
  initialPipelineDeals,
  initialSalesQuotes,
  initialBankFeedLines,
} from "./lib/api-mock";
import type {
  Account,
  Bill,
  Invoice,
  InvoicesSummary,
  JournalEntry,
  Party,
  ProductItem,
  WarehouseLocation,
  WarehouseStockSlot,
  StockTransfer,
  PipelineDeal,
  SalesQuote,
  BankFeedLine,
} from "./types";

function getTabFromLocation(): string {
  if (typeof window === "undefined") return "dashboard";
  const hash = window.location.hash.replace(/^#\/?/, "").trim();
  if (hash) return hash;
  const path = window.location.pathname.replace(/^\/+|\/+$/g, "");
  if (path === "gallery") return "gallery";
  return "dashboard";
}

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      if (typeof window !== "undefined" && window.location.hash.includes("signed-out")) {
        return false;
      }
      const sess = sessionStorage.getItem("qavril-session");
      if (sess === "signed-out") return false;
    } catch {
      // ignore
    }
    return true;
  });

  const [activeTab, setActiveTab] = useState<string>(() => getTabFromLocation());
  const [isCommandBarOpen, setIsCommandBarOpen] = useState<boolean>(false);
  const [isOcrDrawerOpen, setIsOcrDrawerOpen] = useState<boolean>(false);
  const [isAutopilotDrawerOpen, setIsAutopilotDrawerOpen] = useState<boolean>(false);
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState<boolean>(false);

  const [items, setItems] = useState<ProductItem[]>(initialMockItems);
  const [parties, setParties] = useState<Party[]>(initialMockParties);
  const [accounts, setAccounts] = useState<Account[]>(initialMockAccounts);
  const [invoices, setInvoices] = useState<Invoice[]>(initialMockInvoices);
  const [invoicesSummary, setInvoicesSummary] = useState<InvoicesSummary>(
    initialMockInvoicesSummary
  );
  const [bills, setBills] = useState<Bill[]>(initialMockBills);
  const [journals, setJournals] = useState<JournalEntry[]>(initialMockJournals);
  const [warehouses] = useState<WarehouseLocation[]>(initialWarehouses);
  const [stockSlots] = useState<WarehouseStockSlot[]>(initialWarehouseStock);
  const [transfers, setTransfers] = useState<StockTransfer[]>(initialStockTransfers);
  const [pipelineDeals, setPipelineDeals] = useState<PipelineDeal[]>(initialPipelineDeals);
  const [salesQuotes, setSalesQuotes] = useState<SalesQuote[]>(initialSalesQuotes);
  const [bankFeedLines, setBankFeedLines] = useState<BankFeedLine[]>(initialBankFeedLines);
  const [isLiveApi, setIsLiveApi] = useState<boolean>(false);

  // Sync URL hash and activeTab
  const navigateToTab = (tab: string) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${tab}`);
    }
  };

  useEffect(() => {
    const onHashChange = () => {
      const tab = getTabFromLocation();
      if (tab === "signed-out") {
        setIsAuthenticated(false);
      }
      setActiveTab(tab);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Global keyboard shortcuts (Ctrl+K for CommandBar, ESC to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "k" || e.code === "KeyK")) {
        e.preventDefault();
        setIsCommandBarOpen((prev) => !prev);
      } else if (e.key === "Escape" || e.key === "Esc" || e.code === "Escape") {
        e.preventDefault();
        setIsCommandBarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // Load Master Data & Invoices from Fastify HTTP Endpoints via contract client
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    async function loadFromBackend() {
      const [partiesRes, itemsRes, accountsRes, invoicesRes, journalsRes] =
        await Promise.all([
          apiClient.listParties(),
          apiClient.listItems(),
          apiClient.listAccounts(),
          apiClient.listInvoices(),
          apiClient.listJournalEntries(),
        ]);

      if (cancelled) return;
      setParties(partiesRes.data);
      setItems(itemsRes.data);
      setAccounts(accountsRes.data);
      setInvoices(invoicesRes.data.invoices);
      setInvoicesSummary(invoicesRes.data.summary);
      setJournals(journalsRes.data);
      setIsLiveApi(
        partiesRes.isLive || itemsRes.isLive || accountsRes.isLive
      );
    }

    void loadFromBackend();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Journal actions
  const handleAddJournal = (entry: JournalEntry) => {
    setJournals((prev) => [entry, ...prev]);
  };

  const handlePostJournalDraft = (id: string) => {
    setJournals((prev) =>
      prev.map((j) =>
        j.id === id
          ? { ...j, status: "posted", postedAt: new Date().toISOString() }
          : j
      )
    );
  };

  const handleReverseJournal = (id: string) => {
    const target = journals.find((j) => j.id === id);
    if (!target) return;

    const reversalEntry: JournalEntry = {
      id: `jrn-${Date.now()}`,
      entryNumber: `REV-${target.entryNumber}`,
      date: new Date().toISOString().split("T")[0] || "2026-11-10",
      memo: `Reversal of ${target.entryNumber}: ${target.memo}`,
      sourceModule: "MANUAL",
      referenceDocument: target.entryNumber,
      status: "posted",
      lines: target.lines.map((l, idx) => ({
        id: `rev-line-${Date.now()}-${idx}`,
        accountCode: l.accountCode,
        accountName: l.accountName,
        side: l.side === "DEBIT" ? "CREDIT" : "DEBIT",
        amount: l.amount,
      })),
      totalDebit: target.totalCredit,
      totalCredit: target.totalDebit,
      isBalanced: true,
      postedAt: new Date().toISOString(),
    };

    setJournals((prev) => [
      reversalEntry,
      ...prev.map((j) =>
        j.id === id
          ? {
              ...j,
              status: "reversed" as const,
              reversedByEntryId: reversalEntry.id,
            }
          : j
      ),
    ]);
  };

  // Invoices actions (SAL-04 / FIN-02) via contract HTTP client
  const handleAddInvoice = (inv: Invoice) => {
    setInvoices((prev) => [inv, ...prev]);
    void apiClient.createInvoice(inv).then((res) => {
      if (res.isLive) {
        setInvoices((prev) =>
          prev.map((item) => (item.id === inv.id ? res.data : item))
        );
      }
    });
  };

  const handleUpdateInvoice = (updated: Invoice) => {
    setInvoices((prev) =>
      prev.map((i) => (i.id === updated.id ? updated : i))
    );
    void apiClient.updateInvoice(updated);
  };

  const handleDeleteInvoice = (id: string) => {
    setInvoices((prev) => prev.filter((i) => i.id !== id));
    void apiClient.deleteInvoice(id);
  };

  const handleMarkPaidInvoice = (id: string) => {
    setInvoices((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, status: "paid", balanceDue: "0.00", amountPaid: i.total }
          : i
      )
    );
    void apiClient.markInvoicePaid(id);
  };

  // Bills actions (FIN-03)
  const handleAddBill = (b: Bill) => {
    setBills((prev) => [b, ...prev]);
  };

  const handleApproveBill = (id: string) => {
    setBills((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: "approved" } : b))
    );
  };

  const handlePayBill = (id: string) => {
    setBills((prev) =>
      prev.map((b) =>
        b.id === id
          ? { ...b, status: "paid", balanceDue: "0.00", amountPaid: b.total }
          : b
      )
    );
  };

  const handleDeleteBill = (id: string) => {
    setBills((prev) => prev.filter((b) => b.id !== id));
  };

  // Item Master actions (MDM-02 -> /v1/master-data/items)
  const handleAddItem = (item: ProductItem) => {
    setItems((prev) => [item, ...prev]);
    void apiClient.createItem(item).then((res) => {
      if (res.isLive) {
        setItems((prev) =>
          prev.map((existing) => (existing.id === item.id ? res.data : existing))
        );
      }
    });
  };

  const handleUpdateItem = (updated: ProductItem) => {
    setItems((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
    void apiClient.updateItem(updated).then((res) => {
      if (res.isLive) {
        setItems((prev) =>
          prev.map((item) => (item.id === updated.id ? res.data : item))
        );
      }
    });
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    void apiClient.deleteItem(id);
  };

  // Party Master actions (MDM-01 -> /v1/master-data/parties)
  const handleAddParty = (party: Party) => {
    setParties((prev) => [party, ...prev]);
    void apiClient.createParty(party).then((res) => {
      if (res.isLive) {
        setParties((prev) =>
          prev.map((existing) => (existing.id === party.id ? res.data : existing))
        );
      }
    });
  };

  const handleUpdateParty = (updated: Party) => {
    setParties((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p))
    );
    void apiClient.updateParty(updated).then((res) => {
      if (res.isLive) {
        setParties((prev) =>
          prev.map((p) => (p.id === updated.id ? res.data : p))
        );
      }
    });
  };

  const handleDeleteParty = (id: string) => {
    setParties((prev) => prev.filter((p) => p.id !== id));
    void apiClient.deleteParty(id);
  };

  const handleToggleStatusParty = (id: string) => {
    const target = parties.find((p) => p.id === id);
    if (!target) return;
    const nextParty: Party = {
      ...target,
      status: target.status === "active" ? "inactive" : "active",
    };
    setParties((prev) => prev.map((p) => (p.id === id ? nextParty : p)));
    void apiClient.updateParty(nextParty);
  };

  // Chart of Accounts actions (MDM-03 -> /v1/master-data/accounts)
  const handleAddAccount = (account: Account) => {
    setAccounts((prev) => [account, ...prev]);
    void apiClient.createAccount(account).then((res) => {
      if (res.isLive) {
        setAccounts((prev) =>
          prev.map((a) => (a.code === account.code ? res.data : a))
        );
      }
    });
  };

  const handleUpdateAccount = (updated: Account) => {
    setAccounts((prev) =>
      prev.map((a) => (a.code === updated.code ? updated : a))
    );
    void apiClient.updateAccount(updated);
  };

  const handleDeleteAccount = (code: string) => {
    setAccounts((prev) => prev.filter((a) => a.code !== code));
  };

  const handleToggleStatusAccount = (code: string) => {
    const target = accounts.find((a) => a.code === code);
    if (!target) return;
    const nextAccount: Account = { ...target, active: !target.active };
    setAccounts((prev) =>
      prev.map((a) => (a.code === code ? nextAccount : a))
    );
    void apiClient.updateAccount(nextAccount);
  };

  const handleNavigateBot = (botId: string) => {
    const botRouteMap: Record<string, string> = {
      lou: "ledger-lou",
      "ledger-lou": "ledger-lou",
      chloe: "chase-chloe",
      "chase-chloe": "chase-chloe",
      rex: "restock-rex",
      "restock-rex": "restock-rex",
      gus: "guard-gus",
      "guard-gus": "guard-gus",
      finn: "forecast-finn",
      "forecast-finn": "forecast-finn",
      pip: "pip",
      tess: "ticket-tess",
      "ticket-tess": "ticket-tess",
      ola: "onboard-ola",
      "onboard-ola": "onboard-ola",
    };
    navigateToTab(botRouteMap[botId] || botId);
  };

  return (
    <div className="min-h-screen bg-page text-text flex font-body">
      {/* Persistent Desktop Sidebar and Mobile Drawer */}
      {isAuthenticated && (
        <Sidebar
          activeTab={activeTab}
          onNavigate={navigateToTab}
          isOpenMobile={isSidebarOpenMobile}
          onCloseMobile={() => setIsSidebarOpenMobile(false)}
          workspaceName="Example Tools Ltd"
        />
      )}

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* App Header per UI Contract */}
        <AppHeader
          workspaceName="Example Tools Ltd"
          activeTab={activeTab}
          onOpenCommandBar={() => setIsCommandBarOpen(true)}
          onOpenOcrDrawer={() => setIsOcrDrawerOpen(true)}
          onOpenAutopilot={() => setIsAutopilotDrawerOpen(true)}
          onToggleSidebar={() => setIsSidebarOpenMobile((prev) => !prev)}
          onSignOut={() => {
            try {
              sessionStorage.setItem("qavril-session", "signed-out");
            } catch {
              // ignore
            }
            setIsAuthenticated(false);
          }}
        />

        {/* Main Content Area */}
        <main className="flex-1 pb-16 px-3 sm:px-6 md:px-8 max-w-[1400px] w-full mx-auto" id="main">
        {!isAuthenticated ? (
          <div className="max-w-[1240px] mx-auto px-4 pt-12">
            <Gate
              type="signed-out"
              onPrimaryAction={() => {
                try {
                  sessionStorage.setItem(
                    "qavril-session",
                    JSON.stringify({ token: "tok_demo", email: "user@apex.com" })
                  );
                } catch {
                  // ignore
                }
                setIsAuthenticated(true);
                navigateToTab("dashboard");
              }}
              onSecondaryAction={() => {
                try {
                  sessionStorage.setItem(
                    "qavril-session",
                    JSON.stringify({ token: "tok_demo", email: "demo@apex.com" })
                  );
                } catch {
                  // ignore
                }
                setIsAuthenticated(true);
                navigateToTab("dashboard");
              }}
            />
          </div>
        ) : activeTab === "dashboard" ? (
          <Dashboard
            onNavigateToBot={handleNavigateBot}
            onOpenAutopilot={() => setIsAutopilotDrawerOpen(true)}
          />
        ) : activeTab === "ledger-lou" ? (
          <LedgerLou onNavigateBack={() => navigateToTab("dashboard")} />
        ) : activeTab === "chase-chloe" ? (
          <ChaseChloe onNavigateBack={() => navigateToTab("invoices")} />
        ) : activeTab === "restock-rex" ? (
          <RestockRex onNavigateBack={() => navigateToTab("dashboard")} />
        ) : activeTab === "guard-gus" ? (
          <GuardGus onNavigateBack={() => navigateToTab("dashboard")} />
        ) : activeTab === "forecast-finn" ? (
          <ForecastFinn onNavigateBack={() => navigateToTab("dashboard")} />
        ) : activeTab === "digital-twin" ? (
          <div className="max-w-[1240px] mx-auto px-4 pt-8">
            <FinancialDigitalTwinStudio
              onOpenCashRiver3D={() => navigateToTab("forecast-finn")}
              onNavigateToInbox={() => navigateToTab("approvals")}
            />
          </div>
        ) : activeTab === "pip" ? (
          <Pip onNavigateBack={() => navigateToTab("dashboard")} />
        ) : activeTab === "ticket-tess" ? (
          <TicketTess onNavigateBack={() => navigateToTab("dashboard")} />
        ) : activeTab === "onboard-ola" ? (
          <OnboardOla onNavigateBack={() => navigateToTab("dashboard")} />
        ) : activeTab === "approvals" ? (
          <ApprovalsInbox onNavigateBack={() => navigateToTab("dashboard")} />
        ) : activeTab === "ledger" ? (
          <div className="max-w-[1240px] mx-auto px-4 pt-8">
            <LedgerPage
              entries={journals}
              accounts={accounts}
              parties={parties}
              onAddEntry={handleAddJournal}
              onPostDraft={handlePostJournalDraft}
              onReverseEntry={handleReverseJournal}
            />
          </div>
        ) : activeTab === "invoices" ? (
          <div className="max-w-[1240px] mx-auto px-4 pt-8">
            <InvoicesPage
              invoices={invoices}
              summary={invoicesSummary}
              parties={parties}
              catalogItems={items}
              isLiveApi={isLiveApi}
              onAddInvoice={handleAddInvoice}
              onUpdateInvoice={handleUpdateInvoice}
              onDeleteInvoice={handleDeleteInvoice}
              onMarkPaidInvoice={handleMarkPaidInvoice}
              onNavigateToChaseChloe={() => navigateToTab("chase-chloe")}
            />
          </div>
        ) : activeTab === "inventory" ? (
          <div className="max-w-[1240px] mx-auto px-4 pt-8">
            <InventoryPage
              warehouses={warehouses}
              stockSlots={stockSlots}
              transfers={transfers}
              onAddTransfer={(t) => setTransfers((prev) => [t, ...prev])}
              onUpdateTransferStatus={(id, status) =>
                setTransfers((prev) =>
                  prev.map((t) => (t.id === id ? { ...t, status } : t))
                )
              }
            />
          </div>
        ) : activeTab === "crm" ? (
          <div className="max-w-[1240px] mx-auto px-4 pt-8">
            <CrmPipelinePage
              deals={pipelineDeals}
              quotes={salesQuotes}
              onAddDeal={(deal) => setPipelineDeals((prev) => [deal, ...prev])}
              onUpdateDealStage={(id, stage) =>
                setPipelineDeals((prev) =>
                  prev.map((d) => (d.id === id ? { ...d, stage } : d))
                )
              }
              onAddQuote={(quote) => setSalesQuotes((prev) => [quote, ...prev])}
              onUpdateQuoteStatus={(id, status) =>
                setSalesQuotes((prev) =>
                  prev.map((q) => (q.id === id ? { ...q, status } : q))
                )
              }
              onConvertToInvoice={(inv) => setInvoices((prev) => [inv, ...prev])}
            />
          </div>
        ) : activeTab === "bank" ? (
          <div className="max-w-[1240px] mx-auto px-4 pt-8">
            <BankReconciliationPage
              bankLines={bankFeedLines}
              invoices={invoices}
              bills={bills}
              onReconcileLine={(lineId, matchedRef) =>
                setBankFeedLines((prev) =>
                  prev.map((l) =>
                    l.id === lineId
                      ? { ...l, status: "Reconciled", matchedRef, confidence: 100 }
                      : l
                  )
                )
              }
              onImportStatement={(lines) =>
                setBankFeedLines((prev) => [...lines, ...prev])
              }
            />
          </div>
        ) : activeTab === "payables" ? (
          <div className="max-w-[1240px] mx-auto px-4 pt-8">
            <PayablesManager
              bills={bills}
              suppliers={parties.filter(
                (p) => p.type === "supplier" || p.type === "both"
              )}
              expenseAccounts={accounts.filter(
                (a) => a.type === "EXPENSE" || a.type === "ASSET"
              )}
              onAddBill={handleAddBill}
              onApproveBill={handleApproveBill}
              onPayBill={handlePayBill}
              onDeleteBill={handleDeleteBill}
              onOpenOcrInspector={() => setIsOcrDrawerOpen(true)}
            />
          </div>
        ) : activeTab === "items" ? (
          <div className="max-w-[1240px] mx-auto px-4 pt-8">
            <ItemsPage
              items={items}
              isLiveApi={isLiveApi}
              onAddItem={handleAddItem}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
            />
          </div>
        ) : activeTab === "contacts" ? (
          <div className="max-w-[1240px] mx-auto px-4 pt-8">
            <ContactsPage
              parties={parties}
              isLiveApi={isLiveApi}
              onAddParty={handleAddParty}
              onUpdateParty={handleUpdateParty}
              onDeleteParty={handleDeleteParty}
              onToggleStatusParty={handleToggleStatusParty}
            />
          </div>
        ) : activeTab === "accounts" ? (
          <div className="max-w-[1240px] mx-auto px-4 pt-8">
            <AccountsPage
              accounts={accounts}
              isLiveApi={isLiveApi}
              onAddAccount={handleAddAccount}
              onUpdateAccount={handleUpdateAccount}
              onDeleteAccount={handleDeleteAccount}
              onToggleStatusAccount={handleToggleStatusAccount}
            />
          </div>
        ) : activeTab === "packs" ? (
          <div className="max-w-[1240px] mx-auto px-4 pt-8">
            <IndustryPacksHub />
          </div>
        ) : activeTab === "import" ? (
          <div className="max-w-[1240px] mx-auto px-4 pt-8">
            <ImportPage />
          </div>
        ) : activeTab === "gallery" ? (
          <div className="max-w-[1240px] mx-auto px-4 pt-8">
            <GalleryPage />
          </div>
        ) : (
          <div className="max-w-[1240px] mx-auto px-4 py-12 text-center">
            <div className="neo-card max-w-lg mx-auto p-8">
              <h2 className="font-display font-extrabold text-xl uppercase mb-2">
                {activeTab}
              </h2>
              <p className="text-sm text-muted mb-6">
                Select a module from the navigation header or press Ctrl+K.
              </p>
              <button
                type="button"
                onClick={() => navigateToTab("dashboard")}
                className="neo-btn bg-lime text-ink text-xs uppercase font-bold"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Global CommandBar (Ctrl+K) */}
      <CommandBar
        isOpen={isCommandBarOpen}
        onClose={() => setIsCommandBarOpen(false)}
        onNavigate={navigateToTab}
        onOpenQuickEntry={() => navigateToTab("dashboard")}
        onOpenContactDrawer={() => navigateToTab("contacts")}
        onOpenItemDrawer={() => navigateToTab("items")}
        onOpenOcrDrawer={() => setIsOcrDrawerOpen(true)}
      />

      {/* AI-01 Document Intelligence & OCR Visual Extraction Inspector Drawer */}
      <DocumentIntelligenceDrawer
        isOpen={isOcrDrawerOpen}
        onClose={() => setIsOcrDrawerOpen(false)}
        onBillCreated={(newBill) => {
          setBills((prev) => [newBill, ...prev]);
        }}
      />

      {/* Autonomous Autopilot Mission Control Drawer */}
      <AutopilotMissionControlDrawer
        isOpen={isAutopilotDrawerOpen}
        onClose={() => setIsAutopilotDrawerOpen(false)}
        onNavigateToInbox={() => navigateToTab("approvals")}
      />

      {/* Global Toast Container */}
      <ToastContainer />
      </div>
    </div>
  );
};

export default App;
