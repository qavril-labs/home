import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { StatusChip } from "../../components/ui/StatusChip";
import { useToast } from "../../context/ToastContext";
import { liveApi, type LiveBatchStatus, type LiveExpiryReport } from "../../lib/live-api";
import { formatAmount, formatQuantity, todayIso } from "../../lib/live-format";
import { errorMessage, fieldClass, Field } from "./fields";
import type { LiveContext } from "./LiveContext";
import { StatTile } from "./StatTile";
import type { WriteOffPrefill } from "./WriteOffPanel";

/** The pharmacy expiry report (INV-03): what has expired, what expires soon, and what it is worth. */
export const ExpiryPanel: React.FC<{ live: LiveContext; onRequestWriteOff: (prefill: WriteOffPrefill) => void }> = ({ live, onRequestWriteOff }) => {
  const { showToast } = useToast();
  const [asOf, setAsOf] = useState<string>(todayIso());
  const [withinDays, setWithinDays] = useState<string>("30");
  const [report, setReport] = useState<LiveExpiryReport | null>(null);

  useEffect(() => {
    const days = Number(withinDays);
    if (!/^\d{1,4}$/.test(withinDays) || !Number.isInteger(days)) return;
    let cancelled = false;
    liveApi
      .expiry(live.token, live.companyId, asOf, days)
      .then((next) => {
        if (!cancelled) setReport(next);
      })
      .catch((error: unknown) => {
        if (!cancelled) showToast(errorMessage(error), undefined, "warn");
      });
    return () => {
      cancelled = true;
    };
  }, [live.token, live.companyId, asOf, withinDays, showToast]);

  const columns = useMemo<Column<LiveBatchStatus>[]>(
    () => [
      { header: "Item", cell: (row) => <span className="font-bold">{row.batch.item}</span> },
      { header: "Warehouse", cell: (row) => row.batch.warehouse },
      { header: "Batch", cell: (row) => row.batch.batchNo },
      { header: "Expires", cell: (row) => row.batch.expiresOn ?? "—" },
      { header: "Days left", align: "right", cell: (row) => String(row.daysLeft) },
      { header: "On hand", align: "right", cell: (row) => formatQuantity(row.batch.balance) },
      { header: "Unit cost", align: "right", cell: (row) => formatAmount(row.batch.unitCost) },
      {
        header: "",
        cell: (row) =>
          row.daysLeft < 0 ? (
            <Button
              size="sm"
              variant="pink"
              onClick={() => onRequestWriteOff({ warehouse: row.batch.warehouse, item: row.batch.item, date: asOf })}
            >
              Request write-off
            </Button>
          ) : (
            <StatusChip status="watch" label="Expiring" />
          ),
      },
    ],
    [asOf, onRequestWriteOff],
  );

  return (
    <div className="space-y-6">
      <section aria-label="Expiry figures" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile label="Expired, at cost" value={formatAmount(report?.expiredValue ?? null)} helper={`${report?.expired.length ?? 0} batches`} tone="pink" />
        <StatTile label="Expiring soon, at cost" value={formatAmount(report?.expiringValue ?? null)} helper={`${report?.expiringSoon.length ?? 0} batches`} tone="yellow" />
        <StatTile label="Report date" value={report?.asOf ?? asOf} helper="The date the days left are counted from" />
      </section>

      <Card title="Expiry report" subtitle="Batches on hand that have expired, and those expiring within the window you choose.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
          <Field label="As of">
            <input type="date" className={fieldClass} value={asOf} onChange={(event) => setAsOf(event.target.value)} />
          </Field>
          <Field label="Expiring within (days)" hint="Between 0 and 3650.">
            <input
              className={fieldClass}
              inputMode="numeric"
              value={withinDays}
              onChange={(event) => setWithinDays(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
            />
          </Field>
        </div>
        <h3 className="font-display font-black uppercase text-sm text-text pt-2 pb-2">Already expired</h3>
        <div className="overflow-x-auto">
          <DataTable columns={columns} data={report?.expired ?? []} emptyTitle="Nothing has expired" emptyDescription="No expired batch holds stock on this date." />
        </div>
        <h3 className="font-display font-black uppercase text-sm text-text pt-6 pb-2">Expiring soon</h3>
        <div className="overflow-x-auto">
          <DataTable columns={columns} data={report?.expiringSoon ?? []} emptyTitle="Nothing expires soon" emptyDescription="No batch expires within the window you chose." />
        </div>
      </Card>
    </div>
  );
};
