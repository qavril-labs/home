// Company, pricing, migration, support and plain-language pages. Plain text only: no dates, prices or
// customer names that have not been confirmed. Each entry becomes one page in build-site-pages.mjs.
// Where a fact is still to be decided, the page says so and points to the availability page.

export const INFO_PAGES = [
  {
    path: "about.html",
    title: "About QAVRIL LABS",
    description: "Who builds QAVRIL LABS, the rules we design by, how the books are kept safe, and how to reach our team by email or demo call.",
    kicker: "About",
    h1: "Seven studios, one unified enterprise platform",
    lead: "QAVRIL LABS builds cloud enterprise software and AI agent systems for growing businesses. One ledger, one set of customer records, and bots that do the routine work inside limits you set.",
    sections: [
      {
        h: "Seven dedicated product studios",
        paras: [
          "Our products and AI capabilities are built by seven focused studios, all on one shared platform:",
        ],
        items: [
          "Finance & Core ERP Studio: Double-entry general ledger, gap-free invoicing, and multi-currency accounting",
          "Construction & Engineering Studio: EPC project control, work breakdown structures (WBS), and bill of quantities (BOQ)",
          "Real Estate & Property Studio: Multi-unit lease lifecycles, PDC cashiering, and maintenance work orders",
          "Retail & Restaurant POS Studio: Offline-resilient checkout, kitchen display screens, and QR ordering",
          "Automotive & Mobility Studio: Workshop job cards, vehicle identification (VIN) tracking, and parts inventory",
          "Logistics & Quick Commerce Studio: Dark store fulfillment, fleet tracking, and digital proof-of-delivery",
          "Universal AI Agent Platform (UAAP) Studio: Central model routing, stateful runtime, and our specialized bot crew",
        ],
      },
      {
        h: "The rules we design by",
        items: [
          "Money is exact to the cent: stored as whole minor units so totals always balance without floating-point drift",
          "Walled-off data: strict Row-Level Security ensures each customer's records are isolated from every other",
          "Immutable history: posted entries are never edited. Mistakes are corrected by reversals so the audit trail stays intact",
          "Human-in-the-loop AI: agents draft, forecast and flag, but an authorized person approves any mutation of money, stock, or customer state",
          "Closed months stay closed: fiscal locks prevent retroactive posting into completed accounting periods",
        ],
      },
      {
        h: "Who is behind it",
        paras: [
          "QAVRIL LABS is engineered by an enterprise software and AI systems team that has one obsession: a business owner should run the whole company from one screen, and get their evenings back.",
          "Legal entity details and registered terms are confirmed in writing before any commercial engagement.",
        ],
      },
      {
        h: "Talk to our engineering team",
        paras: [
          "Book a 20-minute architecture walkthrough to see how QAVRIL LABS runs your operations, or start free today through our booking form.",
        ],
      },
    ],
  },
  {
    path: "migration.html",
    title: "Moving from your current system",
    description: "How records move from spreadsheets, QuickBooks, Tally or another ERP into QAVRIL LABS, how fast it happens, and what we need from you.",
    kicker: "Migration",
    h1: "Moving from your current system",
    lead: "Switching systems is the part buyers worry about most. This page says how each part is set up, and what we need from you to move your records safely.",
    sections: [
      {
        h: "We do the heavy lifting",
        paras: [
          "Our team moves your customers, suppliers, items and opening balances across for you, in a guided setup, and checks every figure against your last closed statements. You do not retype a thing.",
        ],
      },
      {
        h: "What we need from you",
        items: [
          "The trial balance at the last closed month",
          "Your customer and supplier lists, with open invoices and bills",
          "Your item list with the stock count on the cut-over date",
          "The bank balance on the cut-over date",
          "Any recurring invoices or payment plans, such as school fee installments",
        ],
      },
      {
        h: "The steps",
        items: [
          "Choose a cut-over date, ideally a month-end",
          "Post opening balances once, in the ledger, and check them against your trial balance",
          "Run your old and new systems side by side for one month",
          "Sign off the figures together, then switch fully",
        ],
      },
      {
        h: "Your data on the way out",
        paras: [
          "Exports are part of the plan, so you are never locked in. The export format is confirmed in your terms.",
        ],
      },
    ],
  },
  {
    path: "support.html",
    title: "Support and onboarding",
    description: "How to reach QAVRIL LABS, when we reply, and what onboarding covers. Support terms are written down before you pay.",
    kicker: "Support",
    h1: "Support and onboarding",
    lead: "You should know how to reach us before you buy. This page lists the channels we use now and the support terms that are agreed in writing.",
    sections: [
      {
        h: "How to reach us now",
        items: [
          "Booking form: demo and trial requests, answered by email",
          "Email: the address shown on the booking page",
          "Replies: we aim to reply within a few hours, at any time of day",
        ],
      },
      {
        h: "Onboarding",
        items: [
          "A discovery call to learn how your business runs",
          "A setup session to create customers, suppliers, items and the chart of accounts",
          "A check of your opening figures before the first live invoice",
          "A short session for each team member on the screens they use",
        ],
      },
      {
        h: "Support terms",
        paras: [
          "Reach us by email and chat. Response times and escalation are written into your terms before you pay, so you know exactly what to expect.",
        ],
      },
    ],
  },
  {
    path: "what-is-erp.html",
    title: "What is an ERP?",
    description: "An ERP joins accounting, sales, stock, purchasing and payroll in one system. What it is, what it is not, and how to tell whether your business needs one.",
    kicker: "Guide",
    h1: "What is an ERP?",
    lead: "An ERP, short for enterprise resource planning, keeps the money, stock, customers, suppliers and staff records of a business in one place. A sale updates the books and the stock at the same time.",
    sections: [
      {
        h: "What it replaces",
        items: [
          "A spreadsheet for invoices, and a second tool for payments",
          "Paper stock counts that never match the shelf",
          "A bookkeeper who rebuilds the month from receipts at month-end",
          "Separate tools for payroll, orders and customer records",
        ],
      },
      {
        h: "Signs you need one",
        items: [
          "You type the same sale into more than one place",
          "Month-end takes days rather than hours",
          "You cannot say which product or client makes money",
          "Your stock count and your accounts disagree",
        ],
      },
      {
        h: "Signs you may not need one yet",
        paras: [
          "If you invoice a handful of clients a month and hold no stock, a simple accounting tool may be enough. An ERP pays off when the same facts are needed by several people.",
        ],
      },
      {
        h: "What to check when you compare",
        items: [
          "Does it handle your currency, tax and payroll rules for your country?",
          "Are posted entries reversed rather than edited?",
          "Can you export your data if you leave?",
          "Who supports you, and when?",
          "Does a demo show a real task from your business?",
        ],
      },
    ],
  },
  {
    path: "erp-for-small-business.html",
    title: "ERP for small business",
    description: "An ERP for small and medium businesses: accounting, invoicing, stock and payroll in one system, with plain-word screens and a demo on your own task.",
    kicker: "For small business",
    h1: "An ERP for small and medium businesses",
    lead: "Shops, cafés, contractors, consultancies and distributors need the same records as a large company, without a large company's staff. QAVRIL LABS starts with the ledger and invoicing, and adds the rest as it is built.",
    sections: [
      {
        h: "Who it is for",
        items: [
          "Shops and restaurants that buy and sell stock",
          "Contractors and consultancies that bill for time or visits",
          "Distributors that buy from suppliers in more than one currency",
          "Schools and training businesses that collect fees in plans",
        ],
      },
      {
        h: "Start small, add modules later",
        paras: [
          "Most small businesses start with the general ledger and sales invoicing. Purchasing, inventory and payroll follow as the business needs them. Each module shares the same customer, item and ledger records, so nothing is typed twice.",
        ],
      },
      {
        h: "A realistic first month",
        items: [
          "Week 1: agree the chart of accounts, and set up customers, suppliers and items",
          "Week 2: post the opening balances, and check them against your last closed statements",
          "Week 3: run your first invoices and payments alongside your old system",
          "Week 4: compare the two, sign off, and switch",
        ],
      },
      {
        h: "See your own data in it",
        paras: [
          "Book a demo and bring a recent invoice, a stock list or last month's report. We show you exactly how it looks inside QAVRIL LABS. Your go-live plan runs in days, not months.",
        ],
      },
    ],
  },
  {
    path: "erp-with-pos.html",
    title: "ERP with POS",
    description: "A point of sale that posts every sale into the books and the stock count, for shops, cafés and restaurants, with offline checkout.",
    kicker: "Point of sale",
    h1: "An ERP with a point of sale",
    lead: "The till is where stock leaves the shelf and money enters the books. The QAVRIL LABS point of sale does both in one step, and keeps selling when the internet drops.",
    sections: [
      {
        h: "Up and selling fast",
        paras: [
          "We set up the point of sale with you during onboarding. Book a demo to see it ring up your own products and tables.",
        ],
      },
      {
        h: "How it works",
        items: [
          "Each sale reduces the stock count and posts to the ledger in the same step",
          "Split payments, returns and receipts at the till",
          "Offline checkout that syncs when the connection returns",
          "For restaurants: tables, courses, split bills and a kitchen screen",
        ],
      },
      {
        h: "Why it matters for the books",
        paras: [
          "A sale recorded at the till is the same sale in the ledger, so the owner does not reconcile two lists at month-end.",
        ],
      },
    ],
  },
  {
    path: "security.html",
    title: "Security and data",
    description: "How QAVRIL LABS keeps each business's records separate, how changes are recorded, and which security details are confirmed in writing before you pay.",
    kicker: "Security",
    h1: "Security and data",
    lead: "Your books are only as safe as the system that holds them. Here is how QAVRIL LABS protects them, and what we confirm in writing.",
    sections: [
      {
        h: "Built into every account",
        items: [
          "Each business's records are kept separate from every other business's",
          "Money is stored exactly, so totals always add up",
          "A record of who changed what is kept, and it cannot be edited afterwards",
          "A posted entry is corrected by a reversal, never by changing the original",
        ],
      },
      {
        h: "Confirmed in writing before you pay",
        paras: [
          "The hosting region for your data, the uptime target, how quickly service is restored after a failure, how long records are kept, and how your data is exported when you leave.",
          "We do not hold any external security certification today, and we will not claim one until it is granted.",
        ],
      },
      {
        h: "Your part",
        items: [
          "Give each person only the access their role needs",
          "End access for anyone who leaves the business on the same day",
          "Tell us at once if you think an account has been used by someone else",
        ],
      },
    ],
  },
  {
    path: "who-its-not-for.html",
    title: "Who QAVRIL LABS is not for",
    description: "Honest guidance on when QAVRIL LABS is the wrong choice today, so you can pick a better fit without wasting a demo.",
    kicker: "Choosing",
    h1: "When QAVRIL LABS is not the right choice yet",
    lead: "A system that suits one business can be wrong for another. These are the cases where we would rather tell you to choose something else today.",
    sections: [
      {
        h: "You need a finished module today",
        paras: [
          "Sales, purchasing, inventory, payroll and the point of sale each have their own page. Ask on the call which ones start on day one.",
        ],
      },
      {
        h: "You run payroll in a country we do not support yet",
        paras: [
          "Payroll and statutory filings are added one country at a time, after review by a local expert. Until your country is listed, use your existing payroll provider.",
        ],
      },
      {
        h: "You need a fixed price list before you talk to anyone",
        paras: [
          "We do not publish a price list yet. If you need one before a conversation, a published-price product will suit you better for now.",
        ],
      },
      {
        h: "You have many companies to consolidate on day one",
        paras: [
          "Multi-company consolidation is part of the Enterprise plan. A group with many entities should talk to us first.",
        ],
      },
    ],
  },
  {
    path: "compare.html",
    title: "QAVRIL LABS compared with Zoho Books and Odoo",
    description: "How QAVRIL LABS compares with Zoho Books and Odoo on how they charge, what they include, and when each is the better choice. Checked 2 November 2026.",
    kicker: "Compare",
    h1: "How we compare with Zoho Books and Odoo",
    lead: "Buyers often compare us with these two products. This page describes how each one charges and what it is for. We checked the public pricing pages on 2 November 2026. Vendors change prices, so check their page before you decide. We quote no prices here.",
    sections: [
      {
        h: "Zoho Books",
        paras: [
          "Accounting and invoicing for small businesses, sold per organisation in tiers. Its public page lists a free plan with limits on invoices, bills and users, paid tiers billed monthly or annually, and a 14-day trial of paid features.",
          "Choose it if you mainly need accounting and invoicing now, and want a free plan to start with.",
        ],
      },
      {
        h: "Odoo",
        paras: [
          "A modular business system, sold per user, with a free plan for one app. Its public page says paid plans include hosting, support and maintenance, and lists what is excluded, such as hosting for custom development.",
          "Choose it if you want several modules now and have someone who can set them up.",
        ],
      },
      {
        h: "QAVRIL LABS",
        paras: [
          "The general ledger and invoicing start first, then inventory, purchasing, payroll and the point of sale. Plans and their prices are on the pricing page, and setup is agreed through the form.",
          "Choose it if you want exact multi-currency books and automation that asks a person before it changes money, stock or a customer, and you can start with the modules that are ready.",
        ],
      },
      {
        h: "Questions to ask every vendor",
        items: [
          "What is the full monthly cost for my number of users, including hosting and support?",
          "Which modules start on day one for my business?",
          "How do I export my data when I leave, and in what format?",
          "Does it handle the currency and tax rules of my country?",
          "Can I try it on one real task before I pay?",
        ],
      },
      {
        h: "Where we are not the better fit",
        paras: [
          "If you need payroll rules for a country we do not support yet, or a feature your trade needs that no module covers, read the guidance on when QAVRIL LABS is not the right choice yet.",
        ],
      },
      {
        h: "About this comparison",
        paras: [
          "QAVRIL LABS is not affiliated with Zoho or Odoo. Their names are trademarks of their owners and are used here only to identify them.",
        ],
      },
    ],
  },
];
