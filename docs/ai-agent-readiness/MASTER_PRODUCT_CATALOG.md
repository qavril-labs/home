# QAVRIL LABS — Master Product Catalog & Multi-Product Portfolio

**Document ID:** QAVRIL-CATALOG-001  
**Author:** Principal Enterprise ERP Architect & Technical Product Manager  
**Date:** November 5, 2026  
**Status:** Canonical Enterprise Portfolio Specification (Phase 1B)  

---

## 1. Portfolio Philosophy: Standalone Products vs Reusable Modules

A cornerstone architectural requirement of QAVRIL LABS is the clear distinction between:
1. **Standalone Products:** Dedicated customer-facing applications designed for specific business verticals (e.g., Construction ERP, Property Management ERP, Retail POS, Restaurant POS, Visitor Management).
2. **Reusable ERP Modules:** Standardized business engines (e.g., General Ledger, Sales Invoicing, Purchase Orders, 3-Way Matching, Inventory Ledger, HRMS Core, Tax Rules Engine) that can operate as standalone services or be embedded across multiple ERP products without code or logic duplication.

```
+----------------------------------------------------------------------------------------------------+
|                                     STANDALONE PRODUCT SUITE                                       |
|  Construction ERP · Property Management ERP · Retail POS · Restaurant POS · IT HelpDesk · VMS ...   |
+----------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼
+----------------------------------------------------------------------------------------------------+
|                                   SHARED REUSABLE ERP MODULES                                      |
|  Finance & Ledger · Sales & Invoicing · Purchase & Procurement · Inventory & Store · HRMS · Tax   |
|            (Shared Kernel in packages/* and Authorized Reusable Database Schemas)                  |
+----------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼
+----------------------------------------------------------------------------------------------------+
|                           UNIVERSAL AI AGENT PLATFORM (UAAP - FLAGSHIP)                             |
|       Master Orchestrator · Model Gateway · Agent Runtime · Tool Registry · RAG Memory             |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Complete 39-Product Master Inventory

### Category A: ERP & Enterprise Management Applications (17 Products)

| Product ID | Official Product Name | Standalone / Reusable Module | Primary Vertical / Target Market | Discovered Codebase Location |
|---|---|---|---|---|
| **PRD-ERP-01** | **Construction ERP** | Standalone Product (incorporates Store, Purchase, Cost Ledger modules) | EPC, Infrastructure, Commercial Real Estate Developers | `E:\Port\Construction` |
| **PRD-ERP-02** | **Garage Management System** | Standalone Product (incorporates Inventory, Invoicing modules) | Auto workshops, commercial dealerships, service centers | `E:\Port\Garage Management` |
| **PRD-ERP-03** | **Property Management ERP** | Standalone Product (incorporates Leasing, Finance, Maintenance modules) | Landlords, REITs, facility operators, co-living | `E:\Port\Property Management System` |
| **PRD-ERP-04** | **Retail POS** | Standalone Product (incorporates Sales, Inventory, Tax modules) | Supermarkets, boutiques, multi-outlet retail chains | `E:\Port\POS` (`zyno_pos_*`, `ZynoPOSMobile`) |
| **PRD-ERP-05** | **Restaurant POS** | Standalone Product (incorporates KOT, Billing, Recipe Costing modules) | Fine dining, QSR, cafes, multi-chain restaurants | `E:\Port\Restaurant POS` (`serve-sweetly-engine`) |
| **PRD-ERP-06** | **IT HelpDesk** | Standalone Product (incorporates SLA, Ticketing, CMDB modules) | Enterprise IT teams, managed service providers | `E:\Port\IT Helpdesk` |
| **PRD-ERP-07** | **Procurement Management** | Reusable Module & Standalone Solution | Enterprise purchasing departments, supply chain hubs | `E:\Port\Procurement`, `E:\SaaS\packages\db` |
| **PRD-ERP-08** | **Production & Planning ERP** | Reusable Module & Standalone Solution | Discrete manufacturing, assembly plants, fabrication | `E:\SaaS\ERP-Product-Catalog.md` (MFG-01–10) |
| **PRD-ERP-09** | **Quick Commerce Delivery Platform** | Standalone Product (incorporates Driver Dispatch, Tracking) | Hyperlocal delivery, dark stores, last-mile logistics | `E:\Port\Quick Commerce Delivery Partner` |
| **PRD-ERP-10** | **Visitor Management System (VMS)** | Standalone Product (incorporates Kiosk, Access, Security) | Corporate campuses, gated communities, secure sites | `E:\Port\VMS` |
| **PRD-ERP-11** | **Fleet & Transport Management** | Reusable Module & Standalone Solution | Logistics fleets, transport operators, distribution | `E:\Port\Garage Management` & `Quick Commerce` |
| **PRD-ERP-12** | **HIMS (Hospital Information System)** | Standalone Product (incorporates EMR, Pharmacy, Billing) | Hospitals, outpatient clinics, multi-specialty centers | `E:\Port\Health Prescription` & `ERP-Catalog` |
| **PRD-ERP-13** | **HRMS (Human Resource Management)** | Reusable Module & Standalone Solution | Cross-industry enterprise workforce administration | `E:\Port\PMS\supabase\migrations\202608240001` |
| **PRD-ERP-14** | **Finance & Accounting** | Reusable Module & Standalone Solution | Core general ledger, double-entry, multi-currency | `E:\SaaS\packages\ledger`, `Personal Finance` |
| **PRD-ERP-15** | **Sales Management** | Reusable Module & Standalone Solution | Invoicing, accounts receivable, quotation pipeline | `E:\SaaS\packages\sales`, `SalesRobot+Hi-Reply` |
| **PRD-ERP-16** | **Purchase Management** | Reusable Module & Standalone Solution | Requisitions, purchase orders, vendor evaluation | `E:\Port\Construction\src\modules\purchase` |
| **PRD-ERP-17** | **Business & SME ERP** | Standalone Platform Foundation | Global small and medium businesses requiring unified ERP | `E:\SaaS` (Core Monorepo & Fastify API) |

---

### Category B: AI & Intelligent Products (10 Products)

| Product ID | Official Product Name | Architecture Pattern | Flagship / Specialized | Discovered Codebase Location |
|---|---|---|---|---|
| **PRD-AI-01** | **Universal AI Agent Platform (UAAP)** | Central Intelligence Layer (FastAPI, LangGraph, Model Gateway) | **FLAGSHIP PRODUCT** | `E:\Port\Zyno Genie` & `Scrapper RAG` |
| **PRD-AI-02** | **Enterprise AI Copilot** | Contextual Workspace Assistant (Sidebar UI + LLM API) | Specialized Intelligence | `E:\Port\Enterprise Copilot for ERPCRM` |
| **PRD-AI-03** | **Enterprise Knowledge Copilot** | Multi-Tenant RAG & Enterprise Search | Specialized Intelligence | `E:\Port\Voice Agent` & `Scrapper RAG` |
| **PRD-AI-04** | **AI Customer Support Agent** | Omnichannel Voice & Chat Support Engine | Specialized Autonomous Agent | `E:\Port\Voice Agent` & `site/bots/` |
| **PRD-AI-05** | **AI Sales Assistant** | Lead Qualification & Automated Outreach Engine | Specialized Autonomous Agent | `E:\Port\SalesRobot+Hi-Reply` & `site/leads` |
| **PRD-AI-06** | **AI Customer Feedback Intelligence**| Multichannel Sentiment & Anomaly Detection | Specialized Intelligence | `E:\Port\News chatbot` & App Store Datasets |
| **PRD-AI-07** | **Smart Inventory Forecasting** | Demand Curve & Stock Depletion ML/LLM Predictor | Specialized Subagent | `E:\SaaS\ERP-Product-Catalog.md` (AI-06) |
| **PRD-AI-08** | **Intelligent Document Processing** | OCR, Vision Defect & Contract Extraction Engine | Specialized Subagent | `E:\Port\Scrapper RAG` & `Construction AI` |
| **PRD-AI-09** | **AI Procurement Assistant** | Automated RFQ, Quote Comparison & 3-Way Matching | Specialized Subagent | `E:\Port\Procurement` & Construction Store |
| **PRD-AI-10** | **AI Marketing Automation** | Automated Trend Research, Content & Social Outreach | Specialized Autonomous Agent | `E:\Port\SalesRobot+Hi-Reply` & `News chatbot` |

---

### Category C: Automation & Technology Products (7 Products)

| Product ID | Official Product Name | Category | Primary Focus | Discovered Codebase Location |
|---|---|---|---|---|
| **PRD-TECH-01** | **Business Process Automation Platform** | Automation | Outbox event bus, asynchronous workflow routing | `E:\SaaS\packages\events`, `E:\Port\Syncora` |
| **PRD-TECH-02** | **Cloud Infrastructure Automation** | Technology | Automated deployment gates, staging/prod pipelines | `E:\Port\IT Helpdesk\comprehensive_integration` |
| **PRD-TECH-03** | **Cloud & DevOps Solutions** | Technology | Containerization, reverse proxies, CI/CD templates | `docker-compose.yml`, Dockerfiles across repos |
| **PRD-TECH-04** | **Data Engineering & BI** | Technology | Immutable audit logs, change data capture, reports | `packages/audit`, `Personal Finance Analyzer` |
| **PRD-TECH-05** | **Cybersecurity & Resilience** | Technology | Zero-Trust RLS, scrypt auth, SQL target guards | `packages/db`, `database_target_guard.js` |
| **PRD-TECH-06** | **IoT & Connected Systems** | Technology | Barrier gates, RFID kiosks, driver GPS telematics | `E:\Port\VMS`, `Quick Commerce Delivery App` |
| **PRD-TECH-07** | **Digital Product Design System** | Technology | Unified UI tokens, accessible component library | `site/styles.css`, Radix UI & Tailwind configs |

---

### Category D: Immersive Technology Solutions (5 Products)

| Product ID | Official Product Name | Delivery Mechanism | Target Use Case | Discovered Codebase Location |
|---|---|---|---|---|
| **PRD-IMM-01** | **AR/VR/MR Applications** | WebXR / Native Spatial | Architecture walk-throughs, safety training | `ERP-Product-Catalog.md` (P4 Immersive) |
| **PRD-IMM-02** | **WebAR Experiences** | Browser-based WebGL/WebXR | Zero-install product placement in browser | `E:\SaaS\site\scene3d.js` |
| **PRD-IMM-03** | **Virtual Showrooms** | Interactive 3D Canvas | Real estate unit tour, automobile inspection | `E:\Port\Build Flow\BuildFlow-ERP` (3D POC) |
| **PRD-IMM-04** | **3D Product Configurators** | Three.js / WebGL shaders | Custom vehicle/furniture interactive pricing | `scripts/render-product-images.py`, `site` |
| **PRD-IMM-05** | **Digital Twins & Simulations**| Discrete Event & BIM Twins | Construction site progress, building energy | `ERP-Product-Catalog.md` (PLN-05, CON-12) |

