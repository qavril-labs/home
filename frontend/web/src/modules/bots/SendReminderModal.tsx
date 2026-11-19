import React, { useState, useEffect } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { formatMoney } from "../../lib/currency";
import type { OverdueInvoice, ReminderDraft } from "../../types";
import {
  MessageSquare,
  Mail,
  Send,
  Sparkles,
  AlertCircle,
  Clock,
} from "lucide-react";

export interface SendReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: OverdueInvoice | null;
  onSendReminder: (draft: ReminderDraft) => void;
}

export const SendReminderModal: React.FC<SendReminderModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onSendReminder,
}) => {
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [tone, setTone] = useState<"friendly" | "firm" | "urgent">("friendly");
  const [subject, setSubject] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");

  useEffect(() => {
    if (invoice && invoice.draftReminder) {
      setChannel(invoice.draftReminder.channel);
      setTone(invoice.draftReminder.tone);
      setSubject(invoice.draftReminder.subject || `Courtesy reminder: Invoice ${invoice.id} (${formatMoney(invoice.amountDue)})`);
      setMessage(invoice.draftReminder.message);
      setRecipient(invoice.draftReminder.recipient);
    } else if (invoice) {
      setChannel("whatsapp");
      setTone("friendly");
      setSubject(`Courtesy reminder: Invoice ${invoice.id} (${formatMoney(invoice.amountDue)})`);
      setMessage(
        `Hi ${invoice.partyName} team, friendly reminder from Apex Precision Tools: Invoice ${invoice.id} (${formatMoney(
          invoice.amountDue
        )}) was due on ${invoice.dueDate}. Please let us know when payment has been scheduled. Thank you!`
      );
      setRecipient("+1 555-019-2831");
    }
  }, [invoice]);

  const handleToneChange = (newTone: "friendly" | "firm" | "urgent") => {
    setTone(newTone);
    if (!invoice) return;

    if (newTone === "friendly") {
      setMessage(
        `Hi ${invoice.partyName} team, friendly reminder from Apex Precision Tools: Invoice ${invoice.id} (${formatMoney(
          invoice.amountDue
        )}) was due on ${invoice.dueDate}. Please let us know when payment has been scheduled. Thank you!`
      );
    } else if (newTone === "firm") {
      setMessage(
        `Attention Accounts Payable, ${invoice.partyName}: Invoice ${invoice.id} for ${formatMoney(
          invoice.amountDue
        )} is now ${invoice.daysOverdue} days past due (due date was ${
          invoice.dueDate
        }). Please arrange payment at your earliest convenience or contact our billing desk.`
      );
    } else if (newTone === "urgent") {
      setMessage(
        `URGENT NOTICE - OVERDUE BALANCE: Invoice ${invoice.id} (${formatMoney(
          invoice.amountDue
        )}) for ${invoice.partyName} is significantly overdue. Immediate settlement is required to prevent commercial account credit suspension.`
      );
    }
  };

  const handleSend = () => {
    if (!invoice) return;
    const finalDraft: ReminderDraft = {
      id: invoice.draftReminder?.id || `REM-${Math.floor(100 + Math.random() * 900)}`,
      invoiceId: invoice.id,
      channel,
      recipient,
      recipientName: invoice.partyName,
      subject: channel === "email" ? subject : undefined,
      message,
      tone,
      status: "approved",
      updatedAt: new Date().toLocaleTimeString(),
    };
    onSendReminder(finalDraft);
  };

  if (!invoice) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Review Payment Reminder Draft"
      description="Chase Chloe prepared this collection draft based on customer terms and past payment velocity."
      maxWidth="max-w-xl"
    >
      <div className="space-y-3">
        {/* Invoice Summary Banner */}
        <div className="p-3 bg-panel border-line shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-text">{invoice.id}</span>
              <span className="text-muted">·</span>
              <span className="font-bold text-text">{invoice.partyName}</span>
            </div>
            <div className="flex items-center gap-2 text-muted mt-0.5 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-watch" />
              <span>Due {invoice.dueDate}</span>
              <span>·</span>
              <span className="font-bold text-act">{invoice.daysOverdue} days overdue</span>
            </div>
          </div>

          <div className="sm:text-right">
            <span className="text-[10px] uppercase font-bold text-muted block">
              Outstanding Balance
            </span>
            <span className="font-display font-black text-base text-text">
              {formatMoney(invoice.amountDue)}
            </span>
          </div>
        </div>

        {/* Channel & Tone Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Channel Selector */}
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1.5">
              Delivery Channel
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setChannel("whatsapp")}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-bold border-line transition-all ${
                  channel === "whatsapp"
                    ? "bg-yellow text-ink shadow-[2px_2px_0_var(--q-ink)]"
                    : "bg-page text-muted hover:text-text hover:bg-page/80"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setChannel("email")}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-bold border-line transition-all ${
                  channel === "email"
                    ? "bg-yellow text-ink shadow-[2px_2px_0_var(--q-ink)]"
                    : "bg-page text-muted hover:text-text hover:bg-page/80"
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email</span>
              </button>
            </div>
          </div>

          {/* Tone Selector */}
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1.5">
              Tone Style
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["friendly", "firm", "urgent"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleToneChange(t)}
                  className={`py-1.5 px-2 text-[11px] font-bold border-line uppercase transition-all ${
                    tone === t
                      ? "bg-cream text-ink shadow-[2px_2px_0_var(--q-ink)] font-black"
                      : "bg-page text-muted hover:text-text"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recipient Address */}
        <div>
          <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">
            {channel === "whatsapp" ? "WhatsApp Number" : "Recipient Email"}
          </label>
          <div className="relative">
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full text-xs font-mono px-3 py-2 bg-page border-line focus:outline-none focus:ring-1 focus:ring-ink"
              placeholder={channel === "whatsapp" ? "+1 555-..." : "ap@customer.com"}
            />
          </div>
        </div>

        {/* Email Subject Field (Email only) */}
        {channel === "email" && (
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">
              Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full text-xs font-medium px-3 py-2 bg-page border-line focus:outline-none focus:ring-1 focus:ring-ink"
            />
          </div>
        )}

        {/* Message Editor */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-yellow" />
              <span>Draft Message Preview</span>
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

        {/* Tier 2 Human Review Notice */}
        <div className="p-2.5 bg-cream border-line flex items-start gap-2 text-[11px] text-ink">
          <AlertCircle className="w-4 h-4 text-watch flex-shrink-0 mt-0.5" />
          <span>
            <strong>Tier 2 Supervisor Action:</strong> Chloe drafts reminders but never contacts clients without your explicit approval. Approving dispatches the communication and logs an audit record.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-grid">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="yellow"
            size="sm"
            onClick={handleSend}
            className="flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Approve & Deliver Reminder</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
