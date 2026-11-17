import React, { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { StatusChip } from "../../components/ui/StatusChip";
import { useToast } from "../../context/ToastContext";
import { liveApi, LiveApiError, type LivePriceResult, type LiveSyncResult, type TenderMethod } from "../../lib/live-api";
import { formatAmount, reasonInWords, todayIso } from "../../lib/live-format";
import { offlineQueue } from "../../lib/offline-queue";
import { tillAccounts, type PostingAccounts } from "../../lib/posting-accounts";
import { amountText, errorMessage, Field, fieldClass } from "../stock/fields";
import type { LiveContext } from "../stock/LiveContext";
import {
  discountBody,
  emptyDiscount,
  emptyLine,
  emptyTender,
  isNetworkFailure,
  newSaleId,
  priceBody,
  saleBody,
  type DiscountForm,
  type LineForm,
  type TenderForm,
} from "./saleBody";

const METHODS: TenderMethod[] = ["CASH", "CARD", "MOBILE"];
const METHOD_LABEL: Record<TenderMethod, string> = { CASH: "Cash", CARD: "Card", MOBILE: "Mobile money" };

/**
 * The till's sale entry (POS-01). Totals, change and problems come from the server's price preview, so the browser
 * never adds up money. A sale is sent to the server when it is completed. If the server cannot be reached, the sale
 * is kept on this device and sent when the connection returns.
 */
export const SaleEntry: React.FC<{ live: LiveContext; accounts: PostingAccounts; currency: string }> = ({ live, accounts, currency }) => {
  const { showToast } = useToast();
  const [saleId, setSaleId] = useState<string>(() => newSaleId());
  const [warehouse, setWarehouse] = useState<string>("");
  const [date, setDate] = useState<string>(todayIso());
  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);
  const [tenders, setTenders] = useState<TenderForm[]>([emptyTender("CASH")]);
  const [discount, setDiscount] = useState<DiscountForm>(emptyDiscount());
  const [price, setPrice] = useState<LivePriceResult | null>(null);
  const [outcome, setOutcome] = useState<LiveSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const updateLine = (index: number, patch: Partial<LineForm>) => {
    setLines((current) => current.map((line, position) => (position === index ? { ...line, ...patch } : line)));
    setPrice(null);
  };
  const updateTender = (index: number, patch: Partial<TenderForm>) => {
    setTenders((current) => current.map((tender, position) => (position === index ? { ...tender, ...patch } : tender)));
    setPrice(null);
  };

  const reset = () => {
    setSaleId(newSaleId());
    setLines([emptyLine()]);
    setTenders([emptyTender("CASH")]);
    setDiscount(emptyDiscount());
    setPrice(null);
    setError(null);
  };

  const validationProblem = () => {
    if (warehouse.trim() === "") return "Name the warehouse the sale takes stock from.";
    if (lines.some((line) => line.itemCode.trim() === "" || line.qty.trim() === "" || line.unitPrice.trim() === "")) {
      return "Every line needs an item code, a quantity and a unit price.";
    }
    if (lines.some((line) => line.revenueAccount.trim() === "")) return "Every line needs a revenue account.";
    return null;
  };

  const priceNow = async () => {
    setError(null);
    const problem = validationProblem();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      setPrice(
        await liveApi.priceSale(
          live.token,
          priceBody({ companyId: live.companyId, warehouse, date, currency, lines, tenders, discount, discountApprovalAbove: accounts.discountApprovalAbove }),
        ),
      );
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const askForDiscountApproval = async () => {
    const amount = discountBody(discount)?.amount;
    if (typeof amount !== "string") {
      setError("Type the bill discount first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const request = await liveApi.createApproval(live.token, {
        companyId: live.companyId,
        kind: "POS_BILL_DISCOUNT",
        reason: "Bill discount agreed with the manager on this sale.",
        payload: { saleId, amount },
      });
      setDiscount((current) => ({ ...current, approvalId: request.id }));
      showToast("Sent to the manager. Complete the sale once it is approved.", undefined, "good");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    setError(null);
    setOutcome(null);
    const problem = validationProblem();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      if (discount.approvalId.trim() !== "") {
        const approved = await liveApi.approvals(live.token, live.companyId, "APPROVED");
        if (!approved.some((item) => item.id === discount.approvalId.trim())) {
          setError("The manager has not approved this discount yet. Ask them to approve it on the Review tab.");
          return;
        }
      }
      const sale = saleBody({ id: saleId, warehouse, date, currency, lines, tenders, discount });
      const response = await liveApi.syncSales(live.token, {
        companyId: live.companyId,
        accounts: tillAccounts(accounts),
        ...(accounts.discountApprovalAbove.trim() === "" ? {} : { discountApprovalAbove: accounts.discountApprovalAbove.trim() }),
        sales: [sale],
      });
      const result = response.results[0];
      if (!result) throw new Error("The server did not return a result for this sale.");
      if (result.status === "REJECTED") {
        setOutcome(result);
        setError("The sale was not stored. Fix the problem below and complete it again.");
        return;
      }
      setOutcome(result);
      if (result.status === "POSTED") {
        showToast(`Sale ${result.number ?? ""} posted.`, undefined, "good");
      } else {
        showToast("Sale kept for review. A manager will decide it on the Review tab.", undefined, "warn");
      }
      reset();
    } catch (failure) {
      if (isNetworkFailure(failure)) {
        const sale = saleBody({ id: saleId, warehouse, date, currency, lines, tenders, discount });
        offlineQueue.enqueue({
          actionType: "pos_sale",
          payload: {
            saleId,
            summary: `${lines.length} line(s), warehouse ${warehouse.trim()}, ${date}`,
            body: {
              companyId: live.companyId,
              accounts: tillAccounts(accounts),
              ...(accounts.discountApprovalAbove.trim() === "" ? {} : { discountApprovalAbove: accounts.discountApprovalAbove.trim() }),
              sales: [sale],
            },
          },
        });
        showToast("No connection. The sale is kept on this device and will be sent when it returns.", undefined, "warn");
        reset();
      } else if (failure instanceof LiveApiError && failure.status === 401) {
        setError("Your session has ended. Sign in again before completing the sale.");
      } else {
        setError(errorMessage(failure));
      }
    } finally {
      setBusy(false);
    }
  };

  const needsDiscountApproval = price?.problems.includes("DISCOUNT_NEEDS_APPROVAL") ?? false;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2" title="Sale" subtitle="Enter what the customer buys. Price it first to see the total and the change.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
          <Field label="Warehouse the stock comes from">
            <input className={fieldClass} value={warehouse} onChange={(event) => setWarehouse(event.target.value)} />
          </Field>
          <Field label="Sale date">
            <input type="date" className={fieldClass} value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
        </div>

        <div className="space-y-3">
          {lines.map((line, index) => (
            <fieldset key={index} className="border-line p-3 grid grid-cols-1 sm:grid-cols-6 gap-3">
              <legend className="px-1 text-xs font-black uppercase text-muted">Line {index + 1}</legend>
              <Field label="Item code" className="sm:col-span-2">
                <input className={fieldClass} value={line.itemCode} onChange={(event) => updateLine(index, { itemCode: event.target.value })} />
              </Field>
              <Field label="Qty">
                <input inputMode="numeric" className={fieldClass} value={line.qty} onChange={(event) => updateLine(index, { qty: event.target.value.replace(/[^0-9]/g, "") })} />
              </Field>
              <Field label="Unit price">
                <input inputMode="decimal" className={fieldClass} value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: amountText(event.target.value) })} />
              </Field>
              <Field label="Item discount">
                <input inputMode="decimal" className={fieldClass} value={line.discount} onChange={(event) => updateLine(index, { discount: amountText(event.target.value) })} />
              </Field>
              <Field label="Tax rate (basis points)" hint="1900 is 19%.">
                <input inputMode="numeric" className={fieldClass} value={line.taxRateBps} onChange={(event) => updateLine(index, { taxRateBps: event.target.value.replace(/[^0-9]/g, "") })} />
              </Field>
              <Field label="Tax mode">
                <select className={fieldClass} value={line.taxMode} onChange={(event) => updateLine(index, { taxMode: event.target.value as LineForm["taxMode"] })}>
                  <option value="EXCLUSIVE">Added to price</option>
                  <option value="INCLUSIVE">Included in price</option>
                </select>
              </Field>
              <Field label="Revenue account">
                <input className={fieldClass} value={line.revenueAccount} onChange={(event) => updateLine(index, { revenueAccount: event.target.value })} />
              </Field>
              <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2">
                <input type="checkbox" checked={line.tracked} onChange={(event) => updateLine(index, { tracked: event.target.checked })} />
                Stock item (takes stock first to expire)
              </label>
              {lines.length > 1 ? (
                <Button variant="ghost" size="sm" onClick={() => setLines((current) => current.filter((_, position) => position !== index))}>
                  Remove line
                </Button>
              ) : null}
            </fieldset>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setLines((current) => [...current, emptyLine()])}>
            Add a line
          </Button>
        </div>

        <div className="pt-6 space-y-3">
          <h3 className="font-display font-black uppercase text-sm">Payments</h3>
          {tenders.map((tender, index) => (
            <div key={index} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <Field label="Method">
                <select className={fieldClass} value={tender.method} onChange={(event) => updateTender(index, { method: event.target.value as TenderMethod })}>
                  {METHODS.map((method) => (
                    <option key={method} value={method}>
                      {METHOD_LABEL[method]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Amount">
                <input inputMode="decimal" className={fieldClass} value={tender.amount} onChange={(event) => updateTender(index, { amount: amountText(event.target.value) })} />
              </Field>
              {tenders.length > 1 ? (
                <Button variant="ghost" size="sm" onClick={() => setTenders((current) => current.filter((_, position) => position !== index))}>
                  Remove payment
                </Button>
              ) : null}
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setTenders((current) => [...current, emptyTender("CARD")])}>
            Add a payment
          </Button>
        </div>

        <div className="pt-6 space-y-3">
          <h3 className="font-display font-black uppercase text-sm">Bill discount</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Amount off the bill">
              <input inputMode="decimal" className={fieldClass} value={discount.amount} onChange={(event) => setDiscount((current) => ({ ...current, amount: amountText(event.target.value), approvalId: "" }))} />
            </Field>
            <Field label="Reason" hint="Required when there is a discount.">
              <input className={fieldClass} value={discount.reason} onChange={(event) => setDiscount((current) => ({ ...current, reason: event.target.value }))} />
            </Field>
          </div>
          {needsDiscountApproval && discount.approvalId === "" ? (
            <Button variant="pink" size="sm" onClick={askForDiscountApproval} disabled={busy}>
              Ask the manager to approve this discount
            </Button>
          ) : null}
          {discount.approvalId !== "" ? <p className="text-xs font-bold text-muted">Waiting for approval. Complete the sale once it is approved.</p> : null}
        </div>

        {error ? (
          <p role="alert" className="pt-4 text-sm font-bold text-pink">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-6">
          <Button variant="cyan" onClick={priceNow} disabled={busy}>
            Price the sale
          </Button>
          <Button variant="lime" onClick={complete} disabled={busy}>
            Complete the sale
          </Button>
        </div>
      </Card>

      <Card title="Total" subtitle="Worked out by the server. Nothing is stored until you complete the sale.">
        {price ? (
          <div className="space-y-4">
            <dl className="space-y-2 text-sm">
              <Row label="Net, before tax" value={formatAmount(price.subtotal)} />
              {price.billDiscount.amount !== "0.00" ? <Row label="Bill discount" value={formatAmount(price.billDiscount)} /> : null}
              <Row label="Tax" value={formatAmount(price.tax)} />
              <Row label="Total" value={formatAmount(price.total)} strong />
              <Row label="Tendered" value={formatAmount(price.tendered)} />
              <Row label="Change to give back" value={formatAmount(price.change)} strong />
            </dl>
            {price.problems.length === 0 ? (
              <StatusChip status="good" label="Ready to complete" />
            ) : (
              <div className="space-y-2">
                <StatusChip status="watch" label="Would go to review" />
                <ul className="space-y-1 text-sm">
                  {price.problems.map((problem, index) => (
                    <li key={`${problem}-${index}`} className="font-bold text-pink">
                      {reasonInWords(problem)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">Price the sale to see the total, the change, and anything that needs a manager.</p>
        )}

        {outcome ? (
          <div className="pt-6 space-y-2 text-sm">
            <StatusChip status={outcome.status === "POSTED" ? "good" : "act"} label={outcome.status === "POSTED" ? `Posted ${outcome.number ?? ""}` : outcome.status === "NEEDS_REVIEW" ? "Kept for review" : "Not stored"} />
            {outcome.reasons.map((reason, index) => (
              <p key={`${reason}-${index}`} className="text-muted">
                {reasonInWords(reason)}
              </p>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong = false }) => (
  <div className="flex justify-between gap-4">
    <dt className={strong ? "font-black uppercase text-xs self-center" : "text-muted"}>{label}</dt>
    <dd className={strong ? "font-display font-black text-lg" : "font-bold"}>{value}</dd>
  </div>
);
