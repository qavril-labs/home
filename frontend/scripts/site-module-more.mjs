// Extra detail for each module page: highlights, what it works with, and the questions customers ask.
// Written as what the module does for the customer, in plain words.

export const MODULE_MORE = {
  "general-ledger": {
    highlights: [
      "Every sale, bill, payment and stock movement lands in the ledger the moment it is saved",
      "Balances in your base currency, with the rate for each day kept on record",
      "Month-end close that locks a period, so finished months cannot change by accident",
      "Reports ready to hand to your accountant: trial balance, profit and loss, and balance sheet",
    ],
    works_with: ["Sales and invoicing", "Purchasing and suppliers", "Bank feeds", "Payroll and HR", "Your accountant's review"],
    faqs: [
      { q: "Can my accountant review the books?", a: "Yes. Your accountant gets a read view of the ledger, the trial balance and the period close, and can add notes against entries." },
      { q: "What happens if I post a wrong entry?", a: "You reverse it. The reversal uses the original amounts, so the first entry and its correction both stay in the history." },
    ],
  },
  "sales-invoicing": {
    highlights: [
      "Quotes become sales orders, and sales orders become invoices with one click",
      "Invoice numbers run in order and are assigned only when an invoice is saved",
      "Customer statements and an aging list show who owes what, and by how many days",
      "Recurring invoices for retainers, rent and fee plans",
    ],
    works_with: ["General ledger", "Inventory", "Customer reminders", "Payments and receipts", "Email and WhatsApp"],
    faqs: [
      { q: "Can I send invoices by WhatsApp or email?", a: "Yes. Invoices and statements go out by email, and message channels are available where your country supports them." },
      { q: "Does it handle tax on each line?", a: "Each line can carry its own tax code, and the totals show tax by rate, as your country's rules require." },
    ],
  },
  purchasing: {
    highlights: [
      "A request from any team member goes to the manager for approval before it becomes an order",
      "Purchase orders are sent to suppliers, and revised orders keep their history",
      "Goods receipts can be partial, so a short delivery is recorded as it arrives",
      "Supplier bills are matched to the order and the receipt before they can be paid",
    ],
    works_with: ["Inventory", "General ledger", "Accounts payable", "Supplier portal", "Multi-currency bills"],
    faqs: [
      { q: "What if a supplier bills me for more than I received?", a: "The bill is held until the difference is agreed. You pay only for what arrived." },
      { q: "Can I buy in a foreign currency?", a: "Yes. The bill is booked in your base currency at the rate on the bill date." },
    ],
  },
  inventory: {
    highlights: [
      "Stock counts for every warehouse, shop and branch, with transfers between them",
      "Expiry dates for each batch, with the oldest stock sold first",
      "Scan a barcode on a phone to receive, pick or count",
      "Reorder points that suggest the next purchase order before shelves run empty",
    ],
    works_with: ["Sales and POS", "Purchasing", "General ledger", "Barcode scanners", "Phones and tablets"],
    faqs: [
      { q: "Can I count stock on a phone?", a: "Yes. Counts can be entered on a phone, and the system shows the difference against the expected figure." },
      { q: "Can I track batches and serial numbers?", a: "Yes. Each batch or serial number is followed from receipt to sale." },
    ],
  },
  "payroll-hr": {
    highlights: [
      "Attendance and shifts, with clock-in and clock-out from a phone",
      "Leave types with balances that update when leave is approved",
      "Payslips and pay runs, posted to the ledger as one entry per run",
      "Employees see their own payslips and leave requests in a self-service screen",
    ],
    works_with: ["General ledger", "Attendance devices", "Bank transfers", "Employee self-service", "Local statutory filings"],
    faqs: [
      { q: "Does payroll follow my country's rules?", a: "Payroll rules are set for each country and checked by a local expert before they are used for your pay runs." },
      { q: "Can staff see their payslips?", a: "Yes. Each employee sees only their own payslips, leave balance and requests." },
    ],
  },
  pos: {
    highlights: [
      "Fast checkout with split payments, returns and receipts",
      "Keeps working when the internet drops, and syncs the sales when it returns",
      "Tables, courses and split bills for restaurants",
      "Kitchen screens show each order as it is placed, and stock updates when a dish is served",
    ],
    works_with: ["Inventory", "General ledger", "Mobile money and card terminals", "Kitchen displays", "QR ordering"],
    faqs: [
      { q: "What if the internet goes down during service?", a: "Sales keep going on the till, and every sale is posted to the books once the connection is back." },
      { q: "Can customers order from the table?", a: "Yes. A QR code on the table opens the menu, and the order goes straight to the kitchen screen." },
    ],
  },
  "projects-field-service": {
    highlights: [
      "Timesheets from a phone or a computer, approved weekly by the manager",
      "Billing by hours, fixed fee or milestone, with one invoice per project",
      "Work orders for technicians with the parts used and photos attached",
      "Profit per project, so margin problems show early",
    ],
    works_with: ["Sales and invoicing", "General ledger", "Inventory for parts", "Phones for technicians", "Client portal"],
    faqs: [
      { q: "Can technicians use it on site?", a: "Yes. Work orders, photos and parts used are recorded from a phone while the visit is still fresh." },
      { q: "How do you bill for time?", a: "Approved hours are turned into invoice lines at each person's rate, with the project and task shown." },
    ],
  },
  "document-capture": {
    highlights: [
      "Reads supplier, date, totals and lines from a photo or a PDF",
      "Suggests the account and tax code for each line",
      "Nothing is posted until a person approves it",
      "Learns from each correction, so the next bill from the same supplier is quicker to check",
    ],
    works_with: ["Purchasing", "General ledger", "Accounts payable", "Phones and scanners", "Email inbox for bills"],
    faqs: [
      { q: "Is the bill posted automatically?", a: "No. The system proposes the entry, and a person approves it before it reaches the ledger." },
      { q: "Can I send bills by email?", a: "Yes. Bills sent to your capture address appear in the approval queue." },
    ],
  },
  security: {
    highlights: [
      "Each business's records are kept apart from every other business's",
      "Roles limit what each person can see and change",
      "A record of every change, showing who made it and when, that cannot be edited afterwards",
      "Amounts are stored exactly, so totals always add up",
    ],
    works_with: ["Every module", "Your staff roles", "Audit reports", "Your accountant's access"],
    faqs: [
      { q: "Can another business see my data?", a: "No. Your records are only ever shown to your own business and the people you give a role to." },
      { q: "Can I end someone's access quickly?", a: "Yes. Access can be ended for one person or one session at any time, and the change is recorded." },
    ],
  },
  "ai-agents": {
    highlights: [
      "Each agent has its own role, spending limits and the modules it may use",
      "Agents draft quotes, follow-ups and purchase orders for you to approve",
      "Prepares reconciliation lists and month-end checklists",
      "Every agent action is logged, and a single switch stops an agent at once",
    ],
    works_with: ["Sales and invoicing", "Purchasing", "General ledger", "Automation rules", "Your approval queue"],
    faqs: [
      { q: "Can an agent spend money without asking?", a: "No. An agent can only draft. Spending and posting need your approval, unless you set a limit you are comfortable with." },
      { q: "How do I stop an agent?", a: "Switch it off from its page. It stops at once, and its open drafts stay in the queue for you to review." },
    ],
  },
  automation: {
    highlights: [
      "Rules start on events such as a sale, a late payment or a low stock level",
      "Actions include a notification, a ledger posting, or a task for a person",
      "Scheduled reports are sent by email or chat",
      "Webhooks let your own systems receive signed events",
    ],
    works_with: ["Sales and invoicing", "Inventory", "Receivables", "Email and chat", "Your own systems through webhooks"],
    faqs: [
      { q: "Can I see what a rule did?", a: "Yes. Every run is logged with the time, the trigger and the result." },
      { q: "Can my developer connect another system?", a: "Yes. Webhooks deliver signed events, and the API documents each event." },
    ],
  },
  "ai-suite": {
    highlights: [
      "Ask questions of your books in plain words, and see the source of each figure",
      "Cash, demand and sales forecasts with the assumptions shown and editable",
      "Watches for duplicate payments, unusual discounts and out-of-pattern expenses",
      "You choose what data the AI features may use, and you can switch each one off",
    ],
    works_with: ["General ledger", "Receivables and payables", "Inventory", "Sales history", "Your data controls"],
    faqs: [
      { q: "Where do the answers come from?", a: "From your own records. Each answer lists the entries and figures it used." },
      { q: "Can I turn the AI off?", a: "Yes. Each AI feature can be switched off per module, and the rest of the system works without it." },
    ],
  },
};
