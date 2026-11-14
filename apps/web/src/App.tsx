import React, { useState, useEffect } from "react";
import { AppHeader } from "./components/ui/AppHeader";
import { ToastContainer } from "./components/ui/Toast";
import { Gate } from "./components/ui/Gate";
import { CommandBar } from "./components/ui/CommandBar";
import { Dashboard } from "./pages/Dashboard";
import { LedgerLou } from "./modules/bots/LedgerLou";
import { ItemsPage } from "./pages/ItemsPage";
import { ContactsPage } from "./pages/ContactsPage";
import { ImportPage } from "./pages/ImportPage";
import { GalleryPage } from "./pages/GalleryPage";
import { initialMockItems, initialMockContacts } from "./lib/api-mock";
import type { Contact, ProductItem } from "./types";

export const App: React.FC = () => {
  const getInitialTab = () => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace(/^#\/?/, "");
      if (hash && ["dashboard", "ledger-lou", "contacts", "items", "import", "gallery"].includes(hash)) {
        return hash;
      }
      const path = window.location.pathname.replace(/^\//, "");
      if (path === "gallery") return "gallery";
    }
    return "dashboard";
  };

  const [activeTab, setActiveTab] = useState<string>(getInitialTab);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [isCommandBarOpen, setIsCommandBarOpen] = useState<boolean>(false);
  const [items, setItems] = useState<ProductItem[]>(initialMockItems);
  const [contacts, setContacts] = useState<Contact[]>(initialMockContacts);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, "");
      if (hash === "signed-out") {
        setIsAuthenticated(false);
      } else if (hash && ["dashboard", "ledger-lou", "contacts", "items", "import", "gallery"].includes(hash)) {
        setActiveTab(hash);
        setIsAuthenticated(true);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandBarOpen((prev) => !prev);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleNavigate = (tab: string) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.location.hash = `#${tab}`;
    }
  };

  const handleAddItem = (item: ProductItem) => {
    setItems((prev) => [item, ...prev]);
  };

  const handleUpdateItem = (updated: ProductItem) => {
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddContact = (contact: Contact) => {
    setContacts((prev) => [contact, ...prev]);
  };

  const handleUpdateContact = (updated: Contact) => {
    setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleDeleteContact = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="min-h-screen bg-page text-text flex flex-col font-body">
      {/* App Header per UI Contract */}
      <AppHeader
        workspaceName="Apex Production"
        activeTab={activeTab}
        onNavigate={handleNavigate}
        onOpenCommandBar={() => setIsCommandBarOpen(true)}
        onSignOut={() => {
          setIsAuthenticated(false);
          if (typeof window !== "undefined") {
            window.location.hash = "#signed-out";
          }
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16" id="main">
        {!isAuthenticated ? (
          <div className="max-w-[1240px] mx-auto px-4 pt-12">
            <Gate
              type="signed-out"
              onPrimaryAction={() => {
                setIsAuthenticated(true);
                handleNavigate("dashboard");
              }}
              statusMessage="Session closed. Ready to resume anytime."
            />
          </div>
        ) : activeTab === "dashboard" ? (
          <Dashboard onNavigateToBot={(botId) => handleNavigate(botId === "lou" ? "ledger-lou" : botId)} />
        ) : activeTab === "ledger-lou" ? (
          <LedgerLou onNavigateBack={() => handleNavigate("dashboard")} />
        ) : activeTab === "items" ? (
          <div className="max-w-[1240px] mx-auto px-4 pt-8">
            <ItemsPage
              items={items}
              onAddItem={handleAddItem}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
            />
          </div>
        ) : activeTab === "contacts" ? (
          <div className="max-w-[1240px] mx-auto px-4 pt-8">
            <ContactsPage
              contacts={contacts}
              onAddContact={handleAddContact}
              onUpdateContact={handleUpdateContact}
              onDeleteContact={handleDeleteContact}
            />
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
                This lane is currently focused on the signed-in Dashboard (PLT-23).
              </p>
              <button
                type="button"
                onClick={() => handleNavigate("dashboard")}
                className="neo-btn bg-lime text-ink text-xs uppercase font-bold"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Global Command Bar */}
      <CommandBar
        isOpen={isCommandBarOpen}
        onClose={() => setIsCommandBarOpen(false)}
        onNavigate={handleNavigate}
        onOpenQuickEntry={() => {
          handleNavigate("dashboard");
        }}
        onOpenContactDrawer={() => {
          handleNavigate("contacts");
        }}
        onOpenItemDrawer={() => {
          handleNavigate("items");
        }}
      />

      {/* Global Toast Container */}
      <ToastContainer />
    </div>
  );
};

export default App;
