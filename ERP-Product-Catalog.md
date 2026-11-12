# ERP Product Catalog

Master list of every product needed to build a complete ERP for small and medium businesses, with the integration rules, build order, and phase for each. Intended as the spec backlog for Claude Code.

## How to read this

- **ID**: family prefix plus number. Use IDs in commit messages, specs, and issues.
- **Size**: relative effort for a small team using Claude Code. S = under 2 weeks, M = 2–6 weeks, L = 2–4 months, XL = 4+ months, plus per-country work. These are planning estimates; recalibrate after the first module ships.
- **Phase**: P0 Foundation, P1 Core (minimum viable ERP), P2 Operations, P3 Advanced and industry packs, P4 Ecosystem. The first niche you pick moves its industry packs earlier.
- **Depends on**: products that must exist first. Items in the shared kernel are used by everything.

## Architecture rules for Claude Code

1. **Modular monolith first.** Each product is a module with its own folder, API, UI, tests, and migrations. Split into services only when a module needs independent scaling.
2. **Shared kernel.** Master data used by every module lives in one place: legal entity, branch, party, item, unit of measure, currency, chart of accounts, tax codes, document sequences, users and roles.
3. **Events, not direct writes.** Modules communicate through domain events published via a transactional outbox. No module writes to another module's tables.
4. **Accounting is the sink.** Every money or stock movement emits an event that the posting engine turns into journal entries. Build FIN-01 (General Ledger) before any transactional module posts.
5. **Country and industry differences are data.** Tax rates, payroll rules, e-invoicing connectors, and chart-of-accounts templates are configuration packs, not forks of the code.
6. **Tenant isolation.** Every row carries a tenant ID, enforced with PostgreSQL row-level security. The Neon MCP server is connected in this environment, so Postgres is the natural database.
7. **Definition of done for every module:** permissions, audit trail, import and export, reports, translatable strings, mobile-responsive UI, API documentation, and automated tests including accounting-balance tests where money moves.
8. **Money handling.** Store amounts as integers in minor units with an explicit currency code. Never use floats. Ledger entries are immutable; corrections are made by reversal.
9. **Idempotency.** Every write API and webhook accepts an idempotency key.

---

## Phase 0: Platform foundation

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| PLT-01 | Identity & Access | SSO (SAML/OIDC), MFA, roles, permissions, delegated admin | M | P0 | — |
| PLT-02 | Tenancy & Organization | Tenants, companies, legal entities, branches, subscriptions | L | P0 | PLT-01 |
| PLT-03 | Localization | Languages, right-to-left layouts, date/number/currency formats, translation workflow | M | P0 | — |
| PLT-04 | Tax & Country Rules Engine | Tax rules as data, rates with effective dates, rounding, reverse charge | L | P0 | PLT-02 |
| PLT-05 | Multi-currency & FX | Rate tables, realized and unrealized gains, revaluation hooks | S | P0 | PLT-02 |
| PLT-06 | Events, Posting & Jobs | Transactional outbox, event bus, retries, idempotency, background jobs, scheduler | L | P0 | — |
| PLT-07 | Workflow & Approvals | Configurable approval chains, thresholds, delegation, reminders | M | P0 | PLT-01 |
| PLT-08 | Document Numbering | Per-document, per-branch sequences, prefixes, reset rules, gap policy | S | P0 | PLT-02 |
| PLT-09 | Custom Fields & Layouts | Tenant-defined fields and form layouts without code | L | P0 | PLT-02 |
| PLT-10 | Notifications | Email, SMS, WhatsApp, push, in-app; templates; delivery tracking | M | P0 | PLT-06 |
| PLT-11 | Documents & Files | Attachments, versioning, retention rules, e-signature | M | P0 | PLT-01 |
| PLT-12 | Print & PDF Engine | Invoices, labels, barcodes, QR codes, thermal receipt printing | M | P0 | PLT-08 |
| PLT-13 | Reporting & BI Engine | Report builder, dashboards, scheduled and exported reports | L | P0 | PLT-06 |
| PLT-14 | Import, Export & Migration | Validated CSV and Excel import; migrators from QuickBooks, Xero, Tally, Zoho, Odoo | M | P0 | PLT-02 |
| PLT-15 | Integration Hub | API gateway, API keys, webhooks, rate limits, connector framework | L | P0 | PLT-06 |
| PLT-16 | Audit Trail | Field-level change history, immutable log, who-did-what views | S | P0 | PLT-01 |
| PLT-17 | Global Search | Search across modules with permissions applied | S | P0 | PLT-01 |
| PLT-18 | Feature & Module Licensing | Turn modules on or off per plan and per country | S | P0 | PLT-02 |
| PLT-19 | Mobile & Offline Shell | PWA or React Native base, offline queue, sync conflict handling | L | P0 | PLT-01 |
| PLT-20 | SaaS Billing (for you) | Your customers' subscriptions, invoices, dunning, payments | M | P0 | PLT-18 |
| PLT-21 | Security & Data Residency | Encryption at rest and in transit, region pinning, retention, backups, disaster recovery | M | P0 | PLT-02 |
| PLT-22 | Observability & Support Console | Logs, metrics, error tracking, admin console, support access with customer consent | M | P0 | — |
| PLT-23 | Onboarding & Help | Setup wizard, sample data, in-app guidance, help center | M | P0 | PLT-18 |

## Shared master data

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| MDM-01 | Party Master | Customers, suppliers, employees, and partners as one party model; deduplication, merge, tax IDs | M | P1 | PLT-02, PLT-04 |
| MDM-02 | Item Master | Items, variants, units of measure and conversions, barcodes, attributes, pricing groups | M | P1 | PLT-02 |
| MDM-03 | Chart of Accounts | Country and industry templates, account types, report mapping | S | P1 | PLT-02 |
| MDM-04 | Price Lists & Discounts | Price tiers, customer-specific prices, promotions; shared by sales, POS, and eCommerce | M | P1 | MDM-02 |
| MDM-05 | Fiscal & Working Calendars | Fiscal years, periods, working days, holidays | S | P1 | PLT-02 |

## Finance

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| FIN-01 | General Ledger | Double-entry journals, periods, opening balances, period locks, reversals | L | P1 | MDM-03, PLT-05 |
| FIN-02 | Accounts Receivable | Customer invoices and receipts, allocations, credit notes, aging | M | P1 | FIN-01, SAL-04 |
| FIN-03 | Accounts Payable | Vendor bills, three-way match, payment runs, withholding, aging | M | P1 | FIN-01, PRC-04 |
| FIN-04 | Bank & Cash | Bank accounts, statement import (file, API, open banking), reconciliation rules | M | P1 | FIN-01 |
| FIN-05 | Payments Hub | Connectors for cards, mobile money, bank transfer, QR, wallets; refunds; settlement | L | P1 | PLT-06, PLT-15 |
| FIN-06 | Tax Returns & Filing | VAT, GST, and sales tax returns; withholding; country tax reports | L | P1 | PLT-04, FIN-01 |
| FIN-07 | E-Invoicing & Tax Clearance | Country connectors for clearance, reporting, signed invoices, QR codes (one per market) | L | P1 | SAL-04, PLT-04 |
| FIN-08 | Dimensions & Cost Centers | Analytical accounting: cost centers, projects, branches, and departments as dimensions | S | P1 | FIN-01 |
| FIN-09 | Financial Statements | P&L, balance sheet, cash flow, comparatives, drill-down, multi-branch | M | P1 | FIN-01, FIN-08 |
| FIN-10 | Fixed Assets | Asset register, depreciation methods, disposal, impairment | M | P2 | FIN-01 |
| FIN-11 | Expense Claims | Receipt capture, policies, approvals, reimbursement by payment or payroll | M | P2 | FIN-03, PLT-07 |
| FIN-12 | Budgeting & Forecasting | Budgets by dimension, versions, variance reports, rolling forecasts | M | P2 | FIN-08 |
| FIN-13 | Period Close | Close checklists, accruals, recurring entries, revaluation, lock dates | M | P2 | FIN-01 |
| FIN-14 | Credit & Collections | Credit limits, dunning sequences, promises to pay, collection notes | M | P2 | FIN-02 |
| FIN-15 | Cost Accounting | Standard, actual, FIFO, and weighted-average costing; WIP; cost roll-ups | L | P2 | INV-06, FIN-01 |
| FIN-16 | Consolidation & Intercompany | Multi-entity consolidation, eliminations, intercompany invoices | L | P3 | FIN-09 |
| FIN-17 | Treasury & Loans | Loan schedules, interest accruals, cash forecasting, covenant tracking | M | P3 | FIN-04 |
| FIN-18 | Statutory & Audit Packs | Statutory statements per country, audit file export, trial balance packs | M | P3 | FIN-09 |
| FIN-19 | Accountant Workspace | Multi-client access for accounting firms, client-level permissions, bulk journals | M | P3 | FIN-01, PLT-01 |

## Sales and CRM

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| SAL-01 | CRM Pipeline | Leads, opportunities, stages, activities, sales forecast | M | P1 | MDM-01 |
| SAL-02 | Quotes & CPQ | Quote templates, configurable products, approvals, e-sign acceptance | M | P1 | SAL-01, MDM-04 |
| SAL-03 | Sales Orders | Order entry, stock reservation, partial deliveries, backorders | M | P1 | SAL-02, INV-01, MDM-02 |
| SAL-04 | Invoicing | Direct and order-based invoices, taxes, discounts, recurring templates | M | P1 | MDM-01, MDM-04, PLT-04 |
| SAL-05 | Returns & Credit Notes | Return authorizations, restocking, refunds, credit allocation | S | P1 | SAL-04, INV-02 |
| SAL-06 | Subscriptions & Recurring Billing | Plans, proration, renewals, usage billing, dunning | L | P2 | SAL-04, FIN-14 |
| SAL-07 | Commissions & Incentives | Commission plans, targets, accruals, payout statements | M | P2 | SAL-01, PLT-07 |
| SAL-08 | Sales Forecasting & Targets | Territory and rep targets, forecast roll-ups | S | P2 | SAL-01 |
| SAL-09 | Customer Portal | Invoices, payments, orders, documents, support tickets | M | P2 | SAL-04, PLT-11 |
| SAL-10 | Field Sales App | Routes, visits, GPS check-in, offline order capture | M | P2 | SAL-03, PLT-19 |
| SAL-11 | Helpdesk & Ticketing | Queues, SLAs, escalation rules, macros, satisfaction scores | M | P2 | PLT-07 |
| SAL-12 | Omnichannel Inbox | WhatsApp, email, web chat, and social messages in one inbox; bot handoff | L | P2 | PLT-10, SAL-11 |
| SAL-13 | Knowledge Base | Articles, search, self-service deflection | S | P3 | SAL-11 |
| SAL-14 | Marketing Automation | Segments, campaigns, drip flows across email, SMS, and WhatsApp | L | P3 | PLT-10, MDM-01 |
| SAL-15 | Loyalty & Rewards | Points, tiers, rewards, referral codes | M | P3 | MDM-01, ECM-05 |
| SAL-16 | Surveys & NPS | Post-transaction surveys, scores, follow-up tasks | S | P3 | SAL-11 |
| SAL-17 | Partner & Reseller Management | Partner portal, deal registration, commission statements | M | P3 | SAL-07 |

## Procurement

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| PRC-01 | Supplier Management | Onboarding, KYC documents, categories, approvals, blocking | M | P1 | MDM-01 |
| PRC-02 | Purchase Requisitions | Request, approve, convert to purchase order | S | P1 | PLT-07 |
| PRC-03 | Purchase Orders | PO creation, approval, revisions, supplier acknowledgment | M | P1 | PRC-01, MDM-02 |
| PRC-04 | Goods Receipt | Receive against PO, partial receipts, quality hand-off | S | P1 | PRC-03, INV-02 |
| PRC-05 | Vendor Returns & Debit Notes | Return to supplier, debit notes, stock adjustment | S | P1 | PRC-04 |
| PRC-06 | RFQ & Tendering | Vendor invitations, bid comparison, award | M | P2 | PRC-03 |
| PRC-07 | Supplier Portal | PO acknowledgment, shipping notices, invoice upload, payment status | M | P2 | PRC-03, PLT-11 |
| PRC-08 | Contract Management | Rate contracts, validity periods, renewals, alerts | M | P2 | PRC-01 |
| PRC-09 | Landed Cost | Freight, duties, and insurance allocated to receipts | M | P2 | PRC-04, FIN-15 |
| PRC-10 | Punch-out Catalogs | Connect to supplier catalogs | M | P3 | PRC-03 |
| PRC-11 | Spend Analytics | Spend by category, supplier, and branch; savings tracking | S | P3 | FIN-09 |

## Inventory and warehouse

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| INV-01 | Stock Ledger & Locations | Multi-warehouse stock, locations, valuation layers | L | P1 | MDM-02 |
| INV-02 | Stock Movements | Receipts, issues, transfers in transit, adjustments with reason codes | M | P1 | INV-01 |
| INV-03 | Lot, Serial & Expiry | Lot, serial, and batch tracking; expiry dates; FEFO picking | M | P1 | INV-01 |
| INV-04 | Barcode & Mobile Scanning | Scan receiving, picking, counting, and labeling from phones | M | P1 | INV-02, PLT-19 |
| INV-05 | Replenishment | Reorder points, min and max levels, suggested purchase orders, safety stock | S | P1 | INV-01, PRC-03 |
| INV-06 | Stock Valuation | FIFO, average cost, standard cost; posting to the general ledger | M | P1 | INV-02, FIN-01 |
| INV-07 | Bin Locations & Put-away | Bin structure, put-away rules, capacity limits | M | P2 | INV-01 |
| INV-08 | Warehouse Management | Wave picking, pick paths, packing, dispatch, returns processing | L | P2 | INV-07, SAL-03 |
| INV-09 | Cycle Counting & Stock Take | Count plans, blind counts, variance approval | S | P2 | INV-04 |
| INV-10 | Quarantine & Quality Holds | Hold stock pending inspection or return | S | P2 | INV-02, MFG-06 |
| INV-11 | Consignment & Dropshipping | Stock held at customer sites; dropship orders sent to suppliers | M | P3 | SAL-03, PRC-03 |
| INV-12 | Inventory Optimization | ABC and XYZ classes, safety stock, slow-moving alerts | S | P3 | INV-05 |

## Manufacturing

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| MFG-01 | Bill of Materials | Multi-level BOMs, versions, substitutes, co-products, by-products | M | P2 | MDM-02 |
| MFG-02 | Routings & Work Centers | Operations, machines, labor, setup and run times, cost rates | M | P2 | MFG-01 |
| MFG-03 | Production Orders | Plan, release, issue materials, complete, backflush | M | P2 | MFG-01, INV-02 |
| MFG-04 | Shop Floor App | Operator tablet: start and stop jobs, output, scrap, downtime | M | P2 | MFG-03, PLT-19 |
| MFG-05 | MRP | Material requirements from demand, lead times, action messages | L | P2 | MFG-01, SAL-03, PRC-03 |
| MFG-06 | Quality Management | Inspection plans, sampling, certificates of analysis, nonconformance, corrective actions | L | P2 | INV-02 |
| MFG-07 | Engineering Change Control | Change requests, approvals, BOM versioning, effectivity dates | M | P3 | MFG-01, PLT-07 |
| MFG-08 | Process & Recipe Manufacturing | Formulas, yields, batch records, by-product allocation | L | P3 | MFG-01 |
| MFG-09 | Finite Capacity Scheduling | Gantt scheduling, constraints, drag-and-drop rescheduling | L | P3 | MFG-02, MFG-05 |
| MFG-10 | Subcontracting | Ship materials out, receive finished goods, service charges | M | P3 | MFG-03, PRC-03 |
| MFG-11 | Maintenance (CMMS) | Preventive schedules, work requests, asset history, spare parts | L | P3 | PSA-08, INV-02 |
| MFG-12 | Food Safety & Traceability | HACCP plans, batch genealogy, recalls, temperature logs | L | P3 | INV-03 |

## Planning

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| PLN-01 | Demand Forecasting | Statistical forecasts with manual overrides; seasonality | M | P3 | SAL-04 |
| PLN-02 | Sales & Operations Planning | Consensus planning across sales, operations, and finance | M | P3 | PLN-01, MFG-05, FIN-12 |
| PLN-03 | Master Production Schedule | Schedule finished goods; capacity checks | M | P3 | MFG-05 |
| PLN-04 | Distribution Requirements Planning | Multi-warehouse replenishment and transfers | M | P3 | INV-05 |
| PLN-05 | Scenario Planning | What-if simulations for demand, capacity, and cost | M | P4 | PLN-02 |

## Logistics and fleet

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| LOG-01 | Shipping & Carriers | Rate comparison, labels, tracking, carrier APIs | M | P2 | INV-08 |
| LOG-02 | Driver App | Route list, navigation, proof of delivery (signature, photo, one-time code), offline mode | M | P2 | PLT-19 |
| LOG-03 | Route Planning & Dispatch | Route optimization, dispatch board, time windows | L | P3 | LOG-02 |
| LOG-04 | Live Tracking | GPS feeds, geofences, ETA, customer tracking links | M | P3 | LOG-02 |
| LOG-05 | Fleet Management | Vehicles, fuel logs, maintenance, documents, driver licenses | M | P3 | MDM-01 |
| LOG-06 | Freight Cost Allocation | Freight invoices matched to shipments and customers | S | P3 | LOG-01, FIN-03 |
| LOG-07 | Customs & Trade Documents | Tariff codes, commercial invoices, packing lists, bills of lading | L | P3 | SAL-04 |
| LOG-08 | Cross-docking & Hubs | Inbound-to-outbound flow through hubs | M | P4 | INV-08 |
| LOG-09 | 3PL Billing | Client storage and handling charges; client portals | M | P4 | INV-08, SAL-04 |
| LOG-10 | Weighbridge & Ticketing | Gross and tare weights, weighing tickets, invoicing per load | S | P3 | SAL-04 |

## HR and payroll

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| HRM-01 | Employee Records | Profiles, documents, employment history, org chart | M | P2 | MDM-01 |
| HRM-02 | Org Structure & Positions | Departments, positions, reporting lines, cost centers | S | P2 | HRM-01, FIN-08 |
| HRM-03 | Attendance & Time | Clock in and out, geofencing, biometric devices, shifts, overtime rules | M | P2 | HRM-01 |
| HRM-04 | Leave Management | Leave types, accruals, carry-forward, approvals | S | P2 | HRM-01, PLT-07 |
| HRM-05 | Payroll Engine | Earnings, deductions, allowances, payslips, bank payment files (one ruleset per country) | XL | P2 | HRM-03, HRM-01, FIN-01, PLT-04 |
| HRM-06 | Statutory Filings | Social security, pensions, income tax, labor reports (one pack per country) | L | P2 | HRM-05 |
| HRM-07 | Employee Self-Service | Payslips, leave requests, attendance corrections, documents on web and mobile | M | P2 | HRM-04, PLT-19 |
| HRM-08 | Workforce Scheduling | Shift rotas, skill-based scheduling, labor cost forecasts | M | P2 | HRM-03 |
| HRM-09 | Recruitment (ATS) | Job posts, candidate pipeline, interviews, offers | M | P3 | HRM-01 |
| HRM-10 | Onboarding & Offboarding | Checklists, equipment assignment, access revocation | S | P3 | HRM-01, PLT-07 |
| HRM-11 | Performance Management | Goals, OKRs, review cycles, 360 feedback | M | P3 | HRM-01 |
| HRM-12 | Learning Management | Courses, certifications, compliance training with expiry tracking | L | P3 | HRM-01 |
| HRM-13 | Compensation & Benefits | Pay bands, benefit enrollment, salary reviews | M | P3 | HRM-05 |
| HRM-14 | Compliance Expiries | Work permits, licenses, certificate expiry alerts | S | P2 | HRM-01, PLT-10 |
| HRM-15 | Engagement Surveys | Pulse surveys, anonymous feedback, eNPS | S | P4 | HRM-01 |

## Projects and field service

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| PSA-01 | Project Management | Projects, tasks, milestones, dependencies, Gantt view, budgets | M | P2 | MDM-01 |
| PSA-02 | Timesheets | Time entry on web and mobile, approvals, billable flags | S | P2 | HRM-01, PSA-01 |
| PSA-03 | Project Billing | Time and materials, fixed fee, milestone, and retainer billing | M | P2 | PSA-02, SAL-04 |
| PSA-04 | Resource Planning | Skills, capacity, utilization, bench reports | M | P3 | PSA-01, HRM-01 |
| PSA-05 | Project Profitability | Cost against revenue per project, margin alerts, WIP | M | P3 | PSA-03, FIN-15 |
| PSA-06 | Field Service Management | Dispatch, technician app, work orders, parts used, invoicing | L | P3 | PSA-08, SAL-04, INV-02 |
| PSA-07 | Service Contracts & Warranties | Coverage rules, service-level agreements, entitlement checks, renewals | M | P3 | SAL-04, PSA-08 |
| PSA-08 | Asset Registry | Installed base, serial numbers, locations, service history, QR tags | M | P3 | MDM-02, MDM-01 |
| PSA-09 | Construction Estimating & Bill of Quantities | Quantity takeoffs, rate libraries, estimates converted to budgets | L | P3 | MDM-02 |
| PSA-10 | Change Orders | Scope changes, approvals, cost and schedule impact | M | P3 | PSA-01, PLT-07 |
| PSA-11 | Progress Billing & Retention | Milestone certificates, retention holds, progress invoices | M | P3 | PSA-03, FIN-02 |
| PSA-12 | Site Management | Daily logs, photos, safety checklists, manpower and equipment logs | M | P3 | PSA-01, PLT-11 |
| PSA-13 | Subcontractor Management | Subcontract agreements, progress claims, payments | M | P3 | PRC-03, FIN-03 |
| PSA-14 | Equipment Rental | Booking calendar, availability, deposits, return inspections | M | P4 | PSA-08, SAL-04 |

## Retail, POS and restaurants

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| POS-01 | Retail POS | Fast checkout, barcode scanning, split payments, offline mode, returns | L | P2 | INV-01, FIN-05, MDM-04 |
| POS-02 | Shift & Cash Management | Cash drawers, shift open and close, cash-up, variance reports | S | P2 | POS-01 |
| POS-03 | Restaurant POS | Tables, courses, split bills, modifiers, tips | L | P2 | POS-01 |
| POS-04 | Kitchen Display & Printing | Kitchen displays, station routing, ticket timers | M | P2 | POS-03 |
| POS-05 | QR Ordering & Digital Menu | Table QR ordering, menu management, pay at table | M | P2 | POS-03, FIN-05 |
| POS-06 | Delivery Platform Integration | Connectors for delivery platforms; menu sync; order injection (per market) | L | P3 | POS-03 |
| POS-07 | Gift Cards & Store Credit | Issue, redeem, balances, expiry rules | S | P3 | POS-01, FIN-02 |
| POS-08 | Pharmacy POS | Drug schedules, batches, expiry, prescriptions, insurance billing | L | P3 | POS-01, INV-03 |
| POS-09 | Omnichannel Inventory Sync | Stock shared across stores and online channels | M | P3 | INV-01, ECM-02 |
| POS-10 | Electronic Shelf Labels | Price label sync with hardware | S | P4 | MDM-04 |

## eCommerce and marketplaces

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| ECM-01 | Storefront Builder | Themes, pages, search engine optimization, multi-language, multi-currency | L | P3 | MDM-04 |
| ECM-02 | Catalog & Search | Variants, faceted search, product content | M | P3 | MDM-02 |
| ECM-03 | Cart & Checkout | Guest and account checkout, tax and shipping rules, local payment methods | M | P3 | FIN-05, LOG-01 |
| ECM-04 | Customer Accounts | Accounts, addresses, wishlists, order history | S | P3 | ECM-01 |
| ECM-05 | Promotions & Coupons | Coupons, bundles, buy-X-get-Y rules engine | M | P3 | MDM-04 |
| ECM-06 | Reviews & Questions | Moderation, verified-purchase badges | S | P4 | ECM-02 |
| ECM-07 | Marketplace Connectors | Two-way sync with marketplaces and storefront platforms (one per platform) | L | P3 | ECM-02, INV-01 |
| ECM-08 | Headless Commerce API & SDK | Public APIs and SDKs for custom storefronts | M | P4 | ECM-03 |
| ECM-09 | Mobile Shopping App Builder | White-label app generation | L | P4 | ECM-08 |

## AI and automation

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| AI-01 | Document Capture (OCR) | Invoices, receipts, and shipping documents converted to structured data, with human review | M | P2 | PLT-11 |
| AI-02 | Bank Transaction Categorization | Suggested accounts and matches, learned per tenant | M | P2 | FIN-04 |
| AI-03 | Natural-Language Assistant | Ask questions of your data, generate reports, draft emails | M | P3 | PLT-13 |
| AI-04 | Anomaly & Fraud Detection | Duplicate payments, unusual discounts, expense outliers | M | P3 | FIN-03, SAL-04 |
| AI-05 | Smart Replies & Support Bot | Draft replies, suggest knowledge base articles, deflect tickets | S | P3 | SAL-11, SAL-13 |
| AI-06 | Advanced Forecasting | Machine-learning models for demand, cash, and churn | M | P3 | PLN-01 |
| AI-07 | Workflow Automation Builder | No-code triggers and actions across modules | L | P3 | PLT-06 |
| AI-08 | Document Generation | Contracts, proposals, and letters from templates filled with data | S | P3 | PLT-11 |
| AI-09 | Conversational Operations | Ask, record and approve through chat and WhatsApp; every action uses the same permissions, approvals and audit trail as the screens | L | P3 | AI-03, SAL-12, PLT-07 |

---

## Industry packs

Each pack sits on top of the core modules. Build a pack only after the core modules it depends on are stable.

### Healthcare

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| HC-01 | Patient Records (lite EMR) | Demographics, history, allergies, consent, documents | L | P3 | MDM-01 |
| HC-02 | Appointments & Reminders | Doctors, rooms, schedules, SMS and WhatsApp reminders | M | P3 | HRM-01, PLT-10 |
| HC-03 | Clinical Notes & e-Prescriptions | Note templates, prescriptions, referrals | M | P3 | HC-01 |
| HC-04 | Laboratory (LIS) | Orders, specimens, results, instrument interfaces, reference ranges | L | P3 | HC-01, INV-03 |
| HC-05 | Imaging Links | Study orders, viewer links, report attachments | M | P4 | HC-01 |
| HC-06 | Hospital Pharmacy & Dispensing | Ward stock, dispensing, controlled-drug logs | M | P3 | POS-08, INV-03 |
| HC-07 | Insurance Claims & Revenue Cycle | Claim preparation, submission, remittance, denial management | L | P3 | FIN-02, HC-01 |
| HC-08 | Telemedicine | Video consultations, payment, notes | M | P4 | HC-02 |
| HC-09 | Dental Charting | Odontogram, procedures, treatment plans | M | P3 | HC-01 |
| HC-10 | Veterinary | Animal patients, owners, vaccinations, procedures | M | P3 | HC-01 |
| HC-11 | Optical | Prescriptions, lens orders, frame inventory | S | P3 | INV-03, HC-01 |
| HC-12 | Interoperability | HL7 FHIR APIs; ICD-10, SNOMED, and LOINC code sets | L | P4 | HC-01 |

### Hospitality

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| HO-01 | Hotel PMS | Reservations, room plan, check-in and out, guest folio, night audit | L | P3 | SAL-04, FIN-02 |
| HO-02 | Channel Manager | Two-way sync with booking platforms | L | P3 | HO-01 |
| HO-03 | Housekeeping & Maintenance | Room status, cleaning tasks, maintenance work orders | S | P3 | HO-01 |
| HO-04 | Guest CRM & Loyalty | Guest profiles, preferences, repeat-stay tracking | S | P3 | MDM-01 |
| HO-05 | Events & Banquets | Event bookings, catering orders, function sheets | M | P3 | HO-01, POS-03 |
| HO-06 | Guesthouse Lite Mode | Simplified property mode for small guesthouses and hostels | S | P3 | HO-01 |

### Education

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| ED-01 | Student Information System | Student profiles, guardians, enrollment, records | L | P3 | MDM-01 |
| ED-02 | Admissions | Application forms, documents, decisions, enrollment fees | M | P3 | ED-01, FIN-02 |
| ED-03 | Attendance | Daily and per-period attendance, absences, parent alerts | S | P3 | ED-01, PLT-10 |
| ED-04 | Timetabling | Classes, teachers, rooms, constraint solver | L | P3 | ED-01, HRM-01 |
| ED-05 | Gradebook & Report Cards | Assessments, grading scales, report templates | M | P3 | ED-01 |
| ED-06 | Fees & Installments | Fee structures, invoices, scholarships, reminders | M | P3 | ED-01, FIN-02 |
| ED-07 | Parent & Student Portal | Results, fees, attendance, messaging; web and mobile | M | P3 | ED-01, PLT-19 |
| ED-08 | Learning Management | Courses, assignments, quizzes, video content | L | P3 | ED-01 |
| ED-09 | School Transport | Routes, bus rosters, pick-up alerts | S | P3 | LOG-02 |
| ED-10 | Library | Catalog, circulation, fines | S | P3 | ED-01 |
| ED-11 | Boarding & Hostel | Rooms, allocations, meals | S | P3 | ED-01 |
| ED-12 | Alumni | Alumni directory, donations, events | S | P4 | ED-01 |

### Real estate and property

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| RE-01 | Property & Unit Inventory | Buildings, units, amenities, owners, documents | M | P3 | MDM-01 |
| RE-02 | Leasing & Tenancy | Leases, deposits, renewals, rent escalations | M | P3 | RE-01, SAL-04 |
| RE-03 | Rent Collection & Owner Statements | Recurring invoices, payment, owner payouts | M | P3 | RE-02, FIN-02 |
| RE-04 | Tenant Portal & Maintenance Requests | Requests with photos, vendor dispatch | S | P3 | RE-02, PSA-06 |
| RE-05 | Off-Plan Sales Pipeline | Unit reservations, payment plans, construction milestones | M | P3 | SAL-01, RE-01 |
| RE-06 | Community & Association Management | Levies, assessments, meetings, notices | M | P3 | RE-03 |
| RE-07 | Brokerage CRM & Listing Syndication | Listings, leads, property portal sync | M | P3 | SAL-01, RE-01 |
| RE-08 | Valuation Support | Comparable sales, valuation reports | M | P4 | RE-01 |

### Agriculture

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| AG-01 | Farm & Field Management | Plots with boundaries, seasons, crop plans | M | P3 | MDM-02 |
| AG-02 | Input & Spray Logs | Seed, fertilizer, chemical application records; withholding periods | M | P3 | AG-01, INV-03 |
| AG-03 | Harvest & Yield | Harvest logs, grading, yield per plot | M | P3 | AG-01, INV-02 |
| AG-04 | Livestock | Herd records, health, breeding, feed | M | P3 | MDM-02 |
| AG-05 | Traceability & Certification | Lot-to-field traceability; audit documents for certification schemes | M | P3 | AG-03, INV-03 |
| AG-06 | Cooperative Management | Members, shares, produce collection, payouts, dividends | L | P3 | MDM-01, FIN-03, AG-03 |
| AG-07 | Weather & Sensors | Sensor data ingestion, alerts, weather feeds | M | P4 | AG-01 |
| AG-08 | Agri-Finance & Insurance | Loan applications, crop insurance connectors | M | P4 | AG-03, FIN-17 |

### Automotive

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| AU-01 | Garage Management | Job cards, inspections, estimates, approvals, invoicing | M | P3 | SAL-04, INV-02 |
| AU-02 | Parts Catalog & VIN Lookup | Parts by vehicle, cross-references, supplier pricing | M | P3 | MDM-02 |
| AU-03 | Service History & Reminders | Service records, recall alerts, reminders | S | P3 | AU-01, PLT-10 |
| AU-04 | Dealer Management | Vehicle stock, sales deals, finance and insurance, trade-ins | L | P4 | AU-01, SAL-02 |
| AU-05 | Warranty Claims | Claims to manufacturers, labor rates, returned parts | M | P3 | AU-01 |

### Legal

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| LG-01 | Matter & Case Management | Matters, parties, deadlines, documents, status | M | P3 | MDM-01 |
| LG-02 | Legal Time & Billing | Time capture, rates, invoices, write-offs | M | P3 | PSA-02, SAL-04 |
| LG-03 | Trust Accounting | Client trust ledgers, three-way reconciliation | M | P3 | FIN-04 |
| LG-04 | Document Assembly | Templates, clause libraries, merge fields | S | P3 | PLT-11 |
| LG-05 | Court Calendar & Deadlines | Jurisdiction-specific deadline rules | S | P3 | LG-01 |
| LG-06 | Conflict Checks | Searchable parties database with conflict alerts | S | P3 | MDM-01 |
| LG-07 | E-Filing Connectors | Court filing integrations per jurisdiction | M | P4 | LG-01 |

### Accounting firms (channel product)

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| AC-01 | Practice Management | Client list, engagements, staff allocation, deadlines | M | P3 | MDM-01, PSA-02 |
| AC-02 | Client Portal & Document Collection | Document requests, reminders, uploads | M | P3 | PLT-11 |
| AC-03 | Tax Return Workflow | Checklists, review queues, sign-off | M | P3 | AC-01, PLT-07 |
| AC-04 | Payroll Bureau | Run payroll for multiple clients | L | P3 | HRM-05 |
| AC-05 | Firm Billing & WIP | Firm billing with work-in-progress tracking | M | P3 | PSA-03 |

### Non-profit

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| NP-01 | Donor CRM & Giving | Donors, pledges, online giving, recurring donations, receipts | M | P3 | MDM-01, FIN-05 |
| NP-02 | Grants Management | Applications, budgets, milestones, reporting deadlines | M | P3 | PSA-01 |
| NP-03 | Fund Accounting | Restricted and unrestricted funds; grant reporting | M | P3 | FIN-08 |
| NP-04 | Volunteer Management | Shifts, skills, hours | S | P3 | MDM-01 |
| NP-05 | Beneficiary & Impact Tracking | Program enrollments, outcomes, indicators | M | P3 | MDM-01 |

### Fitness and wellness

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| FW-01 | Memberships & Subscriptions | Plans, freezes, renewals, dunning | M | P3 | SAL-06 |
| FW-02 | Class Booking | Schedules, waitlists, check-in | S | P3 | MDM-01 |
| FW-03 | Access Control Integration | Turnstiles, card readers, mobile passes | M | P4 | FW-01 |
| FW-04 | Trainer Scheduling & Payouts | Trainer schedules, pay per session | S | P3 | HRM-03 |

### Beauty and salons

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| BS-01 | Appointments & Reminders | Staff calendars, bookings, SMS and WhatsApp reminders | M | P3 | MDM-01, PLT-10 |
| BS-02 | Staff Commissions & Tips | Commission rules, tip pools | S | P3 | POS-01 |
| BS-03 | Client Records & Treatment Notes | Client history, forms, before-and-after photos | S | P3 | MDM-01 |
| BS-04 | Packages | Prepaid packages and session tracking | S | P3 | SAL-06 |

### Microfinance and SACCOs

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| MF-01 | Member & Group Management | Members, groups, KYC, share capital | M | P3 | MDM-01 |
| MF-02 | Savings & Deposits | Savings accounts, deposits, withdrawals, interest | M | P3 | FIN-01 |
| MF-03 | Loan Origination & Repayment | Loan products, schedules, guarantors, arrears | L | P3 | MF-01, FIN-01 |
| MF-04 | Field Officer App | Collections, visits, offline cash receipts | M | P3 | PLT-19 |
| MF-05 | Mobile Money Integration | Disbursements and repayments through mobile wallets | M | P3 | FIN-05 |
| MF-06 | Regulatory Reporting | Central bank returns (one pack per country) | L | P3 | FIN-01 |

### Utilities and municipal

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| UT-01 | Utility Billing | Accounts, meters, tariffs, bills | L | P3 | MDM-01 |
| UT-02 | Meter Reading App | Mobile readings, photos, anomaly flags | M | P3 | UT-01, PLT-19 |
| UT-03 | Citizen Services Portal | Requests, payments, documents | M | P3 | PLT-11 |
| UT-04 | Licensing & Permits | Applications, inspections, fees, renewals | M | P3 | PLT-07 |
| UT-05 | Municipal Tax & Fee Collection | Property and business taxes, reminders | M | P3 | FIN-02 |

### Textile and garments

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| TX-01 | Style & Size/Color Matrix | Styles, colorways, size curves | M | P3 | MDM-02 |
| TX-02 | Sampling & Tech Packs | Samples, approvals, tech pack versions | M | P3 | TX-01 |
| TX-03 | Cutting & Piece-Rate Tracking | Cut tickets, bundles, operator piece-rate pay | M | P3 | MFG-03, HRM-05 |
| TX-04 | Buyer Compliance & Audits | Audit schedules, certificates, factory compliance | S | P3 | PLT-11 |

### Printing and packaging

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| PR-01 | Job Estimating & Costing | Paper, ink, finishing costs; quotes | M | P3 | MDM-02, FIN-15 |
| PR-02 | Job Tickets & Proofing | Prepress approvals, job routing | M | P3 | MFG-03 |

### Waste and recycling

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| WR-01 | Collection Routing & Billing | Pickups, containers, billing | M | P3 | LOG-03, FIN-02 |
| WR-02 | Weighbridge for Waste | Weighing and ticketing for waste loads | S | P3 | LOG-10 |

### Insurance agencies

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| IN-01 | Policy Administration | Policies, endorsements, renewals, premiums | L | P3 | MDM-01, FIN-02 |
| IN-02 | Claims Management | Claim intake, assessment, settlement | M | P3 | IN-01 |
| IN-03 | Carrier Commission Statements | Commission reconciliation with insurers | M | P3 | IN-01, FIN-03 |

### Jewelry

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| JW-01 | Precious Metal Inventory | Weight-based stock, karat, daily rates, hallmarking | M | P3 | INV-03, MDM-02 |
| JW-02 | Repairs & Custom Orders | Repair tickets, custom order tracking, deposits | S | P3 | SAL-03 |

---

### Distribution and FMCG

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| DS-01 | Distributor & Route Sales | Beat plans, van sales, secondary orders, collections on route | L | P3 | SAL-03, SAL-10 |
| DS-02 | Trade Schemes & Claims | Schemes, discounts, free goods, distributor claim settlement | M | P3 | MDM-04, FIN-03 |
| DS-03 | Retailer Network | Outlet master, retailer credit, retailer app ordering | M | P3 | MDM-01, ECM-01 |
| DS-04 | Secondary Sales Visibility | Distributor stock and sell-through reporting | M | P3 | DS-01, PLT-13 |

### Quick commerce

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| QC-01 | Dark Store Operations | Slotting, fast picking, batching, packing in minutes | L | P3 | INV-08, INV-03 |
| QC-02 | Rider Dispatch & Tracking | Rider assignment, live tracking, proof of delivery | M | P3 | LOG-02, LOG-04 |
| QC-03 | Store Replenishment | Hourly demand signals, transfers from the mother warehouse | M | P3 | PLN-04, INV-05 |
| QC-04 | Order Promise & Availability | Real-time availability per store and delivery promise | M | P3 | QC-01, ECM-01 |

### Food and beverage

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| FB-01 | Central Kitchen | Production from outlet orders, recipes, transfers to outlets | M | P3 | MFG-08, INV-02 |
| FB-02 | Shelf Life & Wastage | Shelf-life rules, markdowns, wastage and yield reports | S | P3 | INV-03, MFG-08 |
| FB-03 | Cold Chain Logs | Temperature readings for storage and transport, breach alerts | M | P3 | MFG-12, LOG-04 |
| FB-04 | Recall Management | Batch genealogy search, customer notification, recovery tracking | M | P3 | MFG-12, PLT-10 |

### Pharmaceutical and life sciences

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| PH-01 | GMP Batch Records | Electronic batch manufacturing records, review and release | L | P3 | MFG-08, MFG-06 |
| PH-02 | Serialization & QR Traceability | Unit and pack serial numbers, QR codes, regulator reporting (one connector per market) | L | P3 | INV-03, PLT-12 |
| PH-03 | Validation & Electronic Records | Validated workflows, e-signatures, audit trails for regulated records | L | P3 | PLT-16, PLT-11 |
| PH-04 | Supplier Qualification | Vendor audits, approved supplier list, material specifications | M | P3 | PRC-01, MFG-06 |
| PH-05 | Pharma Distribution | Licensed customer checks, cold chain, recall readiness | M | P3 | SAL-03, FB-03 |

### Energy and renewables

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| EN-01 | Solar & Renewable EPC | Site survey, design, installation projects, commissioning | L | P3 | PSA-01, PSA-12 |
| EN-02 | Generation Monitoring | Inverter and meter data, performance ratio, alerts | M | P4 | PSA-08, AG-07 |
| EN-03 | Asset Maintenance & Outages | Preventive plans, outage logs, field work orders | M | P3 | MFG-11, PSA-06 |
| EN-04 | Carbon & Sustainability Reporting | Emission factors, energy data, sustainability reports | M | P4 | PLT-13 |

### Travel and tourism

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| TT-01 | Itinerary & Package Builder | Packages, itineraries, supplier rates, package costing | M | P3 | MDM-04, PRC-08 |
| TT-02 | Bookings & Cancellations | Reservations, amendments, cancellation and refund rules | M | P3 | TT-01, SAL-05 |
| TT-03 | Supplier Contracts | Hotel, transport and guide contracts with allotments | M | P3 | PRC-08 |
| TT-04 | Agent Commissions | Sub-agent network, commission rules and statements | S | P3 | SAL-07 |

### Mining and extractives

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| MN-01 | Site & Production Tracking | Pits, shifts, output, grades, haulage | L | P4 | PSA-12, INV-02 |
| MN-02 | Safety & Incident Management | Permits to work, incidents, inspections, corrective actions | M | P4 | MFG-06, PLT-07 |
| MN-03 | Environmental Compliance | Monitoring data, permits, regulator reports | M | P4 | PLT-13, PLT-11 |

## Country compliance packs

Each market needs its own tax, payroll, and reporting pack. These are the typical requirements; rules and deadlines change often, so verify current requirements before building.

| Market | Typical requirements |
|---|---|
| Saudi Arabia | ZATCA e-invoicing (Fatoora), VAT returns, Wage Protection System payroll, GOSI social insurance |
| United Arab Emirates | VAT returns, Wage Protection System payroll, e-invoicing rollout |
| India | GST returns, e-invoice registration portal, e-way bills, TDS, EPF and ESI payroll, Tally import |
| Kenya | KRA eTIMS, VAT, PAYE, NSSF, Social Health Authority contributions |
| Nigeria | Tax authority e-invoicing, PAYE, pension remittance |
| Egypt | Egyptian Tax Authority e-invoicing, VAT, social insurance |
| Mexico | CFDI invoicing (SAT), electronic payroll receipts, IVA returns |
| Brazil | NF-e, NFS-e, SPED reporting, eSocial payroll |
| Indonesia | e-Faktur, income tax withholding, BPJS payroll |
| European Union | VAT One-Stop Shop, country e-invoicing mandates, GDPR |
| United States | State sales tax, 1099 reporting, payroll tax filings, ACH and NACHA payments |

---

## Ecosystem (Phase 4)

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| EC-01 | App Marketplace | Third-party apps, listings, reviews, revenue share | L | P4 | PLT-15, PLT-20 |
| EC-02 | Developer Platform & SDK | Public APIs, documentation, sandboxes, app certification | L | P4 | PLT-15 |
| EC-03 | Partner & Implementer Portal | Partner accounts, referrals, certification tracks | M | P4 | PLT-02 |
| EC-04 | Analytics Warehouse & Embedded Analytics | Central analytical store; embeddable dashboards for customers | L | P4 | PLT-13 |
| EC-05 | Embedded Payments | Merchant accounts, payouts. Regulated: needs licenses or a licensed partner | XL | P4 | FIN-05 |
| EC-06 | Embedded Lending | Working-capital loans based on ERP data. Regulated: needs a licensed partner | XL | P4 | EC-05, FIN-17 |

---

## Integration events (examples)

Modules stay decoupled by publishing events. Consumers react without knowing the publisher's internals.

| Event | Published by | Consumed by |
|---|---|---|
| InvoicePosted | SAL-04 | FIN-02 (receivables), FIN-06 (tax), FIN-09 (revenue), INV-06 (cost of sales) |
| BillPosted | PRC-03 or FIN-03 | FIN-03 (payables), FIN-06 (input tax) |
| GoodsReceived | PRC-04 | INV-02 (stock in), FIN-03 (goods received, not invoiced accrual) |
| StockIssued | INV-02 | INV-06 (valuation), FIN-15 (cost) |
| SaleCompleted | POS-01 | INV-02 (stock out), FIN-05 (settlement), FIN-09 (sales) |
| PaymentReceived | FIN-05 | FIN-02 (allocation), SAL-04 (invoice status), NP-01 (receipts) |
| PayrunApproved | HRM-05 | FIN-01 (payroll journal), FIN-04 (bank payment file) |
| OrderCompleted | MFG-03 | INV-02 (finished goods in), FIN-15 (WIP to finished goods) |
| DeliveryCompleted | LOG-02 | SAL-03 (order status), INV-08 (dispatch), SAL-04 (invoice trigger) |
| TimesheetApproved | PSA-02 | PSA-03 (billing draft), PSA-05 (profitability) |
| OrderPlaced | ECM-03 | SAL-03 (sales order), INV-02 (reservation), FIN-05 (payment) |
| PeriodClosed | FIN-13 | Every posting module (blocks new postings to the closed period) |
| PartyUpdated | MDM-01 | All modules that cache party data |

---

## Build order (critical path)

1. **Foundation:** PLT-01, PLT-02, PLT-03, PLT-05, PLT-06, PLT-08, PLT-16, PLT-21.
2. **Shared master data and ledger:** MDM-01, MDM-02, MDM-03, FIN-01, FIN-08.
3. **Stock and purchasing:** INV-01, INV-02, INV-06, PRC-01, PRC-02, PRC-03, PRC-04, PRC-05.
4. **Sales and receivables:** SAL-01, SAL-02, SAL-03, SAL-04, FIN-02, FIN-03.
5. **Cash and tax:** FIN-04, FIN-05, PLT-04, FIN-06, FIN-07 (first market only), FIN-09.
6. **Retail and operations:** POS-01, POS-02, INV-03, INV-04, INV-05, MDM-04.
7. **Operations expansion:** Phase 2 products, starting with HRM-01 through HRM-05, then MFG-01 through MFG-05.
8. **Industry pack:** Choose one niche and one market. Build its packs in dependency order.
9. **Ecosystem:** Phase 4, after real customers and partners exist.

## Minimum viable ERP

Phase 0 (23 products) plus Phase 1 (30 products) makes a sellable core. It covers:

- Accounts receivable and payable, general ledger, bank reconciliation, and financial statements
- Sales pipeline, quotes, orders, and invoicing
- Procurement from requisition through goods receipt
- Multi-warehouse inventory with lots, serials, and valuation
- Master data for parties, items, pricing, and chart of accounts
- The platform layer that every product needs

Sell this core with one industry pack. The pack is what customers pay for; the core is what makes them stay.

## Things not to build early

- Payroll for more than one country. Each ruleset is a compliance project.
- Embedded payments or lending (EC-05, EC-06). These need financial licenses or a licensed partner.
- Consolidation, advanced planning, and finite scheduling. Most SMBs do not need them.
- Multiple industry packs at once. Finish one before starting the next.
- Native mobile apps for every module. Start with one responsive app built on PLT-19.

---

## AI agents, automation and AI suite

Added to the plan after the core modules. Agents act only inside permissions the customer grants, and every action they take is recorded in the audit trail and can be approved by a person.

### AI agents

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| AGT-01 | Agent runtime and permissions | Agents run with a named role, limited scopes, spending and posting limits, and a kill switch | M | P3 | PLT-01, PLT-06 |
| AGT-02 | Sales assistant agent | Drafts quotes and follow-ups from the pipeline, and proposes next steps for a person to approve | M | P3 | SAL-01 |
| AGT-03 | Finance close assistant | Prepares reconciliation lists and month-end checklists, and flags unusual entries for review | M | P3 | FIN-01, FIN-13 |
| AGT-04 | Replenishment agent | Proposes purchase orders from sales velocity and stock levels, for approval | M | P3 | INV-05 |
| AGT-05 | Customer support agent | Answers common questions from the knowledge base and hands over to a person when unsure | M | P3 | SAL-11 |
| AGT-06 | Agent approvals and audit | Every agent action is logged, can be reviewed, and can be approved or reversed by a person | S | P3 | AGT-01 |

### Automation

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| AUT-01 | Trigger and action rules | When an event happens, run an action such as notify, post, or create a task, with conditions | M | P3 | PLT-06 |
| AUT-02 | Scheduled jobs and recurring reports | Run reports and tasks on a schedule and deliver them by email or chat | S | P3 | PLT-13 |
| AUT-03 | Integration connector library | Connect to banks, payment providers, shipping carriers, and common SaaS tools | L | P3 | PLT-15 |
| AUT-04 | Webhooks and event subscriptions | Customers subscribe to events from their own data and receive them over signed webhooks | S | P3 | PLT-15 |

### AI suite

| ID | Product | Key capabilities | Size | Phase | Depends on |
|---|---|---|---|---|---|
| AIS-01 | Natural-language queries | Ask questions of the books and reports in plain language, with the source of each figure shown | M | P4 | PLT-13 |
| AIS-02 | Forecasting suite | Cash, demand, and sales forecasts with the assumptions shown and editable | M | P4 | PLN-01 |
| AIS-03 | Anomaly and fraud monitoring | Flags duplicate payments, unusual discounts, and out-of-pattern expenses | M | P4 | AI-04 |
| AIS-04 | Drafting copilot | Drafts contracts, letters, and proposals from templates and the customer's own data | S | P4 | AI-08 |
| AIS-05 | Model governance and data controls | Customers choose what data AI features may use, and can turn them off per module | M | P4 | PLT-21 |
