import React, { useCallback, useEffect, useState } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useToast } from "../../context/ToastContext";
import { liveApi, type LiveExpiryReport, type LiveApproval } from "../../lib/live-api";
import { formatAmount, todayIso } from "../../lib/live-format";
import { DEFAULT_POSTING_ACCOUNTS, isAccountCode, readPostingAccounts, writePostingAccounts, type PostingAccounts } from "../../lib/posting-accounts";
import { LiveFrame, useLiveContext, type LiveContext } from "./LiveContext";
import { StatTile } from "./StatTile";
import { StockList } from "./StockList";
import { ExpiryPanel } from "./ExpiryPanel";
import { ReceiveDrawer } from "./ReceiveDrawer";
import { TransferDrawer } from "./TransferDrawer";
import { WriteOffPanel, type WriteOffPrefill } from "./WriteOffPanel";
import { CountsPanel } from "./CountsPanel";
import { ImportPanel } from "./ImportPanel";
import { Field, fieldClass } from "./fields";

export type StockTab = "stock" | "expiry" | "write-offs" | "counts" | "import" | "accounts";

const TABS: { id: StockTab; label: string }[] = [
  { id: "stock", label: "Stock" },
  { id: "expiry", label: "Expiry" },
  { id: "write-offs", label: "Write-offs" },
  { id: "counts", label: "Counts" },
  { id: "import", label: "CSV import" },
  { id: "accounts", label: "Posting accounts" },
];

/** The inventory screen (INV-01). Every figure on it comes from the live API. */
export const StockPage: React.FC = () => {
  const live = useLiveContext();
  return (
    <div className="max-w-app mx-auto px-4 pt-6 pb-10 space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-black uppercase text-muted">INV-01 · Stock by batch</p>
        <h1 className="font-display font-black uppercase text-3xl text-text">Inventory &amp; Warehouses</h1>
        <p className="text-sm text-muted">Stock by batch with expiry, transfers, counts and receipts from a CSV file.</p>
      </header>
      <LiveFrame live={live}>
        <StockConnected live={live} />
      </LiveFrame>
    </div>
  );
};

const StockConnected: React.FC<{ live: LiveContext }> = ({ live }) => {
  const { showToast } = useToast();
  const [tab, setTab] = useState<StockTab>("stock");
  const [expiry, setExpiry] = useState<LiveExpiryReport | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [openCounts, setOpenCounts] = useState<number | null>(null);
  const [version, setVersion] = useState<number>(0);
  const [receiveOpen, setReceiveOpen] = useState<boolean>(false);
  const [transferOpen, setTransferOpen] = useState<boolean>(false);
  const [prefill, setPrefill] = useState<WriteOffPrefill | null>(null);
  const [accounts, setAccounts] = useState<PostingAccounts>(() => readPostingAccounts());

  const refresh = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    const today = todayIso();
    Promise.all([
      liveApi.expiry(live.token, live.companyId, today, 30),
      liveApi.approvals(live.token, live.companyId, "PENDING"),
      liveApi.counts(live.token, live.companyId),
    ])
      .then(([report, approvals, counts]) => {
        if (cancelled) return;
        setExpiry(report);
        setPending(approvals.filter((item: LiveApproval) => item.kind === "INVENTORY_WRITE_OFF" || item.kind === "STOCK_COUNT_APPLY").length);
        setOpenCounts(counts.filter((count) => count.status === "OPEN" || count.status === "SUBMITTED").length);
      })
      .catch((error: unknown) => {
        if (!cancelled) showToast(error instanceof Error ? error.message : "Could not load the figures.", undefined, "warn");
      });
    return () => {
      cancelled = true;
    };
  }, [live.token, live.companyId, version, showToast]);

  const requestWriteOff = (next: WriteOffPrefill) => {
    setPrefill(next);
    setTab("write-offs");
  };

  return (
    <>
      <section aria-label="Figures from the server" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label="Expired stock, at cost"
          value={formatAmount(expiry?.expiredValue ?? null)}
          helper={expiry ? `As of ${expiry.asOf}` : "Loading"}
          tone={expiry?.expiredValue ? "pink" : "panel"}
        />
        <StatTile
          label="Expiring within 30 days"
          value={formatAmount(expiry?.expiringValue ?? null)}
          helper="Cost of the balance on hand"
          tone={expiry?.expiringValue ? "yellow" : "panel"}
        />
        <StatTile label="Waiting for approval" value={pending === null ? "—" : String(pending)} helper="Write-offs and count adjustments" />
        <StatTile label="Counts in progress" value={openCounts === null ? "—" : String(openCounts)} helper="Open or waiting for approval" />
      </section>

      <nav aria-label="Inventory sections" className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            aria-pressed={tab === item.id}
            className={`px-3 py-1.5 text-xs font-bold border-line ${
              tab === item.id ? "bg-lime text-ink shadow-sm" : "bg-page text-text hover:bg-cream"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="flex flex-wrap gap-2">
        <Button variant="lime" onClick={() => setReceiveOpen(true)}>
          Receive stock
        </Button>
        <Button variant="cyan" onClick={() => setTransferOpen(true)}>
          Transfer stock
        </Button>
      </div>

      {tab === "stock" && <StockList live={live} version={version} />}
      {tab === "expiry" && (
        <ExpiryPanel live={live} onRequestWriteOff={(prefilled) => requestWriteOff(prefilled)} />
      )}
      {tab === "write-offs" && (
        <WriteOffPanel live={live} accounts={accounts} prefill={prefill} onChanged={refresh} />
      )}
      {tab === "counts" && <CountsPanel live={live} accounts={accounts} onChanged={refresh} />}
      {tab === "import" && <ImportPanel live={live} accounts={accounts} onChanged={refresh} />}
      {tab === "accounts" && <AccountsPanel accounts={accounts} onSave={setAccounts} />}

      <ReceiveDrawer
        live={live}
        isOpen={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        accounts={accounts}
        onReceived={() => {
          setReceiveOpen(false);
          refresh();
        }}
      />
      <TransferDrawer
        live={live}
        isOpen={transferOpen}
        onClose={() => setTransferOpen(false)}
        onMoved={() => {
          setTransferOpen(false);
          refresh();
        }}
      />
    </>
  );
};

const AccountsPanel: React.FC<{ accounts: PostingAccounts; onSave: (next: PostingAccounts) => void }> = ({ accounts, onSave }) => {
  const { showToast } = useToast();
  const [draft, setDraft] = useState<PostingAccounts>(accounts);
  const keys: (keyof PostingAccounts)[] = ["inventory", "clearing", "cogs", "writeOff", "countVariance", "cash", "card", "mobile", "taxPayable"];
  const labels: Record<string, string> = {
    inventory: "Stock on hand",
    clearing: "Goods received not invoiced",
    cogs: "Cost of goods sold",
    writeOff: "Expired stock written off",
    countVariance: "Stock count variance",
    cash: "Cash",
    card: "Card clearing",
    mobile: "Mobile money clearing",
    taxPayable: "Tax payable",
  };
  const invalid = keys.filter((key) => !isAccountCode(draft[key]));
  const save = () => {
    if (invalid.length > 0) {
      showToast(`Check the account codes: ${invalid.map((key) => labels[key]).join(", ")}.`, undefined, "warn");
      return;
    }
    writePostingAccounts(draft);
    onSave(draft);
    showToast("Posting accounts saved for this tab.", undefined, "good");
  };
  return (
    <Card title="Posting accounts" subtitle="The ledger accounts stock and sales post to, from your chart of accounts. The codes are kept for this tab only.">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {keys.map((key) => (
          <Field key={key} label={labels[key] ?? key} error={isAccountCode(draft[key]) ? null : "Use letters, digits, dots or hyphens."}>
            <input
              className={fieldClass}
              value={draft[key]}
              onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
            />
          </Field>
        ))}
        <Field label="Bill discount approval above" hint="Leave empty for no threshold. Amounts above it need a manager." className="sm:col-span-2">
          <input
            className={fieldClass}
            value={draft.discountApprovalAbove}
            onChange={(event) => setDraft({ ...draft, discountApprovalAbove: event.target.value.replace(/[^0-9.]/g, "") })}
          />
        </Field>
      </div>
      <div className="flex gap-2 pt-4">
        <Button variant="lime" onClick={save}>
          Save posting accounts
        </Button>
        <Button variant="ghost" onClick={() => setDraft({ ...DEFAULT_POSTING_ACCOUNTS })}>
          Use the defaults
        </Button>
      </div>
    </Card>
  );
};
