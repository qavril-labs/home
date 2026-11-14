import React from "react";
import { Drawer } from "../../components/ui/Drawer";
import { Button } from "../../components/ui/Button";
import { formatMoney } from "../../lib/currency";
import type { DraftPurchaseOrder } from "../../types";
import { ShoppingCart, Building, ShieldCheck, AlertCircle } from "lucide-react";

export interface CreatePODrawerProps {
  isOpen: boolean;
  onClose: () => void;
  draftPO: DraftPurchaseOrder | null;
  onSubmitForApproval: (poId: string) => void;
}

export const CreatePODrawer: React.FC<CreatePODrawerProps> = ({
  isOpen,
  onClose,
  draftPO,
  onSubmitForApproval,
}) => {
  if (!draftPO) return null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Draft Replenishment PO: ${draftPO.id}`}
      description="Restock Rex prepared this replenishment order based on supplier lead times and safety reorder thresholds."
      secondaryActionLabel="Cancel"
      onSecondaryAction={onClose}
    >
      <div className="space-y-4 text-xs">
        {/* Vendor Header Card */}
        <div className="p-3 bg-page border-line space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted flex items-center gap-1.5 font-bold">
              <Building className="w-3.5 h-3.5" />
              <span>Target Vendor:</span>
            </span>
            <span className="font-bold text-text">{draftPO.vendorName}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted">Payment Terms:</span>
            <span className="font-mono font-bold text-text">Net 30 Commercial</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted">Creation Timestamp:</span>
            <span className="font-mono text-muted text-[11px]">{draftPO.createdAt.replace("T", " ").replace("Z", "")}</span>
          </div>

          <div className="pt-2 border-t border-grid flex items-center justify-between">
            <span className="font-bold uppercase text-muted">Grand Total:</span>
            <span className="font-display font-black text-lg text-text">
              {formatMoney(draftPO.totalAmount)}
            </span>
          </div>
        </div>

        {/* Line Items Table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-display font-extrabold text-xs uppercase tracking-wider text-muted flex items-center gap-1.5">
              <ShoppingCart className="w-3.5 h-3.5 text-orange" />
              <span>Order Lines ({draftPO.lines.length})</span>
            </h4>
            <span className="text-[10px] font-mono text-muted">Auto-computed quantities</span>
          </div>

          <div className="overflow-x-auto border-line bg-panel">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-grid bg-page text-muted uppercase text-[10px] font-bold">
                  <th className="py-2 px-2.5">Item & SKU</th>
                  <th className="py-2 px-2.5 text-center">Qty</th>
                  <th className="py-2 px-2.5 text-right">Unit Price</th>
                  <th className="py-2 px-2.5 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grid">
                {draftPO.lines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-page/60 transition-colors">
                    <td className="py-2.5 px-2.5 max-w-[180px]">
                      <div className="font-bold text-text leading-tight">{line.name}</div>
                      <span className="font-mono text-[10px] text-muted">{line.sku}</span>
                    </td>
                    <td className="py-2.5 px-2.5 text-center font-mono font-bold text-text">
                      {line.qty}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono text-muted text-[11px]">
                      {formatMoney(line.unitPrice)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono font-bold text-text">
                      {formatMoney(line.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tier 3 Governance Alert */}
        <div className="p-3 bg-cream border-line flex items-start gap-2 text-[11px] text-ink">
          <AlertCircle className="w-4 h-4 text-watch flex-shrink-0 mt-0.5" />
          <span>
            <strong>Tier 3 Approval Requirement:</strong> Submitting this purchase order routes it to the <strong>Approvals Inbox (PLT-07)</strong>. Under the Dual-Control policy (AGT-06), commercial disbursement cannot occur until an authorized purchasing supervisor signs off.
          </span>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-grid">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="yellow"
            size="sm"
            onClick={() => onSubmitForApproval(draftPO.id)}
            className="flex items-center gap-1.5 font-bold"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Submit PO for Approval</span>
          </Button>
        </div>
      </div>
    </Drawer>
  );
};
