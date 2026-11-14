# QAVRIL LABS — Independent Staging Verification and Deployment Audit Report

**Document:** `docs/website/ANTIGRAVITY_DEPLOYMENT_REPORT.md`  
**Role:** Independent Release Engineer & Deployment Verification Owner (Antigravity Lane)  
**Primary Implementation Owner:** Claude Code  
**Date:** 14 November 2026  
**Final Release Decision:** **STAGING NOT VERIFIED**  
**Production Gate:** **STRICTLY BLOCKED**  

---

## 1. Executive Summary & Verification Verdict

An independent, read-only deployment and verification audit was conducted on the QAVRIL LABS website, comparing the actual live staging deployment (`https://staging.qavrillabs.com/`), local workspace artifacts (`frontend/site/`), repository commit history, and the complete target company positioning.

### Key Audit Findings:
1. **Actual Cloud Staging is Out-of-Sync (`STAGING NOT VERIFIED`):** Probing `https://staging.qavrillabs.com/` reveals the live Cloudflare deployment is serving an older build from `Fri, 13 Nov 2026 08:30:00 GMT` based on initial commit `79c61a5` with stylesheet `styles.css?v=7` and legacy page titles (`<title>ERP for Small Businesses | QAVRIL LABS</title>`). Neither our mobile UI commit `164cfaf` nor Claude Code's header fix `6ed6018` (`styles.css?v=11`) is currently running on the live staging domain.
2. **Missing Core Scope Pages (Information Architecture Gaps):** The target company structure mandates dedicated detail pages for 11 Studios, 12 Core / 57 Proposed Services, 15 Industry Verticals, and the QAVRIL EXPERT NETWORK. In the repository:
   - Dedicated `/studios/*.html` pages: **0 / 11 exist** (present only as an in-page tab section on `index.html`).
   - Dedicated `/services/*.html` pages: **0 / 12 exist** (no `/services/` directory exists).
   - Dedicated `/expert-network` pages: **0 / 3 exist** (no route exists).
   - Industry Verticals: **11 / 15 exist** (Apparel, FMCG, Automotive industry page, and Financial Services/Insurance are missing).
3. **Forms & Authentication are Purely Fallback / Non-Functional on Staging:** Staging runs with `apiBase: ""` (`config.js`). Lead and booking forms do not submit to an API backend; they trigger a client-side offline fallback message. Customer sign-in (`signin.html`) and sign-up (`signup.html`) cannot authenticate and display `noApi()` notices.
4. **Web App Build (`build:web`) Fails:** Following the recent workspace restructuring into `frontend/` and `backend/`, dependencies are not installed inside `frontend/` (`frontend/node_modules` is missing), causing `tsc && vite build` in `frontend/web` to fail.

---

## 2. Actual Staging Deployment Verification

| Inspection Parameter | Evidence & Observed Values | Audit Status |
|:---|:---|:---:|
| **Staging URL** | `https://staging.qavrillabs.com/` | **VERIFIED** |
| **Hosting Provider** | Cloudflare Pages (Server: `cloudflare`, CF-RAY: `a5a46634dc14cf4b-MRS`) | **VERIFIED** |
| **Live Deployed Last-Modified**| `Fri, 13 Nov 2026 08:30:00 GMT` | **VERIFIED** |
| **Live Deployed Commit SHA** | Likely `79c61a5` (Pre-`164cfaf`, Pre-`6ed6018`) | **UNVERIFIED / OUTDATED** |
| **Live Stylesheet Asset** | `styles.css?v=7` (Repo HEAD uses `v=11` or `v=10`) | **FAILED (Out of Sync)** |
| **Live Homepage Title** | `<title>ERP for Small Businesses \| QAVRIL LABS</title>` | **FAILED (Legacy Branding)** |
| **Local Staging Endpoint** | `http://127.0.0.1:8080/` (via `frontend/scripts/serve-site.mjs`) | **VERIFIED (200 OK)** |
| **Automated CI/CD Pipeline** | No `.github/workflows` found in repo; deployment trigger mechanism to Cloudflare Pages is external/manual | **UNVERIFIED** |

---

## 3. Re-examination of Previous Validation Reports & Prior Failures

The previous deployment report claimed universal readiness based on static check totals. A critical re-examination was performed:

### 3.1 Static Generator & Audit Suite Results
- **`npm --prefix frontend run site:check`**: **PASSED** (4,094 checks passed, 0 failed). Verified link references, image alt tags, JSON-LD structure, and sitemap synchronization across existing files.
- **`node frontend/scripts/audit-site-l1.mjs`**: **PASSED** (4,507 assertions passed, 0 failed across 88 generated HTML pages).
- **Static Artifact Count**: Exactly 88 HTML files generated in `frontend/site/`.

### 3.2 Investigation of Previous Test Failures
1. **`build:web` exited with code 1 (`FAILED`):**
   - *Investigation:* `npm --prefix frontend run build:web` failed with TS2307 (`Cannot find module 'react'`).
   - *Root Cause:* The repository was recently split into `frontend/` and `backend/`. `frontend/package.json` defines its own workspace, but `frontend/node_modules` has not been populated with an isolated `npm install`. Root `node_modules` exists, but monorepo hoisting is not configured for the new `frontend/` directory.
   - *Classification:* **Environment & Dependency Configuration Defect**.
2. **Local Server Startup / Probe Failures (`RESOLVED`):**
   - *Investigation:* Initial PowerShell `Invoke-WebRequest` command failed with `Access is denied 0x5` (Windows PowerShell console output buffer bug in headless CI shells). A second attempt timed out before the Node process bound to port 8080.
   - *Root Cause:* Shell console limitations and race conditions. When tested synchronously waiting for `running at http://127.0.0.1:8080/`, `serve-site.mjs` consistently serves 200 OK across all routes.
   - *Classification:* **Environmental Test Artifact (Resolved)**.
3. **Route Verification Runner exited with code 1 (`RESOLVED`):**
   - *Investigation:* Custom test runner reported `FAIL: /404.html 200`.
   - *Root Cause:* Test script flaw. In `serve-site.mjs`, accessing the physical file `/404.html` directly returns HTTP 200 with the static template. Requesting an actual non-existent route (e.g. `/missing-test-path`) correctly yields HTTP 404 with the 404 template.
   - *Classification:* **Test Harness Assertion Defect (Resolved)**.

---

## 4. Real Customer Journey Audit

Testing the distinction between static page loading and actual operational functionality:

| Customer Journey | Target Route | Operational Behavior & Actual Destination | Verdict |
|:---|:---|:---|:---:|
| **Consultation / Demo Form** | `/book.html`, `#join` | **Client Fallback Only:** Because `window.ERP_CONFIG.apiBase` is `""` on staging, submitting triggers `notConnected()`: *"Requests are not connected on this page yet. Email connect@qavrillabs.com with your details"*. No HTTP request is dispatched to `/v1/public/leads`. | **PARTIALLY VERIFIED (Fallback Active)** |
| **Product Enquiry** | Product detail modals | Same decoupled modal fallback to `connect@qavrillabs.com`. | **PARTIALLY VERIFIED (Fallback Active)** |
| **Expert Network Enquiry** | `/expert-network` | Route does not exist on disk (returns 404). | **FAILED (Missing Route)** |
| **Customer Sign-In** | `/signin.html` | **Non-Functional:** Form submission calls `noApi(signin)`, informing the visitor that sign-in requires an active backend API. Cannot sign in to customer portal. | **FAILED (Non-Functional)** |
| **Workspace Sign-Up** | `/signup.html` | **Non-Functional:** Form submission cannot reach `/v1/public/signup`. | **FAILED (Non-Functional)** |
| **Customer App / Portal** | `/app.html` | Loads demo mockup interface with mock session; not connected to live tenant database or backend API. | **PARTIALLY VERIFIED (Mock Only)** |
| **Mobile Navigation** | Global header | Responsive drawer toggles, traps focus, and dismisses on `Escape` key and backdrop touch. Minimum 48px tap targets. | **VERIFIED** |
| **Theme Switching** | Header toggle | Toggles `data-theme` between `light` and `dark` and persists in `localStorage` without layout flash. | **VERIFIED** |

---

## 5. Review of Public-Facing Claims vs. Reality

| Public-Facing Marketing Claim | Stated on Site | Reality / Evidence Supporting Claim | Risk / Recommendation |
|:---|:---|:---|:---|
| **"Start free"** | Header CTA on all pages | Trial access is **NOT open yet**. `book.html:61` explicitly states: *"trial access is not open yet. Requesting one puts you first in line"*. | **Misleading CTA:** Change button label from *"Start free"* to *"Join Waitlist"* or *"Request Trial"*. |
| **"Live in days"** | Hero & marketing pages | Platform is pre-launch / in development. Self-serve onboarding does not exist. | **Overstatement:** Qualify as target timeline for guided enterprise deployments. |
| **Hours-Saved / ROI Calculator** | `index.html#roi-calculator`, `roi.js` | Mathematical formula based on arbitrary slider inputs (headcount $\times$ 4 hours); not derived from measured customer benchmark data. | Label explicitly as an *"Illustrative Estimate"*. |
| **Product Availability Labels** | `products.html` | Labels Core modules as *"Available"*, but public sign-up and self-serve access are closed. | Add note: *"Available for controlled enterprise pilots"*. |
| **Case Studies** | `/case-studies.html` | Disclaimer is prominently and truthfully displayed: *"These are example scenarios, not customer stories. We have no paying customers yet."* | **Compliant:** Truthful and transparent. |
| **Double-Entry Ledger Invariants** | `llms.txt`, `security.html` | Backed by backend architecture specs (`docs/ai-agent-readiness/`). | Verified in system design documentation. |

---

## 6. Target Company Positioning & Scope Alignment

The official QAVRIL LABS target positioning is a **Global AI, Automation & Technology Company** structured across:
- **3 Engines:** BUILD, INTELLIGENCE, TRANSFORM (Accurately articulated in `index.html`).
- **11 Specialist Studios:** FORGE, NEXUS, QUANTUM, FORMA, IMMERSA, FRAME, PULSE, FLOW, PRISM, VERITY, VENTURES (Represented as tabs on `index.html`, but **missing dedicated `/studios/*.html` pages**).
- **Core Services:** 12 core / 57 proposed services (Represented only in high-level overview text; **no `/services/*.html` directory or detail pages exist**).
- **15 Industry Verticals:** Only **11 industry vertical pages exist** in `frontend/site/industries/`. Missing: Apparel/Fashion, FMCG, dedicated Automotive vertical, Financial Services/Insurance.
- **QAVRIL EXPERT NETWORK:** **Missing entirely** from site navigation and file tree.

---

## 7. Security, Headers & Indexability Audit

- **HTTPS & SSL:** Cloudflare edge SSL is active on `https://staging.qavrillabs.com/`.
- **Security Headers:** Configured via `_headers`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
- **Staging Indexability:** Properly blocked via `X-Robots-Tag: noindex, nofollow` on Cloudflare staging.
- **Secret Exposure Audit:** Inspected all generated JavaScript and HTML files. Zero API keys, passwords, database URLs, or private tokens are exposed.
- **Third-Party Trackers:** Zero third-party tracker scripts or analytics beacons injected.

---

## 8. Defect Log & Blockers

### P0 (Production Blockers)
1. **Live Staging Out of Sync:** `https://staging.qavrillabs.com/` is serving an old build (`styles.css?v=7`, commit `79c61a5`). Commits `164cfaf` and `6ed6018` must be deployed and verified on staging.
2. **Missing Core Scope Pages:**
   - Dedicated Studio pages (`/studios/`)
   - Dedicated Services directory (`/services/`)
   - Dedicated Expert Network routes (`/expert-network/`)
   - Missing 4 industry vertical pages.
3. **Broken Web App Workspace Build:** `frontend/` workspace requires `npm install` and proper dependency resolution to restore `npm --prefix frontend run build:web`.

### P1 (Customer Experience Gaps)
1. **Misleading "Start free" CTA:** Button implies instant self-serve software access, but trial access is closed.
2. **Disconnected Authentication:** `/signin.html` and `/signup.html` are dead ends when accessed on cloud staging.

### P2 (Improvements)
1. **Cloudflare Cache Purge:** When new builds are deployed, ensure edge CDN cache is purged.

---

## 9. Final Release Decision & Next Actions

### Final Verdict:
### **`STAGING NOT VERIFIED`**

**Reasoning:**  
The live cloud staging deployment at `https://staging.qavrillabs.com/` is currently running outdated artifacts from commit `79c61a5`, while the repository contains unreleased fixes (`164cfaf`, `6ed6018`). Furthermore, major structural components of the QAVRIL LABS specification (Studios, Services, Expert Network, and 4 Industry Verticals) do not yet exist on disk, and customer-facing forms and authentication operate solely in offline fallback states.

### Recommended Next Actions:
1. **Deploy Repository HEAD to Cloudflare Staging:** Push or configure the Cloudflare Pages deployment to build the latest commit (`6ed6018` / `164cfaf`) so `staging.qavrillabs.com` reflects recent fixes.
2. **Author Missing Information Architecture Pages:** Claude Code / Frontend lane must generate the approved `/services/`, `/studios/`, and `/expert-network/` pages per `docs/architecture/QAVRIL_LABS_WEBSITE_SPECIFICATION.md`.
3. **Resolve `frontend/` Dependency Isolation:** Run `npm install` inside `frontend/` to enable clean execution of `npm --prefix frontend run build:web`.
4. **Update CTA Copy:** Align "Start free" buttons with the actual waitlist / demo booking reality.
5. **Maintain Production Gate:** **Production deployment (`https://qavrillabs.com/`) must remain strictly blocked** until the above items are completed and explicitly approved by the owner.
