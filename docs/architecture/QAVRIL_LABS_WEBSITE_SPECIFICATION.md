# QAVRIL LABS — Master Website Information Architecture & Content Specification

**Document Type:** Website Implementation & Content Master Specification  
**Version:** 1.0  
**Parent Blueprint:** [`QAVRIL_LABS_MASTER_BLUEPRINT.md`](file:///E:/SaaS/docs/architecture/QAVRIL_LABS_MASTER_BLUEPRINT.md)  
**Date:** 13 November 2026  
**Status:** Approved for Implementation  
**Target Environment:** `E:\SaaS\site\`  

---

## 1. Information Architecture & Global Navigation

The website serves as the primary digital flagship for QAVRIL LABS, communicating its identity as a **Global AI, Automation & Technology Company**.

```
                                    QAVRIL/LABS NAV
 ┌─────────┬──────────┬───────────┬────────────┬─────────┬──────────┬───────────┬─────────┬───────┐
 │Services │ Products │ Solutions │ Industries │ Studios │ Projects │ Resources │ Company │ Book  │
 └────┬────┴────┬─────┴─────┬─────┴─────┬──────┴────┬────┴────┬─────┴─────┬─────┴────┬────┴───┬───┘
      │         │           │           │           │         │           │          │        │
      ▼         ▼           ▼           ▼           ▼         ▼           ▼          ▼        ▼
  12 Core    7 Flagship   10 Cross-    11 Priority  11 Tech    Technical   Guides &   About &  Demo &
  Services    Products   Functional   Verticals    Studios   Blueprints   Research  Governance Consult
```

### 1.1 Global Header Elements
- **Logo:** `QAVRIL/LABS` with neobrutalist badge and slash branding.
- **Primary Nav:** Services, Products, Solutions, Industries, Studios, Projects, Resources, Company.
- **Theme Switcher:** Single-click Light/Dark theme toggle with `localStorage` persistence.
- **Primary Action (CTA):** `Book a consultation / Demo` pointing to `book.html`.
- **Mobile Menu Drawer:** Single-row collapsed topbar with accessible `Escape` key flyout.

---

## 2. Core Page Templates & Section Specifications

### 2.1 Homepage (`index.html`)
The homepage unifies QAVRIL's three engines: **Build**, **Intelligence**, and **Transform**.

1. **Hero Section:**
   - Headline: *"Your business. Intelligent technology. Zero operational chaos."*
   - Subhead: *"We research, design, engineer and deploy intelligent enterprise systems, AI agent swarms and workflow automation for organisations worldwide."*
   - Interactive CTA Row: `Explore Services`, `Book Discovery Sprint`, `See Product Suite`.
   - Proof Ticker: *11 Technology Studios · 7 Intelligence Products · 12 Core Services · Exact-to-the-Cent Ledger · 100% Tenant Isolation*.
2. **Executive & AI Search Brief (AEO / GEO Digest):**
   - Direct, citable definition block explaining what QAVRIL LABS is, its commercial model, and its technical invariants.
3. **The 3 Engines Matrix:**
   - Engine 1: Build (Enterprise software, custom platforms, mobile & SaaS).
   - Engine 2: Intelligence (AI agents, RAG, decision intelligence, voice).
   - Engine 3: Transform (Workflow automation, integrations, process redesign).
4. **Interactive Studio Explorer (`#studios`):**
   - Tabbed navigator across all 11 Studios (FORGE, NEXUS, QUANTUM, FORMA, IMMERSA, FRAME, PULSE, FLOW, PRISM, VERITY, VENTURES) with live capabilities and assigned bot badges.
5. **Proprietary Intelligence Suite Preview (`#products`):**
   - Showcase cards for QAVRIL ANALYST, BI, KNOWLEDGE, BRAIN, AGENTS, FLOW, CONNECT with maturity status badges (*Available, Early Access, In Development*).
6. **Interactive Live Ledger & Bot Simulation Sandbox (`#ledger-simulation`):**
   - Demonstrates the real-time double-entry engine, tenant isolation tokens, and autonomous bot approvals with single-use tokens.
7. **Competitive Comparison Matrix (`#comparison-matrix`):**
   - Factual table comparing QAVRIL LABS vs Legacy ERPs (SAP/NetSuite) vs Mid-Market (Odoo) vs Basic SMB tools (Zoho/QuickBooks).
8. **Interactive ROI & TCO Calculator (`#roi-calculator`):**
   - Sliders for team size, transaction volume, and industry, calculating estimated hours and costs saved.
9. **Priority Industries Showcase (`#industries`):**
   - Construction, Real Estate, Transport, Automotive, Quick Commerce, Manufacturing, Healthcare, Retail.
10. **Interactive FAQ Hub (`#faq`):**
    - Instant category filtering and keyword search with exact 1-to-1 JSON-LD `FAQPage` synchronization.
11. **Decoupled Lead Intake & Consultation Booking (`#join`):**
    - Clean form capturing full name, work email, company, industry, interest, and slot preferences with transparent fallback.

---

### 2.2 Dedicated Services Directory & Pages (`/services/`)
Each service page follows the **Service Page Specification Standard**:
- Headline & Business Value Proposition.
- Specific Customer Friction Points & Operational Gaps.
- Technical Deliverables & Architecture.
- Engagement Models (Discovery Sprint, PoC, Turnkey Implementation, Managed Service).
- Assigned Studio & Technology Stack.
- Client Case Studies or Technical Blueprints.
- Consultation Booking CTA.

**Catalog of 12 Core Service Pages:**
1. `/services/ai-strategy-consulting.html`
2. `/services/ai-agent-engineering.html`
3. `/services/generative-ai-llm.html`
4. `/services/enterprise-knowledge-rag.html`
5. `/services/intelligent-automation.html`
6. `/services/voice-conversational-ai.html`
7. `/services/custom-software-engineering.html`
8. `/services/data-business-intelligence.html`
9. `/services/cloud-ai-infrastructure.html`
10. `/services/quality-governance-reliability.html`
11. `/services/digital-design-creative-tech.html`
12. `/services/growth-marketing-technology.html`

---

### 2.3 Proprietary Product Directory (`/products/`)
Each product page explicitly states its lifecycle readiness status:
- **Available:** Core General Ledger, Sales Invoicing, Purchasing, Inventory, Payroll HR, POS Suite.
- **Early Access / In Development:** QAVRIL KNOWLEDGE (Enterprise RAG), QAVRIL FLOW (Automation Engine), QAVRIL AGENTS (Multi-Agent Platform), QAVRIL ANALYST (Conversational BI).
- **Planned / Research Foundation:** QAVRIL BRAIN (Context Decision Graph), QAVRIL BI (Enterprise Analytics), QAVRIL CONNECT (Integration Hub).

---

### 2.4 Industry Solutions Directory (`/industries/`)
Dedicated vertical pages connecting industry operational challenges with specific QAVRIL products, bots, and automated workflows:
1. `industries/construction.html` — EPC controls, WBS, BOQ estimation, subcontractor retentions.
2. `industries/property.html` — Multi-unit PMS, lease agreements, PDC cashiering.
3. `industries/logistics.html` — Fleet routing, dark stores, dispatch, electronic proof of delivery.
4. `industries/restaurants.html` — Offline POS, table ordering, KOT, recipe costing.
5. `industries/clinics.html` — Appointments, patient billing, medical inventory.
6. `industries/retail-pharmacy.html` — Batch and expiry tracking, barcode checkout.
7. `industries/schools.html` — Fee schedules, parent communication, installment plans.
8. `industries/professional-services.html` — Milestone billing, project time cards.
9. `industries/agriculture.html` — Farm input tracking, cooperative payouts.
10. `industries/hospitality.html` — Reservation management, room cleaning status.
11. `industries/manufacturing.html` — Bill of materials (BOM), production runs, scrap tracking.

---

### 2.5 The 11 Studios Showcase (`/studios/`)
Dedicated profiles for the 11 technology studios detailing domain responsibilities, leadership charters, and core technologies:
- `studios/forge.html` — Enterprise Platforms & SaaS
- `studios/nexus.html` — AI & Multi-Agent Swarms
- `studios/quantum.html` — Deep Tech & ML Research
- `studios/forma.html` — Design Systems & Digital UX
- `studios/immersa.html` — Spatial Computing & 3D Twins
- `studios/frame.html` — Media & Creative Automation
- `studios/pulse.html` — Growth, Brand & SEO
- `studios/flow.html` — Intelligent Automation & Integration
- `studios/prism.html` — Data Engineering & Decision Intelligence
- `studios/verity.html` — Quality, Testing & AI Evaluation
- `studios/ventures.html` — Product Incubation & Strategic IP

---

## 3. Search Engine, Answer Engine (AEO) & Generative (GEO) Strategy

To ensure QAVRIL LABS is cited and referenced authoritatively by **Google, Bing, ChatGPT, Gemini, Claude, and Perplexity**:

### 3.1 Structured Data (JSON-LD `@graph`)
Every page embeds machine-readable schema:
1. `Organization`: Official identity, legal status (draft noted), founder credentials, knowsAbout taxonomy, official contact email, and social profiles.
2. `SoftwareApplication`: Product specifications, application category (`BusinessApplication`), operating systems, feature list, and pricing offers.
3. `Service`: Explicit service types, provider, service output, and delivery terms.
4. `FAQPage`: Exact matching of visible questions and answers for Google Rich Results and AI answer extraction.
5. `HowTo`: Structured implementation steps for onboarding and migration.

### 3.2 AI Crawler Permissions (`robots.txt`)
Explicit crawler access for all major AI answer engines:
- `GPTBot`, `ChatGPT-User` (OpenAI / ChatGPT)
- `ClaudeBot`, `Claude-Web` (Anthropic Claude)
- `PerplexityBot` (Perplexity Search)
- `Google-Extended` (Google Gemini & SGE)
- `Applebot-Extended`, `Amazonbot`, `cohere-ai`, `Meta-ExternalAgent`
- Direct pointers to `sitemap.xml` and `llms.txt`.

### 3.3 The LLMs Knowledge Manifests
- `/llms.txt`: Concise, high-density plain-text overview covering system identity, architectural invariants, 11 studios, 7 products, 12 services, and pricing.
- `/llms-full.txt`: Comprehensive machine-readable documentation with full architectural rules, schemas, API contracts, and case studies for deep RAG ingestion.

---

## 4. Verification & Quality Gates

All website updates must continue to satisfy:
1. `npm run site:check` — 0 broken links, 100% FAQ schema synchronization, valid form contracts, real sitemap entries.
2. `node scripts/audit-site-l1.mjs` — 0 failures across semantic structure, accessibility (alt text, ARIA attributes), SEO metadata, security headers, and draft legal notices.
3. Real-browser headless test suite (`scripts/run-l2-browser-suite.mjs`) across 6 viewports (`360px` to `1920px`) with 0 console errors and 0 CSP violations.
4. Zero unapproved commits or git resets on `master`.
