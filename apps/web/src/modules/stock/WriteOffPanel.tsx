import React, { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../context/ToastContext";
import { liveApi } from "../../lib/live-api";
import { todayIso } from "../../lib/live-format";
import { isAccountCode, stockAccounts, type PostingAccounts } from "../../lib/posting-accounts";
import { errorMessage, Field, fieldClass } from "./fields";
import { PendingApprovals } from "./PendingApprovals";
import type { LiveContext } from "./LiveContext";

export interface WriteOffPrefill {
  warehouse: string;
  item: string;
  date: string;
}

const WRITE_OFF_KINDS = ["INVENTORY_WRITE_OFF", "STOCK_COUNT_APPLY"];

/** Asks for expired stock to be written off. Nothing moves until a second person approves the request. */
export const WriteOffPanel: React.FC<{
  live: LiveContext;
  accounts: PostingAccounts;
  prefill: WriteOffPrefill | null;
  onChanged: () => void;
}> = ({ live, accounts, prefill, onChanged }) => {
  const { showToast } = useToast();
  const [open, setOpen] = useState<boolean>(false);
  const [warehouse, setWarehouse] = useState<string>("");
  const [item, setItem] = useState<string>("");
  const [date, setDate] = useState<string>(todayIso());
  const [reference, setReference] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<number>(0);

  // A write-off asked for from the expiry report opens here, already filled in.
  useEffect(() => {
    if (!prefill) return;
    setWarehouse(prefill.warehouse);
    setItem(prefill.item);
    setDate(prefill.date);
    setReference(`WO-${Date.now().toString(36).toUpperCase()}`);
    setReason("");
    setError(null);
    setOpen(true);
  }, [prefill]);

  const startNew = () => {
    setWarehouse("");
    setItem("");
    setDate(todayIso());
    setReference(`WO-${Date.now().toString(36).toUpperCase()}`);
    setReason("");
    setError(null);
    setOpen(true);
  };

  const submit = async () => {
    setError(null);
    if ([warehouse, item, date, reference].some((value) => value.trim() === "")) {
      setError("Fill in the warehouse, item, date and reference.");
      return;
    }
    if (reason.trim().length < 10) {
      setError("Say why the stock is being written off, in at least ten characters. The approver reads it.");
      return;
    }
    const stock = stockAccounts(accounts);
    if (!isAccountCode(stock.inventory) || !isAccountCode(stock.writeOff)) {
      setError("Set the posting accounts first, on the Posting accounts tab.");
      return;
    }
    setBusy(true);
    try {
      await liveApi.requestWriteOff(live.token, {
        companyId: live.companyId,
        warehouse: warehouse.trim(),
        item: item.trim(),
        date,
        reference: reference.trim(),
        reason: reason.trim(),
        accounts: { inventory: stock.inventory, clearing: stock.clearing, cogs: stock.cogs, writeOff: stock.writeOff },
      });
      showToast("Write-off requested. It waits for a second person to approve it.", undefined, "good");
      setOpen(false);
      setVersion((value) => value + 1);
      onChanged();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title="Write off expired stock"
        subtitle="A write-off is a request. The stock stays on the books until a second person approves it."
        action={
          <Button variant="pink" size="sm" onClick={startNew}>
            Request a write-off
          </Button>
        }
      >
        <p className="text-sm text-muted">
          Only batches that expired before the date are written off, first to expire first. If nothing has expired by that date, the server refuses the request.
        </p>
      </Card>

      <PendingApprovals
        live={live}
        kinds={WRITE_OFF_KINDS}
        title="Waiting for approval"
        description="Write-offs and count adjustments that a second person must approve. You cannot approve your own."
        onChanged={onChanged}
        version={version}
      />

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Request a write-off"
        description="The expired batches are written off only after a second person approves."
        primaryActionLabel="Send for approval"
        primaryActionVariant="pink"
        onPrimaryAction={submit}
        isSubmitting={busy}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Warehouse">
            <input className={fieldClass} value={warehouse} onChange={(event) => setWarehouse(event.target.value)} />
          </Field>
          <Field label="Item code">
            <input className={fieldClass} value={item} onChange={(event) => setItem(event.target.value)} />
          </Field>
          <Field label="As of">
            <input type="date" className={fieldClass} value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Reference">
            <input className={fieldClass} value={reference} onChange={(event) => setReference(event.target.value)} />
          </Field>
          <Field label="Reason" className="sm:col-span-2">
            <textarea className={`${fieldClass} min-h-20`} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </div>
        {error ? (
          <p role="alert" className="pt-4 text-sm font-bold text-pink">
            {error}
          </p>
        ) : null}
      </Modal>
    </div>
  );
};
