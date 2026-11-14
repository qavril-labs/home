import type { JournalEntry, StatusType } from "../../types";

export function toDecimalString(val: string | number): string {
  const str = String(val).trim().replace(/,/g, "");
  if (!str) return "0.00";
  const cleaned = str.replace(/[^0-9.]/g, "");
  if (!cleaned) return "0.00";
  const [intPart = "0", decPart = "00"] = cleaned.split(".");
  const paddedDec = (decPart + "00").slice(0, 2);
  const normalizedInt = intPart.replace(/^0+(?=\d)/, "") || "0";
  return `${normalizedInt}.${paddedDec}`;
}

/**
 * Checks whether an array of journal lines balances to zero in minor integer units.
 */
export function calculateJournalBalance(lines: { side: "DEBIT" | "CREDIT"; amount: string }[]): {
  debitCents: number;
  creditCents: number;
  totalDebit: string;
  totalCredit: string;
  isBalanced: boolean;
  imbalance: string;
} {
  let debitCents = 0;
  let creditCents = 0;

  for (const line of lines) {
    const norm = toDecimalString(line.amount);
    const [iStr = "0", dStr = "00"] = norm.split(".");
    const cents = (parseInt(iStr, 10) || 0) * 100 + (parseInt(dStr, 10) || 0);

    if (line.side === "DEBIT") {
      debitCents += cents;
    } else {
      creditCents += cents;
    }
  }

  const toStr = (c: number) => {
    const i = Math.floor(c / 100);
    const d = String(c % 100).padStart(2, "0");
    return `${i}.${d}`;
  };

  const diffCents = Math.abs(debitCents - creditCents);

  return {
    debitCents,
    creditCents,
    totalDebit: toStr(debitCents),
    totalCredit: toStr(creditCents),
    isBalanced: debitCents === creditCents && debitCents > 0,
    imbalance: toStr(diffCents),
  };
}

export function getJournalStatusChip(status: JournalEntry["status"]): {
  status: StatusType;
  label: string;
} {
  switch (status) {
    case "posted":
      return { status: "good", label: "Posted" };
    case "draft":
      return { status: "watch", label: "Draft" };
    case "reversed":
      return { status: "act", label: "Reversed" };
  }
}
