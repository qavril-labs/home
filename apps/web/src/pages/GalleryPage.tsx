import React, { useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { KpiTile } from "../components/ui/KpiTile";
import { StatusChip } from "../components/ui/StatusChip";
import { BotCard } from "../components/ui/BotCard";
import { TrendChart } from "../components/ui/TrendChart";
import { EmptyState } from "../components/ui/EmptyState";
import { Gate } from "../components/ui/Gate";
import { Modal } from "../components/ui/Modal";
import { Drawer } from "../components/ui/Drawer";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../context/ThemeContext";
import { initialMockInsights } from "../lib/api-mock";
import {
  Smartphone,
  Tablet,
  Monitor,
  CheckCircle2,
  Sparkles,
  Layers,
  Palette,
  Type,
  Maximize2,
} from "lucide-react";

export const GalleryPage: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();

  const [viewportMode, setViewportMode] = useState<"fluid" | "375" | "768" | "1280">("fluid");

  // Overlay states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [activeGate, setActiveGate] = useState<"none" | "signed-out" | "setup">("none");

  const colorTokens = [
    { name: "lime", css: "var(--q-lime)", hex: "#c6ff3d", usage: "Primary CTA, cash" },
    { name: "pink", css: "var(--q-pink)", hex: "#ff4fa3", usage: "Accents, warnings" },
    { name: "violet", css: "var(--q-violet)", hex: "#8b6bff", usage: "Series in, sales" },
    { name: "cyan", css: "var(--q-cyan)", hex: "#3de8ff", usage: "Information, tools" },
    { name: "yellow", css: "var(--q-yellow)", hex: "#ffe14d", usage: "Profit, highlights" },
    { name: "orange", css: "var(--q-orange)", hex: "#ff8a3d", usage: "Series out, expenses" },
    { name: "good", css: "var(--q-good)", hex: "#1a7f37", usage: "✓ All good status" },
    { name: "watch", css: "var(--q-watch)", hex: "#9a6700", usage: "! Worth a look" },
    { name: "act", css: "var(--q-act)", hex: "#b42318", usage: "● Needs you" },
    { name: "idle", css: "var(--q-idle)", hex: "#4a4568", usage: "… Waiting for data" },
  ];

  const getContainerClass = () => {
    switch (viewportMode) {
      case "375":
        return "max-w-[375px] mx-auto border-4 border-dashed border-pink p-2 bg-page transition-all";
      case "768":
        return "max-w-[768px] mx-auto border-4 border-dashed border-cyan p-3 bg-page transition-all";
      case "1280":
        return "max-w-[1240px] mx-auto border-4 border-dashed border-lime p-4 bg-page transition-all";
      default:
        return "w-full transition-all";
    }
  };

  return (
    <div className="space-y-8">
      {/* Gallery Control Bar */}
      <div className="bg-panel border-line shadow-card p-4 flex flex-wrap items-center justify-between gap-4 sticky top-16 z-30">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-pink block">
            Quality Assurance & Token Conformance
          </span>
          <h1 className="font-display font-extrabold text-2xl uppercase tracking-tight text-text leading-tight">
            Component Gallery
          </h1>
          <p className="text-xs text-muted">
            Inspect all atoms, cards, forms, charts, and overlays across light/dark themes and viewports.
          </p>
        </div>

        {/* Viewport Width Buttons & Theme Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-page border-line p-1">
            <button
              onClick={() => setViewportMode("fluid")}
              className={`px-2 py-1 text-xs font-bold ${
                viewportMode === "fluid"
                  ? "bg-lime text-ink border border-ink"
                  : "text-muted hover:text-text"
              }`}
            >
              <Maximize2 className="w-3 h-3 inline mr-1" />
              Fluid
            </button>
            <button
              onClick={() => setViewportMode("375")}
              className={`px-2 py-1 text-xs font-bold ${
                viewportMode === "375"
                  ? "bg-lime text-ink border border-ink"
                  : "text-muted hover:text-text"
              }`}
            >
              <Smartphone className="w-3 h-3 inline mr-1" />
              375px (Mobile)
            </button>
            <button
              onClick={() => setViewportMode("768")}
              className={`px-2 py-1 text-xs font-bold ${
                viewportMode === "768"
                  ? "bg-lime text-ink border border-ink"
                  : "text-muted hover:text-text"
              }`}
            >
              <Tablet className="w-3 h-3 inline mr-1" />
              768px (Tablet)
            </button>
            <button
              onClick={() => setViewportMode("1280")}
              className={`px-2 py-1 text-xs font-bold ${
                viewportMode === "1280"
                  ? "bg-lime text-ink border border-ink"
                  : "text-muted hover:text-text"
              }`}
            >
              <Monitor className="w-3 h-3 inline mr-1" />
              1280px (Desktop)
            </button>
          </div>

          <Button variant="yellow" size="sm" onClick={toggleTheme}>
            Theme: {theme.toUpperCase()}
          </Button>
        </div>
      </div>

      {/* Main Responsive Viewport Preview Container */}
      <div className={getContainerClass()}>
        {/* Section 1: Design Tokens & Palette */}
        <div className="space-y-6 mb-8">
          <div className="flex items-center gap-2 border-b-line pb-2">
            <Palette className="w-5 h-5 text-pink" />
            <h2 className="font-display font-bold text-lg uppercase text-text">
              1. Brand Tokens & Colors
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {colorTokens.map((token) => (
              <div key={token.name} className="p-3 bg-panel border-line shadow-sm">
                <div
                  className="w-full h-10 border border-ink mb-2 shadow-[2px_2px_0_var(--q-ink)]"
                  style={{ backgroundColor: token.css }}
                />
                <div className="font-bold text-xs text-text capitalize">{token.name}</div>
                <div className="font-mono text-[10px] text-muted">{token.hex}</div>
                <div className="text-[10px] text-muted mt-1 leading-tight">{token.usage}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Buttons */}
        <div className="space-y-6 mb-8">
          <div className="flex items-center gap-2 border-b-line pb-2">
            <Layers className="w-5 h-5 text-lime" />
            <h2 className="font-display font-bold text-lg uppercase text-text">
              2. Neo-Brutal Buttons
            </h2>
          </div>

          <div className="bg-panel border-line p-6 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="lime">Lime Button</Button>
              <Button variant="yellow">Yellow Button</Button>
              <Button variant="pink">Pink Button</Button>
              <Button variant="violet">Violet Button</Button>
              <Button variant="cyan">Cyan Button</Button>
              <Button variant="dark">Dark Button</Button>
              <Button variant="ghost">Ghost Button</Button>
            </div>

            <div className="pt-2 border-t border-grid flex flex-wrap items-center gap-3">
              <Button size="sm" variant="lime">Small (sm)</Button>
              <Button size="md" variant="lime">Medium (md)</Button>
              <Button size="lg" variant="lime">Large (lg)</Button>
              <Button size="md" variant="lime" disabled>Disabled State</Button>
            </div>
          </div>
        </div>

        {/* Section 3: Status Chips */}
        <div className="space-y-6 mb-8">
          <div className="flex items-center gap-2 border-b-line pb-2">
            <CheckCircle2 className="w-5 h-5 text-good" />
            <h2 className="font-display font-bold text-lg uppercase text-text">
              3. Status Chips (Icon + Text)
            </h2>
          </div>

          <div className="bg-panel border-line p-6 flex flex-wrap items-center gap-4">
            <StatusChip status="good" />
            <StatusChip status="watch" />
            <StatusChip status="act" />
            <StatusChip status="idle" />
          </div>
        </div>

        {/* Section 4: KPI Tiles */}
        <div className="space-y-6 mb-8">
          <div className="flex items-center gap-2 border-b-line pb-2">
            <Type className="w-5 h-5 text-cyan" />
            <h2 className="font-display font-bold text-lg uppercase text-text">
              4. KPI Tiles (Animated Count-up)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiTile
              label="Cash on hand"
              value="42150.00"
              variant="lime"
              helperText="Count-up animation disabled under reduced motion"
            />
            <KpiTile
              label="Sales to date"
              value="128420.50"
              variant="panel"
              helperText="Gross sales recognized"
            />
            <KpiTile
              label="Operating costs"
              value="86270.50"
              variant="panel"
              helperText="Vendor invoices and payables"
            />
            <KpiTile
              label="Operating profit"
              value="42150.00"
              variant="yellow"
              helperText="Net margin 32.8%"
            />
          </div>
        </div>

        {/* Section 5: Overlays (Modals, Drawers, Toasts, Confirm Dialog) */}
        <div className="space-y-6 mb-8">
          <div className="flex items-center gap-2 border-b-line pb-2">
            <Sparkles className="w-5 h-5 text-violet" />
            <h2 className="font-display font-bold text-lg uppercase text-text">
              5. Overlays & Dialogs
            </h2>
          </div>

          <div className="bg-panel border-line p-6 flex flex-wrap items-center gap-3">
            <Button variant="lime" onClick={() => setIsModalOpen(true)}>
              Open Test Modal
            </Button>
            <Button variant="cyan" onClick={() => setIsDrawerOpen(true)}>
              Open Test Drawer
            </Button>
            <Button variant="pink" onClick={() => setIsConfirmOpen(true)}>
              Open ConfirmDialog
            </Button>
            <Button
              variant="yellow"
              onClick={() =>
                showToast("Entry posted to ledger ($1,420.00)", {
                  type: "success",
                  undoAction: () => showToast("Reversed journal entry", { type: "info" }),
                })
              }
            >
              Trigger Success Toast (4s)
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                showToast("System alert: Connection verified", { type: "info" })
              }
            >
              Trigger Info Toast
            </Button>
          </div>
        </div>

        {/* Section 6: Full Trend Chart */}
        <div className="space-y-6 mb-8">
          <div className="flex items-center gap-2 border-b-line pb-2">
            <Layers className="w-5 h-5 text-orange" />
            <h2 className="font-display font-bold text-lg uppercase text-text">
              6. Trend Chart & Accessible Table View
            </h2>
          </div>

          <Card title="Sales & Expenses Comparison" featured>
            <TrendChart data={initialMockInsights.trend} />
          </Card>
        </div>

        {/* Section 7: Bot Cards */}
        <div className="space-y-6 mb-8">
          <div className="flex items-center gap-2 border-b-line pb-2">
            <Sparkles className="w-5 h-5 text-pink" />
            <h2 className="font-display font-bold text-lg uppercase text-text">
              7. Bot Cards (The 8 Autonomous Bots)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {initialMockInsights.bots.map((bot) => (
              <BotCard
                key={bot.id}
                bot={bot}
                onAction={(b) =>
                  showToast(`Selected ${b.name}'s proposal: ${b.draftLabel || b.role}`, {
                    type: "info",
                  })
                }
              />
            ))}
          </div>
        </div>

        {/* Section 8: Empty States & Gates */}
        <div className="space-y-6 mb-8">
          <div className="flex items-center gap-2 border-b-line pb-2">
            <Layers className="w-5 h-5 text-muted" />
            <h2 className="font-display font-bold text-lg uppercase text-text">
              8. Empty States & Gate Screens
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Empty State Pattern">
              <EmptyState
                title="No invoices created yet"
                description="Issue your first invoice to Delta Dynamics to track accounts receivable."
                actionLabel="Create first invoice"
                onAction={() => showToast("Invoice editor drawer opened", { type: "info" })}
              />
            </Card>

            <Card title="Gate Display Preview">
              <div className="flex items-center gap-2 mb-4">
                <Button
                  size="sm"
                  variant={activeGate === "signed-out" ? "lime" : "ghost"}
                  onClick={() => setActiveGate("signed-out")}
                >
                  Signed Out Gate
                </Button>
                <Button
                  size="sm"
                  variant={activeGate === "setup" ? "lime" : "ghost"}
                  onClick={() => setActiveGate("setup")}
                >
                  Setup Books Gate
                </Button>
                <Button
                  size="sm"
                  variant={activeGate === "none" ? "lime" : "ghost"}
                  onClick={() => setActiveGate("none")}
                >
                  Clear
                </Button>
              </div>

              {activeGate !== "none" ? (
                <Gate
                  type={activeGate}
                  onPrimaryAction={() =>
                    showToast(`Gate action clicked: ${activeGate}`, { type: "success" })
                  }
                />
              ) : (
                <div className="p-8 text-center text-xs text-muted font-bold border border-grid">
                  Click a button above to preview full-page Gate patterns.
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Test Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Test Task Modal"
        description="A short task or confirmation dialog (up to 5 fields)."
        primaryActionLabel="Post entry"
        primaryActionVariant="lime"
        onPrimaryAction={() => {
          setIsModalOpen(false);
          showToast("Modal action completed successfully.", { type: "success" });
        }}
        secondaryActionLabel="Cancel"
      >
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase text-muted">
            Transaction Memo
          </label>
          <input
            type="text"
            placeholder="e.g. November Hardware Purchase"
            className="w-full px-3 py-2 text-sm font-bold bg-page border-line"
          />
        </div>
      </Modal>

      {/* Test Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Slide-out Form Drawer"
        description="Longer form or record details sliding from the right (480px wide on desktop)."
        primaryActionLabel="Save Record"
        primaryActionVariant="lime"
        onPrimaryAction={() => {
          setIsDrawerOpen(false);
          showToast("Drawer record saved.", { type: "success" });
        }}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-muted mb-1">
              Field One
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 text-sm font-bold bg-panel border-line"
              defaultValue="Standard value"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-muted mb-1">
              Field Two
            </label>
            <textarea
              className="w-full px-3 py-2 text-sm font-bold bg-panel border-line h-24"
              defaultValue="Detailed notes or parameters"
            />
          </div>
        </div>
      </Drawer>

      {/* Test ConfirmDialog */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="Post $1,250.00 to Sales?"
        message="This action will post an immutable journal entry to the general ledger and update receivables. Once posted, changes must be made via reversal."
        actionVerb="Post $1,250.00 to Sales"
        actionVariant="pink"
        onConfirm={() => {
          setIsConfirmOpen(false);
          showToast("Posted $1,250.00 to Sales journal.", {
            type: "success",
            undoAction: () => showToast("Reversal journal posted.", { type: "info" }),
          });
        }}
      />
    </div>
  );
};
