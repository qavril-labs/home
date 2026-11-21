/**
 * FIN-04: Automated Bank Reconciliation & Auto-Match Rules Engine
 * Powered by Ledger Lou (AGT-03)
 */

export interface BankFeedTransaction {
  id: string;
  date: string;
  description: string;
  amount: string; // positive for deposit/credit, negative for payment/debit
  rawType: "credit" | "debit";
  counterparty?: string;
  referenceNumber?: string;
  reconciliationStatus: "unmatched" | "matched" | "suggested" | "reconciled";
  suggestedMatch?: {
    entityType: "invoice" | "bill" | "expense";
    entityNumber: string;
    entityName: string;
    entityAmount: string;
    confidence: number; // e.g. 99 for 99%
    ruleApplied: string;
  };
}

export const INITIAL_BANK_FEED_TRANSACTIONS: BankFeedTransaction[] = [
  {
    id: "tx-bank-101",
    date: "2026-11-14",
    description: "STRIPE PAYOUT TRANSFER 88219-X",
    amount: "4550.00",
    rawType: "credit",
    counterparty: "Stripe Inc",
    referenceNumber: "STR-88219",
    reconciliationStatus: "suggested",
    suggestedMatch: {
      entityType: "invoice",
      entityNumber: "INV-2026-001",
      entityName: "Horizon Aerospace",
      entityAmount: "4550.00",
      confidence: 99,
      ruleApplied: "Exact Amount + Counterparty Stripe Match Rule",
    },
  },
  {
    id: "tx-bank-102",
    date: "2026-11-13",
    description: "ACH WIRE PRECISION SUPPLIES LTD",
    amount: "-3639.75",
    rawType: "debit",
    counterparty: "Precision Supplies Ltd",
    referenceNumber: "WIRE-99382",
    reconciliationStatus: "suggested",
    suggestedMatch: {
      entityType: "bill",
      entityNumber: "BILL-99382",
      entityName: "Precision Supplies Ltd",
      entityAmount: "3639.75",
      confidence: 98,
      ruleApplied: "Exact Amount + Supplier Reference 99382 Match Rule",
    },
  },
  {
    id: "tx-bank-103",
    date: "2026-11-12",
    description: "AWS CLOUD WEB SERVICES EM-9941",
    amount: "-245.50",
    rawType: "debit",
    counterparty: "Amazon Web Services",
    referenceNumber: "AWS-9941",
    reconciliationStatus: "suggested",
    suggestedMatch: {
      entityType: "expense",
      entityNumber: "EXP-6300",
      entityName: "Hosting & Infrastructure (Acct 6300)",
      entityAmount: "245.50",
      confidence: 96,
      ruleApplied: "Recurring Subscription Vendor Rule (AWS -> SG&A 6300)",
    },
  },
  {
    id: "tx-bank-104",
    date: "2026-11-10",
    description: "CHECK DEPOSIT #44091 ACME CORP",
    amount: "1480.00",
    rawType: "credit",
    counterparty: "Acme Corp",
    referenceNumber: "CHK-44091",
    reconciliationStatus: "suggested",
    suggestedMatch: {
      entityType: "invoice",
      entityNumber: "INV-2026-003",
      entityName: "Acme Corp",
      entityAmount: "1480.00",
      confidence: 95,
      ruleApplied: "Debtor Invoice Amount Match Rule",
    },
  },
];
