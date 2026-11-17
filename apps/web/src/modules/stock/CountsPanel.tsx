import React, { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { StatusChip, type StatusChipProps } from "../../components/ui/StatusChip";
import { useToast } from "../../context/ToastContext";
import { liveApi, type CountStatus, type LiveCount, type LiveCountLine } from "../../lib/live-api";
import { formatQuantity, todayIso } from "../../lib/live-format";
import { isAccountCode, stockAccounts, type PostingAccounts } from "../../lib/posting-accounts";
import { digitsOnly, errorMessage, Field, fieldClass } from "./fields";
import type { LiveContext } from "./LiveContext";
import { PendingApprovals } from "./PendingApprovals";

/** A constant, so the approvals list does not reload on every render. */
const COUNT_KINDS = ["STOCK_COUNT_APPLY"];

const STATUS_CHIP: Record<CountStatus, { status: StatusChipProps["status"]; label: string }> = {
  OPEN: { status: "watch", label: "Counting" },
  SUBMITTED: { status: "act", label: "Waiting for approval" },
  APPLIED: { status: "good", label: "Applied" },
  CANCELLED: { status: "idle", label: "Cancelled" },
};

/**
 * Stock counts (INV-09). The counter records what is on the shelf, batch by batch, without seeing the expected
 * quantity. The server withholds the expected figure until the count is no longer open, so this screen shows
 * the column only when the data has it. Submitting sends the count for a second person to approve.
 */
export const CountsPanel: React.FC<{ live: LiveContext; accounts: PostingAccounts; onChanged: () => void }> = ({ live, accounts, onChanged }) => {
  const { showToast } = useToast();
  const [counts, setCounts] = useState<LiveCount[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [startOpen, setStartOpen] = useState<boolean>(false);
  const [submitOpen, setSubmitOpen] = useState<boolean>(false);
  const [cancelOpen, setCancelOpen] = useState<boolean>(false);
  const [warehouse, setWarehouse] = useState<string>("");
  const [date, setDate] = useState<string>(todayIso());
  const [reason, setReason] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<number>(0);

  const load = useCallback(() => {
    liveApi
      .counts(live.token, live.companyId)
      .then((list) => setCounts(list))
      .catch((failure: unknown) => setError(errorMessage(failure)));
  }, [live.token, live.companyId]);

  useEffect(() => {
    load();
  }, [load, version]);

  const selected = counts?.find((count) => count.id === selectedId) ?? null;

  // Drafts start from what the server holds, so a count re-opened on this screen shows the saved figures.
  useEffect(() => {
    if (!selected) return;
    setDrafts(Object.fromEntries(selected.lines.map((line) => [line.batchId, line.counted ?? ""])));
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setError(null);
    if (warehouse.trim() === "") {
      setError("Name the warehouse to count.");
      return;
    }
    setBusy(true);
    try {
      const created = await liveApi.startCount(live.token, { companyId: live.companyId, warehouse: warehouse.trim(), date });
      setStartOpen(false);
      setWarehouse("");
      setSelectedId(created.id);
      showToast(`Count of ${created.warehouse} started. Record what you see, batch by batch.`, undefined, "good");
      setVersion((value) => value + 1);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const saveLine = async (line: LiveCountLine) => {
    if (!selected) return;
    const counted = drafts[line.batchId] ?? "";
    if (counted === "") {
      setError("Enter the number you counted, zero if there is none.");
      return;
    }
    setError(null);
    try {
      const updated = await liveApi.recordCountLine(live.token, selected.id, { companyId: live.companyId, batchId: line.batchId, counted });
      setCounts((current) => (current ?? []).map((count) => (count.id === updated.id ? updated : count)));
    } catch (failure) {
      setError(errorMessage(failure));
    }
  };

  const submit = async () => {
    if (!selected) return;
    if (reason.trim().length < 10) {
      setError("Say why this count is being applied, in at least ten characters. The approver reads it.");
      return;
    }
    const stock = stockAccounts(accounts);
    if (!isAccountCode(stock.inventory) || !isAccountCode(stock.clearing) || !isAccountCode(stock.cogs) || !isAccountCode(stock.writeOff) || !isAccountCode(stock.countVariance)) {
      setError("Set the posting accounts first, on the Posting accounts tab.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await liveApi.submitCount(live.token, selected.id, {
        companyId: live.companyId,
        reason: reason.trim(),
        accounts: stock,
      });
      setSubmitOpen(false);
      setReason("");
      showToast("Count sent for approval. Its adjustments post once a second person approves.", undefined, "good");
      setVersion((value) => value + 1);
      onChanged();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await liveApi.cancelCount(live.token, selected.id, live.companyId);
      setCancelOpen(false);
      setSelectedId(null);
      showToast("Count cancelled. Nothing was changed.", undefined, "warn");
      setVersion((value) => value + 1);
    } catch (failure) {
      setError(errorMessage(failure));
      setCancelOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const allCounted = selected ? selected.lines.every((line) => line.counted !== null) : false;
  const showExpected = selected ? selected.lines.some((line) => line.expected !== undefined) : false;
  const isOpen = selected?.status === "OPEN";

  const columns: Column<LiveCountLine>[] = [
    { header: "Batch", cell: (row) => <span className="font-bold">{row.batchNo}</span> },
    { header: "Item", accessorKey: "item" },
    { header: "Expires", cell: (row) => row.expiresOn ?? "—" },
    {
      header: "Counted",
      align: "right",
      cell: (row) =>
        isOpen ? (
          <input
            aria-label={`Counted for batch ${row.batchNo}`}
            inputMode="numeric"
            className={`${fieldClass} w-28 text-right`}
            value={drafts[row.batchId] ?? ""}
            onChange={(event) => setDrafts((current) => ({ ...current, [row.batchId]: digitsOnly(event.target.value) }))}
            onBlur={() => saveLine(row)}
          />
        ) : (
          formatQuantity(row.counted ?? "—")
        ),
    },
  ];
  if (showExpected) {
    columns.push(
      { header: "Expected", align: "right", cell: (row) => formatQuantity(row.expected ?? "—") },
      { header: "Difference", align: "right", cell: (row) => (row.variance ? formatQuantity(row.variance) : row.variance === "0" ? "0" : "—") },
    );
  }

  return (
    <div className="space-y-6">
      <Card
        title="Stock counts"
        subtitle="Count a warehouse batch by batch. The counter does not see the expected quantities while the count is open."
        action={
          <Button variant="lime" size="sm" onClick={() => setStartOpen(true)}>
            Start a count
          </Button>
        }
      >
        {error ? (
          <p role="alert" className="pb-3 text-sm font-bold text-pink">
            {error}
          </p>
        ) : null}
        {counts === null ? (
          <EmptyState title="Loading counts" description="Fetching the counts for this company." />
        ) : counts.length === 0 ? (
          <EmptyState title="No counts yet" description="Start a count of a warehouse to check the shelves against the books." actionLabel="Start a count" onAction={() => setStartOpen(true)} />
        ) : (
          <ul className="space-y-2">
            {counts.map((count) => (
              <li key={count.id}>
                <button
                  onClick={() => {
                    setSelectedId(count.id);
                    setError(null);
                  }}
                  aria-pressed={count.id === selectedId}
                  className={`w-full text-left border-line p-3 flex flex-wrap items-center gap-3 ${
                    count.id === selectedId ? "bg-lime text-ink shadow-sm" : "bg-panel text-text hover:bg-cream"
                  }`}
                >
                  <span className="font-bold">{count.warehouse}</span>
                  <span className="text-xs">{count.date}</span>
                  <StatusChip status={STATUS_CHIP[count.status].status} label={STATUS_CHIP[count.status].label} />
                  <span className="text-xs font-bold">{count.lines.length} batches</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {selected ? (
        <Card
          title={`Count of ${selected.warehouse}`}
          subtitle={`As of ${selected.date}. ${isOpen ? "Type what you counted, then leave the box to save it." : "This count is no longer open."}`}
          action={
            <div className="flex gap-2">
              {isOpen ? (
                <>
                  <Button variant="lime" size="sm" disabled={!allCounted} onClick={() => setSubmitOpen(true)}>
                    Send for approval
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setCancelOpen(true)}>
                    Cancel count
                  </Button>
                </>
              ) : null}
            </div>
          }
        >
          {!allCounted && isOpen ? <p className="pb-3 text-sm text-muted">Count every batch before you send the count for approval.</p> : null}
          <div className="overflow-x-auto">
            <DataTable columns={columns} data={selected.lines} emptyTitle="No batches on this count" emptyDescription="The warehouse had no stock on hand when the count started." />
          </div>
        </Card>
      ) : null}

      {selected?.status === "SUBMITTED" || counts?.some((count) => count.status === "SUBMITTED") ? (
        <PendingApprovals
          live={live}
          kinds={COUNT_KINDS}
          title="Counts waiting for approval"
          description="A second person approves a count before its differences are posted."
          onChanged={() => {
            setVersion((value) => value + 1);
            onChanged();
          }}
          version={version}
        />
      ) : null}

      <Modal
        isOpen={startOpen}
        onClose={() => setStartOpen(false)}
        title="Start a stock count"
        description="One count per warehouse can be open at a time."
        primaryActionLabel="Start counting"
        onPrimaryAction={start}
        isSubmitting={busy}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Warehouse">
            <input className={fieldClass} value={warehouse} onChange={(event) => setWarehouse(event.target.value)} />
          </Field>
          <Field label="Count date">
            <input type="date" className={fieldClass} value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
        </div>
        {error ? (
          <p role="alert" className="pt-3 text-sm font-bold text-pink">
            {error}
          </p>
        ) : null}
      </Modal>

      <Modal
        isOpen={submitOpen}
        onClose={() => setSubmitOpen(false)}
        title="Send this count for approval"
        description="Its differences from the books post as adjustments once a second person approves."
        primaryActionLabel="Send for approval"
        onPrimaryAction={submit}
        isSubmitting={busy}
      >
        <Field label="Why this count is being applied" hint="At least ten characters.">
          <textarea className={`${fieldClass} min-h-20`} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        {error ? (
          <p role="alert" className="pt-3 text-sm font-bold text-pink">
            {error}
          </p>
        ) : null}
      </Modal>

      <ConfirmDialog
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this count?"
        message="The counted figures are discarded and nothing in the books changes."
        actionVerb="Cancel count"
        actionVariant="pink"
        onConfirm={cancel}
        isSubmitting={busy}
      />
    </div>
  );
};
