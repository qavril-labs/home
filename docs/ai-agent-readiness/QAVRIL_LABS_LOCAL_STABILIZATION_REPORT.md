# QAVRIL LABS — Local Website Stabilization Report (Phase L1)

**Project Root:** `E:\SaaS\`  
**Website Directory:** `E:\SaaS\site\`  
**Website Generator:** `E:\SaaS\scripts\`  
**Milestone:** L1 — Local Stabilization  
**Date:** 9 November 2026  
**Status:** **L1 COMPLETE — STOPPED AT LOCAL BOUNDARY**

---

## 1. Initial Baseline Inspection (Phase L1-A)

Before applying modifications, the local workspace state was audited:

- **Git Branch:** `master` (0 commits, 0 staged changes).
- **Working Tree:** Preserved with existing untracked project files (`site/`, `scripts/`, `packages/`, `services/`, `apps/`, `docs/`, etc.).
- **Initial Automated Checks:**
  - `npm run site:build`: Wrote 86 pages to `E:\SaaS\site`.
  - `npm run site:check`: 3,743 checks passed, 0 failed, 0 warnings.
- **Initial Inventory:** 86 HTML pages, 3 JavaScript files (`main.js`, `config.js`, `scene3d.js`), 2 CSS stylesheets (`styles.css`, `subpage.css`), 1 XML sitemap (`sitemap.xml`), 2 text manifests (`robots.txt`, `llms.txt`), 1 edge headers file (`_headers`), 13 SVGs, 13 PNGs.

---

## 2. Defects Identified & Status

| Defect / Friction Point | Root Cause | Status | Resolution |
|:---|:---|:---:|:---|
| **Subpage Modal Privacy Link 404** | `requestDialog()` in `main.js` injected `<a href="privacy.html">`. On subpages (`products/*`, `industries/*`, etc.), this resolved to `products/privacy.html` (404). | **FIXED AND VERIFIED** | Dynamically prepends `../` prefix on subpages: `<a href="${prefix}privacy.html">`. |
| **Mobile Menu Missing Escape Handler** | Mobile flyout menu (`#site-links`) had no `keydown` listener for the `Escape` key, trapping keyboard/screen-reader users. | **FIXED AND VERIFIED** | Added `Escape` key event listener in `main.js` to close menu and restore focus to menu button. |
| **Mobile Header Collision (< 480px / 360px)** | On viewports $\le 480\text{px}$ (e.g. 360px and 390px), `.topbar .btn-sm` squeezed alongside the logo, menu toggle, and theme switch, causing awkward multi-row wrapping. | **FIXED AND VERIFIED** | Hidden `.topbar .btn-sm` on screens $\le 480\text{px}$ and added prominent `.menu-cta` button inside the expanded mobile dropdown menu. |
| **Subpage Form Mobile Grid Stacking** | In `site/subpage.css`, `.lead-form` specified `grid-template-columns: 1fr 1fr;` at root scope without a media query, causing 2-column squeezing on mobile `book.html`. | **FIXED AND VERIFIED** | Added `@media (max-width: 720px) { .lead-form { grid-template-columns: 1fr; } }` and mobile padding adjustments in `subpage.css`. |
| **404 Page Missing Social Meta & Nav** | `site/404.html` was missing OpenGraph tags, Twitter cards, `.menu-cta`, theme toggle, and the `Pricing` primary link. | **FIXED AND VERIFIED** | Added `og:title`, `og:description`, `og:image`, Twitter card metadata, `pricing.html` link, theme toggle, and `.menu-cta`. |
| **CSP Blocking Three.js CDN** | `site/_headers` CSP had `script-src 'self' 'unsafe-inline'`, which would block `scene3d.js` importing Three.js from `https://cdn.jsdelivr.net`. | **FIXED AND VERIFIED** | Added `https://cdn.jsdelivr.net` to `script-src` in `site/_headers`. |
| **Tablet Bento/Cards Column Squeezing** | `.cards-3` was not included in the `@media (max-width: 1000px)` 2-column breakpoint, causing 3-column cramping on tablet portrait (768px). | **FIXED AND VERIFIED** | Added `.cards-3` to `@media (max-width: 1000px)` in `site/styles.css`. |

---

## 3. Changes Implemented

1. **`site/main.js`:**
   - Fixed subpage relative link resolution in dynamic modal dialog.
   - Added `Escape` key accessible dismissal handler for the mobile navigation drawer.
2. **`site/_headers`:**
   - Added `https://cdn.jsdelivr.net` to CSP `script-src` to allow Three.js module loading while retaining zero-localhost `connect-src`.
3. **`site/styles.css`:**
   - Added `.menu-cta { display: none; }` on desktop.
   - Added `.cards-3` to 2-column grid at `max-width: 1000px`.
   - Added `@media (max-width: 480px)` breakpoint: reduces shadow depth from 12px to 6px, hides topbar button, renders `.menu-cta` inside open menu, and optimizes padding for 360px/390px viewports.
4. **`site/subpage.css`:**
   - Added responsive single-column collapse for `.lead-form` and `.bot-hero-block` at `max-width: 720px`.
   - Added mobile container padding and shadow reductions at `max-width: 480px`.
5. **`site/404.html`:**
   - Updated `<head>` with full OpenGraph and Twitter metadata.
   - Added `Pricing` link, theme toggle button, and `.menu-cta` to primary navigation.
6. **`site/index.html` & `scripts/build-site-pages.mjs`:**
   - Added `.menu-cta` to primary navigation across all generated pages.
7. **`scripts/audit-site-l1.mjs`:**
   - Created comprehensive 4,230-assertion local validation suite covering DOM structure, duplicate IDs, SEO metadata, links/assets, accessibility, security headers, branding, legal notices, and API decoupling.

---

## 4. Changed-File Inventory

| File Path | Type | Modification Summary |
|:---|:---:|:---|
| `E:\SaaS\site\main.js` | Client Script | Subpage dialog prefix fix; Escape key handler for mobile drawer |
| `E:\SaaS\site\_headers` | Edge Config | Added `cdn.jsdelivr.net` to CSP `script-src` |
| `E:\SaaS\site\styles.css` | Stylesheet | Tablet `.cards-3` rule; mobile $\le 480\text{px}$ single-line header and shadow optimization |
| `E:\SaaS\site\subpage.css` | Stylesheet | Subpage `.lead-form` mobile 1-column collapse and container padding |
| `E:\SaaS\site\404.html` | Static HTML | Added OpenGraph/Twitter tags, pricing link, theme toggle, mobile CTA |
| `E:\SaaS\site\index.html` | Template/HTML | Added `.menu-cta` to navigation drawer |
| `E:\SaaS\scripts\build-site-pages.mjs` | Generator | Added `.menu-cta` to `header()` function across all 86 pages |
| `E:\SaaS\scripts\audit-site-l1.mjs` | Test Tool | Created Phase L1 comprehensive automated audit runner |

*Note: 86 generated HTML pages in `E:\SaaS\site\` were regenerated to reflect the navigation and link updates.*

---

## 5. Pages Audited (86/86 Pages Verified)

All 86 HTML pages were verified for valid structure, single `<h1>`, title/description lengths, canonical URLs, OG tags, Twitter cards, and internal links:

- **Core & Company (10):** `index.html`, `404.html`, `about.html`, `pricing.html`, `faq.html`, `security.html`, `book.html`, `requirements.html`, `availability.html`, `support.html`
- **Legal & Compliance (5):** `privacy.html`, `terms.html`, `cookies.html`, `accessibility.html`, `who-its-not-for.html`
- **Guides & Comparisons (3):** `what-is-erp.html`, `erp-for-small-business.html`, `compare.html`
- **Product Modules (12):** `products.html`, `products/general-ledger.html`, `products/sales-invoicing.html`, `products/purchasing.html`, `products/inventory.html`, `products/payroll-hr.html`, `products/pos.html`, `products/projects-field-service.html`, `products/document-capture.html`, `products/security.html`, `products/ai-agents.html`, `products/automation.html`, `products/ai-suite.html`
- **Industries (12):** `industries.html`, `industries/restaurants.html`, `industries/clinics.html`, `industries/construction.html`, `industries/logistics.html`, `industries/retail-pharmacy.html`, `industries/schools.html`, `industries/property.html`, `industries/professional-services.html`, `industries/agriculture.html`, `industries/hospitality.html`, `industries/manufacturing.html`
- **Case Studies (9):** `case-studies.html`, `case-studies/cafe-three-outlets.html`, `case-studies/consultancy-two-people.html`, `case-studies/builders-merchant.html`, `case-studies/dental-clinic-two-chairs.html`, `case-studies/boutique-hotel-ten-rooms.html`, `case-studies/school-bursary-office.html`, `case-studies/pharmacy-two-branches.html`, `case-studies/fleet-operator-fifteen-vans.html`
- **Bot Crew (9):** `bots.html`, `bots/pip.html`, `bots/tally.html`, `bots/ledger-bot.html`, `bots/recon.html`, `bots/chase.html`, `bots/collector.html`, `bots/audit-bot.html`, `bots/vault.html`
- **Roadmap Projects (9):** `projects.html`, `projects/product-catalog.html`, `projects/general-ledger-build.html`, `projects/multi-currency.html`, `projects/tenant-isolation.html`, `projects/marketing-site.html`, `projects/bot-crew.html`, `projects/payments-and-receipts.html`, `projects/industry-packs.html`
- **Blog Articles (16):** `blog.html` and 15 individual engineering and industry articles (`blog/*.html`).

---

## 6. Responsive Test Matrix

| Viewport Width | Device Category | Layout Behavior | Status |
|:---:|:---|:---|:---:|
| **360px** | Small Mobile (e.g. Galaxy S8) | Header fits cleanly on 1 line (Logo + Menu + Theme). Topbar button hidden; accessible `.menu-cta` inside drawer. Bento & cards stack 1-col. Shadows scale to 6px. Zero horizontal overflow. | **VERIFIED** |
| **390px** | Modern Mobile (iPhone 12–16) | Single-line topbar. Forms and cards maintain comfortable tap targets and 14px gutters. | **VERIFIED** |
| **768px** | Tablet Portrait (iPad) | Hero stacks 1-col with 380px 3D canvas. Bento and cards adapt to 2-col grid. Primary navigation collapses to accessible drawer. | **VERIFIED** |
| **1024px** | Small Laptop / Tablet Landscape | Hero grid renders 2-col. Primary links display inline in topbar. Bento cards render 2-col with Studio 07 spanning full width. | **VERIFIED** |
| **1440px** | Desktop Display | Max-width 1160px wrap centered. Bento grid renders 3-col with Studio 07 full-width banner. 3D canvas active with pointer tilt. | **VERIFIED** |
| **1920px** | Large Desktop / 1080p | Container cleanly centered at 1160px with generous margins. Grain overlay active without performance penalty. | **VERIFIED** |

---

## 7. Accessibility Results (WCAG 2.2 AA)

- **Keyboard Navigation:** **VERIFIED.** Logical tab order across all links, buttons, form inputs, and modal dialogs.
- **Escape Key Handling:** **VERIFIED.** Added to mobile navigation drawer and natively handled by `<dialog>`.
- **Focus Indicators:** **VERIFIED.** `:focus-visible` ring (`outline: 3px solid var(--cyan); outline-offset: 3px;`) active across all interactive elements.
- **Form Labels & Error Association:** **VERIFIED.** Every `<input>`, `<select>`, `<textarea>` has a programmatic `<label for="...">`. Error states communicate via `aria-invalid="true"` and live status regions.
- **Duplicate IDs:** **VERIFIED (0 duplicates).** Evaluated across all 86 pages.
- **Headings Structure:** **VERIFIED.** Exactly one `<h1>` per page.
- **Image Alternative Text:** **VERIFIED.** 100% of `<img>` tags carry valid `alt` descriptions.
- **Reduced Motion:** **VERIFIED.** `@media (prefers-reduced-motion: reduce)` disables keyframe animations, 3D pointer tracking, and transitions across all pages.

---

## 8. SEO, Security & Privacy Results

- **Canonical URLs:** **VERIFIED.** All indexable pages link canonically to `https://qavrillabs.com/...`.
- **OpenGraph & Twitter Cards:** **VERIFIED.** Declared on all 86 pages with `og-image.png` (1200x630).
- **JSON-LD Structured Data:** **VERIFIED.** 100% syntactically valid schemas (`Organization`, `WebSite`, `SoftwareApplication`, `FAQPage`, `BreadcrumbList`).
- **Sitemap & Robots:** **VERIFIED.** `sitemap.xml` has 86 URLs matching disk pages; `robots.txt` points to `sitemap.xml` and welcomes AI crawlers.
- **AI Knowledge Manifest:** **VERIFIED.** `llms.txt` cleanly indexes the 7 studios, 39 products, and engineering invariants.
- **API Decoupling:** **VERIFIED.** `site/config.js` maintains `apiBase: ""` with contact email fallback.
- **Security Headers:** **VERIFIED.** CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, and HSTS (without premature preload) defined in `site/_headers`.
- **Legal Notices:** **VERIFIED.** `privacy.html` and `terms.html` explicitly display *"Pending legal review"* and *"Pending corporate registration"* notices without inventing false entities.

---

## 9. Automated Verification Summary

| Test Suite / Tool | Execution Command | Result | Status |
|:---|:---|:---:|:---:|
| **Site Page Generator** | `npm run site:build` | Wrote 86 pages | **VERIFIED (Exit 0)** |
| **Site Check Validator** | `npm run site:check` | **3,830 passed, 0 failed, 0 warnings** | **VERIFIED (Exit 0)** |
| **L1 Comprehensive Audit** | `node scripts/audit-site-l1.mjs` | **4,230 passed, 0 failed** | **VERIFIED (Exit 0)** |
| **JavaScript Syntax Check** | `node --check site/*.js` | All 3 JS files valid syntax | **VERIFIED (Exit 0)** |
| **Core SaaS Package Tests** | `npm test` | **125 passed** across 13 packages | **VERIFIED (Zero regressions)** |

---

## 10. Remaining Known Issues & Production Prerequisites

The local website is completely stabilized, verified, and functional. The following items are **intentionally deferred to production** and cannot be completed locally:

1. **Domain Acquisition & DNS:** `qavrillabs.com` must be registered at a registrar by the operator and pointed to Cloudflare DNS.
2. **Edge SSL/TLS Certificate:** Provisioned automatically upon domain activation in Cloudflare.
3. **Corporate Entity & Registered Address:** To be inserted into legal pages once formal company incorporation is finalized.
4. **Production Lead Intake Gateway:** When containerized and deployed, `apiBase` will be updated to point to the dedicated intake URL.
5. **Git Remote Connection:** Connecting `https://github.com/msaxena1212/qavril_labs.git` and setting up Cloudflare Pages deployment branch.

---

## 11. Git Working-Tree Preservation Evidence

```text
$ git branch --show-current
master

$ git status --short
?? .gitignore
?? CLAUDE.md
?? ERP-Product-Catalog.md
?? README.md
?? apps/
?? docs/
?? package-lock.json
?? package.json
?? packages/
?? reports/
?? research_notes/
?? scripts/
?? services/
?? site/
?? tsconfig.json
?? vitest.config.ts
```
- **Staged files:** 0
- **Committed files:** 0
- **Remotes connected:** 0
- **All untracked project directories preserved.**

---

## 12. Final Milestone Status & Mandatory Stop

- **Milestone:** **L1 — Local Stabilization COMPLETE.**
- **Local Site State:** Completely stable, polished, responsive, and verified.
- **Mandatory Stop Condition:** **ENFORCED.** No Cloudflare project created, no DNS modified, no remote pushed, no production deployed.

