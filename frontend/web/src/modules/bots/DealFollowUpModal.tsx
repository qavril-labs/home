import React, { useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { formatMoney } from "../../lib/currency";
import type { PipelineDeal } from "../../types";
import {
  Send,
  Clock,
  Sparkles,
  Building,
  User,
  ShieldAlert,
} from "lucide-react";

export interface DealFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  deal: PipelineDeal | null;
  onSendFollowUp: (dealId: string, message: string) => void;
}

export const DealFollowUpModal: React.FC<DealFollowUpModalProps> = ({
  isOpen,
  onClose,
  deal,
  onSendFollowUp,
}) => {
  const [message, setMessage] = useState<string>("");

  React.useEffect(() => {
    if (deal) {
      setMessage(
        deal.draftMessage ||
          `Hi ${deal.contactPerson}, following up on our proposal for ${deal.title}. We would love to answer any questions your team might have.`
      );
    }
  }, [deal]);

  if (!deal) return null;

  const isMarginBreached = (deal.discountOffered || 0) > 18;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Review Sales Follow-Up Draft"
      description={`Pip prepared this message to re-engage ${deal.customer} after ${deal.daysQuiet} days of silence.`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4 text-xs">
        {/* Deal Header Info */}
        <div className="p-3 bg-panel border-line shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-text text-sm">{deal.title}</span>
            <span className="font-display font-black text-sm text-text">
              {formatMoney(deal.amount)}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between text-muted text-[11px] pt-1 border-t border-grid">
            <div className="flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5" />
              <span>{deal.customer}</span>
              <span>·</span>
              <User className="w-3.5 h-3.5" />
              <span>{deal.contactPerson}</span>
            </div>
            <div className="flex items-center gap-1 text-watch font-bold">
              <Clock className="w-3.5 h-3.5" />
              <span>{deal.daysQuiet} days quiet</span>
            </div>
          </div>
        </div>

        {/* Margin Discount Warning (if applicable) */}
        {deal.discountOffered && deal.discountOffered > 0 && (
          <div
            className={`p-2.5 border-line flex items-start gap-2 ${
              isMarginBreached
                ? "bg-act/10 border-act text-act"
                : "bg-cream text-ink"
            }`}
          >
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Discount Policy Check:</strong> {deal.discountOffered}% discount offered.{" "}
              {isMarginBreached
                ? "Breaches standard 18% floor policy; requires supervisor sign-off in Approvals Inbox."
                : "Within approved representative margin threshold."}
            </span>
          </div>
        )}

        {/* Message Editor */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5 break-words">
              <Sparkles className="w-3.5 h-3.5 text-lime" />
              <span>Personalized Outreach Message</span>
            </label>
            <span className="text-[10px] font-mono text-muted">
              {message.length} characters
            </span>
          </div>

          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full text-xs p-3 bg-page border-line font-medium text-text focus:outline-none focus:ring-1 focus:ring-ink leading-relaxed"
          />
        </div>

        {/* Tier 2 Supervisor Note */}
        <p className="text-[11px] text-muted leading-relaxed break-words">
          Pip drafts quiet deal re-engagement messages but never contacts commercial prospects without representative approval.
        </p>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-grid">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="lime"
            size="sm"
            onClick={() => {
              onSendFollowUp(deal.id, message);
              onClose();
            }}
            className="flex items-center gap-1.5 font-bold"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Follow-Up Message</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
