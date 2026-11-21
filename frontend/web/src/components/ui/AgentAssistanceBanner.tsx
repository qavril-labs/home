import React from "react";
import { Sparkles, ArrowRight, ShieldCheck, UserCheck } from "lucide-react";
import { Button } from "./Button";

export interface AgentAssistanceBannerProps {
  botName: string;
  catalogId: string;
  accentColor?: "lime" | "pink" | "cyan" | "yellow" | "violet" | "orange";
  taskSummary: string;
  recommendation: string;
  evidencePoints?: string[];
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  isActionDisabled?: boolean;
}

export const AgentAssistanceBanner: React.FC<AgentAssistanceBannerProps> = ({
  botName,
  catalogId,
  accentColor = "lime",
  taskSummary,
  recommendation,
  evidencePoints = [],
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  isActionDisabled = false,
}) => {
  const accentClasses = {
    lime: "border-l-4 border-lime bg-lime/10",
    pink: "border-l-4 border-pink bg-pink/10",
    cyan: "border-l-4 border-cyan bg-cyan/10",
    yellow: "border-l-4 border-yellow bg-yellow/10",
    violet: "border-l-4 border-violet bg-violet/10",
    orange: "border-l-4 border-orange bg-orange/10",
  }[accentColor];

  const badgeColor = {
    lime: "bg-lime text-ink",
    pink: "bg-pink text-white",
    cyan: "bg-cyan text-ink",
    yellow: "bg-yellow text-ink",
    violet: "bg-violet text-white",
    orange: "bg-orange text-ink",
  }[accentColor];

  return (
    <div
      className={`neo-card p-4 bg-panel border-line shadow-card mb-4 min-w-0 overflow-hidden ${accentClasses}`}
      role="region"
      aria-label={`${botName} Copilot Task Assistance`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
        {/* Left: Bot insight & curated proposal */}
        <div className="space-y-2 max-w-3xl min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider font-mono border-line shrink-0 ${badgeColor}`}
            >
              {catalogId} Copilot
            </span>
            <span className="text-xs font-bold text-text flex items-center gap-1.5 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-lime" />
              <span>{botName} Task Recommendation</span>
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-page border border-line text-muted shrink-0">
              <UserCheck className="w-3 h-3 text-good" />
              <span>Human-In-The-Loop Approval Required</span>
            </span>
          </div>

          <div className="min-w-0">
            <h4 className="text-sm font-extrabold text-text font-display uppercase tracking-tight break-words">
              {taskSummary}
            </h4>
            <p className="text-xs text-muted mt-1 leading-relaxed break-words">
              {recommendation}
            </p>
          </div>

          {evidencePoints.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-muted font-mono min-w-0">
              <span className="font-bold text-text shrink-0">Audit Invariants:</span>
              {evidencePoints.map((point, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-page border border-grid text-text break-all"
                >
                  {point}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right: Explicit Human Action Trigger */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {secondaryActionLabel && onSecondaryAction && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSecondaryAction}
                className="text-xs shrink-0"
              >
                {secondaryActionLabel}
              </Button>
            )}
            <Button
              variant={accentColor as any}
              size="sm"
              onClick={onPrimaryAction}
              disabled={isActionDisabled}
              className="flex items-center gap-1.5 font-bold text-xs shrink-0"
            >
              <span className="truncate max-w-[200px] sm:max-w-none">{primaryActionLabel}</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </Button>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-muted shrink-0">
            <ShieldCheck className="w-3 h-3 text-good shrink-0" />
            <span>Non-autonomous · User retains final review</span>
          </div>
        </div>
      </div>
    </div>
  );
};
