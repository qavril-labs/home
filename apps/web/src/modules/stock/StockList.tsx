import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/ui/Card";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { StatusChip } from "../../components/ui/StatusChip";
import { useToast } from "../../context/ToastContext";
import { liveApi, type LiveBatch, type LiveBatchStatus } from "../../lib/live-api";
import { formatAmount, formatQuantity, todayIso } from "../../lib/live-format";
import { errorMessage, fieldClass } from "./fields";
import type { LiveContext } from "./LiveContext";

/** Every batch on hand, with its expiry status from the server's expiry report. */
export const StockList: React.FC<{ live: LiveContext; version: number }> = ({ live, version }) => {
  const { showToast } = useToast();
  const [batches, setBatches] = useState<LiveBatch[] | null>(null);
  const [flags, setFlags] = useState<Map<string, "expired" | "expiring">>(new Map());
  const [warehouse, setWarehouse] = useState<string>("");
  const [item, setItem] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      liveApi.batches(live.token, live.companyId, { warehouse: warehouse || undefined, item: item.trim() || undefined }),
      liveApi.expiry(live.token, live.companyId, todayIso(), 30),
    ])
      .then(([list, report]) => {
        if (cancelled) return;
        setBatches(list);
        setFlags(flagsOf(report.expired, report.expiringSoon));
      })
      .catch((error: unknown) => {
        if (!cancelled) showToast(errorMessage(error), undefined, "warn");
      });
    return () => {
      cancelled = true;
    };
  }, [live.token, live.companyId, warehouse, item, version, showToast]);

  // The warehouse choices come from the stock the server holds, not from a list written into the app.
  const [knownWarehouses, setKnownWarehouses] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    liveApi
      .batches(live.token, live.companyId)
      .then((all) => {
        if (!cancelled) setKnownWarehouses([...new Set(all.map((batch) => batch.warehouse))].sort());
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [live.token, live.companyId, version]);

  const columns = useMemo<Column<LiveBatch>[]>(
    () => [
      { header: "Item", cell: (row) => <span className="font-bold">{row.item}</span> },
      { header: "Warehouse", accessorKey: "warehouse" },
      { header: "Batch", accessorKey: "batchNo" },
      { header: "Expires", cell: (row) => row.expiresOn ?? "No expiry" },
      { header: "Balance", align: "right", cell: (row) => formatQuantity(row.balance) },
      { header: "Unit cost", align: "right", cell: (row) => formatAmount(row.unitCost) },
      {
        header: "Status",
        cell: (row) => {
          const flag = flags.get(row.id);
          if (flag === "expired") return <StatusChip status="act" label="Expired" />;
          if (flag === "expiring") return <StatusChip status="watch" label="Expires soon" />;
          return <StatusChip status="good" label="On hand" />;
        },
      },
    ],
    [flags],
  );

  return (
    <Card title="Stock by batch" subtitle="Balances are worked out from the stock movements. Figures come from the server.">
      <div className="flex flex-col sm:flex-row gap-3 pb-4">
        <label className="flex flex-col gap-1 sm:w-56">
          <span className="text-[11px] font-black uppercase text-muted">Warehouse</span>
          <select className={fieldClass} value={warehouse} onChange={(event) => setWarehouse(event.target.value)}>
            <option value="">All warehouses</option>
            {knownWarehouses.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 sm:flex-1">
          <span className="text-[11px] font-black uppercase text-muted">Item code</span>
          <input className={fieldClass} value={item} onChange={(event) => setItem(event.target.value)} placeholder="All items" />
        </label>
      </div>
      <div className="overflow-x-auto">
        <DataTable
          columns={columns}
          data={batches ?? []}
          emptyTitle={batches === null ? "Loading stock" : "No stock on hand"}
          emptyDescription={batches === null ? "Fetching the batches from the server." : "Receive goods or import a CSV file to see stock here."}
        />
      </div>
    </Card>
  );
};

export function flagsOf(expired: LiveBatchStatus[], expiringSoon: LiveBatchStatus[]): Map<string, "expired" | "expiring"> {
  const map = new Map<string, "expired" | "expiring">();
  for (const item of expiringSoon) map.set(item.batch.id, "expiring");
  for (const item of expired) map.set(item.batch.id, "expired");
  return map;
}
