# Process Flow to Standalone Products to ERP

Status: proposal for review. Nothing in `ERP-Product-Catalog.md` or `backend/` has changed yet. New IDs below become real only after they are added to the catalog and `npm --prefix backend run catalog:generate` is run.

Source: the documents in `Process Flow/` (process master workbook, revised flow chart, SOPs for sales, purchasing, stores, logistics, maintenance and electrical assembly, plus forms, masters and BOM sheets).

## 1. Ground rules

1. **No client name anywhere.** The reference company, its brand and model names, its document numbers, its people, addresses, tax and bank identifiers, and the third-party tools its files name are not used in product names, catalog entries, seed data, UI copy, tests or docs. The process is generalised into product capabilities. Examples in tests and demos use neutral names such as "Sample Fabrication Co" and "Machine A, 5 kW".
2. **Process, not data.** The source files are read for process logic only. Employee master, vendor master, customer list, price list, BOM SKUs, GST numbers, bank details and the chart of accounts with personal account names are not copied into the product.
3. **Products sell alone.** Each product in section 5 works without the others, talks to them only through events (CLAUDE.md rule 3), and owns its own tables.
4. **The ERP is a bundle.** The ERP is the platform, the shared kernel, the chosen product bundles, and one industry pack. The industry pack holds stage templates, approval matrices, test formulas and form layouts as configuration, not code forks (catalog rule 5).

## 2. What the source documents cover

| Source | Covers | Used for |
|---|---|---|
| Process master workbook | 40 ERP steps from enquiry to supplier release, with department, gate, responsible role and next step. Also a department matrix and an approval matrix. | Sequence, gates, role matrix |
| Revised flow chart (slides) | Same flow with QC loops (ok / not ok), rework, debit note, sub-assembly, outsourcing, four electrical assembly stations | Branches and rework paths |
| Sales SOP | Enquiry, proposal, discount approval, PO verification, drawing request and customer drawing approval, payment, sales projection, work order, sale order, invoice, installation hand-off | Order-to-cash |
| Purchasing SOP | Supplier questionnaire and audit, weighted scorecard, grades, purchase request, RFQ (minimum three vendors), comparative statement, approvals by value, PO, 48-hour acknowledgement, re-evaluation | Procure-to-pay and supplier control |
| Stores SOP | GRN against PO, receiving QC, binning, rejection note and debit note, material request and FIFO issue, perpetual stock and cycle counts, non-returnable and returnable gate passes | Inward, stock and issue |
| Logistics SOP | Dispatch clearance, dispatch plan, transporter selection with 30-day trial and quarterly evaluation, gate-in and gate-out, loading, proof of delivery | Dispatch |
| Maintenance SOP | Preventive, predictive and breakdown maintenance, criticality classes, spares, machine history card, utilities, contractor control | Plant maintenance |
| Electrical assembly SOP | Storage, panel and harness sub-assembly, assembly, load test against calculated current with tolerance, insulation and earth tests, ELCB trip, pass or fail record | Electrical build and test |
| Forms and masters | Delivery note, packing slip, service and installation report (LAMC, CAMC, warranty, preventive status), warranty certificate, perpetual stock register, vendor code opening form, approved vendor and transporter lists, bin and GRN labels, HSN code list, asset list for two units, holiday calendar, organisation chart, BOM sheets | Form templates, master-data fields, labels, asset and calendar models |
| Proposal document (latest version) | A requirement catalogue of about 200 lines, grouped by department | Cross-check for missing capabilities |

## 3. The flow as one chain

1. **Demand.** Enquiry, quotation with value-based approval, customer PO checked against the agreed quote.
2. **Engineering.** Drawing request for customised work, customer drawing approval (no production before it), BOM with revisions.
3. **Commitment.** Payment terms confirmed, work order and sale order created with project number, promised date and BOM.
4. **Planning.** Manufacturing order, capacity and manpower loading, material requirement, weekly material and fabrication plans.
5. **Materials.** Stock check, material request, purchase request, RFQ to at least three vendors, comparative statement, approval, PO, supplier follow-up.
6. **Inward.** Gate receipt, count, GRN against PO, receiving QC accept or reject, binning, rejection note and debit note, invoice to finance.
7. **Production.** FIFO material issue, cutting, bending, welding, grinding, polishing and fitting with in-process QC, electrical sub-assembly and station allocation, electrical load and insulation test, final QC.
8. **Finished goods.** FG record, equipment serial number, FG offer for final verification, packing, labels, move to dispatch store.
9. **Dispatch.** Dispatch clearance from sales, dispatch plan, transporter, gate log, delivery note and packing slip, e-way bill, proof of delivery.
10. **Invoice and cash.** Final invoice after the installation status is reported, payment follow-up 10 days after invoice, receipt confirmation.
11. **Installation and warranty.** Site requirements (MEP) sent to customer, installation work order, installation report with customer sign-off, warranty certificate and activation, service contracts.
12. **After-sales.** Customer feedback, complaints and breakdown calls, preventive visits, plant maintenance.

Cross-cutting: stock control (perpetual stock, cycle counts, reconciliation, minimum and reorder), gate passes, approval matrices, controlled forms, master data.

## 4. Process step to product map

Status key: **Existing** = in the catalog today. **Extend** = in the catalog, needs the capability listed. **New** = proposed in section 6.

### 4.1 Sales and order-to-cash

| Process step | Product | Status | Notes |
|---|---|---|---|
| Enquiry logged, acknowledged within 1–3 days, weekly follow-up | SAL-01 CRM Pipeline | Existing | Follow-up tasks and reminders |
| Proposal from standard template, value approval, non-standard discount approval | SAL-02 Quotes & CPQ | Existing | Discount and value approvals through PLT-07 |
| Customer PO checked line by line against quote | SAL-02, SAL-03 | Extend | Add a quote-to-PO variance check |
| Drawing request and customer drawing approval gate | MFG-16 Design & Drawing Control | New | See 6.2 |
| Work order and sale order with project number, promised date, BOM, loading scope | SAL-03, PSA-01 | Existing | Project number is a field on the order |
| Payment terms gate before work order release | SAL-03, PLT-07 | Existing | Configured as a gate |
| Sales projection to stores and purchase | SAL-08 Sales Forecasting | Existing (P2) | Stock check is triggered from it |
| Customer master with GST, credit limit, segment | MDM-01, FIN-14 | Existing | Credit limit enforced at order entry |
| Price list with customer-specific discounts | MDM-04 | Existing | Discount rules are per customer, not global |
| Invoice raised after installation status, not at dispatch | SAL-04, PSA-11 | Extend | Milestone-gated invoicing |
| Payment follow-up 10 days after invoice, receipt confirmation | FIN-02, FIN-14 | Existing | Dunning sequence |
| Customer feedback at closure | SAL-16 Surveys & NPS | Existing (P3) | Pull into P2 if feedback is a close condition |

### 4.2 Procurement and supplier control

| Process step | Product | Status | Notes |
|---|---|---|---|
| Purchase request from stores (automatic at reorder point) or department (approved by head) | PRC-02 | Existing | Source can be stores or department |
| RFQ to at least three vendors, comparative statement, L1 recommendation | PRC-06 RFQ & Tendering | Existing (P2) | Required by the process, so pull into P1 (see 7) |
| Supplier questionnaire, audit, grade, approved supplier list | PRC-01 Supplier Management | Extend | Add questionnaire and audit steps |
| Weighted supplier scorecard, critical-failure rule, re-evaluation cycle | PRC-12 Supplier Scorecards | New | See 6.4 |
| Approval by value band (regular or non-regular path) | PLT-07, PRC-03 | Existing | Item category decides the approval path |
| PO creation, approval, signed release to vendor, 48-hour acknowledgement | PRC-03 | Existing | Acknowledgement is an SLA timer |
| Dispatch details from supplier (invoice, vehicle, e-way bill, ETA) | PRC-07 Supplier Portal, PRC-04 | Existing (P2) | Advance shipping notice |
| GRN against PO, quantity loaded from PO, not typed | PRC-04 | Existing | Tolerance per item |
| Rejection note, debit note, return to supplier | PRC-05 | Existing | |
| Vendor payment terms and advance rules | PRC-03, FIN-03 | Existing | Advance percentage is data |

### 4.3 Stores and inventory

| Process step | Product | Status | Notes |
|---|---|---|---|
| Gate receipt, count against delivery challan, damage note | INV-02, PRC-04 | Existing | |
| Receiving QC (accept, reject, quarantine) | INV-10, MFG-06 | Existing | Quarantine status |
| Binning by rack, bin and bin card | INV-07 Bin Locations | Existing (P2) | Process needs it in P1 (see 7) |
| Minimum stock, reorder (relevel) level, low-stock report | INV-05 Replenishment | Existing | |
| Material request from production against an order, FIFO issue, signed receipt | INV-02, MFG-03 | Existing | FIFO is a costing and picking rule |
| Barcode and label printing (GRN, FG, serial) | INV-04, PLT-12 | Existing | |
| Cycle counts (ABC, blind count, weekly for high value), reconciliation, approval | INV-09 | Existing | Adjustment approval through PLT-07 |
| Non-returnable and returnable gate passes, gate register, overdue returnables | INV-13 Gate Passes | New | See 6.3 |
| Vehicle gate-in and gate-out times | INV-13 | New | Same log |
| Stock in transit between units or departments | INV-02 | Existing | Transfer not received until acknowledged |

### 4.4 Engineering, BOM and planning

| Process step | Product | Status | Notes |
|---|---|---|---|
| Multi-level BOM with categories (electrical, mechanical, fasteners, induction) | MFG-01 | Extend | Add wastage, flexible-consumption flag, on-hand per line |
| BOM revisions and change history | MFG-01, MFG-07 | Existing | |
| Drawings, drawing revisions, drawing approvals | MFG-16 | New | |
| Routing: cutting, bending, welding, grinding, polishing, assembly, test, packing | MFG-02 Routings & Work Centers | Extend | Add stations (for example four electrical assembly stations) |
| Manufacturing order from work order, release after planning approval | MFG-03 | Existing | |
| Weekly material plan and fabrication plan | MFG-05 MRP, MFG-03 | Existing | Two plans, one source |
| Capacity and manpower loading chart | MFG-09 Finite Capacity | Existing (P3) | A light version can be P2 |
| MRP: material requirement from orders minus stock | MFG-05 | Existing | |

### 4.5 Production and quality

| Process step | Product | Status | Notes |
|---|---|---|---|
| Job cards per stage, start and stop, output, downtime with reasons | MFG-04 Shop Floor App | Existing | |
| Daily production report | MFG-03, MFG-04 | Existing | |
| In-process QC (fit-up, weld, dimensions), first-piece approval, stage QC | MFG-06 Quality Management | Existing | Inspection plan per stage |
| Non-conformance, rework, debit note on bad stock | MFG-06, PRC-05 | Existing | |
| Electrical sub-assembly to approved wiring drawing, ferrule check | MFG-02, MFG-04 | Existing | |
| Electrical load test against calculated current with tolerance, insulation and earth test, ELCB trip, pass or fail record | MFG-13 Equipment Testing | New | See 6.1 |
| Final QC, FG record, equipment serial, component serial for warranty | MFG-06, INV-03, PSA-08 | Existing | Serial links component to finished unit |
| Calibration check on test instruments before use | MFG-13 | New | Instrument register with due dates |

### 4.6 Finished goods, dispatch and logistics

| Process step | Product | Status | Notes |
|---|---|---|---|
| FG offer for final verification, packing, labels, move to dispatch store | INV-08 Warehouse Management, PLT-12 | Existing | |
| Dispatch clearance from sales before loading | LOG-01, SAL-03 | Existing | Gate in the dispatch workflow |
| Dispatch plan, customer delivery address and site timings | LOG-01 | Existing | |
| Transporter selection, 30-day trial, quarterly evaluation | LOG-01, PRC-12 | Existing and New | Evaluation uses PRC-12 |
| Delivery note and packing slip per work order | INV-08, LOG-01 | Extend | Form layouts from the industry pack |
| E-way bill | FIN-07 | Existing | |
| Proof of delivery (signed, stamped) | LOG-02 Driver App | Existing | |

### 4.7 Installation, warranty and service

| Process step | Product | Status | Notes |
|---|---|---|---|
| Site requirements (MEP) sent to customer after drawing approval | PSA-06 Field Service | Extend | Site-survey checklist |
| Installation work order, technician visit, installation report, customer sign-off | PSA-06 | Extend | Installation and service report templates |
| Warranty certificate per unit, warranty start by delivery or invoice date | PSA-07 Service Contracts & Warranties | Extend | Imported and manufactured units differ |
| Labour AMC and comprehensive AMC, chargeable and preventive visits | PSA-07 | Extend | Contract types |
| Breakdown or complaint logging, technician assignment | PSA-06 | Existing | |
| Installed base: unit, serial, location, service history | PSA-08 Asset Registry | Existing | |

### 4.8 Plant maintenance

| Process step | Product | Status | Notes |
|---|---|---|---|
| Preventive, predictive and breakdown maintenance, PM schedule and checklist | MFG-11 Maintenance | Existing (P3) | Pull a basic version into P2 if the plant is in scope early |
| Criticality classes, machine history card, asset codes | MFG-11, PSA-08, FIN-10 | Extend | |
| Spares classes (critical, consumable, emergency), reorder level, vendor approval for critical spares | MFG-11, INV-05 | Extend | |
| Breakdown RCA (5 whys, fishbone) and corrective action | MFG-11, MFG-06 | Extend | |
| Utility maintenance schedules (compressors, generators, panels, pumps) | MFG-11 | Extend | Separate schedule per utility |
| Permit to work, lock-out tag-out, contractor induction | Not in catalog | Open question | See 8 |

### 4.9 Platform, master data and finance

| Process step | Product | Status | Notes |
|---|---|---|---|
| Approval matrix by department and value (prepared, verified, HOD, management) | PLT-07 Workflow & Approvals | Existing | Core of the ERP gates |
| Departments, roles, reporting lines, organisation chart | PLT-01, PLT-02, HRM-02 | Existing | |
| Two units and their stock, assets, staff | PLT-02 | Existing | Branch per unit |
| Item master with HSN or SAC code, UOM conversion (buy, stock, issue) | MDM-02 | Extend | HSN and UOM conversion named explicitly |
| Vendor master with bank, credit days, MSME flag, TDS flag | MDM-01, PRC-01 | Existing | Forms are templates |
| Controlled forms: form number, revision, effective date, form register | PLT-08, PLT-11 | Extend | |
| Chart of accounts from a template | MDM-03 | Existing | Use generic template only |
| Public and festival holiday calendar | MDM-05 | Existing | |
| Fixed asset register (machines, depreciation) | FIN-10 | Existing (P2) | |
| Cost of finished goods (material, labour, overhead) | FIN-15 | Existing (P2) | Needed for job costing |
| Payroll, attendance, employee master | HRM-01 to HRM-05 | Existing | Keep personal data out of seed data |

## 5. Standalone products

Each row is a product that can be sold and run on its own. Platform (PLT) and shared master data (MDM) come with every product.

| Product | Catalog IDs | Works alone for |
|---|---|---|
| A. Sales Pipeline and Quotes | SAL-01, SAL-02, SAL-08 | Lead to quote, with approvals |
| B. Order to Cash | SAL-03, SAL-04, SAL-05, FIN-02, FIN-14 | Orders, invoices, receivables, credit |
| C. Engineering and Drawings | MFG-01, MFG-07, MFG-16 | BOMs, revisions, drawing approval |
| D. Procurement and Supplier Control | PRC-01 to PRC-06, PRC-12 | Requests to receipt, supplier and transporter scorecards |
| E. Stores and Inventory | INV-01 to INV-05, INV-07, INV-09, INV-10, INV-13, INV-03, INV-04 | Stock, bins, counts, gate passes, labels |
| F. Production and Shop Floor | MFG-02, MFG-03, MFG-04, MFG-05 (MFG-09 later) | Routing, orders, job cards, MRP |
| G. Quality and Testing | MFG-06, MFG-13 | Inspections, test records, non-conformance |
| H. Dispatch and Logistics | INV-08, LOG-01, LOG-02 | Packing, dispatch, proof of delivery |
| I. Installation, Warranty and Service | PSA-06, PSA-07, PSA-08, SAL-16 | Installs, warranties, service contracts, feedback |
| J. Plant Maintenance | MFG-11, PSA-08, INV-05 | Preventive and breakdown maintenance |
| K. Finance Core | FIN-01, FIN-03, FIN-04, FIN-06, FIN-07, FIN-08, FIN-09, FIN-10, FIN-15 | Ledger, payables, banking, GST, statements, costing |
| L. HR and Payroll (optional) | HRM-01 to HRM-05 | Employee records, attendance, leave, payroll |

## 6. Proposed new products (not yet in the catalog)

### 6.1 MFG-13 Equipment Testing and Test Records (M, P2)

Depends on MFG-03, MFG-06, INV-03.

- Test plans per product family: which tests, which order, which instrument.
- Reference values calculated from the rating and supply (formula stored as configuration, not code).
- Tolerance bands per rating, stored as data.
- Instrument register with calibration due dates; tests are blocked when the instrument is overdue.
- Measured values, pass or fail, withhold and rework routing, re-test after rework.
- Test record and certificate printed per unit serial.

Why separate from MFG-06: MFG-06 covers inspection plans. Electrical load and insulation testing has calculated limits and a per-unit record.

### 6.2 MFG-16 Design and Drawing Control (M, P2)

Depends on MFG-01, PLT-11, SAL-03.

- Drawing request raised from a won order, with technical details.
- Preliminary drawing, revision and resubmission loop.
- Customer approval gate: a signed copy or written approval is recorded. Production cannot start before it (rule enforced in MFG-03).
- Drawing linked to BOM revision and to the order.

### 6.3 INV-13 Gate Passes and Gate Log (S, P2)

Depends on INV-02, PLT-07.

- Returnable pass (repair, job work, calibration, demo) with expected return date and serial numbers.
- Non-returnable pass (sale, scrap, sample) linked to an invoice or scrap note.
- Multi-copy approval chain by department head, then executive sign-off by value rule.
- Return entry closes the pass; overdue report goes to the approver each week.
- Vehicle gate-in and gate-out times in the same register.

### 6.4 PRC-12 Supplier and Service Provider Scorecards (S, P2)

Depends on PRC-01.

- Qualification questionnaire covering quality, environmental and safety evidence.
- Weighted scorecard with the critical-failure rule (any critical failure can disqualify regardless of score).
- Grades and statuses from configuration (bands, not code).
- Trial period for a new provider (30 days in the source; configurable).
- Periodic re-evaluation by category (annual or two-yearly in the source), corrective action requests.
- Used for suppliers and for transporters (LOG-01).

## 7. Extensions and pull-forwards

Existing products that need a capability from the process:

- **PRC-06 RFQ and Tendering: move to P1.** The process requires a formal RFQ to at least three vendors and a comparative statement before every regular purchase.
- **INV-07 Bin Locations: move to P1.** Binning is part of every receipt.
- **SAL-04 Invoicing: milestone gating.** Final invoice raised on installation status, not on dispatch.
- **PSA-07 Warranties: certificate per unit,** with start date by delivery or invoice, and separate rules for imported units.
- **PSA-06 Field Service: installation and service report templates,** with status flags (labour AMC, comprehensive AMC, chargeable, preventive, warranty).
- **MFG-01 BOM: wastage, flexible consumption, on-hand per line,** and category per line.
- **MFG-02 Routings: stations** (for example, four electrical assembly stations) and inspection points per operation.
- **MFG-11 Maintenance: criticality classes, machine history card, utility schedules, spares classes.**
- **MDM-02 Item Master: HSN or SAC code and explicit UOM conversions** (purchase unit, stock unit, issue unit).
- **PLT-11 and PLT-08: controlled forms register** with form number, revision and effective date.

## 8. Open questions

1. **Catalog change.** Approve adding MFG-13, MFG-16, INV-13 and PRC-12 to `ERP-Product-Catalog.md`. This is backend-lane work and then runs `catalog:generate`.
2. **Pull-forwards.** Confirm moving PRC-06 and INV-07 into P1.
3. **Permit to work and lock-out tag-out.** Add as an EHS product, or as a checklist inside MFG-11?
4. **Industry pack name.** Use a neutral name such as "Made-to-order equipment manufacturing", with fabrication and electrical assembly as its stages.

## 9. Process inconsistencies to settle before building

These are decisions to make as configuration, not in code.

1. **Order of steps.** The process master puts sale order before customer PO. The sales SOP runs PO, then drawing approval, then payment, then work order, then sale order. Pick one canonical sequence and make each gate configurable.
2. **Design timing.** The process master places design after the manufacturing order. The sales SOP says production cannot begin until the customer approves the drawing. The SOP rule should win; confirm.
3. **Electrical tolerance for 5 kW single-phase.** The SOP text says plus or minus 1 A. The annex table row for that rating shows plus or minus 2 A. The annex layout is hard to read from the PDF text, so confirm against the controlled original before encoding.
4. **Supplier grade bands.** The SOP grade table (A to D) has gaps between its bands (for example 69.9 to 70 and 59.9 to 60). Its C band (50 to 59.9, approval hold) also conflicts with the evaluation text (over 60 percent conditional). Confirm the bands.
5. **Three systems named.** The SOPs name one tool for work orders, one for regular purchases and another for non-regular purchases. The product replaces all three. Keep the regular and non-regular split as an item-category setting that selects the approval path.
6. **Warranty for imported units.** The certificate has a separate period for imported equipment. Make the warranty rule per product family.

## 10. Build order for this process

- **Wave 1 (first sellable slice): inward to order to cash.** PLT foundation, MDM-01, MDM-02, MDM-03, FIN-01, FIN-03, FIN-04, PRC-01 to PRC-06 (PRC-06 pulled forward), INV-01 to INV-05, INV-07 (pulled forward), INV-10, SAL-01 to SAL-04, FIN-02. This matches the catalog's minimum viable ERP plus the two pull-forwards.
- **Wave 2: make and ship.** MFG-01 to MFG-06, MFG-13, MFG-16, INV-08, INV-09, INV-13, LOG-01, LOG-02, PRC-12.
- **Wave 3: install, service and maintain.** PSA-06, PSA-07, PSA-08, MFG-11, SAL-16, FIN-10, FIN-15, MFG-09.
- **Wave 4 (optional): people.** HRM-01 to HRM-05.

Events between products (producer, then consumer):

| Event | Produced by | Consumed by |
|---|---|---|
| quote.accepted | SAL-02 | SAL-03 |
| drawing.approved | MFG-16 | MFG-03 (release gate) |
| payment.terms.confirmed | FIN-02 | SAL-03 (work order gate) |
| mo.released | MFG-03 | MFG-05, INV-02 |
| pr.approved | PRC-02 | PRC-06 |
| po.issued | PRC-03 | PRC-04, FIN-03 |
| grn.posted | PRC-04 | INV-02, FIN-01 |
| qc.rejected | MFG-06 | PRC-05 |
| stock.issued | INV-02 | MFG-03, FIN-01 |
| test.passed | MFG-13 | INV-08 |
| fg.created | INV-03 | PSA-08 |
| dispatch.cleared | SAL-03 | LOG-01 |
| dispatch.shipped | LOG-01 | FIN-07, PSA-07 |
| invoice.issued | SAL-04 | FIN-02 |
| install.completed | PSA-06 | SAL-04 (final invoice), PSA-07 |
| warranty.activated | PSA-07 | PSA-08 |

## 11. What not to carry over from the source files

- Client name, brand and model names, and document numbers with the client's prefix.
- The third-party tools named in the SOPs (they are replaced by the product).
- Employee master, bank and identity fields, director names.
- Customer list, GST numbers, credit limits and quote values.
- Vendor list with contact details.
- BOM SKUs and product codes.
- Asset tags and serial numbers.
- Chart-of-accounts names that include people.

Use these for the chart-of-accounts template and form layouts only after they are rewritten with generic names.

Housekeeping: `Process Flow/` is untracked and holds personal and client data. Add it to `.gitignore` before anything in it is committed. The proposal file name includes the client's name; rename it before it is reused as a template.
