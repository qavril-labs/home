import React from "react";
import { cn } from "../../lib/utils";
import { StatusChip } from "./StatusChip";
import { Button } from "./Button";
import type { BotInsight } from "../../types";
import { Bot, ArrowRight, FileText, CheckCircle2 } from "lucide-react";

export interface BotCardProps {
  bot: BotInsight;
  onAction?: (bot: BotInsight) => void;
  className?: string;
}

export const BotCard: React.FC<BotCardProps> = ({ bot, onAction, className }) => {
  const avatarColors: Record<string, string> = {
    lime: "bg-lime text-ink",
    pink: "bg-pink text-white",
    violet: "bg-violet text-white",
    cyan: "bg-cyan text-ink",
    yellow: "bg-yellow text-ink",
    orange: "bg-orange text-white",
  };

  const avatarBg = avatarColors[bot.color] || "bg-lime text-ink";

  return (
    <div
      className={cn(
        "neo-card flex flex-col justify-between p-4 border-line hover:-translate-y-0.5 transition-transform",
        className
      )}
    >
      <div>
        {/* Header: Avatar, Name, Role, StatusChip */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 border-line shadow-[2px_2px_0_var(--q-ink)] flex items-center justify-center font-bold text-lg select-none",
                avatarBg
              )}
            >
              {bot.name.charAt(0)}
            </div>
            <div>
              <h3 className="font-bold text-sm text-text leading-tight">{bot.name}</h3>
              <p className="text-xs text-muted leading-tight mt-0.5">{bot.role}</p>
            </div>
          </div>
          <StatusChip status={bot.status} label={bot.statusText} />
        </div>

        {/* Found & Next sections */}
        <div className="space-y-2 text-xs my-3 bg-page p-2.5 border border-grid">
          <div>
            <span className="font-bold uppercase text-[10px] text-muted tracking-wider block">
              Found
            </span>
            <p className="text-text mt-0.5 leading-snug">{bot.foundText}</p>
          </div>
          <div className="pt-2 border-t border-grid">
            <span className="font-bold uppercase text-[10px] text-muted tracking-wider block">
              Next Step
            </span>
            <p className="text-text mt-0.5 leading-snug font-medium">{bot.nextText}</p>
          </div>
        </div>
      </div>

      {/* Draft banner & Action Button */}
      {bot.hasDraft && (
        <div className="mt-2 pt-2 border-t border-grid flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-pink">
            <FileText className="w-3.5 h-3.5" />
            <span className="truncate">{bot.draftLabel || "Draft prepared"}</span>
          </div>

          <Button
            size="sm"
            variant="lime"
            onClick={() => onAction?.(bot)}
            className="text-xs py-1 px-3"
          >
            {bot.actionVerb || "Review"}
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
};
