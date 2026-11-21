import React from "react";
import { Drawer } from "../../components/ui/Drawer";
import { Button } from "../../components/ui/Button";
import { formatMoney } from "../../lib/currency";
import type { CustomerStatement } from "../../types";
import { Printer, User } from "lucide-react";

export interface CustomerStatementDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  statement: CustomerStatement | null;
}

export const CustomerStatementDrawer: React.FC<CustomerStatementDrawerProps> = ({
  isOpen,
  onClose,
  statement,
}) => {
  if (!statement) return null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Statement of Account: ${statement.partyName}`}
      description="Itemized commercial ledger history, billings, and payment settlements."
      secondaryActionLabel="Close"
      onSecondaryAction={onClose}
    >
      <div className="space-y-4">
        {/* Customer Header Info */}
        <div className="p-3 bg-page border-line space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>Customer Account:</span>
            </span>
            <span className="font-bold text-text">{statement.partyName}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Payment Terms:</span>
            <span className="font-mono font-bold text-text">{statement.paymentTerms}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Billing Email:</span>
            <span className="font-mono text-text">{statement.email}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Contact Phone:</span>
            <span className="font-mono text-text">{statement.phone}</span>
          </div>

          <div className="pt-2 border-t border-grid flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-muted">Total Balance:</span>
            <span className="font-display font-black text-base text-text">
              {formatMoney(statement.currentBalance)}
            </span>
          </div>
        </div>

        {/* Transaction History */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-display font-extrabold text-xs uppercase tracking-wider text-muted break-words">
              Recent Transactions
            </h4>
            <span className="text-[10px] font-mono font-bold text-muted">
              {statement.transactions.length} Records
            </span>
          </div>

          <div className="overflow-x-auto border-line bg-panel">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-grid bg-page text-muted uppercase text-[10px] font-bold">
                  <th className="py-2 px-2.5">Date</th>
                  <th className="py-2 px-2.5">Ref / Type</th>
                  <th className="py-2 px-2.5 text-right">Amount</th>
                  <th className="py-2 px-2.5 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grid">
                {statement.transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-page/60 transition-colors">
                    <td className="py-2.5 px-2.5 font-mono text-muted text-[11px] whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="py-2.5 px-2.5 break-words">
                      <div className="font-bold text-text">{tx.reference}</div>
                      <span className="text-[10px] text-muted uppercase">{tx.type}</span>
                    </td>
                    <td className="py-2.5 px-2.5 font-mono font-bold text-right break-words">
                      <span
                        className={
                          tx.amount.startsWith("-")
                            ? "text-good"
                            : "text-text"
                        }
                      >
                        {formatMoney(tx.amount)}
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 font-mono font-bold text-right text-text break-words">
                      {formatMoney(tx.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Drawer Actions */}
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-grid">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Statement</span>
          </Button>
          <Button
            variant="yellow"
            size="sm"
            onClick={onClose}
            className="text-xs font-bold"
          >
            Close Statement
          </Button>
        </div>
      </div>
    </Drawer>
  );
};
