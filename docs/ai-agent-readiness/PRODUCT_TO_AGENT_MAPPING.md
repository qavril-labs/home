# QAVRIL LABS — Product-to-Agent Mapping & Functional Architecture

**Document ID:** QAVRIL-MAP-003  
**Author:** Principal AI Agent Engineer & Technical Product Manager  
**Date:** November 5, 2026  
**Status:** Product-Wise Specialized Agent & Bot Mapping  

---

## 1. Mapping Overview

Every product in the QAVRIL LABS portfolio connects to the **Universal AI Agent Platform (UAAP)**. While the platform provides common intelligence services (Model Gateway, Runtime, Memory, RAG, Tool Registry, Approvals, Observability), each product requires **domain-specific specialized agents, subagents, tools, and automation bots**.

Below is the complete mapping across all 39 products.

---

## 2. ERP & Enterprise Management Applications

### 1. Construction ERP (`PRD-ERP-01`)
- **Specialized Agents:**
  - *Construction Project Manager Agent:* Contextual workspace guidance grounded in project records (`copilot.controller.js`).
  - *BOQ & Estimation Agent:* Quantity takeoff assistance, rate library item matching.
  - *Material Planning Agent:* Bill-of-materials requirement calculator against store inventory.
  - *Procurement Assistant:* 3-way matching assistance (PO vs GRN vs Vendor Bill).
  - *Cost Control Agent:* Budget reconciliation auditor, negative headroom alerter.
  - *Contractor Billing Agent:* Measurement Book (MB) arithmetic auditor, RA bill certification check.
  - *Site Progress Monitoring Agent:* Daily Progress Report (DPR) log extraction and summary.
  - *Quality Inspection Agent:* Multimodal vision defect classifier on site photos (`ai.service.js`).
  - *HSE Monitoring Agent:* Health and safety checklist parser, incident escalation alerts.
  - *Project Risk Prediction Agent:* Variance order trend analyzer, milestone delay forecaster.
- **Tools:** `get_project_budget`, `reconcile_wbs`, `link_boq_item`, `verify_mb_entry`, `audit_ra_bill`.
- **Automation Bots:** Daily DPR reminder bot, subcontractor retention escalation bot.

### 2. Garage Management System (`PRD-ERP-02`)
- **Specialized Agents:**
  - *Vehicle Service Assistant:* Customer arrival intake, symptom-to-fault mapping.
  - *Job Card Intelligence Agent:* Labor hours estimator, standard repair time recommender.
  - *Spare Parts Inventory Agent:* Real-time stock reservation, supplier parts catalog lookup.
  - *Predictive Maintenance Agent:* Mileage and service history-based upcoming failure alerts.
  - *Service Advisor Agent:* Pre-invoice quote generator, customer approval communicator.
- **Tools:** `lookup_vin`, `create_job_card`, `reserve_spare_parts`, `calculate_service_quote`.
- **Automation Bots:** Next-service SMS reminder bot, overdue pickup notification bot.

### 3. Property Management ERP (`PRD-ERP-03`)
- **Specialized Agents:**
  - *Property Manager Agent:* Portfolio occupancy overview, yield and NOI analyst.
  - *Tenant Support Agent:* Omnichannel tenant FAQ resolution, ticket categorization (`portal.*`).
  - *Lease Intelligence Agent:* Lease clause compliance checker, rent escalation auditor.
  - *Rent Collection Agent:* Post-dated cheque (PDC) clearing tracker, payment reminder sequencer.
  - *Maintenance Agent:* Work order generator, contractor trade category assigner.
  - *Facility Management Agent:* Preventive equipment maintenance scheduler.
  - *Occupancy Intelligence Agent:* Lease rollover risk calculator, vacancy duration forecaster.
- **Tools:** `list_available_units`, `generate_lease_contract`, `query_pdc_status`, `dispatch_maintenance_ticket`.
- **Automation Bots:** Rent-due WhatsApp bot, lease-expiry 90/60/30 day notification bot.

### 4. Retail POS (`PRD-ERP-04`)
- **Specialized Agents:**
  - *Sales Intelligence Agent:* Daily sales pace monitor, basket size analyzer.
  - *Inventory Forecasting Agent:* Stockout predictor based on historical run rates.
  - *Replenishment Agent:* Automated reorder quantity calculation against supplier lead times.
  - *Customer Insights Agent:* Purchase history segmentation, personalized discount recommender.
  - *Pricing Intelligence Agent:* Competitor price matching and margin health auditor.
  - *Fraud & Anomaly Detection Agent:* Cashier discount outliers, excessive voided cart alerts.
- **Tools:** `scan_barcode`, `calculate_cart_tax`, `issue_cashier_refund`, `trigger_store_transfer`.
- **Automation Bots:** End-of-shift register reconciliation bot, low-stock reorder bot.

### 5. Restaurant POS (`PRD-ERP-05`)
- **Specialized Agents:**
  - *Restaurant Operations Agent:* Service speed monitor, kitchen turnaround analyst.
  - *Menu Intelligence Agent:* High-margin item promoter, slow-moving dish identifier.
  - *Food Cost Optimization Agent:* Ingredient portioning auditor, recipe cost variance tracker.
  - *Kitchen Planning Agent:* Station load balancer (Grill, Saute, Pastry).
  - *Demand Forecasting Agent:* Weather/day-of-week diner footfall predictor.
  - *Table & Reservation Assistant:* VIP diner seating allocator, no-show predictor.
- **Tools:** `create_kot`, `split_table_bill`, `reserve_dining_table`, `deduct_recipe_inventory`.
- **Automation Bots:** Kitchen delay alert bot, raw material expiry warning bot.

### 6. IT HelpDesk (`PRD-ERP-06`)
- **Specialized Agents:**
  - *IT Support Agent:* First-contact resolution assistant for internal users.
  - *Incident Classification Agent:* Priority and category tagger (P1–P4) based on ticket description.
  - *Troubleshooting Agent:* Step-by-step diagnostic guide for hardware/software issues.
  - *Knowledge Base Agent:* Semantic documentation search over enterprise tech stacks.
  - *SLA Monitoring Agent:* Breach warning predictor for approaching resolution deadlines.
  - *Ticket Resolution Assistant:* Solution drafting bot summarizing resolved root causes.
- **Tools:** `create_ticket`, `escalate_ticket`, `query_sla_timer`, `grant_repo_access`.
- **Automation Bots:** SLA breach warning bot, user feedback survey bot.

### 7. Procurement Management (`PRD-ERP-07`)
- **Specialized Agents:**
  - *Vendor Discovery Agent:* Supplier web discovery and catalog scraper.
  - *RFQ Automation Agent:* Request-for-quotation draft generator from purchase requisitions.
  - *Quotation Comparison Agent:* Multi-vendor price, delivery, and payment terms scoring matrix.
  - *Purchase Recommendation Agent:* Optimal supplier selector balancing cost and lead time.
  - *Vendor Risk Intelligence Agent:* Vendor delivery delay and quality defect history rater.
- **Tools:** `extract_quote_pdf`, `compare_vendor_rates`, `generate_purchase_order`, `score_supplier`.
- **Automation Bots:** Unanswered RFQ reminder bot, price increase alert bot.

### 8. Production & Planning ERP (`PRD-ERP-08`)
- **Specialized Agents:**
  - *Production Planning Agent:* Master Production Schedule (MPS) generator.
  - *Demand Forecasting Agent:* Finished goods seasonal demand curve predictor.
  - *Capacity Planning Agent:* Machine hours and labor shift bottleneck detector.
  - *Quality Intelligence Agent:* Assembly defect root-cause pattern recognizer.
  - *Production Scheduling Agent:* Dynamic job shop order dispatcher.
  - *Material Requirements Planning (MRP) Agent:* Raw material purchase order generator.
- **Tools:** `calculate_mrp`, `schedule_work_order`, `log_quality_defect`, `query_machine_capacity`.
- **Automation Bots:** Shift handover summary bot, scrap rate spike alert bot.

### 9. Quick Commerce Delivery Platform (`PRD-ERP-09`)
- **Specialized Agents:**
  - *Delivery Planning Agent:* Order batching and delivery time-window optimizer.
  - *Rider Allocation Agent:* Proximity, vehicle capacity, and driver workload assigner.
  - *Order Intelligence Agent:* Order preparation ETA predictor at dark store.
  - *Dispatch Optimization Agent:* Real-time route traffic re-router.
  - *Delivery Exception Agent:* Address ambiguity resolver, failed delivery handler.
- **Tools:** `assign_order_to_driver`, `calculate_delivery_route`, `validate_proof_of_delivery`.
- **Automation Bots:** Delayed delivery customer alert bot, rider idle re-engagement bot.

### 10. Visitor Management System (`PRD-ERP-10`)
- **Specialized Agents:**
  - *Visitor Registration Assistant:* Pre-arrival registration and QR invite guide.
  - *Access Request Agent:* Departmental host approval router.
  - *Visitor Notification Bot:* Instant host notification via SMS/WhatsApp upon guest arrival.
  - *Security & Compliance Monitoring Agent:* Watchlist cross-referencer, DPDP/GDPR data masking auditor.
- **Tools:** `verify_guest_id`, `print_visitor_badge`, `open_barrier_gate`, `audit_active_headcount`.
- **Automation Bots:** Overstay alert bot, emergency evacuation headcount bot.

### 11. Fleet & Transport Management (`PRD-ERP-11`)
- **Specialized Agents:**
  - *Fleet Operations Agent:* Vehicle availability and assignment controller.
  - *Dispatch Agent:* Cargo load and delivery run planner.
  - *Route Optimization Agent:* Traveling Salesperson (TSP) multi-drop route solver.
  - *Predictive Maintenance Agent:* Telematics odometer and engine sensor anomaly analyzer.
  - *Driver Assistant:* Turn-by-turn instruction and rest-break compliance advisor.
  - *Delivery Planning Agent:* Cross-docking and consignment consolidation planner.
- **Tools:** `optimize_multi_stop_route`, `log_fuel_receipt`, `check_driver_hours`, `book_fleet_service`.
- **Automation Bots:** Driver license expiry reminder bot, speeding/harsh braking alert bot.

### 12. HIMS – Hospital Information Management System (`PRD-ERP-12`)
> [!IMPORTANT]
> All clinical or medical decision support must remain strictly clinician-supervised. Agents act purely as administrative and operational assistants.
- **Specialized Agents:**
  - *Hospital Operations Agent:* Bed occupancy and operating theater queue optimizer.
  - *Appointment Scheduling Agent:* Doctor specialty calendar matcher, patient intake scheduler.
  - *Patient Support Agent:* Pre-admission instructions and post-discharge care guide.
  - *Medical Records Document Agent:* Medical transcription formatter, lab report categorizer.
  - *Billing Intelligence Agent:* Insurance claim coding validator (ICD-10 / CPT), co-pay calculator.
  - *Hospital Resource Planning Agent:* Pharmacy inventory and PPE depletion forecaster.
- **Tools:** `check_doctor_availability`, `verify_insurance_eligibility`, `dispense_medication`, `generate_patient_bill`.
- **Automation Bots:** Prescription refill reminder bot, lab result ready notification bot.

### 13. HRMS – Human Resource Management (`PRD-ERP-13`)
- **Specialized Agents:**
  - *Recruitment Agent:* Resume parser, job description matcher, candidate interview screener.
  - *Employee Support Agent:* Policy Q&A bot (leave, benefits, insurance) from employee handbook.
  - *Attendance Intelligence Agent:* Shift anomaly detector, biometric punch reconciliation assistant.
  - *Payroll Validation Agent:* Statutory deductions (PF, ESI, TDS) and overtime auditor.
  - *HR Analytics Agent:* Attrition risk forecaster, compensation parity benchmark analyst.
  - *Learning & Development Agent:* Personalized employee training course recommender.
- **Tools:** `query_leave_balance`, `calculate_payroll_deductions`, `schedule_interview`, `generate_payslip`.
- **Automation Bots:** Birthday/anniversary bot, probation review reminder bot.

### 14. Finance & Accounting (`PRD-ERP-14`)
- **Specialized Agents:**
  - *Accounts Reconciliation Agent:* Bank statement vs ledger transaction matcher.
  - *Financial Reporting Agent:* Balance sheet, P&L, and trial balance narrative synthesizer.
  - *Expense Intelligence Agent:* Employee reimbursement auditor, duplicate claim detector.
  - *Tax Compliance Assistant:* GST/VAT/TDS liability calculator, filing deadline tracker.
  - *Cash Flow Forecasting Agent:* Rolling 30/60/90-day liquidity predictor.
  - *Invoice Processing Agent:* Automated OCR AP invoice coder and journal drafter.
- **Tools:** `post_journal_entry`, `reconcile_bank_statement`, `calculate_tax_liability`, `generate_pnl`.
- **Automation Bots:** Month-end closing checklist reminder bot, payment run approval bot.

### 15. Sales Management (`PRD-ERP-15`)
- **Specialized Agents:**
  - *Sales Intelligence Agent:* Deal conversion probability rater, pipeline velocity tracker.
  - *Quotation Assistant:* Pre-approved discount validator, contract pricing generator.
  - *Account Executive Copilot:* Meeting preparation summarizer, customer history debriefer.
  - *Sales Performance Agent:* Rep quota attainment and commission calculator.
- **Tools:** `create_sales_invoice`, `generate_quotation`, `apply_customer_discount`, `log_sales_activity`.
- **Automation Bots:** Quote expiry follow-up bot, deal stalled warning bot.

### 16. Purchase Management (`PRD-ERP-16`)
- **Specialized Agents:**
  - *Purchase Requisition Agent:* Budget allocation verifier for department purchase requests.
  - *Purchase Order Agent:* Vendor lead time and payment terms optimizer.
  - *Vendor Performance Agent:* On-time delivery and return-rate scoring assistant.
- **Tools:** `create_purchase_order`, `verify_budget_headroom`, `approve_purchase_requisition`.
- **Automation Bots:** Purchase order acceptance reminder bot, goods receipt confirmation bot.

### 17. Business & SME ERP (`PRD-ERP-17`)
- **Specialized Agents:**
  - *SME Executive Copilot:* Natural language business health assistant ("What was our revenue this week?").
  - *Unified Business Health Agent:* Cross-departmental anomaly detector (cash vs inventory vs sales).
- **Tools:** `query_business_kpis`, `export_executive_summary`, `bootstrap_tenant_company`.
- **Automation Bots:** Weekly executive digest bot, system backup verification bot.

---

## 3. AI & Intelligent Products

### 18. Universal AI Agent Platform (UAAP) – Flagship (`PRD-AI-01`)
- **Core Orchestrator:** Master Router, intent classifier, subagent task delegator, global state manager.
- **Platform Agents:** Agent Lifecycle Manager, Tool Permission Gatekeeper, Token Metering Controller.

### 19. Enterprise AI Copilot (`PRD-AI-02`)
- Multi-surface workspace companion embedded in web, mobile, and desktop ERP clients.

### 20. Enterprise Knowledge Copilot (`PRD-AI-03`)
- Hybrid RAG search engine operating across unstructured PDF/Word files and structured database records.

### 21. AI Customer Support Agent (`PRD-AI-04`)
- Multi-tier support bot equipped with LiveKit voice agent, web chat, and IT HelpDesk ticket creation tools.

### 22. AI Sales Assistant (`PRD-AI-05`)
- Inbound lead qualifier, automated email/LinkedIn sequencer, demo calendar booking assistant.

### 23. AI Customer Feedback Intelligence (`PRD-AI-06`)
- Sentiment analysis engine extracting review themes from app stores, Google Reviews, and survey tickets.

### 24. Smart Inventory Forecasting (`PRD-AI-07`)
- Time-series demand forecaster feeding reorder recommendations to Retail, Restaurant, and Construction ERPs.

### 25. Intelligent Document Processing (`PRD-AI-08`)
- Universal OCR extraction engine outputting structured JSON schemas from receipts, invoices, and blueprints.

### 26. AI Procurement Assistant (`PRD-AI-09`)
- External quotation web crawler and vendor negotiation assistant.

### 27. AI Marketing Automation (`PRD-AI-10`)
- Trend scraper, SEO blog drafter, and automated multi-channel campaign scheduler.

---

## 4. Automation & Technology Products

### 28. Business Process Automation (`PRD-TECH-01`)
- Event-driven state transition engine triggered by transactional outbox events across applications.

### 29. Cloud Infrastructure Automation (`PRD-TECH-02`)
- Automated staging-to-production deployment request approver and CI/CD verification bot.

### 30. Cloud & DevOps Solutions (`PRD-TECH-03`)
- Docker container health monitor, SSL certificate renewal bot, automated environment teardown daemon.

### 31. Data Engineering & BI (`PRD-TECH-04`)
- Cross-database ETL synchronizer, reporting data warehouse builder, automated anomaly reporter.

### 32. Cybersecurity & Resilience (`PRD-TECH-05`)
- Prompt injection firewall, brute-force login detector, SQL constraint violation monitor.

### 33. IoT & Connected Systems (`PRD-TECH-06`)
- Boom-barrier controller, biometric punch synchronizer, GPS driver telematics ingestion bot.

### 34. Digital Product Design System (`PRD-TECH-07`)
- Visual design token consistency checker, component accessibility (a11y) auditor.

---

## 5. Immersive Technology Solutions

### 35. AR/VR/MR Applications (`PRD-IMM-01`)
- Spatial asset viewer, BIM 3D model inspector for construction engineers on site.

### 36. WebAR Experiences (`PRD-IMM-02`)
- Zero-download product placement in browser canvas via Three.js (`site/scene3d.js`).

### 37. Virtual Showrooms (`PRD-IMM-03`)
- Interactive 3D walk-through for real estate off-plan developments and automobile showrooms.

### 38. 3D Product Configurators (`PRD-IMM-04`)
- Dynamic 3D model customization engine updating dimensions, materials, and prices in real-time.

### 39. Digital Twins & Simulations (`PRD-IMM-05`)
- Building information model (BIM) digital twin simulating real-time construction site progress and equipment telemetry.

