# QAVRIL LABS — AI Agent & Automation Inventory and Rationalization (Expanded)

**Document ID:** QAVRIL-AUDIT-007-V2  
**Author:** Principal AI Agent Engineer & Technical Product Manager  
**Date:** November 5, 2026  
**Status:** Unified Three-Layer Agent Catalog Across 39 Products  

---

## 1. Principles of Enterprise Agent Rationalization

Across the expanded **39-product portfolio**, instantiating independent AI applications for each product would result in unmanageable prompt drift, security blind spots, and duplicated development. 

QAVRIL LABS employs a **Three-Layer Universal Agent Hierarchy**:
1. **Layer 1 – Universal Intelligence:** 1 Flagship Platform (UAAP), Master Orchestrator, Model Gateway, Runtime, Memory, Tool Registry, Outbox Worker, Approval Center, Observability.
2. **Layer 2 – Reusable Business Domain Agents:** 7 Shared Core Subagents serving multiple products (Finance, Inventory, Procurement, Document Intelligence, Customer Support, Reporting, Approvals).
3. **Layer 3 – Product-Specific Vertical Agents:** 45 Specialized Subagents and Domain Tools tailored to individual verticals (Construction, Property, Retail POS, Restaurant POS, Garage, Quick Commerce, IT HelpDesk, VMS, HIMS, etc.).
4. **Autonomous Automation Bots:** 25 Reusable Event-Driven & Deterministic Bots (Email, WhatsApp, Outbox Dispatch, Approvals, Notifications).

---

## 2. Layer 1 & 2: Shared Universal & Domain Subagent Inventory

| # | Agent Name | Layer | Primary Capabilities | Shared Product Consumers | Verified Codebase Foundation |
|---|---|---|---|---|---|
| 1 | **QAVRIL Master Orchestrator** | Layer 1 | Intent routing, task decomposition, agent delegation | Every product in the portfolio | `E:\Port\Zyno Genie` (LangGraph state graph) |
| 2 | **Universal Finance Agent** | Layer 2 | Double-entry journal checks, bank reconciliation, P&L generation | Construction, Property, Retail, Restaurant, HIMS, SME | `packages/ledger`, `Personal Finance` |
| 3 | **Universal Inventory Agent** | Layer 2 | Stock burn rates, replenishment formulas, reorder lead times | Retail POS, Restaurant, Construction, Garage, Production | `stock_ledger.service.js` |
| 4 | **Universal Procurement Agent**| Layer 2 | 3-way matching assistance, RFQ scoring, supplier ratings | Construction, Property, IT HelpDesk, Production | `E:\Port\Procurement`, `PMS trade_categories` |
| 5 | **Document Intelligence Agent** | Layer 2 | Multimodal OCR, invoice extraction, contract analysis | All 39 products across the portfolio | `E:\Port\Scrapper RAG`, `ai.service.js` |
| 6 | **Customer Support Agent** | Layer 2 | Omnichannel voice and chat resolution, FAQ deflection | Property Portal, IT HelpDesk, POS, Delivery App | `E:\Port\Voice Agent` (`LiveKit`), `IT Helpdesk` |
| 7 | **Universal Reporting Agent** | Layer 2 | Cross-product KPI consolidation, executive summaries | All 39 products across the portfolio | `packages/audit`, `reports/` |
| 8 | **Universal Approval Agent** | Layer 2 | Human-in-the-loop gatekeeper for high-value operations | Gated writes across all enterprise modules | Workflow Engine, Outbox Pattern |

---

## 3. Layer 3: Vertical-Specific Specialized Subagents (Summary)

### Construction ERP (`PRD-ERP-01`)
- *Construction Project Manager Agent:* Grounded project workspace copilot (`copilot.controller.js`).
- *BOQ & Estimation Agent:* Quantity takeoff assistance, rate library matching.
- *Material Planning Agent:* Bill-of-materials requirement calculator against store inventory.
- *Cost Control Agent:* Budget reconciliation auditor, negative headroom alerter.
- *Contractor Billing Agent:* Measurement Book (MB) arithmetic auditor, RA bill certification check.
- *Site Progress Monitoring Agent:* Daily Progress Report (DPR) log extraction and summary.
- *Quality Inspection Agent:* Multimodal vision defect classifier on site photos (`ai.service.js`).
- *HSE Monitoring Agent:* Health and safety checklist parser, incident escalation alerts.
- *Project Risk Prediction Agent:* Variance order trend analyzer, milestone delay forecaster.

### Property Management ERP (`PRD-ERP-03`)
- *Property Manager Agent:* Portfolio occupancy overview, yield and NOI analyst.
- *Tenant Support Agent:* Omnichannel tenant FAQ resolution, ticket categorization (`portal.*`).
- *Lease Intelligence Agent:* Lease clause compliance checker, rent escalation auditor.
- *Rent Collection Agent:* Post-dated cheque (PDC) clearing tracker, payment reminder sequencer.
- *Maintenance Agent:* Work order generator, contractor trade category assigner.
- *Facility Management Agent:* Preventive equipment maintenance scheduler.
- *Occupancy Intelligence Agent:* Lease rollover risk calculator, vacancy duration forecaster.

### Retail & Restaurant POS (`PRD-ERP-04` & `PRD-ERP-05`)
- *Retail Sales Intelligence Agent:* Basket size optimizer, discount outlier detector.
- *Retail Replenishment Agent:* Automated reorder quantity calculation against supplier lead times.
- *Restaurant Operations Agent:* Kitchen order turnaround monitor, food cost variance tracker.
- *Menu Intelligence Agent:* High-margin item promoter, slow-moving dish identifier.
- *Kitchen Planning Agent:* Station load balancer (Grill, Saute, Pastry).
- *Table & Reservation Assistant:* VIP diner seating allocator, no-show predictor.

### Fleet & Logistics (`PRD-ERP-02`, `PRD-ERP-09`, `PRD-ERP-11`)
- *Garage Service Assistant:* Symptom-to-fault mapping, job card labor estimator.
- *Delivery Planning Agent:* Order batching and delivery time-window optimizer.
- *Rider Allocation Agent:* Proximity, vehicle capacity, and driver workload assigner.
- *Route Optimization Agent:* Traveling Salesperson (TSP) multi-drop route solver.
- *Predictive Fleet Maintenance Agent:* Telematics odometer and engine sensor anomaly analyzer.
- *Driver Assistant:* Turn-by-turn instruction and rest-break compliance advisor.

### IT Operations, Security & Healthcare (`PRD-ERP-06`, `PRD-ERP-10`, `PRD-ERP-12`)
- *IT Support & Incident Classification Agent:* Priority and category tagger (P1–P4) based on description.
- *IT SLA Monitoring Agent:* Breach warning predictor for approaching resolution deadlines.
- *Visitor Management Assistant:* Pre-registration QR guide, host approval router.
- *Security & Compliance Monitoring Agent:* Watchlist cross-referencer, DPDP/GDPR data masking auditor.
- *HIMS Hospital Operations Agent:* Bed occupancy and operating theater queue optimizer (clinician-supervised).
- *HIMS Medical Records Document Agent:* Medical transcription formatter, lab report categorizer.

---

## 4. Reusable Automation Bots (Layer 1 Automation Tier)

1. **Transactional Outbox Worker Bot:** Continuously polls and dispatches `outbox_events`.
2. **Approval Reminder & Escalation Bot:** Nudges supervisors when approval tickets sit idle.
3. **Multi-Channel Notification Bot:** Dispatches outbound alerts via Email, SMS, and WhatsApp.
4. **Lead Nurturing & Booking Bot:** Auto-processes incoming demo leads from the marketing site (`site/leads`).
5. **Data Validation & Invariant Checking Bot:** Audits ledger balance invariants and budget headroom.
6. **Rent-Due Reminder Bot:** Automated tenant PDC maturity notifications.
7. **Daily DPR Summary Bot:** Consolidates daily site progress reports for project directors.
8. **End-of-Shift POS Reconciliation Bot:** Matches cash drawer totals against journal sales.
9. **License & Maintenance Expiry Bot:** Warns fleet operators and HRMS teams of document expiration.
10. **System Health & Dead-Letter Monitor Bot:** Alerts engineering teams to failed queue jobs.
