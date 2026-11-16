/**
 * Natural Language Transaction & Command Parser
 * Parses prompts like:
 *  - "Bill Acme $4500 for 10 titanium valves" -> Draft Invoice
 *  - "Expense $250 for AWS hosting" -> Draft Expense / Bill
 *  - "Add customer Apex Steel email contact@apex.com" -> Draft Contact
 *  - "Show overdue invoices" -> Filter view
 */

export interface ParsedNlpIntent {
  raw: string;
  kind: "create_invoice" | "create_expense" | "create_party" | "navigate" | "unknown";
  summary: string;
  payload: {
    partyName?: string;
    amount?: string;
    description?: string;
    itemCode?: string;
    email?: string;
    tab?: string;
  };
  confidence: number;
}

export function parseNaturalLanguageCommand(text: string): ParsedNlpIntent | null {
  const query = text.trim();
  if (!query || query.length < 3) return null;

  // 1. Invoice Intent: "Bill Acme $4500 for CNC milling" or "Invoice Horizon $1200"
  const billMatch = query.match(/(?:bill|invoice)\s+([A-Za-z0-9\s\-]+?)\s+\$?([0-9,]+(?:\.[0-9]{2})?)\s*(?:for\s+(.*))?/i);
  if (billMatch) {
    const partyName = billMatch[1]?.trim() || "Customer";
    const amount = billMatch[2]?.replace(/,/g, "") || "0.00";
    const description = billMatch[3]?.trim() || "Consulting & Services";
    return {
      raw: query,
      kind: "create_invoice",
      summary: `Create Invoice for ${partyName}: $${amount} (${description})`,
      payload: {
        partyName,
        amount,
        description,
      },
      confidence: 0.95,
    };
  }

  // 2. Expense Intent: "Expense $350 for travel" or "Pay supplier Acme $1200"
  const expenseMatch = query.match(/(?:expense|pay|spend)\s+(?:supplier\s+)?([A-Za-z0-9\s\-]+?)?\s*\$?([0-9,]+(?:\.[0-9]{2})?)\s*(?:for\s+(.*))?/i);
  if (expenseMatch) {
    const partyName = expenseMatch[1]?.trim() || "General Supplier";
    const amount = expenseMatch[2]?.replace(/,/g, "") || "0.00";
    const description = expenseMatch[3]?.trim() || "Operational Expense";
    return {
      raw: query,
      kind: "create_expense",
      summary: `Record Expense: $${amount} to ${partyName} (${description})`,
      payload: {
        partyName,
        amount,
        description,
      },
      confidence: 0.92,
    };
  }

  // 3. Add Customer/Party Intent: "Add customer Acme Corp email contact@acme.com"
  const partyMatch = query.match(/add\s+(?:customer|supplier|party|vendor)\s+([A-Za-z0-9\s\-]+?)(?:\s+email\s+([^\s]+))?$/i);
  if (partyMatch) {
    const partyName = partyMatch[1]?.trim() || "New Party";
    const email = partyMatch[2]?.trim();
    return {
      raw: query,
      kind: "create_party",
      summary: `Add Party Master: ${partyName}${email ? ` (${email})` : ""}`,
      payload: {
        partyName,
        email,
      },
      confidence: 0.9,
    };
  }

  // 4. Navigation shortcuts: "open ledger", "show inventory", "go to invoices"
  const navMatch = query.match(/(?:open|show|go\s+to|view)\s+(ledger|invoices|bills|inventory|crm|bank|approvals|parties|contacts|items|accounts|gallery|dashboard)/i);
  if (navMatch) {
    const target = navMatch[1] ? navMatch[1].toLowerCase() : "dashboard";
    const tabMap: Record<string, string> = {
      ledger: "ledger",
      invoices: "invoices",
      bills: "payables",
      inventory: "inventory",
      crm: "crm",
      bank: "bank",
      approvals: "approvals",
      parties: "contacts",
      contacts: "contacts",
      items: "items",
      accounts: "accounts",
      gallery: "gallery",
      dashboard: "dashboard",
    };
    const tab = tabMap[target] || "dashboard";
    return {
      raw: query,
      kind: "navigate",
      summary: `Navigate directly to ${tab.toUpperCase()} module`,
      payload: { tab },
      confidence: 0.98,
    };
  }

  return null;
}
