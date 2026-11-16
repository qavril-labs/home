import React, { useState } from "react";
import { Button } from "../../components/ui/Button";
import { StatusChip } from "../../components/ui/StatusChip";
import { useToast } from "../../context/ToastContext";
import { formatMoney } from "../../lib/currency";
import { sound } from "../../lib/sound-effects";
import {
  initialMockModuleLicenses,
  initialMockAuditLogs,
} from "../../lib/api-mock";
import type { ModuleLicense, AuditLogRecord } from "../../types";
import {
  ShieldCheck,
  Lock,
  Calendar,
} from "lucide-react";

export const WorkspaceSettingsHub: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"general" | "licenses" | "audit">("licenses");
  const [licenses, setLicenses] = useState<ModuleLicense[]>(initialMockModuleLicenses);
  const [auditLogs] = useState<AuditLogRecord[]>(initialMockAuditLogs);
  const [auditFilter, setAuditFilter] = useState<"all" | "human" | "agent">("all");
  const [companyName, setCompanyName] = useState<string>("Example Tools Ltd");
  const [lockDate, setLockDate] = useState<string>("2026-10-31");

  const handleToggleLicense = (moduleId: string) => {
    sound.playClick();
    setLicenses((prev) =>
      prev.map((l) =>
        l.moduleId === moduleId ? { ...l, isEnabled: !l.isEnabled } : l
      )
    );
    const item = licenses.find((l) => l.moduleId === moduleId);
    showToast(
      `Updated license status for ${item?.moduleName} (${item?.isEnabled ? "Disabled" : "Enabled"})`,
      undefined,
      "good"
    );
  };

  const handleSaveGeneral = () => {
    sound.playSuccessChime();
    showToast(`Saved workspace settings: Period locked to ${lockDate}`, undefined, "good");
  };

  const filteredLogs = auditLogs.filter((log) => {
    if (auditFilter === "all") return true;
    return log.actorType === auditFilter;
  });

  return (
    <div className="space-y-6" data-testid="workspace-settings-hub">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-pink block">
            Administration & Governance · PLT-18 / AGT-06
          </span>
          <h1 className="font-display font-extrabold text-3xl uppercase tracking-tight text-text leading-tight">
            Workspace Settings, Licensing & Audit
          </h1>
          <p className="text-xs text-muted mt-1 max-w-2xl">
            Configure tenant parameters, manage active feature licenses, and inspect the tamper-evident cryptographic audit log.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-line bg-panel p-0.5">
          <button
            type="button"
            data-testid="tab-licenses-btn"
            onClick={() => {
              setActiveTab("licenses");
              sound.playClick();
            }}
            className={`px-3 py-1.5 text-xs font-bold font-mono transition-all cursor-pointer ${
              activeTab === "licenses" ? "bg-lime text-ink shadow-[2px_2px_0_var(--q-ink)]" : "text-muted hover:text-text"
            }`}
          >
            Module Licenses (PLT-18)
          </button>
          <button
            type="button"
            data-testid="tab-audit-btn"
            onClick={() => {
              setActiveTab("audit");
              sound.playClick();
            }}
            className={`px-3 py-1.5 text-xs font-bold font-mono transition-all cursor-pointer ${
              activeTab === "audit" ? "bg-lime text-ink shadow-[2px_2px_0_var(--q-ink)]" : "text-muted hover:text-text"
            }`}
          >
            Audit Trail (AGT-06)
          </button>
          <button
            type="button"
            data-testid="tab-general-btn"
            onClick={() => {
              setActiveTab("general");
              sound.playClick();
            }}
            className={`px-3 py-1.5 text-xs font-bold font-mono transition-all cursor-pointer ${
              activeTab === "general" ? "bg-lime text-ink shadow-[2px_2px_0_var(--q-ink)]" : "text-muted hover:text-text"
            }`}
          >
            Fiscal Profile (MDM-03)
          </button>
        </div>
      </div>

      {/* TAB 1: MODULE LICENSING MATRIX */}
      {activeTab === "licenses" && (
        <div className="neo-card p-5 bg-panel space-y-4" data-testid="licenses-panel">
          <div className="flex items-center justify-between pb-3 border-b border-grid">
            <div>
              <h2 className="font-display font-black text-base uppercase tracking-tight">
                Module & Industry Pack Licensing Matrix
              </h2>
              <p className="text-xs text-muted">
                Activate or deactivate platform capabilities per country, jurisdiction, and billing plan.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-good bg-page px-2 py-1 border-line">
              Active Plan: Enterprise
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {licenses.map((lic) => (
              <div
                key={lic.moduleId}
                data-testid={`license-card-${lic.moduleId}`}
                className={`p-4 bg-page border-line flex items-center justify-between gap-3 transition-colors ${
                  lic.isEnabled ? "border-ink" : "opacity-60"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-panel px-1.5 py-0.5 border border-ink">
                      {lic.moduleId}
                    </span>
                    <span className="font-bold text-xs text-text">{lic.moduleName}</span>
                  </div>
                  <div className="text-[11px] text-muted flex items-center gap-2">
                    <span>Category: {lic.catalogCategory}</span>
                    <span>·</span>
                    <span className="font-mono">{formatMoney(lic.monthlyPrice)}/mo</span>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    data-testid={`toggle-license-${lic.moduleId}`}
                    onClick={() => handleToggleLicense(lic.moduleId)}
                    className={`px-3 py-1 text-xs font-bold font-mono border-line transition-all cursor-pointer ${
                      lic.isEnabled
                        ? "bg-lime text-ink shadow-[2px_2px_0_var(--q-ink)]"
                        : "bg-panel text-muted"
                    }`}
                  >
                    {lic.isEnabled ? "ENABLED" : "DISABLED"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: IMMUTABLE AUDIT TRAIL */}
      {activeTab === "audit" && (
        <div className="neo-card p-5 bg-panel space-y-4" data-testid="audit-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-grid">
            <div>
              <h2 className="font-display font-black text-base uppercase tracking-tight">
                Cryptographic Audit Log & Provenance
              </h2>
              <p className="text-xs text-muted">
                Every action taken by human operators and autonomous agents is recorded with immutable SHA-256 signatures.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted">Filter Actor:</span>
              {(["all", "human", "agent"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  data-testid={`filter-audit-${filter}`}
                  onClick={() => {
                    setAuditFilter(filter);
                    sound.playClick();
                  }}
                  className={`px-2.5 py-1 text-xs font-mono font-bold border-line uppercase cursor-pointer ${
                    auditFilter === filter ? "bg-cyan text-ink shadow-[2px_2px_0_var(--q-ink)]" : "bg-page text-muted"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                data-testid={`audit-row-${log.id}`}
                className="p-4 bg-page border-line space-y-2 hover:border-ink transition-colors text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold px-1.5 py-0.5 bg-panel border border-ink">
                      {log.id}
                    </span>
                    <span
                      className={`font-bold px-1.5 py-0.5 border border-ink text-[10px] uppercase ${
                        log.actorType === "agent" ? "bg-violet text-panel" : "bg-lime text-ink"
                      }`}
                    >
                      {log.actorType}: {log.actorName}
                    </span>
                    <span className="font-bold text-text">{log.action}</span>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{log.timestamp}</span>
                    <StatusChip
                      status={log.approvalStatus === "rejected" ? "act" : "good"}
                      label={log.approvalStatus.replace(/_/g, " ").toUpperCase()}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-grid text-[11px] text-muted font-mono">
                  <span>
                    Entity: <strong>{log.targetEntity} (#{log.targetId})</strong> · Policy: Tier {log.policyTier}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] bg-panel px-2 py-0.5 border border-ink">
                    <ShieldCheck className="w-3.5 h-3.5 text-good" />
                    <span>SHA-256: {log.sha256Proof.slice(0, 24)}…</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: FISCAL PROFILE & PERIOD LOCKS */}
      {activeTab === "general" && (
        <div className="neo-card p-5 bg-panel space-y-4" data-testid="general-panel">
          <div className="pb-3 border-b border-grid">
            <h2 className="font-display font-black text-base uppercase tracking-tight">
              Fiscal Period Lock Dates & Currency Profile
            </h2>
            <p className="text-xs text-muted">
              Prevents retrospective modifications to settled general ledger journal entries.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-muted uppercase text-[10px]">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full p-2.5 bg-page border-line font-mono text-xs focus:ring-2 focus:ring-lime"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-muted uppercase text-[10px]">
                Fiscal Period Lock Date (No entries allowed before this date)
              </label>
              <input
                type="date"
                value={lockDate}
                onChange={(e) => setLockDate(e.target.value)}
                className="w-full p-2.5 bg-page border-line font-mono text-xs focus:ring-2 focus:ring-lime"
              />
            </div>
          </div>

          <div className="p-3 bg-page border-line flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted text-[11px]">
              <Lock className="w-4 h-4 text-pink" />
              <span>Hard lock enforced on General Ledger (FIN-01) and Accounts Payable (FIN-03).</span>
            </div>

            <Button
              variant="lime"
              size="md"
              data-testid="save-fiscal-settings-btn"
              onClick={handleSaveGeneral}
            >
              Save Fiscal Settings
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
