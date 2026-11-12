# QAVRIL LABS — Shared Agent & Reusable Tool Registry

**Document ID:** QAVRIL-REGISTRY-005  
**Author:** Principal AI Agent Engineer & Enterprise API Architect  
**Date:** November 5, 2026  
**Status:** Canonical Shared Tool Registry Specification  

---

## 1. Shared Reusable Agent Specifications

By establishing shared agents configured with product-specific parameters, QAVRIL LABS eliminates redundant code while delivering consistent intelligence:

| Shared Agent Name | Universal Core Capabilities | Product Consumers | Underlying Business Modules Reused |
|---|---|---|---|
| **Universal Finance Agent** | Double-entry journal posting, bank reconciliation, trial balance, tax calculations, P&L reporting | Construction ERP, Property ERP, Retail POS, Restaurant POS, HIMS, Business ERP | `@erp/ledger`, `@erp/money`, `@erp/tax` (`packages/*`) |
| **Universal Inventory Agent** | Stock balance queries, replenishment recommendations, reorder quantity formulas, scrap auditing | Retail POS, Restaurant POS, Construction Store, Garage, Production ERP | `stock_ledger.service.js`, `BOQ_ITEMS`, `Store` |
| **Universal Procurement Agent** | Vendor comparison, RFQ drafting, 3-way matching assistance (PO vs GRN vs Bill), lead time rating | Construction ERP, Property ERP, IT HelpDesk, Production ERP, Garage | `procurement.controller.js`, `trade_categories` |
| **Universal Document Agent** | OCR text extraction, invoice line-item extraction, PDF contract clause analysis, multimodal vision | Every product in the portfolio | `document_processor.py`, `ai.service.js` vision |
| **Universal Customer Support** | Omnichannel ticket intake, policy Q&A, sentiment tracking, human escalation routing | Property Tenant Portal, IT HelpDesk, Restaurant Reservations, POS, Delivery | `Voice Agent` (`LiveKit`), `IT Helpdesk` |
| **Universal Reporting Agent** | Executive KPI aggregation, natural language analytics, chart/table JSON formatting | Executive Dashboards across all 39 products | `packages/audit`, `reports/`, Fastify BI endpoints |
| **Universal Approval Agent** | Gatekeeper for high-value transactions, supervisor notification, signature validation | Purchase Orders (> $1,000), Lease terminations, Refund payouts, Deployments | Workflow Approval Center, Outbox Event Bus |

---

## 2. Reusable Core Tool Registry (Layer 1 & Layer 2)

All tools are exposed as authenticated HTTP endpoints with strict JSON-Schema contracts. Agents execute tools via API calls; direct database connections are strictly prohibited.

```
+---------------------------------------------------------------------------------------------------------+
|                                    SHARED ENTERPRISE TOOL SPECIFICATIONS                                |
+------------------------------------+-----------+-----------------------------------+--------------------+
| Tool Identifier                    | HTTP Verb | API Endpoint                      | Permission Tier    |
+------------------------------------+-----------+-----------------------------------+--------------------+
| `ledger_get_balance`               | GET       | `/v1/ledger/accounts/:code`       | Tier 1 (Read-Only) |
| `ledger_post_entry`                | POST      | `/v1/ledger/entries`              | Tier 3 (Approval)  |
| `tax_calculate_document`           | POST      | `/v1/tax/calculate`               | Tier 1 (Read-Only) |
| `sales_create_invoice`             | POST      | `/v1/sales/invoices`              | Tier 2 (Draft)     |
| `inventory_query_stock`            | GET       | `/api/v1/inventory/items/:id`     | Tier 1 (Read-Only) |
| `procurement_match_3way`           | POST      | `/api/v1/procurement/3-way-match` | Tier 1 (Read-Only) |
| `document_extract_ocr`             | POST      | `/api/v1/documents/extract`       | Tier 1 (Read-Only) |
| `approval_submit_request`          | POST      | `/v1/approvals/requests`          | Tier 4 (Write)     |
| `notification_send_multichannel`   | POST      | `/v1/notifications/send`          | Tier 4 (Write)     |
+------------------------------------+-----------+-----------------------------------+--------------------+
```

### Detailed Schema Contracts for Shared Tools

#### 1. Tool: `ledger_post_entry`
- **Description:** Posts a balanced double-entry journal entry to the General Ledger.
- **Permission Tier:** **Tier 3 (Human Approval Required)** if amount exceeds tenant threshold; otherwise **Tier 4**.
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "companyId": { "type": "string", "format": "uuid" },
      "reference": { "type": "string", "maxLength": 100 },
      "entryDate": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" },
      "currency": { "type": "string", "minLength": 3, "maxLength": 3 },
      "memo": { "type": "string" },
      "lines": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "accountCode": { "type": "string" },
            "debit": { "type": "string", "description": "Decimal minor unit string" },
            "credit": { "type": "string", "description": "Decimal minor unit string" }
          },
          "required": ["accountCode", "debit", "credit"]
        },
        "minItems": 2
      }
    },
    "required": ["companyId", "reference", "entryDate", "currency", "lines"]
  }
  ```

#### 2. Tool: `procurement_match_3way`
- **Description:** Validates unit quantities, rates, and tax across a Purchase Order, Goods Receipt Note (GRN), and Vendor Invoice.
- **Permission Tier:** **Tier 1 (Read-Only)**.
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "purchaseOrderId": { "type": "string" },
      "goodsReceiptId": { "type": "string" },
      "vendorInvoiceId": { "type": "string" },
      "tolerancePercent": { "type": "number", "default": 2.0 }
    },
    "required": ["purchaseOrderId", "goodsReceiptId", "vendorInvoiceId"]
  }
  ```

---

## 3. Product-Specific Specialized Tool Registry (Layer 3)

### Construction ERP Tools (`E:\Port\Construction`)
- `construction_get_project_budget`: Queries WBS budget heads, commitments, actual costs, and headroom (`GET /api/v1/projects/budget/reconciliation/project/:projectId`). [Tier 1]
- `construction_verify_mb`: Audits Measurement Book physical dimensions and checks against BOQ contract caps. [Tier 1]
- `construction_draft_ra_bill`: Creates a draft contractor running account bill. [Tier 2]
- `construction_analyze_site_snags`: Runs multimodal defect recognition on DPR images (`POST /api/v1/projects/:projectId/snags/analyze`). [Tier 1]

### Property Management ERP Tools (`E:\Port\PMS`)
- `pms_query_unit_availability`: Retrieves vacant units filtered by property, bedrooms, and pricing (`GET /api/units/available`). [Tier 1]
- `pms_draft_lease_agreement`: Pre-fills a standard tenancy contract with rent-free dates and security deposit schedule. [Tier 2]
- `pms_verify_pdc_schedule`: Checks post-dated cheque bank numbers against the deposit calendar. [Tier 1]
- `pms_dispatch_work_order`: Assigns a maintenance ticket to a verified vendor based on trade category. [Tier 3]

### Retail & Restaurant POS Tools (`E:\Port\POS` & `Restaurant POS`)
- `pos_scan_barcode`: Fetches product name, price, and tax code from store catalog. [Tier 1]
- `pos_apply_cart_discount`: Validates manager override credentials for discounts > 10%. [Tier 3]
- `restaurant_create_kot`: Dispatches order tickets to kitchen display stations. [Tier 4]
- `restaurant_split_bill`: Computes proportional or custom seat split totals. [Tier 1]

### Fleet & Delivery Tools (`E:\Port\Quick Commerce` & `Garage`)
- `fleet_solve_tsp_route`: Solves multi-stop optimal delivery sequence using Google Maps matrix. [Tier 1]
- `fleet_assign_driver`: Dispatches an active order to the nearest available driver. [Tier 4]
- `garage_create_job_card`: Initializes a repair ticket with VIN, customer symptoms, and technician assignment. [Tier 4]

