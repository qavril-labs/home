# Product split plan: separate products that compose into one ERP

Status: draft for go-ahead. Builds on [process-flow-product-map.md](process-flow-product-map.md). Nothing has been created yet: no repositories, no Neon projects, no code, no catalog change.

## 1. Decisions already made

| Question | Answer |
|---|---|
| Deployment | Separate repositories, one per product, plus one platform repository |
| Data | One Neon project per product (the platform has its own too) |
| Who builds screens | Claude Code writes the backend, API and contract. Antigravity builds the screens from the contract, through a handoff per product |
| Screen shape | One web app with a product launcher. Enabled products appear as sections |
| Shared master data and ledger | One platform service owns identity, parties, items, chart of accounts and the ledger. Products call it through its API and subscribe to its events. Nothing is copied |
| API shape | One gateway. Product-prefixed routes (`/v1/procurement/...`). One OpenAPI file per product, merged into one contract at build |
| Composition | The customer enables products on the subscription (PLT-18). Enabling a product turns on its menus, permissions, events and its part of the industry pack |
| First slice | Procurement, Stores, Sales, Production and Quality, Finance core |
| Mobile | Responsive web, with an installable app (PWA) for shop-floor, driver and gate screens |
| Names | Generic functional names. No client or brand names in any repo, API path, table or screen |

## 2. What already exists (reuse, do not rebuild)

`backend/packages` already has most of the platform: `identity` (sessions and permissions), `tenancy` (tenants, entitlements), `events` (bus, dispatcher, outbox types), `audit`, `numbering` (document sequences), `ledger` (accounts, journals, periods, posting), `sales` (invoicing), `tax`, `kernel` (IDs, errors, clock) and `money`. The `contracts/openapi.yaml` already has master-data, ledger and approval routes. The split moves these into the platform repository and product packages; it does not rewrite them.

## 3. The repositories

| Repository | Catalog products | Neon project | API prefix | Screen handoff |
|---|---|---|---|---|
| `platform` | PLT-01, 02, 06, 07, 08, 16, 18; MDM-01, 02, 03, 05; FIN-01 (ledger core) | `platform` | `/v1/platform/*`, `/v1/master-data/*`, `/v1/ledger/*` | Sign-in, launcher, admin, approvals inbox, party and item screens |
| `procurement` | PRC-01, 02, 03, 05, 06 | `procurement` | `/v1/procurement/*` | Supplier list, purchase request, RFQ and comparison, PO |
| `stores` | INV-01, 02, 03, 04, 05, 07, 10; PRC-04 (goods receipt) | `stores` | `/v1/stores/*` | Receipt and QC, binning, stock ledger, issue, reorder list |
| `sales` | SAL-01, 02, 03, 04; FIN-02 (receivables view) | `sales` | `/v1/sales/*` | Enquiry, quote with approvals, sale order, invoice |
| `production` | MFG-01 to 06, MFG-13, MFG-16 | `production` | `/v1/production/*` | BOM, routing, production order, job cards, QC checks, test records, drawings |
| `finance` | FIN-03, FIN-04, FIN-02 (ledger side), FIN-06 later | `finance` | `/v1/finance/*` | Payables, bank and cash, payment runs, GST returns |

Notes on the table:

- **Goods receipt is in `stores`, not `procurement`.** A receipt moves stock and triggers QC, so `stores` owns it. `procurement` keeps the PO and sends the expected receipt. The catalog lists PRC-04 under procurement; this moves its execution into `stores`. Needs your confirmation (section 7).
- **Ledger core stays in `platform`.** Every product posts to it through events (catalog rule 4). The posting engine already exists in `backend/packages/ledger`.
- **`finance` holds payables and banking,** which are separate workflows. Receivables stay with `sales`, next to the invoice that creates them.

## 4. Each product: API, events, screens

Every product exposes the same shape: a REST resource set under its prefix, an OpenAPI file, event producers and consumers listed in `events.md`, a permissions list, an audit trail through the platform, and tests (catalog definition of done).

### 4.1 procurement (`/v1/procurement`)

- **Resources:** `suppliers`, `purchase-requests` (with approve), `rfqs` (with vendors, quotes, comparison, award), `purchase-orders` (with approve, release, acknowledge, close), `supplier-advance-notices`.
- **Produces:** `pr.approved`, `rfq.awarded`, `po.issued`, `po.acknowledged`, `po.closed`.
- **Consumes:** `grn.posted` and `qc.rejected` (from stores, to update received quantity and open debit notes), `invoice.received` (from finance).
- **Screens for Antigravity:** supplier list and detail, purchase request inbox, RFQ comparison, PO list and detail, approval actions.

### 4.2 stores (`/v1/stores`)

- **Resources:** `goods-receipts` (against a PO, quantity from the PO, not typed), `qc-inspections` (accept or reject per line), `bins` and `binning`, `stock-movements`, `stock-balances`, `material-requests` (from production), `issues` (FIFO), `transfers`, `reorder-alerts`.
- **Produces:** `grn.posted`, `qc.accepted`, `qc.rejected`, `stock.issued`, `stock.transferred`, `stock.low`.
- **Consumes:** `po.issued` (expected receipt), `mo.released` (material plan), `fg.created` (finished goods to store), `dispatch.shipped` (stock out).
- **Screens:** receipt and QC queue, binning with bin and rack view, stock ledger, material request queue, issue slip, low-stock list. Stores receiving and binning get a PWA-friendly scanner view.

### 4.3 sales (`/v1/sales`)

- **Resources:** `enquiries`, `quotes` (with revisions and approvals by value), `sale-orders` (from accepted quotes, with customer PO check), `drawing-requests` (handed to production), `invoices` (with milestone rule: final invoice after installation status), `dispatch-clearances`, `credit-checks`.
- **Produces:** `quote.accepted`, `sale-order.confirmed`, `dispatch.cleared`, `invoice.issued`.
- **Consumes:** `drawing.approved` (from production), `install.completed` (from service), `receipt.posted` (from finance), `dispatch.shipped` (from logistics, later).
- **Screens:** pipeline board, quote editor with approval actions, sale order, invoice list, dispatch clearance, customer credit view.

### 4.4 production (`/v1/production`)

- **Resources:** `boms` (versions, lines with wastage and flexible-consumption flag), `routings` (operations, stations, inspection points), `manufacturing-orders`, `job-cards` (start, stop, output, downtime with reason), `inspection-plans` and `qc-checks` (in-process and final), `test-records` (MFG-13: test plan, instrument, measured values, pass or fail), `drawings` (MFG-16: requests, revisions, customer approval), `non-conformances`.
- **Produces:** `drawing.approved`, `mo.released`, `mo.completed`, `fg.created` (after final QC and test pass), `test.passed`, `test.failed`, `qc.nonconforming`.
- **Consumes:** `sale-order.confirmed`, `drawing-request.created`, `stock.issued` (material arrived), `grn.posted` and `qc.accepted` (material status).
- **Screens:** BOM editor, routing, production order board, shop-floor job cards (PWA), QC checks (PWA), test record form, drawing approval queue.

### 4.5 finance (`/v1/finance`)

- **Resources:** `vendor-bills` (three-way match against PO and GRN), `payment-runs`, `payments`, `bank-accounts`, `bank-statements` (import and reconcile), `gst-returns` (later).
- **Produces:** `payment.made`, `bill.posted`.
- **Consumes:** `grn.posted`, `po.issued`, `invoice.issued` (receivables side), `receipt.posted`.
- **Posts to the ledger** through the platform's posting engine, never by writing its tables.
- **Screens:** bill inbox with match status, payment run approval, bank reconciliation, receivables and payables aging (receivables view in `sales`).

### 4.6 platform (`/v1/platform`, `/v1/master-data`, `/v1/ledger`)

- **Owns:** identity and sign-in, tenants and companies, branches (one per unit), entitlements (which products are on), approvals (value and role matrix), numbering, audit, events (outbox and bus), party master, item master (with HSN or SAC and UOM conversions), chart of accounts, holiday calendar, the general ledger.
- **Screens:** launcher, workspace settings, enable and disable products, approvals inbox, parties, items, chart of accounts, ledger and trial balance.

## 5. How the products become one ERP

1. **Sign-in and launcher.** One identity in `platform`. The launcher reads the tenant's entitlements and shows the enabled products.
2. **Gateway.** One API address. A product's routes are reached as `/v1/<product>/...`. The gateway checks the entitlement and the permission, then forwards the call.
3. **Events.** Each product writes its events to its own outbox in the same transaction as the business change. The platform's relay delivers them to the consumers that are enabled for that tenant. Consumers skip events for products that are off.
4. **Shared data.** Parties, items and accounts are read from the platform API or from a local read copy filled by events. Writes always go to the platform.
5. **Posting.** Every money or stock movement emits an event. `finance` and `platform` turn it into journal entries (catalog rule 4).
6. **Industry pack.** Stage templates, approval matrices, test formulas and form layouts are data loaded per tenant. No code forks.

The end-to-end path is covered by the event table in [process-flow-product-map.md](process-flow-product-map.md) section 10. The first slice must pass it: receipt to QC to stock, PO to receipt to bill to payment, quote to order to invoice to ledger.

## 6. Build order

1. **Contracts first.** Write each product's OpenAPI file and event list in `contracts/`, starting with `platform` and `procurement`. Antigravity reviews each one before code.
2. **`platform`:** move identity, tenancy, approvals, numbering, audit, events, parties, items and ledger core into the new repository. Its tests must pass before any product starts.
3. **`procurement` and `stores`:** the inward path, with the receipt, QC and binning flow end to end.
4. **`sales`:** quote to order to invoice, with the milestone rule.
5. **`production`:** BOM, routing, orders, job cards, QC and the test record.
6. **`finance`:** bills, payments and bank reconciliation, posting through the ledger.
7. **Launcher and gateway:** each product's screens appear in the launcher only when enabled.
8. **End-to-end test** across the five products on one tenant.

Each step ends with tests passing in its repository and a contract review by Antigravity.

## 7. Decisions still open (defaults in brackets)

1. **Lane rules change.** CLAUDE.md, the build plan and the repo layout describe one repository with two lanes. Separate repositories replace that. [Update CLAUDE.md and `docs/build-plan.md` in a small root pull request, with a reason, once you agree.]
2. **Goods receipt ownership.** [`stores`, as above.]
3. **GitHub owner and repository names.** The current repository is under `qavril-labs`. [Create the six repositories under `qavril-labs` with the names in section 3.]
4. **Shared package for the contract and kernel.** Separate repositories need the kernel (`kernel`, `money`, `events` types) and the OpenAPI client to be versioned packages. [Publish them from `platform` with semantic versions.]
5. **Frontend structure.** The launcher is in `platform`'s frontend. Each product's screens are a handoff to Antigravity, who puts them in the web app. [Antigravity owns the web app repository; products send screen specs and contracts, not code.] Confirm that the web app is a sixth repository.
6. **Neon.** Six projects: `platform`, `procurement`, `stores`, `sales`, `production`, `finance`. [Created now for the first slice, as you chose.] Creating projects bills the account, so I will confirm the names and region before creating them.
7. **Events transport.** [Outbox in each product's database, relayed by the platform's worker over BullMQ and Redis, as in `docs/infrastructure.md`.]

## 8. What I will do after your go-ahead

1. Write the six contracts in `contracts/` (platform and procurement first) and send them to Antigravity for review.
2. Set up the six repositories and the Neon projects, after you confirm the names and region.
3. Move the existing platform packages into `platform`, keeping their tests green.
4. Build `procurement` and `stores` end to end, then `sales`, `production` and `finance`, in the build order above.
