# QAVRIL LABS — Product-Wise AI Implementation Roadmap

**Document ID:** QAVRIL-ROADMAP-007  
**Author:** Principal Technical Product Manager & AI Systems Architect  
**Date:** November 5, 2026  
**Status:** Product-Wise Phased AI Rollout Specification  

---

## 1. Phased Product AI Delivery Strategy

Rather than attempting to build agents for all 39 products simultaneously, the rollout follows a structured five-stage delivery plan (**Waves A through E**). This ensures that foundational platform intelligence is stabilized before specialized vertical products are onboarded.

```
[ WAVE A: UAAP Platform Foundation & Universal Shared Agents ]
                               │
                               ▼
[ WAVE B: Flagship ERP Copilots (Construction & Property Management) ]
                               │
                               ▼
[ WAVE C: POS, Commerce & Fleet Intelligence (Retail, Restaurant, Garage, Quick Commerce) ]
                               │
                               ▼
[ WAVE D: Operations, Enterprise & Healthcare (IT HelpDesk, VMS, HIMS, HRMS) ]
                               │
                               ▼
[ WAVE E: Autonomous Technology, Multi-Agent Optimization & Immersive Solutions ]
```

---

## 2. Detailed Delivery Waves

### Wave A: UAAP Platform Foundation & Universal Shared Agents
- **Target Products:** Universal AI Agent Platform (`PRD-AI-01`), Shared Modules (Finance, Sales, Procurement, Inventory, Documents).
- **Core Deliverables:**
  1. Central FastAPI Model Gateway with Ollama Cloud (`deepseek-v4.1-flash:cloud`, `gemma4:31b-cloud`, `glm-5.3-flash:cloud`, `minimax-m2.7:cloud`) and provider fallback.
  2. Master AI Orchestrator with LangGraph state graph and Redis working memory.
  3. Shared Tool Registry enforcing the 5-Tier Permission Gate.
  4. Universal Document Intelligence Agent (OCR & contract parsing).
  5. Universal Finance Agent (double-entry ledger validation & bank reconciliation).
  6. Universal Inventory & Procurement Agents.
- **Estimated Duration:** 4 weeks.
- **Milestone Exit Criteria:** All 6 universal domain subagents successfully execute verified tool calls against Fastify APIs in automated test harnesses.

---

### Wave B: Flagship ERP Copilots (Construction & Property)
- **Target Products:** Construction ERP (`PRD-ERP-01`), Property Management ERP (`PRD-ERP-03`).
- **Core Deliverables:**
  1. **Construction ERP Agents:**
     - Grounded Project Manager Agent (upgraded from existing `copilot.controller.js`).
     - BOQ & Estimation Agent (quantity takeoff calculator).
     - Contractor Billing & Measurement Book (MB) audit agent.
     - Budget Reconciler & Negative Headroom alert bot.
     - Site Progress & Vision Defect Inspection Agent (multimodal DPR image classifier).
  2. **Property Management ERP Agents:**
     - Tenant Support Agent (integrated with Tenant Portal `/portal`).
     - Lease Intelligence Agent (rent-free schedule & clause auditor).
     - PDC Rent Collection Agent (post-dated cheque clearing workflow tracker).
     - Maintenance Work Order Dispatch Agent.
- **Estimated Duration:** 5 weeks.
- **Milestone Exit Criteria:** Construction and PMS users can converse with domain copilots, review AI-drafted purchase orders and leases, and approve transactions via the human approval center.

---

### Wave C: Commerce, POS & Fleet Intelligence
- **Target Products:** Retail POS (`PRD-ERP-04`), Restaurant POS (`PRD-ERP-05`), Garage Management (`PRD-ERP-02`), Quick Commerce Delivery (`PRD-ERP-09`), Fleet Management (`PRD-ERP-11`).
- **Core Deliverables:**
  1. **Retail POS:** Sales Intelligence, automated inventory reordering, cashier discount anomaly detector.
  2. **Restaurant POS:** Kitchen order turnaround monitor, recipe ingredient stock depletion, dining reservation assistant.
  3. **Garage Management:** VIN decoder, job card labor estimator, spare parts inventory reservation.
  4. **Quick Commerce & Fleet:** TSP multi-stop route optimizer, real-time driver dispatcher, proof-of-delivery validator.
- **Estimated Duration:** 5 weeks.
- **Milestone Exit Criteria:** POS checkout turnaround maintains < 30 seconds; delivery dispatch runs autonomously with optimal routing.

---

### Wave D: Enterprise Operations, Healthcare & Workforce
- **Target Products:** IT HelpDesk (`PRD-ERP-06`), Visitor Management (`PRD-ERP-10`), HIMS Healthcare (`PRD-ERP-12`), HRMS (`PRD-ERP-13`), AI Sales Assistant (`PRD-AI-05`), AI Customer Feedback (`PRD-AI-06`).
- **Core Deliverables:**
  1. **IT HelpDesk:** Ticket auto-classification, SLA breach predictor, deployment request gatekeeper.
  2. **Visitor Management:** Pre-registration QR guide, instant host WhatsApp alerter, DPDP/GDPR data masking auditor.
  3. **HIMS:** Clinician-supervised patient intake scheduler, medical records transcriptionist, pharmacy inventory depletion forecaster.
  4. **HRMS:** Resume parser, employee handbook policy Q&A bot, payroll deduction validator.
  5. **Sales & Marketing:** Automated lead nurturing bot (`site/leads`), app store review sentiment analyzer.
- **Estimated Duration:** 6 weeks.
- **Milestone Exit Criteria:** IT tickets and visitor arrivals handled with automated workflows; patient data strictly clinician-supervised.

---

### Wave E: Autonomous Technology, Simulations & Immersive Solutions
- **Target Products:** Business Process Automation (`PRD-TECH-01`), Cloud & DevOps Automation (`PRD-TECH-02/03`), WebAR & 3D Configurators (`PRD-IMM-02/04`), Digital Twins & Simulations (`PRD-IMM-05`).
- **Core Deliverables:**
  1. Cross-enterprise transactional outbox event automation.
  2. Multi-agent collaborative supply chain negotiation.
  3. WebAR interactive product placement on web canvases (`site/scene3d.js`).
  4. Construction 4D BIM digital twin simulating site progress against Gantt schedules.
- **Estimated Duration:** Ongoing / Advanced R&D.

