# UAAP Product Adapter Catalogue (39 products)

**Milestone:** A1 · **Status:** Contracts proposed. Nothing is connected. "Known" = seen in code/config during inspection; "TBC" = must be confirmed before that adapter is built.

## 1. Standard adapter contract (applies to every product)
Each adapter registers: `product_id`, `tenant binding`, `auth mode`, `endpoint registry` (method, path, request/response schema), `tool definitions` (name, tier, schemas, idempotency), `permission mapping` (tool → product permission), `event contracts` (inbound/outbound), `error mapping` (product error → UAAP codes), `limits` (concurrency, timeout), and an **integration test suite** (auth, tenant isolation, each tool, failure modes). Adapters call HTTP only.

## 2. Catalogue

| # | ID | Product | Source location | Auth / API (known → TBC) | Tenancy model | Onboarding | Verification status |
|---|---|---|---|---|---|---|---|
| 1 | PRD-ERP-01 | Construction ERP | `E:\Port\Construction\…\zyno_construction_backend` | Express `/api/v1/*`, `checkPermission`, `requireProjectAccess` (known); token format TBC | Project/permission scoped; single SQLite (TBC multi-tenant) | **Reference (Wave B)** | Own docs: 354/354 tests (2026-11-02); not re-run |
| 2 | PRD-ERP-02 | Garage Management | `Garage Management` | Prisma app; API surface TBC | TBC | C | Requires Verification |
| 3 | PRD-ERP-03 | Property Management | `Property Management System` | Supabase JWT, RPC/stored procs, RLS migrations (known); endpoints TBC | RLS (per migrations) | **Reference (Wave B)** | Migrations present; runtime unverified |
| 4 | PRD-ERP-04 | Retail POS | `POS\zyno_pos_*`, `ZynoPOSMobile` | Express + Sequelize gateway dir `api_gateway` (known); auth TBC | TBC | C | Requires Verification |
| 5 | PRD-ERP-05 | Restaurant POS | `Restaurant POS\serve-sweetly-engine` | TanStack Start + Drizzle (known); auth TBC | TBC | C | Requires Verification |
| 6 | PRD-ERP-06 | IT HelpDesk | `IT Helpdesk` | Supabase (known) | Supabase RLS TBC | D | Requires Verification |
| 7 | PRD-ERP-07 | Procurement Mgmt | `Procurement` (Next.js prototype) + PMS procurement migrations | TBC | TBC | A5 shared agent | Prototype |
| 8 | PRD-ERP-08 | Production & Planning | none found (catalogue only; DPR in Construction) | — | — | D+ | **Not Found** as product |
| 9 | PRD-ERP-09 | Quick Commerce | `Quick Commerce Delivery Partner Application` | Supabase + Capacitor (known) | TBC | C | Requires Verification |
| 10 | PRD-ERP-10 | Visitor Management | `VMS` | Supabase schema (known) | TBC | D | Requires Verification |
| 11 | PRD-ERP-11 | Fleet & Transport | Garage + Quick Commerce fragments; catalogue LOG-05 | — | — | C | Partial/Planned |
| 12 | PRD-ERP-12 | HIMS | `Health Prescription` (prescription/medicine prototype) | Supabase (known) | TBC | D (clinician-supervised only) | Prototype |
| 13 | PRD-ERP-13 | HRMS | PMS `hrms_full_suite` migration | via PMS RPC | PMS RLS | D | Schema only |
| 14 | PRD-ERP-14 | Finance & Accounting | `packages/ledger`, routes `/v1/ledger/*` | Bearer token; perms `fin.*`; entitlement FIN-01 (known) | RLS | **Reference (A5)** | Unit tests pass (ledger test not individually run; package suite listed) |
| 15 | PRD-ERP-15 | Sales Management | `packages/sales` (no HTTP routes yet) | none yet | RLS (planned) | After core API | Slice only; 11 tests pass |
| 16 | PRD-ERP-16 | Purchase Management | Construction purchase module; PMS procurement | TBC | TBC | A5 | Requires Verification |
| 17 | PRD-ERP-17 | Business & SME ERP | `E:\SaaS` core | Bearer token, `/v1/*` (known) | RLS | **Reference (A4 first adapter)** | typecheck pass; 72 unit tests pass |
| 18 | PRD-AI-01 | UAAP | to be created (`services/uaap`) | — | — | Wave A | Planned |
| 19 | PRD-AI-02 | Enterprise AI Copilot | `Enterprise Copilot for ERPCRM` (frontend; backend README says pending) | Calls Gemini SDK from browser dependency (**secret-exposure risk**, TBC) | — | UI client of UAAP | Prototype |
| 20 | PRD-AI-03 | Knowledge Copilot | `Scrapper RAG Chatbot` (FastAPI, Chroma, `gemma4:31b-cloud`) | No auth seen in `main.py` head | per-session collection | A5 reuse of ideas | Prototype |
| 21 | PRD-AI-04 | Customer Support Agent | `Voice Agent` (LiveKit, GPT-4o) | Provider keys via env | — | A5 | Prototype |
| 22 | PRD-AI-05 | AI Sales Assistant | `SalesRobot+Hi-Reply` | Supabase | TBC | D | Prototype |
| 23 | PRD-AI-06 | Feedback Intelligence | `News chatbot` (FastAPI) | TBC | TBC | D | Prototype |
| 24 | PRD-AI-07 | Smart Inventory Forecasting | none | — | — | After A5 Inventory | **Planned** |
| 25 | PRD-AI-08 | Document Processing | Scrapper RAG `document_processor.py`, Construction `analyzeMedia` | — | — | **A5 first agent** | Prototype fragments |
| 26 | PRD-AI-09 | AI Procurement Assistant | Procurement prototype | — | — | A5 | Prototype |
| 27 | PRD-AI-10 | AI Marketing Automation | none dedicated | — | — | E | Planned |
| 28 | PRD-TECH-01 | Business Process Automation | `packages/events` outbox | internal | RLS-less system table | A6 | Implemented, no worker |
| 29 | PRD-TECH-02 | Cloud Infra Automation | HelpDesk workflow docs only | — | — | E | Planned (docs) |
| 30 | PRD-TECH-03 | Cloud & DevOps | Dockerfiles/compose, `.gitlab-ci.yml` in Construction | — | — | E | Config present, unverified |
| 31 | PRD-TECH-04 | Data Eng. & BI | audit log only | — | — | E | Planned |
| 32 | PRD-TECH-05 | Cybersecurity | RLS, target guards | — | — | cross-cutting | Partially implemented |
| 33 | PRD-TECH-06 | IoT | none found | — | — | E | **Not Found** |
| 34 | PRD-TECH-07 | Design System | `site/styles.css` (site only) | — | — | n/a | Site-scope only |
| 35 | PRD-IMM-01 | AR/VR/MR | none | — | — | E | **Not Found** |
| 36 | PRD-IMM-02 | WebAR | `site/scene3d.js` (3D canvas, not AR) | — | — | n/a | Prototype (3D, not AR) |
| 37 | PRD-IMM-03 | Virtual Showrooms | none verified | — | — | E | **Not Found** |
| 38 | PRD-IMM-04 | 3D Configurators | `render-product-images.py` (image renderer) | — | — | n/a | Not a configurator |
| 39 | PRD-IMM-05 | Digital Twins | none | — | — | E | **Planned** |

**Honest tally from this inspection (replaces Phase 1B counts until verified):** reference-grade verified by me: Core SaaS only. Construction: documented-verified. Everything else: *Requires Verification*, *Prototype*, *Planned* or *Not Found*. A full re-baseline (build + test per product) is a recommended pre-A5 task.

## 3. Onboarding order
Reference: Core SaaS (A4) → Construction & PMS (Wave B) → POS/Garage/Quick Commerce/Fleet (C) → HelpDesk/VMS/HIMS/HRMS/sales (D) → rest (E). Contracts exist for all 39 via the template above; only Core SaaS is built in Wave A.

