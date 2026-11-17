import React, { useEffect, useState } from "react";
import { Drawer } from "../../components/ui/Drawer";
import { useToast } from "../../context/ToastContext";
import { liveApi } from "../../lib/live-api";
import { todayIso } from "../../lib/live-format";
import { isAccountCode, stockAccounts, type PostingAccounts } from "../../lib/posting-accounts";
import { amountText, digitsOnly, errorMessage, Field, fieldClass } from "./fields";
import type { LiveContext } from "./LiveContext";

interface ReceiveForm {
  warehouse: string;
  item: string;
  batchNo: string;
  expiresOn: string;
  qty: string;
  unitCost: string;
  date: string;
  reference: string;
}

function blankForm(): ReceiveForm {
  return {
    warehouse: "",
    item: "",
    batchNo: "",
    expiresOn: "",
    qty: "",
    unitCost: "",
    date: todayIso(),
    reference: `GRN-${Date.now().toString(36).toUpperCase()}`,
  };
}

/** Receives goods into a new batch. The server checks the expiry, the cost, and the batch number. */
export const ReceiveDrawer: React.FC<{
  live: LiveContext;
  isOpen: boolean;
  onClose: () => void;
  accounts: PostingAccounts;
  onReceived: () => void;
}> = ({ live, isOpen, onClose, accounts, onReceived }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState<ReceiveForm>(blankForm);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setForm(blankForm());
      setServerError(null);
    }
  }, [isOpen]);

  const set = (key: keyof ReceiveForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const missing = (["warehouse", "item", "batchNo", "qty", "unitCost", "date", "reference"] as const).filter((key) => form[key].trim() === "");

  const submit = async () => {
    setServerError(null);
    if (missing.length > 0) {
      setServerError("Fill in every field marked as required.");
      return;
    }
    const stock = stockAccounts(accounts);
    if (!isAccountCode(stock.inventory) || !isAccountCode(stock.clearing) || !isAccountCode(stock.cogs) || !isAccountCode(stock.writeOff)) {
      setServerError("Set the posting accounts first, on the Posting accounts tab.");
      return;
    }
    setSubmitting(true);
    try {
      await liveApi.receive(live.token, {
        companyId: live.companyId,
        warehouse: form.warehouse.trim(),
        item: form.item.trim(),
        batchNo: form.batchNo.trim(),
        expiresOn: form.expiresOn === "" ? null : form.expiresOn,
        qty: form.qty,
        unitCost: form.unitCost,
        date: form.date,
        reference: form.reference.trim(),
        accounts: { inventory: stock.inventory, clearing: stock.clearing, cogs: stock.cogs, writeOff: stock.writeOff },
      });
      showToast(`Received ${form.qty} of ${form.item.trim()} into batch ${form.batchNo.trim()}.`, undefined, "good");
      onReceived();
    } catch (error) {
      setServerError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Receive stock"
      description="Goods come in as a new batch with its expiry date and unit cost. The value is posted to the ledger."
      primaryActionLabel="Receive stock"
      onPrimaryAction={submit}
      isSubmitting={submitting}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Warehouse">
          <input className={fieldClass} value={form.warehouse} onChange={(event) => set("warehouse", event.target.value)} />
        </Field>
        <Field label="Item code">
          <input className={fieldClass} value={form.item} onChange={(event) => set("item", event.target.value)} />
        </Field>
        <Field label="Batch number">
          <input className={fieldClass} value={form.batchNo} onChange={(event) => set("batchNo", event.target.value)} />
        </Field>
        <Field label="Expiry date" hint="Leave empty for an item with no expiry.">
          <input type="date" className={fieldClass} value={form.expiresOn} onChange={(event) => set("expiresOn", event.target.value)} />
        </Field>
        <Field label="Quantity" hint="Whole units.">
          <input inputMode="numeric" className={fieldClass} value={form.qty} onChange={(event) => set("qty", digitsOnly(event.target.value))} />
        </Field>
        <Field label="Unit cost" hint="In the company currency.">
          <input inputMode="decimal" className={fieldClass} value={form.unitCost} onChange={(event) => set("unitCost", amountText(event.target.value))} />
        </Field>
        <Field label="Date received">
          <input type="date" className={fieldClass} value={form.date} onChange={(event) => set("date", event.target.value)} />
        </Field>
        <Field label="Reference" hint="A repeat with the same reference never creates a second batch.">
          <input className={fieldClass} value={form.reference} onChange={(event) => set("reference", event.target.value)} />
        </Field>
      </div>
      {serverError ? (
        <p role="alert" className="pt-4 text-sm font-bold text-pink">
          {serverError}
        </p>
      ) : null}
    </Drawer>
  );
};
