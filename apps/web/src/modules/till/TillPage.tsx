import React, { useEffect, useState } from "react";
import { offlineQueue } from "../../lib/offline-queue";
import { readPostingAccounts } from "../../lib/posting-accounts";
import { LiveFrame, useLiveContext, type LiveContext } from "../stock/LiveContext";
import { ReviewQueue } from "./ReviewQueue";
import { SaleEntry } from "./SaleEntry";

type TillTab = "sell" | "review";

/** The till (POS-01): take a sale, and decide the sales that were kept for review. Every figure comes from the server. */
export const TillPage: React.FC = () => {
  const live = useLiveContext();
  return (
    <div className="max-w-app mx-auto px-4 pt-6 pb-10 space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-black uppercase text-muted">POS-01 · Retail till</p>
        <h1 className="font-display font-black uppercase text-3xl text-text">Till</h1>
        <p className="text-sm text-muted">Take a sale, with split payments and bill discounts. Sales that cannot be posted wait here for a decision.</p>
      </header>
      <LiveFrame live={live}>
        <TillConnected live={live} />
      </LiveFrame>
    </div>
  );
};

const TillConnected: React.FC<{ live: LiveContext }> = ({ live }) => {
  const [tab, setTab] = useState<TillTab>("sell");
  const [accounts] = useState(() => readPostingAccounts());
  const [waiting, setWaiting] = useState<number>(0);
  const currency = live.companies.find((company) => company.id === live.companyId)?.baseCurrency ?? "";

  useEffect(
    () =>
      offlineQueue.subscribe((queue) => {
        setWaiting(queue.filter((item) => item.actionType === "pos_sale" && item.syncStatus !== "synced").length);
      }),
    [],
  );

  return (
    <>
      <nav aria-label="Till sections" className="flex flex-wrap gap-2">
        <button
          onClick={() => setTab("sell")}
          aria-pressed={tab === "sell"}
          className={`px-3 py-1.5 text-xs font-bold border-line ${tab === "sell" ? "bg-lime text-ink shadow-sm" : "bg-page text-text hover:bg-cream"}`}
        >
          Sell
        </button>
        <button
          onClick={() => setTab("review")}
          aria-pressed={tab === "review"}
          className={`px-3 py-1.5 text-xs font-bold border-line ${tab === "review" ? "bg-lime text-ink shadow-sm" : "bg-page text-text hover:bg-cream"}`}
        >
          Review and approvals
        </button>
      </nav>

      {waiting > 0 ? (
        <p role="status" className="text-sm font-bold text-muted">
          {waiting} sale(s) are kept on this device, waiting for the connection to return.
        </p>
      ) : null}

      {currency === "" ? (
        <p className="text-sm text-muted">The company's currency is not known yet, so sales cannot be entered.</p>
      ) : tab === "sell" ? (
        <SaleEntry live={live} accounts={accounts} currency={currency} />
      ) : (
        <ReviewQueue live={live} accounts={accounts} />
      )}
    </>
  );
};
