// Extra detail for the product, case study, project, industry and FAQ pages.
// Describes how things work for a customer. Keep examples as examples, never as customer stories.

export const PRODUCT_DETAIL = {
  "general-ledger": {
    steps: ["Set up your chart of accounts and fiscal year once.", "Post each sale, bill and payment as it happens, in its own currency.", "Close the month, and review the trial balance before anyone signs off."],
    example: "A shop in London buys stock in dollars. The bill is booked in the local currency at that day's rate, and the owner can see the cost on the same report as the local sales.",
  },
  "sales-invoicing": {
    steps: ["Create a quote and send it to the customer.", "Turn the accepted quote into an invoice with the next number in sequence.", "Record payments as they arrive, and follow up overdue invoices from the aging list."],
    example: "A consultant bills for a month of work. The invoice is numbered in order, and the customer's late payment appears on the aging list the following week.",
  },
  purchasing: {
    steps: ["A team member raises a request, and the manager approves it.", "The approved request becomes a purchase order for the supplier.", "When goods arrive, the receipt is checked against the order before the bill is paid."],
    example: "A merchant orders cement. The delivery is short by ten bags, and the bill is paid only for what actually arrived.",
  },
  inventory: {
    steps: ["Set up each warehouse or shop, and count stock once to start.", "Every sale, receipt and transfer updates the count automatically.", "Reorder points tell you what to buy before shelves run empty."],
    example: "A pharmacy sees that a batch of a medicine expires in 60 days. The system moves those units to the front of the queue, so they sell first.",
  },
  "payroll-hr": {
    steps: ["Record each employee's role, pay and leave entitlement.", "Attendance and leave feed into the pay run.", "Payslips and statutory filings are produced for the country you operate in, checked by a local expert."],
    example: "A staff member requests leave. The manager approves it on the phone, and the leave balance updates before the next pay run.",
  },
  pos: {
    steps: ["Set up products, prices and tables once.", "Sales work at the till, even when the connection drops, and sync when it returns.", "The kitchen sees each order on its own screen, and stock updates when a dish is served."],
    example: "A café loses internet for an hour at lunch. Orders keep flowing to the kitchen, and the sales appear in the books once the connection is back.",
  },
  "projects-field-service": {
    steps: ["Set up projects and the rates for each team member.", "Time is logged from a phone or a computer and approved weekly.", "Invoices are built from the approved hours or the agreed milestones."],
    example: "A technician finishes a repair visit and logs the parts used on the spot. The customer's invoice lists the visit, the time and the parts.",
  },
  "document-capture": {
    steps: ["Photograph or upload a supplier bill or receipt.", "The system reads the supplier, date, totals and lines, and suggests the account for each line.", "A person checks the suggestion and approves it, and only then is it posted."],
    example: "A manager photographs a fuel receipt at the end of the day. The entry appears for approval the next morning, with the cost already matched to the vehicle.",
  },
  security: {
    steps: ["Each business's records are kept apart from every other business's.", "Every change is recorded with who made it and when.", "Sign-in is protected, and sessions can be ended at any time."],
    example: "A former employee's access is removed the day they leave, and their past changes stay on record.",
  },
  "ai-agents": {
    steps: ["You set what each agent may do and how much it may spend or post.", "The agent drafts its work, such as a follow-up or a purchase order.", "You approve, change or reject it. Every action is logged, and you can stop an agent at once."],
    example: "A restocking agent notices that a fast-selling item will run out in five days. It drafts a purchase order, and the owner approves it with one tap.",
  },
  automation: {
    steps: ["Choose what should start the rule, such as a sale or a late payment.", "Choose what should happen, such as a reminder, a task or a posting.", "Review the log to see each time the rule ran and what it did."],
    example: "An invoice is 14 days overdue. The rule sends the customer a polite reminder and adds a task for the owner to call them.",
  },
  "ai-suite": {
    steps: ["Ask a question in plain words, such as which customers pay late.", "See the answer with the figures and the source of each figure.", "Change the assumptions in a forecast and see the result update."],
    example: "The owner asks which products made the most profit last quarter. The answer lists them with the sales and costs behind each one.",
  },
};

export const CASE_DETAIL = {
  "pharmacy-two-branches": {
    day: [
      "Morning: each branch checks its batches, and anything within 60 days of expiry is flagged.",
      "Midday: a transfer from one branch to the other is recorded once, and both counts update.",
      "Afternoon: a purchase order is raised for the item that is running low, and a manager approves it.",
      "Month-end: the loss from expired stock is shown by branch, with the batch and the date.",
    ],
  },
  "logistics-delivery-fleet": {
    day: [
      "Dispatch: each delivery note is created from the order and sent to the driver.",
      "On the road: proof of delivery is captured on the phone, with the signature and a photo.",
      "Evening: fuel receipts are photographed and matched to the vehicle and the route.",
      "Month-end: profit is shown for each route, with fuel and driver time included.",
    ],
  },
  "hotel-guesthouse": {
    day: [
      "Booking: each reservation holds the room and shows on the calendar at once.",
      "During the stay: bar, kitchen and laundry charges are added to the guest's bill as they happen.",
      "Checkout: one bill is printed with every charge, and the room is marked for cleaning.",
      "Month-end: occupancy and revenue per room are ready without a notebook.",
    ],
  },
  "school-bursary-office": {
    day: [
      "Term start: each family's fee plan is set up once, with its installments.",
      "Payment day: a mobile money payment clears the balance and issues a numbered receipt.",
      "A week before each installment: the family gets a reminder that shows the amount due.",
      "Term end: the bursar sees who owes what, in one list, by class.",
    ],
  },
  "dental-clinic-two-chairs": {
    day: [
      "Morning: each treatment is logged on the chair screen as it is finished.",
      "Midday: the invoice is raised from the logged treatment, with the price list applied.",
      "Afternoon: the receptionist sees which patients still owe money, and sends a reminder.",
      "Month-end: the clinic's income by treatment type is ready without a spreadsheet.",
    ],
  },
  "school-fee-plans": {
    day: [
      "Term start: each family's three-installment fee plan is set up once.",
      "Payment day: a payment reduces the balance, and a receipt is issued in order.",
      "A week before each installment: the family gets an automatic reminder.",
      "Term end: the bursar sees exactly who is owed what, in one list.",
    ],
  },

  "cafe-three-outlets": {
    day: [
      "Morning: the stock count is entered from a phone at each outlet, and low items are flagged.",
      "Lunch: sales at the till reduce the stock as they happen, and the kitchen gets each order on screen.",
      "Evening: the owner sees the day's sales for all three outlets on one page.",
      "Month-end: the report is ready the same day, with no re-typing.",
    ],
  },
  "consultancy-two-people": {
    day: [
      "The week: time is logged from a phone after each client visit.",
      "Friday: approved hours become invoices with the next number in sequence.",
      "Monday: the aging list shows which invoices are late, and reminders go out.",
      "Month-end: the profit for each client is visible, without a spreadsheet.",
    ],
  },
  "builders-merchant": {
    day: [
      "A supplier bill arrives in dollars: it is booked in the local currency at that day's rate.",
      "A delivery is checked against the order before the bill is approved.",
      "Stock counts update as goods leave the yard, so the sales team sees what is available.",
      "A wrong entry is corrected by a reversal, so the original record stays intact.",
    ],
  },
};

export const INDUSTRY_DETAIL = {
  hospitality: { example: "A guesthouse takes a booking by phone. The room is held, the guest's stay is charged to one bill, and checkout prints a single invoice with every extra." },
  manufacturing: { example: "A small maker quotes a batch of furniture. The materials needed are listed, the cost is known before the order is accepted, and the actual cost is compared with the quote afterwards." },

  restaurants: { example: "A café's stock of milk is counted each morning on a phone. The system flags the milk that expires on Thursday, and the daily special is changed to use it first." },
  clinics: { example: "A dental clinic books a patient's visit, records the treatment, and sends the invoice the same day. Insurance claims follow once the industry pack is added." },
  construction: { example: "A builder enters the estimate for a job. As materials are bought and hours are logged, the job shows whether it is on budget, before the client is billed." },
  logistics: { example: "A delivery van's fuel and driver costs are logged against each route. The owner sees which routes make money, and proof of delivery is kept with the invoice." },
  "retail-pharmacy": { example: "A pharmacy sells medicines in batches. Each batch's expiry date is tracked, and the oldest stock is sold first, with expired stock flagged for removal." },
  schools: { example: "A school sets a fee plan with three installments. Payments reduce the balance for each family, and reminders go out before each due date." },
  property: { example: "A landlord records rent for each unit. Late payments appear on a list, and an owner statement is produced at the end of each month." },
  "professional-services": { example: "A firm logs hours against each client matter. Approved time becomes an invoice, and the profit for each matter is visible to the partners." },
  agriculture: { example: "A cooperative records what each member delivered. Payouts are calculated from the deliveries, and the records show where each batch came from." },
};

export const PROJECT_DETAIL = {
  "bot-crew": { meaning: "Routine work such as reminders, reorders and checks is prepared for you. Nothing changes money, stock or customers until you approve it." },
  "payments-and-receipts": { meaning: "Payments are matched to the invoices they settle, so you see who has paid and who has not without a manual match." },
  "industry-packs": { meaning: "Your trade gets its own words, forms and reports on top of the same core, so you are not forced into a generic setup." },
  "ai-bots": { meaning: "Routine work such as reminders and reorders is prepared for you. Nothing changes money, stock or customers until you say so." },

  "product-catalog": { meaning: "You can see the full plan, the order it will arrive in, and what each module depends on before you buy." },
  "general-ledger-build": { meaning: "Your books balance in every currency, closed months stay closed, and corrections are shown as reversals so the history stays clear." },
  "multi-currency": { meaning: "If you buy or sell in more than one currency, every amount is booked in your own currency at the rate for that day." },
  "tenant-isolation": { meaning: "Your records are yours alone. No other business on the platform can see them." },
  "marketing-site": { meaning: "When you request a demo or a trial, we receive the slot you chose and reply to you by email." },
};

export const FAQ = [
  { q: "Are the AI bots safe to use with real money?", a: "Bots draft and flag. Anything that changes money, stock or a customer needs your approval, and every action is logged so you can review it." },
  { q: "Can I switch a bot off?", a: "Yes. Each bot can be paused or stopped at any time, and it stops at once." },
  { q: "Do I need an accountant to use the ledger?", a: "No. Your accountant can review the books at month-end, and the screens are written in plain words for owners and managers." },
  { q: "What if I already use spreadsheets?", a: "You can keep them while we move your records across. The move is part of onboarding, so you do not do it alone." },
  { q: "How do I know my customers' data is not shared?", a: "Each business's records are kept separate from every other business's, and only people in that business with the right role can see them." },
  { q: "Can my bookkeeper or accountant have access?", a: "Yes. Access is given by role, so your accountant can see the books without seeing everything else." },
  { q: "Can I use it today?", a: "Yes. Book a demo, and we set up your business with you, starting with the modules you need first." },
  { q: "What does a free trial include?", a: "Trial access is not open yet. Requesting one puts you first in line, and we email you when your trial is ready. Nothing is charged for a trial." },
  { q: "How does a demo work?", a: "A demo lasts about 20 minutes. Bring one real task, such as a sale or a month-end report, and we show how it would run in your business." },
  { q: "Which countries are supported?", a: "We launch in the United States, Europe, the Middle East and North Africa (MENA), and Asia. Tax, e-invoicing and payroll rules are set for each country and reviewed by a local expert before they are used, so each country opens when its rules are ready." },
  { q: "Where is my data stored?", a: "Each customer's data is kept separate from every other customer's. The hosting region is confirmed in your written terms." },
  { q: "Can I move my data from QuickBooks or Tally?", a: "Yes. We move your opening balances, customers, suppliers and stock across in a guided setup, and check them against your last closed statements." },
  { q: "Will my staff need training?", a: "Yes. Every team gets a short onboarding session. The screens are designed for people who are not accountants." },
  { q: "Does it work offline?", a: "The till and stock screens keep working when the connection drops, and the sales sync when it returns." },
  { q: "What are AI agents, and do I stay in control?", a: "Agents do routine work inside limits you set. They draft, you approve, every action is logged, and you can stop an agent at any time." },
  { q: "How is pricing decided?", a: "Plans start free. Paid plans are a monthly subscription plus a one-time setup fee, and the exact amount is confirmed in writing before you pay. See the pricing page." },
];
