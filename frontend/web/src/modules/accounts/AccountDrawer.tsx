import React, { useEffect, useState } from "react";
import { Drawer } from "../../components/ui/Drawer";
import type { Account, AccountType } from "../../types";
import { AlertCircle } from "lucide-react";

export interface AccountDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editingAccount?: Account | null;
  defaultType?: AccountType;
  onSave: (account: Account) => void;
}

const ACCOUNT_SUBTYPE_SUGGESTIONS: Record<AccountType, string[]> = {
  ASSET: [
    "Cash & Cash Equivalents",
    "Current Assets",
    "Accounts Receivable",
    "Inventory",
    "Property, Plant & Equipment",
    "Contra Asset",
    "Other Assets",
  ],
  LIABILITY: [
    "Current Liabilities",
    "Accounts Payable",
    "Tax Liabilities",
    "Payroll Liabilities",
    "Credit Cards",
    "Long-term Debt",
  ],
  EQUITY: [
    "Contributed Capital",
    "Common Stock",
    "Retained Earnings",
    "Owner Distributions",
  ],
  REVENUE: [
    "Operating Revenue",
    "Product Sales",
    "Service Revenue",
    "Discounts & Returns",
    "Other Income",
  ],
  EXPENSE: [
    "Cost of Goods Sold",
    "Direct Materials",
    "Direct Overhead",
    "Operating Expenses",
    "Payroll Expenses",
    "Rent & Leases",
    "Depreciation & Amortization",
    "Tax & Regulatory",
  ],
};

const CODE_PATTERN = /^[0-9A-Za-z.-]{1,20}$/;

export function isValidAccountCode(code: string): boolean {
  return CODE_PATTERN.test(code.trim());
}

export function validateAccountForm(input: {
  code: string;
  name: string;
  type: string;
}): { code?: string; name?: string; type?: string } {
  const errors: { code?: string; name?: string; type?: string } = {};

  const trimmedCode = input.code.trim();
  if (!trimmedCode) {
    errors.code = "Account code is required.";
  } else if (!isValidAccountCode(trimmedCode)) {
    errors.code = "Account code must be 1 to 20 letters, digits, dots, or hyphens (e.g. 1010 or 10.10).";
  }

  const trimmedName = input.name.trim();
  if (!trimmedName) {
    errors.name = "Account name is required.";
  } else if (trimmedName.length > 120) {
    errors.name = "Account name must be under 120 characters.";
  }

  if (!["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"].includes(input.type)) {
    errors.type = "Please select a valid account classification.";
  }

  return errors;
}

export const AccountDrawer: React.FC<AccountDrawerProps> = ({
  isOpen,
  onClose,
  editingAccount,
  defaultType = "ASSET",
  onSave,
}) => {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>(defaultType);
  const [subtype, setSubtype] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<{ code?: string; name?: string; type?: string }>({});
  const [showValidationBanner, setShowValidationBanner] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    setShowValidationBanner(false);

    if (editingAccount) {
      setCode(editingAccount.code);
      setName(editingAccount.name);
      setType(editingAccount.type);
      setSubtype(editingAccount.subtype || "");
      setCurrency(editingAccount.currency || "USD");
      setDescription(editingAccount.description || "");
      setActive(editingAccount.active);
    } else {
      setCode("");
      setName("");
      setType(defaultType);
      setSubtype(ACCOUNT_SUBTYPE_SUGGESTIONS[defaultType][0] || "");
      setCurrency("USD");
      setDescription("");
      setActive(true);
    }
  }, [isOpen, editingAccount, defaultType]);

  const handleTypeChange = (newType: AccountType) => {
    setType(newType);
    setSubtype(ACCOUNT_SUBTYPE_SUGGESTIONS[newType][0] || "");
  };

  const handleSubmit = () => {
    const validationErrors = validateAccountForm({ code, name, type });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setShowValidationBanner(true);
      return;
    }

    const saved: Account = {
      code: code.trim(),
      name: name.trim(),
      type,
      subtype: subtype.trim() || undefined,
      currency,
      description: description.trim() || undefined,
      active,
      balance: editingAccount ? editingAccount.balance : "0.00",
      isSystem: editingAccount?.isSystem,
    };

    onSave(saved);
    onClose();
  };

  const inputBaseClass = (hasError?: string) =>
    `w-full px-3 py-2 text-sm font-bold bg-page text-text border-line shadow-sm focus:outline-none focus:ring-2 placeholder:text-muted ${
      hasError ? "border-act focus:ring-act" : "focus:ring-lime"
    }`;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={editingAccount ? `Edit account ${editingAccount.code}` : "New general ledger account"}
      description="Chart of Accounts (MDM-03). Account codes cannot be altered once posted to."
      primaryActionLabel={editingAccount ? "Save account" : "Create account"}
      primaryActionVariant="lime"
      onPrimaryAction={handleSubmit}
      secondaryActionLabel="Cancel"
    >
      <div className="space-y-4">
        {showValidationBanner && Object.keys(errors).length > 0 && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-2.5 p-3 bg-page border-line border-act text-act text-xs font-bold shadow-sm"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <span>Please correct the errors indicated below to proceed.</span>
            </div>
          </div>
        )}

        {/* Account Code */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
            Account Code <span className="text-act">*</span>
          </label>
          <input
            type="text"
            required
            disabled={Boolean(editingAccount?.isSystem)}
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (errors.code) setErrors((prev) => ({ ...prev, code: undefined }));
            }}
            placeholder="e.g. 1010 or 5200"
            className={inputBaseClass(errors.code)}
          />
          {errors.code && (
            <p className="text-xs text-act font-bold mt-1">{errors.code}</p>
          )}
          <span className="text-[10px] text-muted mt-1 block">
            1 to 20 digits, letters, dots or hyphens. Standard numbering: 1000s Assets, 2000s Liabilities, 3000s Equity, 4000s Revenue, 5000–6000s Expenses.
          </span>
        </div>

        {/* Account Name */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
            Account Name <span className="text-act">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            placeholder="e.g. Operating Checking Account"
            className={inputBaseClass(errors.name)}
          />
          {errors.name && (
            <p className="text-xs text-act font-bold mt-1">{errors.name}</p>
          )}
        </div>

        {/* Classification / Account Type */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
            Classification / Type <span className="text-act">*</span>
          </label>
          <select
            value={type}
            disabled={Boolean(editingAccount?.isSystem)}
            onChange={(e) => handleTypeChange(e.target.value as AccountType)}
            className={inputBaseClass(errors.type)}
          >
            <option value="ASSET">ASSET · Normal Balance: Debit (Cash, Receivables, Inventory, Equipment)</option>
            <option value="LIABILITY">LIABILITY · Normal Balance: Credit (Payables, Accruals, Loans, Taxes)</option>
            <option value="EQUITY">EQUITY · Normal Balance: Credit (Owner Capital, Retained Earnings)</option>
            <option value="REVENUE">REVENUE · Normal Balance: Credit (Sales, Services, Fees)</option>
            <option value="EXPENSE">EXPENSE · Normal Balance: Debit (COGS, Rent, Utilities, Wages)</option>
          </select>
          {errors.type && (
            <p className="text-xs text-act font-bold mt-1">{errors.type}</p>
          )}
        </div>

        {/* Subtype */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
            Account Subtype / Group
          </label>
          <input
            type="text"
            list="subtype-options"
            value={subtype}
            onChange={(e) => setSubtype(e.target.value)}
            placeholder="e.g. Cash & Cash Equivalents"
            className={inputBaseClass()}
          />
          <datalist id="subtype-options">
            {ACCOUNT_SUBTYPE_SUGGESTIONS[type].map((opt) => (
              <option key={opt} value={opt} />
            ))}
          </datalist>
          <span className="text-[10px] text-muted mt-1 block">
            Select a suggested category or type a custom subcategory for financial statement groupings.
          </span>
        </div>

        {/* Currency */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
            Account Currency
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className={inputBaseClass()}
          >
            <option value="USD">USD ($) · US Dollar</option>
            <option value="EUR">EUR (€) · Euro</option>
            <option value="GBP">GBP (£) · British Pound</option>
            <option value="CAD">CAD ($) · Canadian Dollar</option>
            <option value="AUD">AUD ($) · Australian Dollar</option>
            <option value="INR">INR (₹) · Indian Rupee</option>
          </select>
        </div>

        {/* Description / Notes */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
            Description & Purpose
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what transactions should be posted to this account…"
            className={inputBaseClass()}
          />
        </div>

        {/* Status Toggle */}
        <div className="pt-2 border-t border-grid">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={Boolean(editingAccount?.isSystem)}
              className="w-4 h-4 accent-lime"
            />
            <span className="text-xs font-bold text-text">
              Active account (available for journal posting and invoice lines)
            </span>
          </label>
        </div>
      </div>
    </Drawer>
  );
};
