import React, { useState } from "react";
import { AppHeader } from "./components/ui/AppHeader";
import { ToastContainer } from "./components/ui/Toast";
import { Dashboard } from "./pages/Dashboard";
import { LedgerLou } from "./modules/bots/LedgerLou";
import { ItemsPage } from "./pages/ItemsPage";
import { ContactsPage } from "./pages/ContactsPage";
import { ImportPage } from "./pages/ImportPage";
import { GalleryPage } from "./pages/GalleryPage";
import { initialMockItems, initialMockContacts } from "./lib/api-mock";
import type { Contact, ProductItem } from "./types";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [items, setItems] = useState<ProductItem[]>(initialMockItems);
  const [contacts, setContacts] = useState<Contact[]>(initialMockContacts);

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
        onNavigate={(tab) => setActiveTab(tab)}
        onSignOut={() => alert("Signed out")}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16" id="main">
        {activeTab === "dashboard" ? (
          <Dashboard onNavigateToBot={(botId) => setActiveTab(botId === "lou" ? "ledger-lou" : botId)} />
        ) : activeTab === "ledger-lou" ? (
          <LedgerLou onNavigateBack={() => setActiveTab("dashboard")} />
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
                onClick={() => setActiveTab("dashboard")}
                className="neo-btn bg-lime text-ink text-xs uppercase font-bold"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Global Toast Container */}
      <ToastContainer />
    </div>
  );
};

export default App;
