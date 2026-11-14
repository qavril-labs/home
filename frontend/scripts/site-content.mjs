// Content for the marketing site's detail pages. build-site-pages.mjs turns this into HTML.
// Keep claims true: describe what a module does and what exists today. Do not promise dates.

export const PRODUCTS = [
  {
    slug: "general-ledger",
    name: "General ledger",
    summary: "The book every other module posts into: accounts, periods, multi-currency entries, reversals and a trial balance.",
    features: [
      "A chart of accounts with account types, which you control",
      "Monthly fiscal periods that can be closed, so nothing is posted into a finished month",
      "Entries in any currency, booked in your base currency at the rate on the entry date",
      "Reversals that undo an entry at its original amounts, even after rates change",
      "A trial balance as at any date, where debits must equal credits",
    ],
    who: "Any business that needs correct books, from a two-person firm to a company with several branches.",
  },
  {
    slug: "sales-invoicing",
    name: "Sales and invoicing",
    summary: "From quote to invoice to credit note, with receivables that update as money comes in.",
    features: [
      "Quotes that turn into sales orders and then invoices",
      "Invoice numbers that never skip, even when a save fails",
      "Credit notes and returns",
      "Receivables aging and customer statements",
    ],
    who: "Service firms, distributors and shops that invoice their customers regularly.",
  },
  {
    slug: "purchasing",
    name: "Purchasing and suppliers",
    summary: "Requisitions, purchase orders, goods receipts and supplier bills matched to what actually arrived.",
    features: [
      "Requisitions that a manager approves before they become orders",
      "Purchase orders with revisions and supplier acknowledgment",
      "Goods receipts, including partial deliveries",
      "Supplier bills checked against the order and the receipt before they are paid",
    ],
    who: "Any business that buys stock or services from suppliers, especially across currencies.",
  },
  {
    slug: "inventory",
    name: "Inventory",
    summary: "Stock across warehouses and branches, with lots, expiry dates and barcode scanning.",
    features: [
      "Stock levels per warehouse, with transfers between them",
      "Lot and serial tracking, and expiry dates with first-expiry-first-out picking",
      "Barcode scanning on a phone for receiving, picking and counting",
      "Reorder points and suggested purchase orders",
    ],
    who: "Shops, restaurants, pharmacies and distributors that need to know what is on the shelf.",
  },
  {
    slug: "payroll-hr",
    name: "Payroll and HR",
    summary: "Attendance, leave and payslips. Payroll rules are added country by country, because each country's rules differ.",
    features: [
      "Attendance and shifts, including clock-in with location",
      "Leave types, accruals and approvals",
      "Employee self-service for payslips and leave requests",
      "Payroll and statutory filings for each country, reviewed by a local expert before use",
    ],
    who: "Businesses that pay staff and need records that stand up to an audit.",
  },
  {
    slug: "pos",
    name: "Retail and restaurant POS",
    summary: "Checkout that keeps working when the internet drops, plus tables, kitchen screens and QR ordering for restaurants.",
    features: [
      "Fast checkout with split payments and returns",
      "Offline mode that syncs when the connection returns",
      "Tables, courses and split bills for restaurants",
      "Kitchen display screens and customer QR ordering",
    ],
    who: "Shops, cafés and restaurants that sell face to face and need the till to keep working.",
  },
  {
    slug: "projects-field-service",
    name: "Projects and field service",
    summary: "Project time, billing by hours or milestone, and technician work orders with parts used.",
    features: [
      "Timesheets from web and phone, with approvals",
      "Billing by hours, fixed fee or milestone",
      "Work orders for technicians, with parts and photos",
      "Profitability per project, so margin problems show early",
    ],
    who: "Consultancies, contractors and service companies that bill for time or visits.",
  },
  {
    slug: "document-capture",
    name: "Document capture",
    summary: "Read invoices and receipts from photos or PDFs, and propose entries that a person checks before anything is posted.",
    features: [
      "Extracts supplier, date, totals and lines from a photo or PDF",
      "Suggests the account and tax code for each line",
      "Nothing is posted until a person approves it",
      "Learns from corrections made for each customer",
    ],
    who: "Businesses drowning in paper bills and receipts at month-end.",
  },
  {
    slug: "security",
    name: "Security and tenant isolation",
    summary: "The protections every product is built on. Each one's status is listed on the availability page.",
    features: [
      "Each customer's data is kept separate from every other customer's",
      "Sign-in is protected, and any session can be ended at any time",
      "A record of who changed what, which cannot be altered afterwards",
      "Amounts are exact to the cent, so totals always add up",
    ],
    who: "Every customer. These protections are the reason the modules can be trusted with real books.",
  },
  {
    slug: "ai-agents",
    name: "AI agents",
    summary: "Agents that do routine work inside the limits you set, and hand anything unusual to a person.",
    features: [
      "Each agent runs with its own role, spending limits and the modules it may touch",
      "Drafts quotes and follow-ups from the pipeline, and proposes next steps for approval",
      "Prepares reconciliation lists and month-end checklists, and flags unusual entries",
      "Every agent action is logged in the audit trail, and a kill switch stops an agent at once",
    ],
    who: "Owners and managers who want routine work done without losing control of the books.",
  },
  {
    slug: "automation",
    name: "Automation",
    summary: "Rules that run when something happens: notify, post, create a task, or send a report on a schedule.",
    features: [
      "Starts on events such as a sale, a late payment, or a low stock level",
      "Actions such as notify, post to the ledger, or create a task, with conditions",
      "Scheduled reports delivered by email or chat",
      "Webhooks so your own systems can subscribe to events, with signed requests",
    ],
    who: "Any business that repeats the same steps every day, and developers who want to connect other systems.",
  },
  {
    slug: "ai-suite",
    name: "AI suite",
    summary: "Ask questions of your books, forecast cash and demand, and spot unusual payments, with the reasons shown.",
    features: [
      "Plain-language questions about your books, with the source of each figure shown",
      "Cash, demand and sales forecasts with editable assumptions",
      "Monitoring for duplicate payments, unusual discounts and out-of-pattern expenses",
      "You choose what data the AI features may use, and can turn them off per module",
    ],
    who: "Businesses that want answers faster and want the reasons behind them, with control over their data.",
  },
];

export const REQUIREMENTS = [
  { name: "Works on phones and offline", covers: "A mobile-first app, offline checkout and stock counts that sync later.", ids: "PLT-19, POS-01, INV-04" },
  { name: "Your currency and language", covers: "Multi-currency books, translated screens, and right-to-left layouts.", ids: "PLT-03, PLT-05, FIN-01" },
  { name: "Local tax and e-invoicing", covers: "Tax returns and e-invoices shaped for each country, added market by market.", ids: "FIN-06, FIN-07, PLT-04" },
  { name: "Payroll for each country", covers: "Payroll and statutory filings built one country at a time, reviewed by a local expert.", ids: "HRM-05, HRM-06" },
  { name: "Your data stays where you choose", covers: "Region-pinned hosting, encryption at rest and in transit, and retention rules.", ids: "PLT-21" },
  { name: "Secure sign-in", covers: "Single sign-on, two-factor sign-in, and roles that limit what each person sees.", ids: "PLT-01, PLT-07" },
  { name: "A record of every change", covers: "An audit trail that cannot be edited, showing who changed what and when.", ids: "PLT-16" },
  { name: "Connects to your other tools", covers: "An API, signed webhooks, and connectors to banks, payment providers and carriers.", ids: "PLT-15, AUT-03, AUT-04" },
  { name: "Automation and agents", covers: "Rules that run when something happens, and agents that act inside limits you set.", ids: "AUT-01, AGT-01, AGT-06" },
  { name: "AI you can control", covers: "Plain-language questions, forecasts and monitoring, with the data they use under your control.", ids: "AIS-01, AIS-05" },
  { name: "Get your data out", covers: "Exports and a migration path from other systems, so you are never locked in.", ids: "PLT-14" },
  { name: "Payments people actually use", covers: "Mobile money, cards, bank transfer and QR payments, reconciled automatically.", ids: "FIN-05" },
  { name: "Always on, always backed up", covers: "Backups, disaster recovery and clear uptime targets. Targets are stated in your written terms.", ids: "PLT-21, PLT-22" },
  { name: "Messages where customers are", covers: "SMS, WhatsApp, email and push notifications for invoices, reminders and orders.", ids: "PLT-10, SAL-12" },
  { name: "AI bots and automations", covers: "Small bots for follow-ups, reminders, checks and reorders. Each starts with drafts and flags, and acts only after a person approves.", ids: "AGT-01, AUT-01" },
];

export const CASES = [
  {
    slug: "cafe-three-outlets",
    name: "A three-outlet café",
    summary: "Stock is counted on paper, orders arrive on WhatsApp, and month-end takes a weekend.",
    problem: "Each outlet keeps its own count sheet. Milk and pastries expire before anyone notices, and the owner only learns the margins at month-end.",
    modules: ["Inventory with expiry dates", "Restaurant POS with kitchen screens", "Sales reports across outlets"],
    demo: "We would walk through one morning count at one outlet, a sale that drops stock at the till, and the report the owner reads on Monday.",
  },
  {
    slug: "consultancy-two-people",
    name: "A two-person consultancy",
    summary: "Invoices go out from one tool and payments are chased from another. Time is tracked in a spreadsheet.",
    problem: "Each invoice is retyped from a spreadsheet of hours. Late payers are chased by hand, and nobody knows which client is most profitable.",
    modules: ["Sales and invoicing", "Receivables aging", "General ledger", "Projects and billing by hours"],
    demo: "We would show an invoice built from logged hours, a payment that clears the receivable, and the aging list for chasing.",
  },
  {
    slug: "builders-merchant",
    name: "A builders' merchant buying from abroad",
    summary: "Supplier bills arrive in dollars while the books are kept in the local currency.",
    problem: "Each dollar bill is converted by hand at a rate nobody wrote down. Stock counts drift from the system, so orders are placed twice.",
    modules: ["General ledger with multi-currency entries", "Purchasing with goods receipts", "Inventory with reorder points"],
    demo: "We would post a dollar bill, show the local-currency amount booked at that day's rate, and reverse an entry without changing the original.",
  },
  {
    slug: "dental-clinic-two-chairs",
    name: "A dental clinic with two chairs",
    summary: "Appointments are kept in a paper diary, and invoices are sent days after treatment.",
    problem: "Two chairs, two dentists and one receptionist. Diary clashes happen weekly, and treatment is billed late because the notes are on a clipboard.",
    modules: ["Sales and invoicing", "Receivables aging", "Projects and billing by hours", "General ledger"],
    demo: "We would show a treatment logged on the day, an invoice raised from it, and the list of patients who still owe money.",
  },
  {
    slug: "school-fee-plans",
    name: "A private school with fee plans",
    summary: "Families pay in three installments, and the office chases each payment by phone.",
    problem: "Fee balances live in a spreadsheet that nobody fully trusts. Receipts are handwritten, and at term end the bursar cannot say who is owed what.",
    modules: ["Sales and invoicing", "Receivables aging", "General ledger", "Automation reminders"],
    demo: "We would show a family's fee plan, a payment that reduces the balance, and an automatic reminder before the next installment is due.",
  },
  {
    slug: "pharmacy-two-branches",
    name: "A pharmacy with two branches",
    summary: "Medicines expire on different dates in each branch, and the owner learns about losses only when the shelves are checked.",
    problem: "Each branch keeps its own stock book. Batches near expiry are found by chance, and stock moved between branches is not recorded, so the two counts never agree.",
    modules: ["Inventory with batch expiry", "Purchasing with goods receipts", "General ledger"],
    demo: "We would show a batch flagged before it expires, a transfer between branches that updates both counts, and the loss report the owner reads on Monday.",
  },
  {
    slug: "logistics-delivery-fleet",
    name: "A delivery company with a small fleet",
    summary: "Drivers record deliveries on paper, fuel is paid in cash, and nobody knows which route makes money.",
    problem: "Proof of delivery sits in a folder, fuel receipts are lost, and each route's cost is estimated at the end of the month instead of measured.",
    modules: ["Sales and invoicing with delivery notes", "Document capture for fuel receipts", "Projects and billing per route"],
    demo: "We would show a delivery closed with proof, a fuel receipt read from a photo and matched to the vehicle, and a profit view for each route.",
  },
  {
    slug: "hotel-guesthouse",
    name: "A guesthouse with twelve rooms",
    summary: "Bookings come from phone calls, messages and a notebook, and extras are added to the bill by hand at checkout.",
    problem: "Double bookings happen weekly, minibar and laundry charges are forgotten, and the bill at checkout is a guess that guests dispute.",
    modules: ["Sales and invoicing for the guest bill", "Point of sale for the bar and kitchen", "Inventory for linen and stock"],
    demo: "We would show a guest's stay with every charge added as it happens, a single bill at checkout, and the room and stock counts after the night.",
  },
  {
    slug: "school-bursary-office",
    name: "A school office with 400 families",
    summary: "Fee balances are kept in a spreadsheet, payments arrive by mobile money, and receipts are written by hand.",
    problem: "Nobody is sure which family owes what until term end. Receipts are handwritten, and reminders are sent from memory.",
    modules: ["Sales and invoicing for fee plans", "Receivables aging and reminders", "General ledger with clear receipts"],
    demo: "We would show a family's fee plan, a mobile money payment that clears the balance, and the reminder that goes out before the next installment.",
  },
];

export const PROJECTS = [
  {
    slug: "product-catalog",
    name: "Product plan",
    summary: "Every module, the order it is set up in, and what each one depends on.",
    today: "Every module is listed with its order and what it depends on, so the plan is clear.",
    proof: "The plan is kept consistent, so no module depends on something that does not exist.",
  },
  {
    slug: "general-ledger-build",
    name: "General ledger",
    summary: "Accounts, periods, balanced entries, closing, reversals and the trial balance.",
    today: "Entries must balance in their own currency and again in the base currency. Closed periods reject new entries. A repeated submission returns the stored entry instead of posting twice.",
    proof: "Books must balance, closed months stay closed, and corrections are made by reversal, never by editing.",
  },
  {
    slug: "multi-currency",
    name: "Multi-currency ledger",
    summary: "Foreign-currency entries booked in the base currency at the rate on the entry date.",
    today: "Rates are stored with the date they take effect. An entry posted today uses today's rate, and a reversal uses the original base amounts.",
    proof: "Tests check conversion to a currency with different decimal places, and that an entry which balances in its currency but not after conversion is refused.",
  },
  {
    slug: "tenant-isolation",
    name: "Data separation",
    summary: "Your business data is kept separate from every other customer's, so only your own team can see your records.",
    today: "Each business's records are kept apart, so one customer never sees another's.",
    proof: "Records are only ever shown to the business that owns them.",
  },
  {
    slug: "marketing-site",
    name: "Demos and trials",
    summary: "The public site, product and industry pages, case studies, and the demo and trial request form.",
    today: "Each request keeps the interest and the slot you chose.",
    proof: "Demo and trial requests reach us with the slot you pick, and we reply by email.",
  },
  {
    slug: "bot-crew",
    name: "The AI bot crew",
    summary: "Eight bots that handle routine work, each with one job, a short list of automations and clear limits.",
    today: "Each bot drafts and flags. Anything that changes money, stock or a customer waits for a person's approval, and every action is logged.",
    proof: "Each bot's limits are written down before it is switched on, and its activity is kept in the audit trail.",
  },
  {
    slug: "payments-and-receipts",
    name: "Mobile money and card payments",
    summary: "Payments from mobile money, cards and bank transfer are matched to invoices automatically.",
    today: "Each payment is recorded against the invoice it settles. Partial payments reduce the balance, and overpayments are held as credit.",
    proof: "A payment can only settle what it was received for, and every match is in the audit trail.",
  },
  {
    slug: "industry-packs",
    name: "Industry packs",
    summary: "Extra screens and rules for a trade, added for the customers who need them first.",
    today: "Each industry starts from the same core. A pack adds the trade's own words, forms and reports, and is chosen by the customers who need it.",
    proof: "A pack is only added after it is tested with a real business in that trade.",
  },
];

export const INDUSTRIES = [
  { slug: "restaurants", name: "Restaurants and cafés", pains: "Stock that expires, tills that stop when the internet drops, and tickets that get lost between the counter and the kitchen.", first: "Inventory and sales first, then POS and kitchen screens." },
  { slug: "clinics", name: "Clinics and dental", pains: "Appointments on paper, billing that lags behind treatment, and records that are hard to find.", first: "Ledger and invoicing first. Clinical and appointment packs come later, as an industry pack." },
  { slug: "construction", name: "Construction and trades", pains: "Estimates that miss costs, progress payments that are late, and subcontractors paid without a clear record.", first: "Ledger, purchasing and project billing first. Estimating and progress billing come as an industry pack." },
  { slug: "logistics", name: "Logistics and transport", pains: "Deliveries recorded on paper, fuel and driver costs spread across spreadsheets, and proof of delivery that is hard to find.", first: "Inventory and purchasing first. Driver app and routing come later." },
  { slug: "retail-pharmacy", name: "Retail and pharmacy", pains: "Expiry dates tracked by hand, till and stock that disagree, and prescriptions handled outside the system.", first: "Inventory and POS first. Pharmacy rules come later as an industry pack." },
  { slug: "schools", name: "Schools and training", pains: "Fees collected by hand, installment plans tracked in spreadsheets, and parents chasing receipts.", first: "Ledger and invoicing first. Student records and fee plans come as an industry pack." },
  { slug: "property", name: "Property management", pains: "Rent collected late, owner statements done by hand, and maintenance requests lost in messages.", first: "Ledger and invoicing first. Leasing and owner statements come as an industry pack." },
  { slug: "professional-services", name: "Professional services", pains: "Time logged in one place, invoices made in another, and profit per client unknown.", first: "Sales, invoicing and project billing first." },
  { slug: "agriculture", name: "Agriculture and cooperatives", pains: "Farm records on paper, input costs spread across receipts, and cooperative payouts worked out by hand.", first: "Ledger and purchasing first. Farm records and cooperative payouts come as an industry pack." },
  { slug: "hospitality", name: "Hotels and guesthouses", pains: "Bookings taken in several places, rooms cleaned late, and bills settled by hand at checkout.", first: "Sales and invoicing first. Room booking and housekeeping come as an industry pack." },
  { slug: "manufacturing", name: "Small manufacturers", pains: "Materials bought without a clear need, production runs estimated on paper, and costs found out only after the order ships.", first: "Purchasing and inventory first. Bills of materials and production planning come as an industry pack." },
];

// Go-live steps shown on the availability page, in plain words for customers.
export const PENDING = [
  { area: "Day 1", item: "A 20-minute call. We map your business, your branches and the modules you need on day one." },
  { area: "Days 2 to 5", item: "We move your customers, suppliers, items and opening balances across, and check every figure with you." },
  { area: "Week 2", item: "Your team gets a short session on the screens they use. Your bots start in draft mode, so you approve everything they do." },
  { area: "Go-live", item: "Your first live invoice, sale or pay run. We stay on hand by email and chat while you settle in." },
  { area: "Every month after", item: "Add modules, branches, users and bots as you grow. Same system, same data, no migration." },
];

// The five steps on the homepage: each one builds on the one before.
export const LEVELS = [
  { name: "The books", summary: "The ledger, exact money, tax rules, numbering that never skips, and a full change history.", items: ["General ledger", "Multi-currency", "Period close"] },
  { name: "Sell and buy", summary: "Quotes, invoices, purchase orders and goods receipts, all posting into the same books.", items: ["Sales and invoicing", "Purchasing", "Receivables and payables"] },
  { name: "Run the shop", summary: "Stock, the point of sale and projects, so the floor and the books always agree.", items: ["Inventory", "Point of sale", "Projects and field service"] },
  { name: "People and paper", summary: "Payroll for each country, leave and payslips, and bills read from a photo.", items: ["Payroll and HR", "Document capture", "Approvals"] },
  { name: "Automate and ask", summary: "AI bots, rules and an AI suite that work inside the limits you set, with every action logged.", items: ["AI agents", "Automation", "AI suite"] },
];

// Plans. Prices are in US dollars per company per month, billed monthly; annual billing gives two months free.
// Setup is a one-time fee for moving your records and training your team. It is agreed through the request form.
export const PLANS = [
  {
    name: "Free",
    monthly: "0",
    setup: "None",
    tagline: "Try the books on one company.",
    includes: ["1 company and 1 user", "General ledger and invoicing, up to 30 invoices a month", "Email support"],
    best: "Freelancers and very small shops starting out.",
  },
  {
    name: "Starter",
    monthly: "9",
    setup: "49",
    tagline: "The core for a small business.",
    includes: ["1 company and 3 users", "General ledger, sales and invoicing, purchasing and inventory", "1 AI bot", "Email support"],
    best: "Shops and service businesses that outgrew spreadsheets.",
  },
  {
    name: "Growth",
    monthly: "19",
    setup: "149",
    tagline: "Everything a growing shop runs on.",
    includes: ["3 companies and 10 users", "Everything in Starter, plus payroll for one country", "Point of sale, projects and document capture", "3 AI bots and automation rules", "Priority support"],
    best: "Businesses with a till, staff and more than one branch.",
    featured: true,
  },
  {
    name: "Business",
    monthly: "39",
    setup: "399",
    tagline: "The full system, for a business with a team.",
    includes: ["Unlimited companies and 25 users", "Every module, including the AI suite", "All 8 AI bots", "API and signed webhooks", "Dedicated onboarding and phone support"],
    best: "Established businesses with several branches and a finance team.",
  },
  {
    name: "Enterprise",
    monthly: "Custom",
    setup: "Custom",
    tagline: "For groups and larger teams.",
    includes: ["Unlimited users and companies", "Custom industry packs and integrations", "Service levels written into the contract", "Dedicated account manager"],
    best: "Groups with many entities or special compliance needs.",
  },
];
