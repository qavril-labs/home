import React, { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Package,
  Layers,
  FileText,
  Receipt,
  BookOpen,
  Warehouse,
  Kanban,
  CheckSquare,
  Sparkles,
  Bot,
  BrainCircuit,
  FileSpreadsheet,
  Palette,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  code?: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export interface SidebarProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  workspaceName?: string;
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Core",
    items: [
      { id: "dashboard", label: "Dashboard", code: "PLT-01", icon: LayoutDashboard },
    ],
  },
  {
    title: "Master Data",
    items: [
      { id: "contacts", label: "Parties", code: "MDM-01", icon: Users },
      { id: "items", label: "Items", code: "MDM-02", icon: Package },
      { id: "accounts", label: "Accounts", code: "MDM-03", icon: Layers },
    ],
  },
  {
    title: "Finance & Sales",
    items: [
      { id: "invoices", label: "Invoices", code: "SAL-04", icon: FileText },
      { id: "payables", label: "Bills", code: "FIN-03", icon: Receipt },
      { id: "ledger", label: "General Ledger", code: "FIN-01", icon: BookOpen },
      { id: "inventory", label: "Inventory", code: "INV-01", icon: Warehouse },
      { id: "crm", label: "CRM Pipeline", code: "SAL-01", icon: Kanban },
      { id: "bank", label: "Bank Rec", code: "FIN-04", icon: CheckSquare },
    ],
  },
  {
    title: "HR & Payroll",
    items: [
      { id: "hrm-dashboard", label: "HR Dashboard", code: "HRM-10/14", icon: Users },
      { id: "hrm-org", label: "Org & Requisitions", code: "HRM-02/16", icon: Layers },
      { id: "hrm-recruitment", label: "Recruitment & Offers", code: "HRM-09", icon: Kanban },
      { id: "hrm-employees", label: "Employees & Lifecycle", code: "HRM-01/17", icon: Users },
      { id: "hrm-attendance", label: "Attendance & Leave", code: "HRM-03/04", icon: CheckSquare },
      { id: "hrm-payroll", label: "Payroll & Statutory", code: "HRM-05/06", icon: Receipt },
      { id: "hrm-separations", label: "Separations & Loans", code: "HRM-18/19", icon: Receipt },
    ],
  },
  {
    title: "Self-Service",
    items: [
      { id: "hrm-self-service", label: "My Self-Service", code: "HRM-07", icon: Users },
    ],
  },
  {
    title: "AI & Autopilot",
    items: [
      { id: "approvals", label: "Approvals Inbox", code: "PLT-07", icon: Sparkles },
      { id: "ledger-lou", label: "Ledger Lou", code: "AGT-03", icon: Bot },
      { id: "chase-chloe", label: "Chase Chloe", code: "FIN-14", icon: Bot },
      { id: "pm-bots", label: "PM Bots (MVP)", code: "PRJ-BOT", icon: Bot },
      { id: "packs", label: "Industry Packs", code: "GAR/FMCG", icon: BrainCircuit },
    ],
  },
  {
    title: "Platform & Tools",
    items: [
      { id: "import", label: "CSV Import", code: "PLT-14", icon: FileSpreadsheet },
      { id: "gallery", label: "Component Gallery", code: "UI-LIB", icon: Palette },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
  workspaceName = "Apex Production",
}) => {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (sectionTitle: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionTitle]: !prev[sectionTitle],
    }));
  };

  const renderNavContent = () => (
    <div className="flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b-line bg-panel shrink-0">
        <a
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("dashboard");
            onCloseMobile();
          }}
          className="flex items-center gap-2 group text-text no-underline"
        >
          <span className="w-8 h-8 rounded-none bg-lime border-line flex items-center justify-center font-display font-black text-ink text-lg shadow-[2px_2px_0_var(--q-ink)] group-hover:scale-105 transition-transform">
            Q
          </span>
          <div className="flex flex-col">
            <span className="font-display font-extrabold text-sm tracking-tight uppercase leading-none">
              QAVRIL<span className="text-pink">/</span>LABS
            </span>
            <span className="text-[10px] font-mono text-muted tracking-wider uppercase mt-0.5">
              Enterprise ERP
            </span>
          </div>
        </a>

        {/* Mobile close button */}
        <button
          onClick={onCloseMobile}
          className="md:hidden p-1.5 text-text hover:bg-page border border-transparent hover:border-line"
          aria-label="Close navigation sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Workspace Context Chip */}
      <div className="px-3 py-2.5 bg-page border-b border-grid shrink-0">
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-panel border-line shadow-[2px_2px_0_var(--q-ink)]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-good animate-pulse shrink-0" />
            <span className="text-xs font-bold text-text truncate">{workspaceName}</span>
          </div>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-yellow text-ink border border-ink">
            PROD
          </span>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {NAV_SECTIONS.map((section) => {
          const isCollapsed = collapsedSections[section.title];
          return (
            <div key={section.title} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleSection(section.title)}
                className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-mono font-bold uppercase tracking-wider text-muted hover:text-text transition-colors"
              >
                <span>{section.title}</span>
                {isCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {!isCollapsed && (
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = activeTab === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onNavigate(item.id);
                          onCloseMobile();
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 text-xs font-bold transition-all text-left group ${
                          isActive
                            ? "bg-yellow text-ink border-line shadow-[2px_2px_0_var(--q-ink)] -translate-x-0.5"
                            : "text-text hover:bg-page hover:border-line border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                              isActive ? "text-ink" : "text-muted group-hover:text-text"
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.code && (
                          <span
                            className={`text-[10px] font-mono px-1 py-0.2 shrink-0 ${
                              isActive
                                ? "bg-ink text-yellow font-black"
                                : "text-muted group-hover:text-text"
                            }`}
                          >
                            {item.code}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t-line bg-page text-[11px] font-mono text-muted shrink-0 flex items-center justify-between">
        <span>v2.4.0-lane</span>
        <span className="text-good font-bold">API Online :3002</span>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Left Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-panel border-r-line shrink-0 h-screen sticky top-0 z-30 shadow-[4px_0_0_rgba(0,0,0,0.02)]">
        {renderNavContent()}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-ink/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative flex flex-col w-72 max-w-[85vw] bg-panel border-r-line shadow-2xl h-full z-10 animate-in slide-in-from-left duration-200">
            {renderNavContent()}
          </aside>
        </div>
      )}
    </>
  );
};
