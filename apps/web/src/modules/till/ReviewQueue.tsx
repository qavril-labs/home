import React, { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { StatusChip } from "../../components/ui/StatusChip";
import { useToast } from "../../context/ToastContext";
import { liveApi, reasonsOf, type LiveSale, type TenderMethod } from "../../lib/live-api";
import { formatAmount, reasonInWords, todayIso } from "../../lib/live-format";
import { tillAccounts, type PostingAccounts } from "../../lib/posting-accounts";
import { amountText, errorMessage, Field, fieldClass } from "../stock/fields";
import { PendingApprovals } from "../stock/PendingApprovals";
import type { LiveContext } from "../stock/LiveContext";
import { emptyTender, type TenderForm } from "./saleBody";

const METHODS: TenderMethod[] = ["CASH", "CARD", "MOBILE"];
/** A constant, so the approvals list does not reload on every render. */
const DISCOUNT_KINDS = ["POS_BILL_DISCOUNT"];

/**
 * Sales that were kept for review. A manager posts one now, with its payments reconciled and on an open date, or
 * voids it with a reason. A post that still cannot be made changes nothing, and the server's reasons are shown.
 */
export const ReviewQueue: React.FC<{ live: LiveContext; accounts: PostingAccounts }> = ({ live, accounts }) => {
  const { showToast } = useToast();
  const [sales, setSales] = useState<LiveSale[] | null>(null);
  const [version, setVersion] = useState<number>(0);
  const [deciding, setDeciding] = useState<{ sale: LiveSale; decision: "POST" | "VOID" } | null>(null);
  const [date, setDate] = useState<string>(todayIso());
  const [tenders, setTenders] = useState<TenderForm[]>([emptyTender("CASH")]);
  const [reason, setReason] = useState<string>("");
  const [approvalId, setApprovalId] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [refusal, setRefusal] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    liveApi
      .sales(live.token, live.companyId, { status: "NEEDS_REVIEW", pending: true })
      .then((list) => setSales(list))
      .catch((failure: unknown) => setError(errorMessage(failure)));
  }, [live.token, live.companyId]);

  useEffect(() => {
    load();
  }, [load, version]);

  const open = (sale: LiveSale, decision: "POST" | "VOID") => {
    setDeciding({ sale, decision });
    setDate(sale.date);
    setTenders(sale.tenders.length > 0 ? sale.tenders.map((tender) => ({ method: tender.method, amount: tender.amount.amount })) : [emptyTender("CASH")]);
    setReason("");
    setApprovalId("");
    setRefusal([]);
    setError(null);
  };

  const decide = async () => {
    if (!deciding) return;
    if (reason.trim().length < 5) {
      setError("Say why, in at least five characters. It is kept with the sale.");
      return;
    }
    setBusy(true);
    setError(null);
    setRefusal([]);
    try {
      const isPost = deciding.decision === "POST";
      await liveApi.reviewSale(live.token, deciding.sale.id, {
        companyId: live.companyId,
        decision: deciding.decision,
        reason: reason.trim(),
        accounts: tillAccounts(accounts),
        ...(isPost
          ? {
              date,
              tenders: tenders.filter((tender) => tender.amount.trim() !== "").map((tender) => ({ method: tender.method, amount: tender.amount.trim() })),
              ...(approvalId.trim() === "" ? {} : { billDiscountApprovalId: approvalId.trim() }),
              ...(accounts.discountApprovalAbove.trim() === "" ? {} : { discountApprovalAbove: accounts.discountApprovalAbove.trim() }),
            }
          : {}),
      });
      showToast(isPost ? "Sale posted." : "Sale voided. It will never be posted.", undefined, isPost ? "good" : "warn");
      setDeciding(null);
      setVersion((value) => value + 1);
    } catch (failure) {
      const reasons = reasonsOf(failure);
      if (reasons.length > 0) {
        setRefusal(reasons);
        setError("This sale still cannot be posted. Nothing was changed. Fix the points below and try again, or void it.");
      } else {
        setError(errorMessage(failure));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card title="Sales waiting for a decision" subtitle="Each sale was kept because it could not be posted as it stood. Decide it here.">
        {error && !deciding ? (
          <p role="alert" className="pb-3 text-sm font-bold text-pink">
            {error}
          </p>
        ) : null}
        {sales === null ? (
          <EmptyState title="Loading sales" description="Fetching the sales waiting for a decision." />
        ) : sales.length === 0 ? (
          <EmptyState title="Nothing to decide" description="Every sale has been posted or voided." />
        ) : (
          <ul className="space-y-3">
            {sales.map((sale) => (
              <li key={sale.id} className="border-line shadow-sm p-4 bg-panel space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip status="act" label="Needs a decision" />
                  <span className="text-xs font-bold text-muted">
                    {sale.warehouse} · {sale.date} · recorded {sale.recordedAt.slice(0, 10)}
                  </span>
                </div>
                <p className="font-display font-black text-xl">{formatAmount(sale.total)}</p>
                <ul className="space-y-1 text-sm">
                  {sale.reasons.map((reason, index) => (
                    <li key={`${reason}-${index}`} className="font-bold text-pink">
                      {reasonInWords(reason)}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button variant="lime" size="sm" onClick={() => open(sale, "POST")}>
                    Post now
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => open(sale, "VOID")}>
                    Void
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <PendingApprovals
        live={live}
        kinds={DISCOUNT_KINDS}
        title="Bill discounts waiting for approval"
        description="A bill discount above the limit is approved here before its sale is completed."
        onChanged={() => setVersion((value) => value + 1)}
        version={version}
      />

      <Modal
        isOpen={deciding !== null}
        onClose={() => setDeciding(null)}
        title={deciding?.decision === "VOID" ? "Void this sale" : "Post this sale now"}
        description={
          deciding?.decision === "VOID"
            ? "A voided sale is never posted, and nothing is written to the ledger."
            : "The sale is posted against current stock, with the payments as reconciled, on the date you choose."
        }
        primaryActionLabel={deciding?.decision === "VOID" ? "Void sale" : "Post sale"}
        primaryActionVariant={deciding?.decision === "VOID" ? "pink" : "lime"}
        onPrimaryAction={decide}
        isSubmitting={busy}
      >
        {deciding?.decision === "POST" ? (
          <div className="space-y-4">
            <Field label="Date to post on" hint="Must be in an open fiscal period.">
              <input type="date" className={fieldClass} value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <div className="space-y-2">
              <span className="text-[11px] font-black uppercase text-muted">Payments as reconciled</span>
              {tenders.map((tender, index) => (
                <div key={index} className="grid grid-cols-2 gap-2">
                  <select
                    className={fieldClass}
                    value={tender.method}
                    onChange={(event) => setTenders((current) => current.map((item, position) => (position === index ? { ...item, method: event.target.value as TenderMethod } : item)))}
                  >
                    {METHODS.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                  <input
                    inputMode="decimal"
                    className={fieldClass}
                    value={tender.amount}
                    onChange={(event) => setTenders((current) => current.map((item, position) => (position === index ? { ...item, amount: amountText(event.target.value) } : item)))}
                  />
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setTenders((current) => [...current, emptyTender("CARD")])}>
                Add a payment
              </Button>
            </div>
            {deciding.sale.reasons.includes("DISCOUNT_NEEDS_APPROVAL") ? (
              <Field label="Bill discount approval" hint="Paste the id of the approved discount request, if there is one.">
                <input className={fieldClass} value={approvalId} onChange={(event) => setApprovalId(event.target.value)} />
              </Field>
            ) : null}
          </div>
        ) : null}
        <Field label="Reason" hint="At least five characters. It is kept with the sale." className="pt-4">
          <textarea className={`${fieldClass} min-h-20`} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        {refusal.length > 0 ? (
          <ul className="pt-4 space-y-1 text-sm">
            {refusal.map((item, index) => (
              <li key={`${item}-${index}`} className="font-bold text-pink">
                {reasonInWords(item)}
              </li>
            ))}
          </ul>
        ) : null}
        {error ? (
          <p role="alert" className="pt-3 text-sm font-bold text-pink">
            {error}
          </p>
        ) : null}
      </Modal>
    </div>
  );
};
