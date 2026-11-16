import React, { useState, useEffect, useCallback } from "react";
import { StatusChip } from "../../components/ui/StatusChip";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../context/ToastContext";
import { eventBus } from "../../lib/event-stream";
import { initialMockOnboardingRecords } from "../../lib/api-mock";
import type { OnboardingRecord } from "../../types";
import {
  Power,
  RotateCw,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Key,
  Laptop,
  FileCheck,
} from "lucide-react";

export interface OnboardOlaProps {
  onNavigateBack?: () => void;
}

export const OnboardOla: React.FC<OnboardOlaProps> = ({ onNavigateBack }) => {
  const { showToast } = useToast();
  const [records, setRecords] = useState<OnboardingRecord[]>(initialMockOnboardingRecords);
  const [selectedRecord, setSelectedRecord] = useState<OnboardingRecord | null>(null);
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState<boolean>(false);
  const [isKillSwitchActive, setIsKillSwitchActive] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLiveApi, setIsLiveApi] = useState<boolean>(false);

  const refreshRecords = useCallback(() => {
    setIsLoading(true);
    const now = new Date();
    setLastUpdated(
      now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    );

    setTimeout(() => {
      setIsLoading(false);
      setIsLiveApi(false);
    }, 250);
  }, []);

  useEffect(() => {
    refreshRecords();
  }, [refreshRecords]);

  const handleToggleKillSwitch = () => {
    const next = !isKillSwitchActive;
    setIsKillSwitchActive(next);
    showToast(
      next
        ? "Onboard Ola resumed: Automated access provisioning & onboarding checklists active."
        : "Onboard Ola kill switch engaged: Permission drafting and access grants suspended.",
      undefined,
      next ? "good" : "act"
    );
  };

  const handleOpenProvisionModal = (rec: OnboardingRecord) => {
    setSelectedRecord(rec);
    setIsProvisionModalOpen(true);
  };

  const handleApproveProvisioning = () => {
    if (!selectedRecord) return;

    // Emit domain event across real-time bus
    eventBus.emit({
      type: "hr.onboarding.provisioned",
      producer: "services/uaap/onboard_ola",
      data: {
        employeeId: selectedRecord.id,
        employeeName: selectedRecord.employeeName,
        roleTier: selectedRecord.roleTier,
        systemCount: selectedRecord.systemPermissions.length,
      },
    });

    setRecords((prev) =>
      prev.map((r) =>
        r.id === selectedRecord.id
          ? {
              ...r,
              status: "provisioned",
              checklist: r.checklist.map((c) => ({ ...c, status: "completed" })),
            }
          : r
      )
    );

    setIsProvisionModalOpen(false);
    showToast(
      `Approved access grants & hardware dispatch for ${selectedRecord.employeeName} (${selectedRecord.roleTier})`,
      undefined,
      "good"
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" data-testid="onboard-ola-page">
      {/* 1. Breadcrumbs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onNavigateBack && (
            <button
              type="button"
              onClick={onNavigateBack}
              className="text-xs font-bold text-muted hover:text-text flex items-center gap-1 transition-colors cursor-pointer"
            >
              ← Back to Dashboard
            </button>
          )}
          <span className="text-muted text-xs">/</span>
          <span className="text-xs font-mono font-bold text-muted uppercase">
            Agents & Autopilot
          </span>
          <span className="text-muted text-xs">/</span>
          <span className="text-xs font-bold text-text">Onboard Ola (HRM-10)</span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold border-line ${
              isLiveApi ? "bg-lime text-ink" : "bg-cream text-ink"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLiveApi ? "bg-good" : "bg-watch"}`} />
            {isLiveApi ? "API Connected" : "Mock Fixture"}
          </span>
          <span className="text-xs font-mono font-bold text-muted">
            Agent Card: HRM-10 · PLT-01
          </span>
        </div>
      </div>

      {/* 2. Bot Header Banner */}
      <section className="neo-card p-6 bg-panel border-line shadow-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            {/* Ola Avatar: Violet #8b6bff */}
            <div className="w-16 h-16 bg-violet text-panel border-line shadow-[3px_3px_0_var(--q-ink)] flex items-center justify-center select-none flex-shrink-0 relative">
              <svg className="w-12 h-12" viewBox="0 0 80 80" aria-hidden="true">
                <circle cx="40" cy="40" r="32" fill="var(--q-violet)" stroke="var(--q-ink)" strokeWidth="3" />
                <path d="M28 50 C28 42, 34 38, 40 38 C46 38, 52 42, 52 50" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" />
                <circle cx="40" cy="28" r="8" fill="white" />
                <path d="M48 24 L56 18 M56 24 L56 18 L50 18" stroke="var(--q-lime)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-good opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-good border border-ink"></span>
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display font-extrabold text-2xl uppercase tracking-tight text-text">
                  Onboard Ola
                </h1>
                <span className="text-xs font-mono px-2 py-0.5 bg-page border-line font-bold text-muted">
                  HRM-10 · HRM-01 / PLT-07
                </span>
                <StatusChip
                  status={isKillSwitchActive ? "good" : "act"}
                  label={isKillSwitchActive ? "Autonomous Provisioning" : "Kill Switch Engaged"}
                />
              </div>
              <p className="text-xs text-muted mt-1 max-w-xl">
                Autonomous people & talent onboarding agent. Prepares role-based access tiers (PLT-07), tracks statutory compliance agreements, coordinates hardware logistics, and submits managerial approvals.
              </p>
            </div>
          </div>

          {/* Kill Switch & Refresh */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={refreshRecords}
              disabled={isLoading}
              className="px-3 py-2 text-xs font-bold bg-page border-line shadow-[2px_2px_0_var(--q-ink)] hover:bg-panel flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>{lastUpdated ? `Sync: ${lastUpdated}` : "Sync"}</span>
            </button>

            <button
              type="button"
              data-testid="ola-kill-switch-btn"
              onClick={handleToggleKillSwitch}
              className={`px-3 py-2 text-xs font-bold border-line shadow-[2px_2px_0_var(--q-ink)] flex items-center gap-1.5 transition-all cursor-pointer ${
                isKillSwitchActive
                  ? "bg-good/20 text-good hover:bg-danger/20 hover:text-pink"
                  : "bg-danger text-panel"
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{isKillSwitchActive ? "Kill Switch: Active" : "Disengaged"}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 3. KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="neo-card p-4 bg-panel">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
            Staged Joiners
          </span>
          <div className="font-display font-black text-2xl text-text mt-1">
            {records.length} Employees
          </div>
          <span className="text-[10px] font-mono text-muted">Next start: Nov 20</span>
        </div>

        <div className="neo-card p-4 bg-panel">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
            Checklist Completion
          </span>
          <div className="font-display font-black text-2xl text-good mt-1">
            78.5%
          </div>
          <span className="text-[10px] font-mono text-muted">NDAs & Direct Deposit signed</span>
        </div>

        <div className="neo-card p-4 bg-panel">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
            Pending Access Grants
          </span>
          <div className="font-display font-black text-2xl text-pink mt-1">
            {records.filter((r) => r.status === "review_pending").length} Approvals
          </div>
          <span className="text-[10px] font-mono text-muted">Tier 2 Role Permissions</span>
        </div>

        <div className="neo-card p-4 bg-panel">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
            Avg Provisioning Speed
          </span>
          <div className="font-display font-black text-2xl text-text mt-1">
            12 Minutes
          </div>
          <span className="text-[10px] font-mono text-good font-bold">Zero-touch automation</span>
        </div>
      </div>

      {/* 4. Staged Joiner Roster */}
      <div className="neo-card p-5 bg-panel space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-grid">
          <div>
            <h2 className="font-display font-black text-lg uppercase tracking-tight">
              Incoming Personnel & Access Tiers
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Review and authorize system permissions, hardware allocations, and statutory contracts.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-muted bg-page px-2 py-1 border-line">
            HRM-10 / PLT-01
          </span>
        </div>

        <div className="space-y-4">
          {records.map((rec) => (
            <div
              key={rec.id}
              data-testid={`onboard-row-${rec.id}`}
              className="p-5 bg-page border-line space-y-4 hover:border-ink transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-panel border border-ink flex items-center justify-center font-display font-black text-sm">
                    {rec.employeeName.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-text">{rec.employeeName}</span>
                      <span className="font-mono text-xs text-muted">({rec.email})</span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-panel border border-ink text-violet">
                        {rec.roleTier}
                      </span>
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {rec.roleTitle} · {rec.department} · Manager: {rec.managerName}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Start Date: <strong className="text-text">{rec.startDate}</strong>
                  </span>
                  <StatusChip
                    status={rec.status === "provisioned" ? "good" : "watch"}
                    label={rec.status === "provisioned" ? "PROVISIONED" : "NEEDS APPROVAL"}
                  />
                </div>
              </div>

              {/* Checklist & Permissions Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-grid text-xs">
                {/* Permissions Column */}
                <div className="p-3 bg-panel border-line space-y-2">
                  <span className="text-[10px] font-bold uppercase text-muted flex items-center gap-1">
                    <Key className="w-3 h-3 text-cyan" />
                    Requested System Entitlements ({rec.systemPermissions.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {rec.systemPermissions.map((perm, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-page border border-ink font-mono text-[10px] font-bold"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Hardware Column */}
                <div className="p-3 bg-panel border-line space-y-2">
                  <span className="text-[10px] font-bold uppercase text-muted flex items-center gap-1">
                    <Laptop className="w-3 h-3 text-pink" />
                    Hardware Logistics Staging:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {rec.requestedHardware.map((hw, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-page border border-ink font-mono text-[10px]"
                      >
                        {hw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action row */}
              <div className="flex items-center justify-between pt-2 border-t border-grid text-xs">
                <span className="text-muted text-[11px]">
                  All statutory contracts (W-4, Direct Deposit, IP NDAs) pre-verified by Onboard Ola.
                </span>

                <div>
                  {rec.status === "review_pending" ? (
                    <Button
                      variant="violet"
                      size="sm"
                      data-testid={`provision-btn-${rec.id}`}
                      onClick={() => handleOpenProvisionModal(rec)}
                    >
                      <FileCheck className="w-3.5 h-3.5 mr-1" />
                      Approve System Grants ({rec.roleTier})
                    </Button>
                  ) : (
                    <span className="text-xs font-mono text-good font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Access Grants Provisioned
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Access Provisioning Confirmation Modal */}
      {selectedRecord && (
        <Modal
          isOpen={isProvisionModalOpen}
          onClose={() => setIsProvisionModalOpen(false)}
          title={`Authorize Access Grants · ${selectedRecord.employeeName}`}
          description={`Role: ${selectedRecord.roleTitle} · Access Level: ${selectedRecord.roleTier}`}
          primaryActionLabel="Authorize All Provisioning Grants"
          primaryActionVariant="violet"
          onPrimaryAction={handleApproveProvisioning}
          secondaryActionLabel="Cancel"
          onSecondaryAction={() => setIsProvisionModalOpen(false)}
        >
          <div className="space-y-4 text-xs" data-testid="ola-provision-modal">
            <div className="p-3 bg-page border-line space-y-2">
              <span className="text-[10px] font-bold uppercase text-muted block">
                The following permissions will be registered into the transactional outbox:
              </span>
              <ul className="space-y-1 font-mono text-[11px]">
                {selectedRecord.systemPermissions.map((perm, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="text-good font-bold">✓</span>
                    <span>{perm}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-3 bg-panel border-line flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-good shrink-0" />
              <span className="text-[11px] text-muted">
                Dual-Control enforced: Manager approval logged under audit trail (AGT-06 / PLT-07).
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
