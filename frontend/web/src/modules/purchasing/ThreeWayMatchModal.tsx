import React, { useMemo, useState } from "react";
import { Drawer } from "../../components/ui/Drawer";
import { formatMoney } from "../../lib/currency";
import type { ThreeWayMatchItem } from "../../types";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export interface ThreeWayMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Matches from GET /v1/procurement/matches. The server decides every status and figure. */
  matches: ThreeWayMatchItem[];
  /** True when the matches came from the server rather than the offline sample set. */
  isLive: boolean;
  /** Records an override on the server. Resolves true only when the server saved it. */
  onOverride: (matchId: string, note: string) => Promise<boolean>;
}

interface Case {
  poId: string;
  poRef: string;
  grnRef: string;
  billRef: string;
  supplierName: string;
  lines: ThreeWayMatchItem[];
}

const STATUS_LABEL: Record<ThreeWayMatchItem["status"], string> = {
  MATCHED: "MATCH",
  PRICE_VARIANCE: "PRICE VARIANCE",
  QUANTITY_VARIANCE: "QTY VARIANCE",
  UNMATCHED_GRN: "NO BILL",
  UNMATCHED_BILL: "NO RECEIPT",
};

const isCleared = (m: ThreeWayMatchItem) => m.status === "MATCHED" || m.overrideApproved === true;

export const ThreeWayMatchModal: React.FC<ThreeWayMatchModalProps> = ({
  isOpen,
  onClose,
  matches,
  isLive,
  onOverride,
}) => {
  const cases = useMemo<Case[]>(() => {
    const byPo = new Map<string, Case>();
    for (const m of matches) {
      const existing = byPo.get(m.poId);
      if (existing) existing.lines.push(m);
      else
        byPo.set(m.poId, {
          poId: m.poId,
          poRef: m.poRef,
          grnRef: m.grnRef,
          billRef: m.billRef,
          supplierName: m.supplierName,
          lines: [m],
        });
    }
    return [...byPo.values()];
  }, [matches]);

  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const current = cases.find((c) => c.poId === selectedPoId) ?? cases[0];
  const open = current ? current.lines.filter((l) => !isCleared(l)) : [];

  const handleOverride = async () => {
    if (!current || note.trim().length === 0 || busy) return;
    setBusy(true);
    let saved = 0;
    for (const line of open) {
      if (await onOverride(line.id, note.trim())) saved += 1;
    }
    setBusy(false);
    setMessage(
      saved === open.length
        ? `Override recorded on ${saved} line${saved === 1 ? "" : "s"}.`
        : `Saved ${saved} of ${open.length} lines. The rest were not saved; try again.`
    );
    if (saved === open.length) setNote("");
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="3-Way Match Verification Studio (PRC-03)"
      description="Purchase order ⟷ goods receipt ⟷ supplier bill, checked line by line on the server"
      size="xl"
    >
      <div className="space-y-6 pb-6 text-xs font-sans">
        {!isLive && (
          <div className="p-3 border-line bg-yellow/30 text-ink font-bold" role="note">
            Offline sample data. The server could not be reached, so overrides cannot be saved.
          </div>
        )}

        {!current ? (
          <div className="p-6 text-center text-muted border-line bg-panel">No matches to review yet.</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 p-3 bg-page border-line">
              <span className="font-bold text-muted uppercase">Purchase order:</span>
              {cases.map((c) => (
                <button
                  key={c.poId}
                  type="button"
                  onClick={() => {
                    setSelectedPoId(c.poId);
                    setMessage(null);
                  }}
                  className={`px-3 py-1.5 font-mono font-bold text-xs border-line transition-all ${
                    current.poId === c.poId
                      ? "bg-lime text-ink shadow-[2px_2px_0_var(--q-ink)]"
                      : "bg-panel text-muted hover:text-text"
                  }`}
                >
                  {c.poRef} ({c.supplierName})
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                ["1. Purchase order", current.poRef],
                ["2. Goods receipt", current.grnRef],
                ["3. Supplier bill", current.billRef],
              ].map(([label, ref]) => (
                <div key={label} className="p-3.5 bg-panel border-line shadow-sm space-y-1">
                  <div className="text-[10px] font-mono text-muted uppercase border-b border-grid pb-1">{label}</div>
                  <p className="font-bold text-sm text-text pt-1 font-mono">{ref || "none"}</p>
                </div>
              ))}
            </div>

            <div
              className={`p-3.5 border-line shadow-sm flex items-start gap-3 ${
                open.length === 0 ? "bg-good/15 border-good" : "bg-pink/15 border-pink"
              }`}
            >
              {open.length === 0 ? (
                <CheckCircle2 className="w-5 h-5 text-good shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-pink shrink-0 mt-0.5" />
              )}
              <p className="text-xs text-text">
                {open.length === 0
                  ? "Every line matches, or its variance was approved. The bill can be paid."
                  : `${open.length} line${open.length === 1 ? "" : "s"} outside tolerance. Payment is held until each is approved with a note.`}
              </p>
            </div>

            <div className="border-line bg-panel overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-ink bg-page/50 text-[10px] font-bold font-mono uppercase text-muted">
                    <th className="py-2 px-3">Item / SKU</th>
                    <th className="py-2 px-3 text-center">Ordered</th>
                    <th className="py-2 px-3 text-center">Received</th>
                    <th className="py-2 px-3 text-center">Billed</th>
                    <th className="py-2 px-3 text-right">PO rate</th>
                    <th className="py-2 px-3 text-right">Bill rate</th>
                    <th className="py-2 px-3 text-right">PO total</th>
                    <th className="py-2 px-3 text-right">Bill total</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-grid">
                  {current.lines.map((l) => (
                    <tr key={l.id} className={isCleared(l) ? "" : "bg-pink/10"}>
                      <td className="py-2 px-3 font-medium">
                        <div>{l.description}</div>
                        <div className="font-mono text-[10px] text-muted">{l.sku}</div>
                      </td>
                      <td className="py-2 px-3 text-center font-mono">{l.orderedQty}</td>
                      <td className="py-2 px-3 text-center font-mono">{l.receivedQty}</td>
                      <td className="py-2 px-3 text-center font-mono">{l.billedQty}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatMoney(l.agreedUnitPrice)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{formatMoney(l.billedUnitPrice)}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatMoney(l.poTotal)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{formatMoney(l.billTotal)}</td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-mono font-bold border border-ink ${
                            isCleared(l) ? "bg-good text-ink" : "bg-pink text-ink"
                          }`}
                        >
                          {l.overrideApproved && l.status !== "MATCHED" ? "APPROVED" : STATUS_LABEL[l.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {open.length > 0 && (
              <div className="p-4 bg-page border-line space-y-2">
                <label className="block font-bold uppercase text-[10px] text-muted" htmlFor="match-override-note">
                  Reason for approving the variance
                </label>
                <textarea
                  id="match-override-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="w-full p-2 border-line bg-panel text-xs"
                  disabled={!isLive}
                />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] text-muted" role="status">
                    {message}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleOverride()}
                    disabled={!isLive || busy || note.trim().length === 0}
                    className="px-4 py-2 font-mono font-bold text-xs uppercase border-line shadow-[2px_2px_0_var(--q-ink)] bg-lime text-ink disabled:bg-panel disabled:text-muted disabled:cursor-not-allowed"
                  >
                    {busy ? "Saving…" : "Approve variance"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-panel border-line shadow-sm hover:bg-cream text-xs font-bold font-mono"
          >
            Close
          </button>
        </div>
      </div>
    </Drawer>
  );
};
