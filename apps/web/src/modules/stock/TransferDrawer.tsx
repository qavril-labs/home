import React, { useEffect, useState } from "react";
import { Drawer } from "../../components/ui/Drawer";
import { useToast } from "../../context/ToastContext";
import { liveApi } from "../../lib/live-api";
import { formatQuantity, todayIso } from "../../lib/live-format";
import { digitsOnly, errorMessage, Field, fieldClass } from "./fields";
import type { LiveContext } from "./LiveContext";

interface TransferForm {
  fromWarehouse: string;
  toWarehouse: string;
  item: string;
  qty: string;
  date: string;
  reference: string;
}

function blankForm(): TransferForm {
  return {
    fromWarehouse: "",
    toWarehouse: "",
    item: "",
    qty: "",
    date: todayIso(),
    reference: `TR-${Date.now().toString(36).toUpperCase()}`,
  };
}

/** Moves stock between warehouses, first to expire first. No ledger entry is posted for a transfer. */
export const TransferDrawer: React.FC<{ live: LiveContext; isOpen: boolean; onClose: () => void; onMoved: () => void }> = ({
  live,
  isOpen,
  onClose,
  onMoved,
}) => {
  const { showToast } = useToast();
  const [form, setForm] = useState<TransferForm>(blankForm);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setForm(blankForm());
      setServerError(null);
    }
  }, [isOpen]);

  const set = (key: keyof TransferForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setServerError(null);
    const required: (keyof TransferForm)[] = ["fromWarehouse", "toWarehouse", "item", "qty", "date", "reference"];
    if (required.some((key) => form[key].trim() === "")) {
      setServerError("Fill in every field.");
      return;
    }
    if (form.fromWarehouse.trim() === form.toWarehouse.trim()) {
      setServerError("Choose two different warehouses.");
      return;
    }
    setSubmitting(true);
    try {
      const moved = await liveApi.transfer(live.token, {
        companyId: live.companyId,
        fromWarehouse: form.fromWarehouse.trim(),
        toWarehouse: form.toWarehouse.trim(),
        item: form.item.trim(),
        qty: form.qty,
        date: form.date,
        reference: form.reference.trim(),
      });
      showToast(`Moved ${formatQuantity(moved.transferred)} of ${form.item.trim()} to ${form.toWarehouse.trim()}.`, undefined, "good");
      onMoved();
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
      title="Transfer stock"
      description="Stock leaves the first warehouse first to expire. Its batch number, expiry date and cost travel with it. A transfer posts no ledger entry."
      primaryActionLabel="Transfer stock"
      primaryActionVariant="cyan"
      onPrimaryAction={submit}
      isSubmitting={submitting}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="From warehouse">
          <input className={fieldClass} value={form.fromWarehouse} onChange={(event) => set("fromWarehouse", event.target.value)} />
        </Field>
        <Field label="To warehouse">
          <input className={fieldClass} value={form.toWarehouse} onChange={(event) => set("toWarehouse", event.target.value)} />
        </Field>
        <Field label="Item code">
          <input className={fieldClass} value={form.item} onChange={(event) => set("item", event.target.value)} />
        </Field>
        <Field label="Quantity" hint="Whole units.">
          <input inputMode="numeric" className={fieldClass} value={form.qty} onChange={(event) => set("qty", digitsOnly(event.target.value))} />
        </Field>
        <Field label="Date">
          <input type="date" className={fieldClass} value={form.date} onChange={(event) => set("date", event.target.value)} />
        </Field>
        <Field label="Reference" hint="A repeat with the same reference moves nothing more.">
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
