import React, { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { StatusChip } from "../../components/ui/StatusChip";
import { useToast } from "../../context/ToastContext";
import { liveApi, type LiveImportReport } from "../../lib/live-api";
import { formatAmount, formatQuantity } from "../../lib/live-format";
import { isAccountCode, stockAccounts, type PostingAccounts } from "../../lib/posting-accounts";
import { errorMessage, fieldClass } from "./fields";
import type { LiveContext } from "./LiveContext";

const COLUMNS = ["warehouse", "item", "batch_no", "expires_on", "qty", "unit_cost", "date", "reference"];

/**
 * Imports goods received, or opening stock, from a CSV file. A check (dry run) comes first and writes nothing.
 * The import is written only when the check is clean, and the result is reconciled against the stock account.
 * Excel files need saving as CSV first. Native QuickBooks or Tally files are not read by this screen.
 */
export const ImportPanel: React.FC<{ live: LiveContext; accounts: PostingAccounts; onChanged: () => void }> = ({ live, accounts, onChanged }) => {
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [csv, setCsv] = useState<string>("");
  const [report, setReport] = useState<LiveImportReport | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<boolean>(false);

  const chooseFile = async (chosen: File | null) => {
    setFile(chosen);
    setReport(null);
    setError(null);
    setCsv("");
    if (!chosen) return;
    try {
      setCsv(await chosen.text());
    } catch {
      setError("The file could not be read. Save it again as CSV and choose it once more.");
    }
  };

  const accountsOrNull = () => {
    const stock = stockAccounts(accounts);
    if (!isAccountCode(stock.inventory) || !isAccountCode(stock.clearing) || !isAccountCode(stock.cogs) || !isAccountCode(stock.writeOff)) {
      setError("Set the posting accounts first, on the Posting accounts tab.");
      return null;
    }
    return {
      inventory: stock.inventory,
      clearing: stock.clearing,
      cogs: stock.cogs,
      writeOff: stock.writeOff,
      ...(isAccountCode(stock.countVariance) ? { countVariance: stock.countVariance } : {}),
    };
  };

  const check = async () => {
    setError(null);
    const stock = accountsOrNull();
    if (!stock || csv.trim() === "") return;
    setBusy(true);
    try {
      setReport(await liveApi.importReceipts(live.token, live.companyId, csv, stock, true));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const importRows = async () => {
    setConfirming(false);
    const stock = accountsOrNull();
    if (!stock || csv.trim() === "") return;
    setBusy(true);
    try {
      const written = await liveApi.importReceipts(live.token, live.companyId, csv, stock, false);
      setReport(written);
      if (written.applied) {
        showToast(`Imported ${written.created} new batch(es). ${written.repeated} were already in the books.`, undefined, "good");
        onChanged();
      }
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const clean = report !== null && !report.applied && report.errors.length === 0 && report.rows > 0;

  return (
    <div className="space-y-6">
      <Card title="Import from a CSV file" subtitle="Goods received or opening stock, one row per batch. A check runs first and writes nothing.">
        <div className="space-y-4">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-black uppercase text-muted">CSV file</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className={fieldClass}
              onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <p className="text-sm text-muted">
            The first row names the columns: <span className="font-mono text-text">{COLUMNS.join(", ")}</span>. Leave expires_on empty for an item with no expiry.
            Quantities are whole units; unit costs are in the company currency.
          </p>
          {file ? <p className="text-xs font-bold text-muted">{file.name}, {file.size.toLocaleString()} bytes</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="cyan" onClick={check} disabled={!file || busy}>
              Check the file
            </Button>
            <Button variant="lime" onClick={() => setConfirming(true)} disabled={!clean || busy}>
              Import these rows
            </Button>
          </div>
          {error ? (
            <p role="alert" className="text-sm font-bold text-pink">
              {error}
            </p>
          ) : null}
        </div>
      </Card>

      {report ? (
        <Card
          title={report.applied ? "Imported" : "Check result"}
          subtitle={report.applied ? "The rows are in the books." : "Nothing was written. Fix the rows listed below, then check again."}
          action={<StatusChip status={report.errors.length > 0 ? "act" : report.applied ? "good" : "watch"} label={report.errors.length > 0 ? "Rows need fixing" : report.applied ? "Written" : "Ready to import"} />}
        >
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Figure label="Rows in the file" value={String(report.rows)} />
            <Figure label="Total quantity" value={formatQuantity(report.totalQty)} />
            <Figure label="Total value" value={formatAmount(report.totalValue)} />
            <Figure label={report.applied ? "New batches" : "Batches to create"} value={String(report.applied ? report.created : report.rows - report.errors.length)} />
          </dl>

          {report.errors.length > 0 ? (
            <div className="pt-4">
              <h3 className="font-display font-black uppercase text-sm pb-2">Rows with problems</h3>
              <ul className="space-y-1 text-sm">
                {report.errors.map((item, index) => (
                  <li key={`${item.row}-${index}`} className="font-bold text-pink">
                    Row {item.row}: {item.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="pt-6">
            <h3 className="font-display font-black uppercase text-sm pb-2">Reconciliation with the ledger</h3>
            <p className="text-sm text-muted pb-2">
              The stock account <span className="font-mono text-text">{report.reconciliation.stockAccount}</span> must move by exactly the value of the batches created.
            </p>
            <dl className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <Figure label="Before" value={formatAmount(report.reconciliation.before)} />
              <Figure label="After" value={formatAmount(report.reconciliation.after)} />
              <Figure label="Change" value={formatAmount(report.reconciliation.change)} />
              <Figure label="Expected change" value={formatAmount(report.reconciliation.expected)} />
              <Figure label="Reconciled" value={report.reconciliation.reconciled ? "Yes" : "No"} />
            </dl>
          </div>
        </Card>
      ) : null}

      <ConfirmDialog
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        title="Import these rows?"
        message={report ? `${report.rows} rows, ${formatAmount(report.totalValue)} in total, will be posted to the ledger. A repeat of a row already in the books changes nothing.` : ""}
        actionVerb={report ? `Import ${report.rows} rows` : "Import"}
        actionVariant="lime"
        onConfirm={importRows}
        isSubmitting={busy}
      />
    </div>
  );
};

const Figure: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="border-line bg-page p-3">
    <dt className="text-[11px] font-black uppercase text-muted">{label}</dt>
    <dd className="font-display font-black text-lg text-text">{value}</dd>
  </div>
);
