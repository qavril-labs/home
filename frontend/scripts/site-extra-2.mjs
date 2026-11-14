// Services, functions and AI bots for the product and bot pages.
// Describes what a customer can use. Dashboard previews are illustrative, with sample figures only.

export const PRODUCT_MORE = {
  "general-ledger": {
    kpis: ["Trial balance", "Open periods", "Entries to review"],
    services: ["Chart of accounts design for your business", "Opening balances migration", "Monthly close support", "Multi-currency setup"],
    functions: ["Post journal entries in any currency", "Close and lock fiscal periods", "Reverse an entry without editing it", "Trial balance as at any date", "Exchange rates by effective date"],
  },
  "sales-invoicing": {
    kpis: ["Open invoices", "Overdue", "Collected this month"],
    services: ["Price list and tax setup", "Quote and invoice template design", "Customer statement and reminder setup"],
    functions: ["Quotes that convert to orders and invoices", "Invoice numbers issued on save", "Credit notes and returns", "Receivables aging", "Customer statements"],
  },
  purchasing: {
    kpis: ["Open orders", "Awaiting receipt", "Bills to approve"],
    services: ["Supplier onboarding", "Approval rules setup", "Three-way matching setup"],
    functions: ["Requisitions and approvals", "Purchase orders and revisions", "Goods receipts, including partial", "Bill matching before payment", "Supplier history"],
  },
  inventory: {
    kpis: ["Items in stock", "Low stock", "Expiring soon"],
    services: ["Warehouse and bin setup", "Stock count on go-live", "Barcode label printing setup"],
    functions: ["Multi-warehouse stock and transfers", "Lots, serials and expiry dates", "Barcode scanning on a phone", "Reorder points and suggestions", "Cycle counting"],
  },
  "payroll-hr": {
    kpis: ["Staff present", "Leave requests", "Pay run status"],
    services: ["Country payroll setup with a local expert", "Leave policy setup", "Statutory filing support"],
    functions: ["Employee records and documents", "Attendance and shifts", "Leave requests and balances", "Payslips and pay runs", "Self-service for staff"],
  },
  pos: {
    kpis: ["Sales today", "Open tables", "Kitchen queue"],
    services: ["Till and printer setup", "Menu and price setup", "Staff training on the till"],
    functions: ["Fast checkout with split payments", "Offline sales that sync later", "Tables, courses and split bills", "Kitchen display screens", "QR ordering for guests"],
  },
  "projects-field-service": {
    kpis: ["Hours logged", "Open work orders", "Billable"],
    services: ["Project and rate setup", "Technician app setup", "Billing rules setup"],
    functions: ["Timesheets from phone or computer", "Billing by hours, fixed fee or milestone", "Work orders with parts and photos", "Project profitability", "Dispatch board"],
  },
  "document-capture": {
    kpis: ["Documents read", "Awaiting review", "Matched automatically"],
    services: ["Training on your supplier documents", "Review rules setup"],
    functions: ["Read bills and receipts from photos or PDFs", "Suggest accounts and tax codes", "Match to purchase orders", "Learn from corrections", "Nothing posted without approval"],
  },
  security: {
    kpis: ["Active sessions", "Changes recorded", "Access reviews due"],
    services: ["Role and access design", "Data retention setup", "Security review on request"],
    functions: ["Role-based access", "Full history of changes", "Sessions that can be ended", "Data kept separate for each business", "Export of your own records"],
  },
  "ai-agents": {
    kpis: ["Agents running", "Waiting for approval", "Actions today"],
    services: ["Agent design for your workflow", "Limits and approval setup", "Training on reviewing agent work"],
    functions: ["Named roles and limits per agent", "Drafts for approval", "Full action log", "Kill switch", "Escalation to a person"],
  },
  automation: {
    kpis: ["Rules active", "Runs today", "Errors to check"],
    services: ["Rule design with your team", "Connector setup for your tools"],
    functions: ["Triggers and conditions", "Actions such as notify, task or post", "Scheduled reports", "Signed webhooks", "Run history and retries"],
  },
  "ai-suite": {
    kpis: ["Questions asked", "Forecasts run", "Alerts raised"],
    services: ["Forecast model review with your accountant", "Data-use settings setup"],
    functions: ["Plain-language questions", "Cash and demand forecasts", "Duplicate and unusual payment alerts", "Sources shown for each answer", "Data-use controls per module"],
  },
};

export const BOTS = [
  { slug: "pip", name: "Pip", role: "Sales follow-up bot", color: "#c6ff3d", accent: "#3de8ff", mood: "M32 46 Q40 52 48 46", does: "Drafts follow-ups from the pipeline and proposes the next step for each deal.", automations: ["Follow up a quote after 3 days without a reply", "Suggest a call when a deal goes quiet", "Log each sent follow-up against the customer"], limits: "Drafts only. Nothing is sent without your approval." },
  { slug: "ledger-lou", name: "Ledger Lou", role: "Month-end checker", color: "#3de8ff", accent: "#ffe14d", mood: "M33 46 H47", does: "Prepares reconciliation lists and checks month-end before the books are closed.", automations: ["Match bank lines to open invoices and bills", "Flag entries posted after a close", "Build the month-end checklist"], limits: "Reads and flags. It never closes a period by itself." },
  { slug: "restock-rex", name: "Restock Rex", role: "Restocking bot", color: "#ff4fa3", accent: "#c6ff3d", mood: "M32 45 Q40 40 48 45", does: "Watches stock and sales speed, and proposes purchase orders before items run out.", automations: ["Propose an order when stock nears its reorder point", "Move expiring stock to the front of the queue", "Group small orders into one supplier order"], limits: "Proposes orders. A manager approves each one." },
  { slug: "chase-chloe", name: "Chase Chloe", role: "Payment reminder bot", color: "#ffe14d", accent: "#ff4fa3", mood: "M32 47 Q40 43 48 47", does: "Sends polite reminders for overdue invoices, and escalates to a person when needed.", automations: ["Send a reminder 3 days after the due date", "Send a firmer reminder at 14 days", "Create a call task for the owner at 30 days"], limits: "Reminders follow the wording you approve." },
  { slug: "forecast-finn", name: "Forecast Finn", role: "Cash forecast bot", color: "#8b6bff", accent: "#c6ff3d", mood: "M32 46 Q40 49 48 46", does: "Forecasts cash for the coming weeks, with the assumptions shown so you can change them.", automations: ["Refresh the cash forecast every morning", "Warn when cash drops below your floor", "Show what changes the forecast most"], limits: "Forecasts are estimates. Assumptions are yours to edit." },
  { slug: "guard-gus", name: "Guard Gus", role: "Duplicate and anomaly bot", color: "#ff4fa3", accent: "#8b6bff", mood: "M33 47 Q40 44 47 47", does: "Watches payments and expenses for duplicates and unusual amounts.", automations: ["Flag a bill paid twice", "Flag a discount far above normal", "Flag an expense outside the usual pattern"], limits: "Flags for review. It never blocks a payment on its own." },
  { slug: "ticket-tess", name: "Ticket Tess", role: "Customer support bot", color: "#3de8ff", accent: "#ff4fa3", mood: "M32 46 Q36 50 40 46 Q44 42 48 46", does: "Answers common questions from your knowledge base and hands over when unsure.", automations: ["Answer order-status questions", "Route refund requests to a person", "Ask for feedback after a delivery"], limits: "Hands over to a person whenever it is not sure." },
  { slug: "onboard-ola", name: "Onboard Ola", role: "New staff setup bot", color: "#c6ff3d", accent: "#8b6bff", mood: "M32 46 Q40 52 48 46", does: "Prepares a new starter's access, equipment and first-week checklist.", automations: ["Create the starter's record and role", "Assign the first-week checklist", "Remove access on the last working day"], limits: "Access changes need a manager's approval." },
];
