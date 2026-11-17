import React, { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { StatusChip } from "../../components/ui/StatusChip";
import { useToast } from "../../context/ToastContext";
import { formatAmount } from "../../lib/live-format";
import { liveApi, type LiveApproval, type Amount } from "../../lib/live-api";
import { errorMessage, Field, fieldClass } from "./fields";
import type { LiveContext } from "./LiveContext";

/** A request as the approver reads it: what is asked, by whom, and why. */
function summaryOf(item: LiveApproval): string {
  const p = item.payload;
  const text = (key: string) => (typeof p[key] === "string" ? (p[key] as string) : "");
  if (item.kind === "INVENTORY_WRITE_OFF") {
    return `Write off expired ${text("item")} in ${text("warehouse")}, as of ${text("date")}. Reference ${text("reference")}.`;
  }
  if (item.kind === "STOCK_COUNT_APPLY") {
    return "Apply a submitted stock count. Each difference from the books is posted as an adjustment.";
  }
  if (item.kind === "POS_BILL_DISCOUNT") {
    return `Approve a bill discount of ${text("amount")} on sale ${text("saleId")}.`;
  }
  return item.kind;
}

/** What a decided request did, in the words the server gave back (effect). */
function effectOf(item: LiveApproval): string | null {
  const effect = item.effect;
  if (!effect) return null;
  if (effect.written === true) {
    const cost = effect.cost as Amount | null | undefined;
    return `Written off. Cost ${cost ? formatAmount(cost) : "—"}.`;
  }
  if (effect.written === false) return "Nothing had expired by that date, so nothing was written off.";
  if (effect.countStatus === "APPLIED") {
    const net = effect.netValue as Amount | null | undefined;
    return `Count applied with ${effect.adjustments ?? 0} adjustment(s). Net ${net ? formatAmount(net) : "—"}.`;
  }
  return null;
}

/**
 * Requests waiting for a second person, of the kinds given. Approving carries the action out on the server. The
 * requester cannot approve their own request, and the screen says so rather than hiding the choice.
 */
export const PendingApprovals: React.FC<{
  live: LiveContext;
  kinds: string[];
  title: string;
  description: string;
  onChanged: () => void;
  version: number;
}> = ({ live, kinds, title, description, onChanged, version }) => {
  const { showToast } = useToast();
  const [items, setItems] = useState<LiveApproval[] | null>(null);
  const [confirming, setConfirming] = useState<LiveApproval | null>(null);
  const [rejecting, setRejecting] = useState<LiveApproval | null>(null);
  const [note, setNote] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    liveApi
      .approvals(live.token, live.companyId, "PENDING")
      .then((all) => setItems(all.filter((item) => kinds.includes(item.kind))))
      .catch((failure: unknown) => setError(errorMessage(failure)));
  }, [live.token, live.companyId, kinds]);

  useEffect(() => {
    load();
  }, [load, version]);

  const approve = async () => {
    if (!confirming) return;
    setBusy(true);
    setError(null);
    try {
      const decided = await liveApi.approve(live.token, confirming.id, live.companyId);
      const outcome = effectOf(decided);
      if (outcome) setOutcomes((current) => ({ ...current, [decided.id]: outcome }));
      showToast("Approved.", undefined, "good");
      setConfirming(null);
      load();
      onChanged();
    } catch (failure) {
      setError(errorMessage(failure));
      setConfirming(null);
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    if (note.trim().length < 5) {
      setError("A rejection needs a note of at least five characters, so the requester knows what to change.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await liveApi.reject(live.token, rejecting.id, live.companyId, note.trim());
      showToast("Rejected. The requester has been told why.", undefined, "warn");
      setRejecting(null);
      setNote("");
      load();
      onChanged();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={title} subtitle={description}>
      {error ? (
        <p role="alert" className="pb-3 text-sm font-bold text-pink">
          {error}
        </p>
      ) : null}
      {items === null ? (
        <EmptyState title="Loading requests" description="Fetching the requests waiting for a decision." />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing waiting" description="No request is waiting for a second person right now." />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const isMine = item.requestedBy === live.userId;
            return (
              <li key={item.id} className="border-line shadow-sm p-4 bg-panel space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip status="act" label="Needs a second person" />
                  <span className="text-xs font-black uppercase text-muted">{item.kind}</span>
                  <span className="text-xs text-muted">Requested {item.requestedAt.slice(0, 10)}</span>
                </div>
                <p className="text-sm text-text">{summaryOf(item)}</p>
                <p className="text-sm text-muted">
                  <span className="font-bold">Reason:</span> {item.reason}
                </p>
                {outcomes[item.id] ? <p className="text-sm font-bold text-good">{outcomes[item.id]}</p> : null}
                <div className="flex flex-wrap gap-2 items-center pt-1">
                  <Button variant="lime" size="sm" disabled={isMine || busy} onClick={() => setConfirming(item)}>
                    Approve
                  </Button>
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => setRejecting(item)}>
                    Reject
                  </Button>
                  {isMine ? <span className="text-xs font-bold text-muted">You asked for this, so a second person has to approve it.</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        isOpen={confirming !== null}
        onClose={() => setConfirming(null)}
        title="Approve this request?"
        message={confirming ? `${summaryOf(confirming)} This takes effect as soon as you approve.` : ""}
        actionVerb="Approve"
        actionVariant="lime"
        onConfirm={approve}
        isSubmitting={busy}
      />

      <Modal
        isOpen={rejecting !== null}
        onClose={() => {
          setRejecting(null);
          setNote("");
        }}
        title="Reject this request"
        description="Say what needs to change. The requester sees this note."
        primaryActionLabel="Reject"
        primaryActionVariant="pink"
        onPrimaryAction={reject}
        isSubmitting={busy}
      >
        <Field label="Note for the requester" hint="At least five characters.">
          <textarea className={`${fieldClass} min-h-24`} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </Modal>
    </Card>
  );
};
