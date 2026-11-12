# Industry portfolio

How QAVRIL LABS covers 30+ industries from one platform. This turns the November 2026 portfolio memo into catalog terms. Product IDs refer to [ERP-Product-Catalog.md](../ERP-Product-Catalog.md).

## The decision

Research 30+ sectors. Build one shared platform. Keep a separate product roadmap per industry. Do not create a codebase per industry.

Every industry product is an **industry pack**: data, workflows, terminology and screens on top of the shared core. The shared core is the platform (PLT), master data (MDM), finance (FIN), sales (SAL), procurement (PRC), inventory (INV), manufacturing (MFG), HR (HRM), projects and field service (PSA), and the AI layer (AI, AGT, AUT, AIS).

## Coverage map

Status: **In catalog** means product rows exist. **Added** means rows were added on 2026-11-11. **Roadmap only** means research, no rows yet.

### Level 1: core industry platforms

| Industry | Product shape | Catalog coverage | Status |
|---|---|---|---|
| Construction | ERP | PSA-09 to PSA-13 (estimating, change orders, progress billing, site, subcontractors) | In catalog |
| Property | Property management system | RE-01 to RE-08 | In catalog |
| Fleet and logistics | Fleet management system | LOG-01 to LOG-10 | In catalog |
| Manufacturing | ERP and execution | MFG-01 to MFG-12, PLN-01 to PLN-05 | In catalog |
| FMCG and distribution | ERP | DS-01 to DS-04 | Added |
| Retail and e-commerce | Retail management system | POS-01 to POS-10, ECM-01 to ECM-09 | In catalog |
| Agriculture and agri-business | ERP | AG-01 to AG-08 | In catalog |
| Professional services | Professional services automation | PSA-01 to PSA-05, AC-01 to AC-05 | In catalog |

### Level 2: specialized industry platforms

| Industry | Product shape | Catalog coverage | Status |
|---|---|---|---|
| Hospitality | Property management system | HO-01 to HO-06 | In catalog |
| Food and beverage, central kitchens | ERP and execution | FB-01 to FB-04, plus MFG-08, MFG-12 | Added |
| Quick commerce | Retail management system | QC-01 to QC-04 | Added |
| Garage and automotive | Fleet and service | AU-01 to AU-05 | In catalog |
| Apparel and textiles | Manufacturing execution | TX-01 to TX-04 | In catalog |
| Education | School management system | ED-01 to ED-12 | In catalog |
| Healthcare | Hospital information system | HC-01 to HC-12 | In catalog |
| Legal | Practice management system | LG-01 to LG-07 | In catalog |
| Pharmaceutical | ERP with regulated records | PH-01 to PH-05 | Added |
| Energy and renewables | Enterprise asset management | EN-01 to EN-04, UT-01 to UT-05 | Added |
| Field service and facilities | Service operations | PSA-06 to PSA-08, MFG-11 | In catalog |
| Travel and tourism | Booking and operations | TT-01 to TT-04 | Added |
| Waste and recycling | ERP | WR-01, WR-02, LOG-10 | In catalog |

### Level 3: enterprise and regulated platforms

| Industry | Catalog coverage | Status |
|---|---|---|
| Insurance agencies and brokers | IN-01 to IN-03 | In catalog |
| Microfinance and SACCOs | MF-01 to MF-06 | In catalog |
| Mining and extractives | MN-01 to MN-03 (phase P4) | Added |
| Non-profits | NP-01 to NP-05 | In catalog |
| Banking and NBFC core, wealth management, aviation, maritime, government, media, security services, events | None | Roadmap only |

Level 3 sectors need specialist integrations, regulator approval or enterprise sales. Start them only with a partner or an anchor customer.

## The five shared engines already exist as catalog families

The memo proposes five reusable engines. Each maps to products already in the core, so verticals reuse them rather than rebuild:

| Engine | Catalog products |
|---|---|
| Manufacturing and production | MFG-01 to MFG-10, FIN-15 |
| Supply chain and traceability | INV-01 to INV-12, MFG-12, AG-05, PH-02 |
| Workforce and scheduling | HRM-03, HRM-08, PSA-02, PSA-04 |
| Compliance and quality | MFG-06, PLT-16, PLT-11, PLT-07, PH-03 |
| Service and contracts | PSA-06 to PSA-08, SAL-06, SAL-09 |

## Conversational interface

Owners should be able to ask, record and approve from chat and WhatsApp, not only from dashboards. This is **AI-09 Conversational Operations**. It must use the same permissions, approvals and audit trail as the screens; chat is another way in, not a way around the controls. It builds on AI-03, SAL-12 and PLT-07.

## What this does not change

- **The build order stays.** The foundation and the minimum viable ERP come first. Today the general ledger, a sales slice, sign-up and the dashboard exist (see [phase-0-status.md](phase-0-status.md)). No industry pack is started.
- **One pack at a time.** The catalog's rule "Multiple industry packs at once. Finish one before starting the next." still holds. Eight Level 1 platforms is the portfolio, not eight parallel builds.
- **Pick the first niche next.** It moves that pack's dependencies earlier in the build order. Distribution and FMCG, or retail, reuse the most of the core already planned for phase P1.

## Market figures in the memo

The memo cites survey and government figures, such as post-harvest losses, retail inventory accuracy, hotel reporting and insurance-agent workload. They are not verified here. Check each source before using it on the website, in sales material or in investor documents.
