// Generates the product, case study, project, and industry pages, the booking page, and the sitemap
// from scripts/site-content.mjs. Run after editing the content: npm run site:build
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { MODULE_LINKS, modulesFor } from "./site-links.mjs";
import { MODULE_MORE } from "./site-module-more.mjs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CASES, INDUSTRIES, LEVELS, PENDING, PLANS, PRODUCTS, PROJECTS, REQUIREMENTS } from "./site-content.mjs";
import { CASE_DETAIL, FAQ, INDUSTRY_DETAIL, PRODUCT_DETAIL, PROJECT_DETAIL } from "./site-extra.mjs";
import { BOTS, PRODUCT_MORE } from "./site-extra-2.mjs";
import { signinBody, signupBody } from "./site-account-pages.mjs";
import { BOT_DETAIL } from "./site-extra-3.mjs";
import { BOT_CONTROLS } from "./site-bot-controls.mjs";
import { INFO_PAGES } from "./site-info-pages.mjs";
import { LEGAL_PAGES } from "./site-legal-pages.mjs";
import { BLOG_POSTS } from "./site-blog.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "site");
// Set SITE_BASE_URL once the domain is known, so every canonical, sitemap and llms.txt link is updated together.
const BASE = (process.env.SITE_BASE_URL || "https://qavrillabs.com").replace(/\/$/, "");

function writeLlmsTxt() {
  const lines = [
    "# QAVRIL LABS",
    "",
    "> Cloud ERP for small and medium businesses: finance, sales, inventory, purchasing, payroll, POS, and AI agents with automation, in one system. Start free or book a demo.",
    "",
    "## System Identity & Overview",
    "QAVRIL LABS is a multi-tenant cloud Enterprise Resource Planning (ERP) platform for small and medium-sized businesses. It unifies core double-entry finance, order-to-cash sales, procure-to-pay purchasing, multi-location inventory, localized payroll, offline-first point of sale, and an autonomous AI agent swarm under strict tenant isolation.",
    "",
    "## Core Architectural Invariants (Factual & Citable)",
    "- Double-Entry Immutable Ledger: Every financial event posts debits and credits that balance exact to the cent. Posted journal entries cannot be edited or quietly deleted; corrections are handled exclusively via audit-logged reversing entries.",
    "- Strict Tenant Data Isolation: Each customer's data is partitioned with PostgreSQL row-level security and tenant-scoped session claims. Zero cross-tenant data bleed occurs at the database or memory layers.",
    "- Exact-to-the-Cent Fixed-Point Math: Financial values are computed without floating-point inaccuracies, guaranteeing error-free trial balances and tax reporting across all supported currencies.",
    "- Gap-Free Document Numbering: Sequential numbers for invoices, bills, and journals run contiguously without gaps, meeting statutory audit compliance.",
    "- Bots with Human-in-the-Loop Approvals: AI bots run routine tasks within hard limits and need single-use token approvals from authorized personnel before changing the ledger.",
    "- Decoupled Static Architecture: The public marketing front-end is completely decoupled from internal database and API gateways, ensuring resilience, zero attack surface, and instant global CDN delivery.",
    "",
    "## The Seven Purpose-Built Product Studios",
    "- [Studio 01: Finance & Autonomous Core](${BASE}/products.html): Immutable double-entry general ledger, multi-currency accounts, automated sales invoicing, purchasing, and fiscal period locks.",
    "- [Studio 02: Construction & Engineering](${BASE}/industries/construction.html): EPC project controls, Work Breakdown Structures (WBS), Bill of Quantities (BOQ) estimation, subcontractor billing, and retention tracking.",
    "- [Studio 03: Real Estate & Property](${BASE}/industries/property.html): Multi-unit property management (PMS), lease lifecycle agreements, Post-Dated Cheque (PDC) cashiering, and automated maintenance dispatch.",
    "- [Studio 04: Retail & Restaurant POS](${BASE}/products/pos.html): Offline-resilient fast counter checkout, table kitchen order ticketing (KOT), split billing, barcode scanning, and QR digital ordering.",
    "- [Studio 05: Automotive & Mobility](${BASE}/products/projects-field-service.html): Garage workshop management, vehicle job cards, VIN tracking, bay allocation, technician time logs, and preventative fleet service.",
    "- [Studio 06: Logistics & Quick Commerce](${BASE}/industries/logistics.html): Dark store inventory dispatch, multi-warehouse lot and expiry tracking, delivery partner routing, and electronic proof of delivery.",
    "- [Studio 07: Universal AI Agent Platform (UAAP)](${BASE}/products/ai-agents.html): Stateful agent graph runtime, Human-in-the-Loop approvals with single-use token hashes, 5-tier permission sandboxes, and autonomous bot crew coordination.",
    "",
    "## Products & Core Modules",
    ...PRODUCTS.map((p) => `- [${p.name}](${BASE}/products/${p.slug}.html): ${p.summary}`),
    "",
    "## Autonomous AI Bot Crew",
    ...BOTS.map((b) => `- [${b.name}](${BASE}/bots/${b.slug}.html): ${b.role}. Handles routine workflows inside strict limits with audit logs.`),
    "",
    "## Supported Industries",
    ...INDUSTRIES.map((i) => `- [${i.name}](${BASE}/industries/${i.slug}.html): ${i.pains}`),
    "",
    "## Comparative Analysis vs Other Systems",
        "- Compared to SAP / NetSuite: QAVRIL LABS offers onboarding in days rather than 6-12 months, transparent low monthly subscriptions ($19-$39/mo vs $1,000+/user/mo), and native built-in autonomous bot workflows.",
    "- Compared to Odoo: QAVRIL LABS offers immutable double-entry ledger enforcement without third-party plugin dependency, offline-resilient POS, and unified tenant isolation.",
    "- Compared to Zoho Books / QuickBooks: QAVRIL LABS unifies operations (WBS construction, property PMS, dark store logistics, and kitchen ticketing) eliminating the need for 5+ fragmented apps and spreadsheets.",
    "",
    "## Pricing Structure (US Dollars)",
    "- Free: $0 per month, 1 company, 1 user, up to 30 invoices/month.",
    "- Starter: $9 per month, one-time setup $49.",
    "- Growth: $19 per month, one-time setup $149.",
    "- Business: $39 per month, one-time setup $399.",
    "- Enterprise: Custom deployment, dedicated tenancy, custom integrations.",
    "- Annual billing offers two months free. No hidden setup charges.",
    "",
    "## Target Markets & Localization",
    "Fiscal calendars, e-invoicing formats, and payroll rules are configured as per-country data, and each country pack is reviewed by a local expert.",
    "",
    "## Official Contact & Booking",
    "- Demo & Trial Booking: ${BASE}/book.html",
    "- Company Inquiries: connect@qavrillabs.com",
    "- Canonical Website: ${BASE}/"
  ];
  writeFileSync(join(site, "llms.txt"), lines.join("\n") + "\n", "utf8");

  // Also write comprehensive llms-full.txt for deep retrieval
  const fullLines = [
    "# QAVRIL LABS — Full Platform Knowledge Base & Architectural Specification",
    "",
    ...lines,
    "",
    "## Detailed Architectural Rules & Invariants",
    "1. Ledger Invariant: In any journal entry, sum(debit) == sum(credit). All currency conversions calculate base_amount = foreign_amount * exchange_rate, locked at the transaction date.",
    "2. Fiscal Locking: Closed fiscal periods reject any new write operations. Any adjustment must occur in the active fiscal period with explicit audit notation.",
    "3. Human-in-the-Loop Tokenization: AI bots generate action proposals. A cryptographic single-use token is delivered to the authorized human reviewer. Approval consumes the token; expired or replayed tokens fail closed.",
    "4. Point of Sale Offline Resilience: POS registers keep a local cache so sales continue without internet and sync on reconnection.",
    "",
    "## Case Studies & Practical Scenarios",
    ...CASES.map((c) => `### ${c.name}\n${c.summary}\nFull details: ${BASE}/case-studies/${c.slug}.html\n`),
    "",
    "## Engineering Deep Dives",
    ...PROJECTS.map((p) => `### ${p.name}\n${p.summary}\nBlueprint: ${BASE}/projects/${p.slug}.html\n`),
  ];
  writeFileSync(join(site, "llms-full.txt"), fullLines.join("\n") + "\n", "utf8");
}


// Illustrative dashboard preview. Sample figures only; labeled as such in the image itself.
function dashboardSvg(title, kpis, hue, services = []) {
  const tiles = kpis.map((label, i) => `<g transform="translate(${30 + i * 200},78)"><rect width="180" height="78" rx="14" fill="#16122e" stroke="${hue}" stroke-width="2"/><text x="14" y="30" fill="#bfbad9" font-size="13" font-family="Arial">${esc(label)}</text><text x="14" y="62" fill="#fff4dc" font-size="24" font-weight="700" font-family="Arial">${["1,240", "38", "92%"][i]}</text></g>`).join("");
  const bars = Array.from({ length: 12 }, (_, i) => {
    const h = 40 + ((title.length * (i + 3) * 17) % 120);
    return `<rect x="${40 + i * 46}" y="${320 - h}" width="28" height="${h}" rx="6" fill="${i % 2 ? hue : "#8b6bff"}"/>`;
  }).join("");
  const screen = `<rect width="640" height="360" rx="22" fill="#0d0b1f"/><rect width="640" height="48" rx="22" fill="#16122e"/><circle cx="22" cy="24" r="6" fill="#ff4fa3"/><circle cx="40" cy="24" r="6" fill="#ffe14d"/><circle cx="58" cy="24" r="6" fill="#c6ff3d"/><text x="80" y="30" fill="#fff4dc" font-size="16" font-weight="700" font-family="Arial">${esc(title)}</text><text x="400" y="30" fill="#bfbad9" font-size="11" font-family="Arial">Illustrative preview · sample data</text>${tiles}${bars}`;
  const badges = services.slice(0, 4).map((label, i) => {
    const x = [24, 400, 40, 380][i];
    const y = [300, 300, 20, 20][i];
    const w = Math.min(200, 16 + label.length * 7);
    return `<g transform="translate(${x},${y})"><rect width="${w}" height="26" rx="13" fill="${hue}" stroke="#0a0a0f" stroke-width="2"/><text x="12" y="17" fill="#0a0a0f" font-size="12" font-weight="700" font-family="Arial">${esc(label)}</text></g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" role="img" aria-label="Illustrative 3D layout for ${esc(title)}">
<defs><linearGradient id="g${hue.slice(1)}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1f5c"/><stop offset="1" stop-color="#0d0b1f"/></linearGradient></defs>
<rect width="640" height="360" rx="22" fill="url(#g${hue.slice(1)})"/>
<ellipse cx="320" cy="318" rx="220" ry="18" fill="#000" opacity="0.45"/>
<g transform="translate(320 180) skewY(-9) skewX(12) scale(0.8) translate(-320 -180)">
  <rect x="0" y="22" width="640" height="360" rx="22" fill="#000" opacity="0.5"/>
  <rect x="0" y="12" width="640" height="360" rx="22" fill="${hue}" opacity="0.35"/>
  ${screen}
</g>
${badges}
</svg>`;
}

function botSvg(b) {
  return `<svg class="bot" viewBox="0 0 80 80" aria-hidden="true"><line x1="40" y1="8" x2="40" y2="16" stroke="#0a0a0f" stroke-width="3"/><circle cx="40" cy="7" r="4" fill="${b.accent}" stroke="#0a0a0f" stroke-width="2"/><rect x="16" y="16" width="48" height="40" rx="14" fill="${b.color}" stroke="#0a0a0f" stroke-width="3"/><circle class="eye" cx="32" cy="34" r="5" fill="#0a0a0f"/><circle class="eye" cx="48" cy="34" r="5" fill="#0a0a0f"/><path d="${b.mood}" fill="none" stroke="#0a0a0f" stroke-width="3" stroke-linecap="round"/><rect x="24" y="58" width="32" height="14" rx="6" fill="${b.accent}" stroke="#0a0a0f" stroke-width="3"/></svg>`;
}

const esc = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SLOTS = [
  "Monday morning", "Monday afternoon", "Tuesday morning", "Tuesday afternoon", "Wednesday morning",
  "Wednesday afternoon", "Thursday morning", "Thursday afternoon", "Friday morning", "Friday afternoon",
];


const SECTION_NAMES = { products: "Products", "case-studies": "Case studies", projects: "Projects", industries: "Industries", bots: "AI bots", blog: "Blog" };

// Breadcrumb structured data: helps search engines and AI assistants see where a page sits.
function crumbs(path, title) {
  const items = [{ name: "Home", url: `${BASE}/` }];
  const parts = path.split("/");
  if (parts.length > 1) items.push({ name: SECTION_NAMES[parts[0]], url: `${BASE}/${parts[0]}.html` });
  items.push({ name: title, url: `${BASE}/${path}` });
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: item.url })),
  };
  return `  <script type="application/ld+json">${JSON.stringify(data)}</script>
`;
}

function head(prefix, title, description, canonicalPath) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} | QAVRIL LABS</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${BASE}/${canonicalPath}">
  <meta name="robots" content="index, follow">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="QAVRIL LABS">
  <meta property="og:title" content="${esc(title)} | QAVRIL LABS">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${BASE}/${canonicalPath}">
  <meta property="og:image" content="${BASE}/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)} | QAVRIL LABS">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${BASE}/og-image.png">
  <link rel="icon" href="${prefix}favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Unbounded:wght@800&display=swap" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Unbounded:wght@800&display=swap"></noscript>
  <script>try{var t=localStorage.getItem("qavril-theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>
  <link rel="stylesheet" href="${prefix}styles.css?v=11">
  <link rel="stylesheet" href="${prefix}subpage.css">
${crumbs(canonicalPath, title)}</head>
<body>`;
}

function header(prefix) {
  return `  <header class="topbar">
    <div class="wrap nav">
      <a class="logo" href="${prefix}index.html">
        <span class="logo-mark" aria-hidden="true">Q</span>
        <span class="logo-text">QAVRIL<span class="slash">/</span>LABS</span>
      </a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-links">
        <span class="menu-bars" aria-hidden="true"></span>
        <span class="menu-label">Menu</span>
      </button>
      <nav class="links" id="site-links" aria-label="Primary">
        <a href="${prefix}products.html">Products</a>
        <a href="${prefix}case-studies.html">Case studies</a>
        <a href="${prefix}projects.html">Projects</a>
        <a href="${prefix}industries.html">Industries</a>
        <a href="${prefix}pricing.html">Pricing</a>
        <a href="${prefix}blog.html">Blog</a>
        <a href="${prefix}faq.html">FAQ</a>
        <a href="${prefix}signin.html">Sign in</a>
        <a class="menu-cta" href="${prefix}signup.html">Start free</a>
      </nav>
      <button class="theme-toggle" type="button" aria-label="Switch to dark theme" aria-pressed="false" data-theme-toggle><span aria-hidden="true">◐</span></button>
      <a class="btn btn-sm btn-lime" href="${prefix}signup.html">Start free</a>
    </div>
  </header>`;
}

function footer(prefix) {
  return `  <footer class="footer-line">
    <a href="${prefix}index.html">Home</a> · <a href="${prefix}products.html">Products</a> · <a href="${prefix}industries.html">Industries</a> · <a href="${prefix}pricing.html">Pricing</a> · <a href="${prefix}migration.html">Migration</a> · <a href="${prefix}support.html">Support</a> · <a href="${prefix}about.html">About</a> · <a href="${prefix}security.html">Security</a> · <a href="${prefix}book.html">Book a demo or trial</a> · <a href="${prefix}privacy.html">Privacy</a> · <a href="${prefix}terms.html">Terms</a> · <a href="${prefix}cookies.html">Cookies</a> · <a href="${prefix}accessibility.html">Accessibility</a>
  </footer>
  <script src="${prefix}config.js?v=4"></script>
  <script src="${prefix}main.js?v=5"></script>
</body>
</html>
`;
}

const ctaBlock = (prefix) => `    <section class="cta-band">
      <h2>See it, then decide</h2>
      <p>Book a 20-minute demo slot, or request a free trial. We reply by email to confirm.</p>
      <div class="cta-row">
        <a class="btn btn-lime" href="${prefix}book.html?interest=demo" data-modal="demo">Book a demo slot</a>
        <a class="btn btn-ghost" href="${prefix}signup.html">Request a free trial</a>
      </div>
    </section>`;

const list = (items) => items.map((item) => `        <li>${esc(item)}</li>`).join("\n");


function detailPage({ prefix, title, description, canonicalPath, kicker, name, summary, body, extra = "", back }) {
  return `${head(prefix, title, description, canonicalPath)}
${header(prefix)}

  <main>
    <span class="kicker">${esc(kicker)}</span>
    <h1>${esc(name)}</h1>
    <p class="lead">${esc(summary)}</p>
    <p class="cta-row"><a class="btn btn-lime" href="${prefix}signup.html">Start free</a> <a class="btn btn-ghost" href="${prefix}book.html?interest=demo" data-modal="demo">See it in a live demo</a></p>
${body}
${extra}
${ctaBlock(prefix)}
    <p class="note"><a href="${prefix}${back.href}">&larr; ${esc(back.label)}</a></p>
  </main>

${footer(prefix)}`;
}

function indexPage({ title, description, canonicalPath, kicker, h1, lead, cards, intro = "", prefix = "" }) {
  const grid = cards
    .map(
      (card) => `      <a class="item card-link" href="${card.href}">
        <h3>${esc(card.name)}</h3>
        <p>${esc(card.summary)}</p>
        <span class="more">Read more &rarr;</span>
      </a>`,
    )
    .join("\n");
  return `${head(prefix, title, description, canonicalPath)}
${header(prefix)}

  <main>
    <span class="kicker">${esc(kicker)}</span>
    <h1>${esc(h1)}</h1>
    <p class="lead">${esc(lead)}</p>
    <div class="grid">
${grid}
    </div>
${intro ? `    <section class="detail-block">${intro}</section>` : ""}
${ctaBlock(prefix)}
  </main>

${footer(prefix)}`;
}

// Plain pages: a heading, a lead, then titled sections of paragraphs and lists.
function infoPage({ path, title, description, kicker, h1, lead, sections }) {
  const body = sections
    .map((s) => {
      const paras = (s.paras || []).map((p) => `    <p>${esc(p)}</p>`).join("\n");
      const items = s.items ? `    <ul class="feature-list">\n${list(s.items)}\n    </ul>` : "";
      return `    <section class="detail-block">\n      <h2>${esc(s.h)}</h2>\n${paras}\n${items}\n    </section>`;
    })
    .join("\n");
  return `${head("", title, description, path)}
${header("")}

  <main>
    <span class="kicker">${esc(kicker)}</span>
    <h1>${esc(h1)}</h1>
    <p class="lead">${esc(lead)}</p>
${body}
${ctaBlock("")}
  </main>

${footer("")}`;
}

function bookPage() {
  const options = SLOTS.map((slot) => `              <option>${esc(slot)}</option>`).join("\n");
  return `${head("", "Book a demo or request a free trial", "Book a 20-minute demo slot or request a free trial of the ERP platform.", "book.html")}
${header("")}

  <main>
    <span class="kicker">Book</span>
    <h1>Book a demo slot or request a trial</h1>
    <p class="lead">Pick a preferred time and tell us about your business. We reply by email within one business day to confirm the slot.</p>
    <p class="note"><strong>Free trial:</strong> trial access is not open yet. Requesting one puts you first in line, and we email you when your trial is ready. Nothing is charged for a trial.</p>

    <form id="lead-form" class="lead-form" novalidate>
      <div class="field">
        <label for="b-name">Full name</label>
        <input id="b-name" name="name" type="text" autocomplete="name" required maxlength="120">
      </div>
      <div class="field">
        <label for="b-email">Work email</label>
        <input id="b-email" name="email" type="email" autocomplete="email" required maxlength="254">
      </div>
      <div class="field">
        <label for="b-company">Company</label>
        <input id="b-company" name="company" type="text" autocomplete="organization" maxlength="160">
      </div>
      <div class="field">
        <label for="b-country">Country</label>
        <input id="b-country" name="country" type="text" autocomplete="country-name" maxlength="80">
      </div>
      <div class="field">
        <label for="b-interest">I want a</label>
        <select id="b-interest" name="interest" required>
          <option value="demo">Demo slot</option>
          <option value="trial">Free trial (request)</option>
          <option value="early_access">Product updates only</option>
          <option value="partner">Become a partner or accountant</option>
        </select>
      </div>
      <div class="field">
        <label for="b-slot">Preferred slot</label>
        <select id="b-slot" name="slot">
          <option value="">No preference</option>
${options}
        </select>
      </div>
      <div class="field">
        <label for="b-industry">Industry</label>
        <select id="b-industry" name="industry">
          <option value="">Choose one</option>
${INDUSTRIES.map((i) => `          <option>${esc(i.name)}</option>`).join("\n")}
          <option>Other</option>
        </select>
      </div>
      <div class="field full">
        <label for="b-message">What should we cover? <span class="optional">(optional)</span></label>
        <textarea id="b-message" name="message" rows="4" maxlength="1000"></textarea>
      </div>
      <div class="field full check">
        <input id="b-consent" name="consent" type="checkbox" required>
        <label for="b-consent">I agree that QAVRIL LABS may store these details and contact me about my request. Read the <a href="privacy.html">privacy notice</a>.</label>
      </div>
      <div class="hp" aria-hidden="true">
        <label>Leave this field empty <input name="website" type="text" tabindex="-1" autocomplete="off"></label>
      </div>
      <div class="field full actions">
        <button class="btn btn-lime" type="submit">Send my request</button>
        <p id="form-status" class="status" role="status" aria-live="polite"></p>
      </div>
    </form>
  </main>

${footer("")}`;
}

function write(relativePath, html) {
  const full = join(site, relativePath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, html, "utf8");
}

// Structured data for a module page: what it is, its status, and the steps a customer follows.
function softwareSchema(p) {
  const software = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: p.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: p.summary,
    url: `${BASE}/products/${p.slug}.html`,
  };
  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How ${p.name} works`,
    step: PRODUCT_DETAIL[p.slug].steps.map((text, index) => ({ "@type": "HowToStep", position: index + 1, text })),
  };
  return `  <script type="application/ld+json">${JSON.stringify(software)}</script>
  <script type="application/ld+json">${JSON.stringify(howTo)}</script>
`;
}

// Links between detail pages. Every detail page sits one folder below the site root, so "../" reaches them all.
const productLink = (slug) => `        <li><a href="../products/${slug}.html">${esc(PRODUCTS.find((p) => p.slug === slug).name)}</a></li>`;
const industryLink = (slug) => `        <li><a href="../industries/${slug}.html">${esc(INDUSTRIES.find((i) => i.slug === slug).name)}</a></li>`;
const caseLink = (slug) => `        <li><a href="../case-studies/${slug}.html">${esc(CASES.find((c) => c.slug === slug).name)}</a></li>`;

function relatedSection(title, items) {
  if (items.length === 0) return "";
  return `    <section class="detail-block">
      <h2>${esc(title)}</h2>
      <ul class="feature-list">
${items.join("\n")}
      </ul>
    </section>`;
}

// Index pages and detail pages.
for (const p of PRODUCTS) {
  const more = PRODUCT_MORE[p.slug];
  write(`img/dashboards/${p.slug}.svg`, dashboardSvg(p.name, more.kpis, p.slug.length % 2 ? "#c6ff3d" : "#3de8ff", more.services));
}

const productCards = PRODUCTS.map((p) => ({ name: p.name, summary: p.summary, href: `products/${p.slug}.html` }));
write("products.html", indexPage({
  title: "Products", description: "Every ERP module: what it does, who it is for, and how a demo shows it.",
  canonicalPath: "products.html", kicker: "Products", h1: "The modules, one system",
  lead: "Each module shares the same customer records, ledger and permissions. Pick one to read the detail, or book a demo to see them together. Explore our foundational <a href=\"requirements.html\">platform requirements</a>.",
  cards: productCards,
}));
for (const p of PRODUCTS) {
  const d = PRODUCT_DETAIL[p.slug];
  const m = PRODUCT_MORE[p.slug];
  const extra = `    <section class="detail-block">
      <figure class="dashboard-figure">
        <img src="../img/dashboards/${p.slug}.png" alt="Illustrative 3D preview of the ${esc(p.name)} screen, with sample data" width="1600" height="900" loading="lazy">
        <figcaption>Illustrative dashboard preview with sample data. Your screens show your own figures.</figcaption>
      </figure>
      <h2>Services</h2>
      <ul class="feature-list">
${m.services.map((x) => `        <li>${esc(x)}</li>`).join("\n")}
      </ul>
      <h2>Functions</h2>
      <ul class="feature-list">
${m.functions.map((x) => `        <li>${esc(x)}</li>`).join("\n")}
      </ul>
      <h2>How it works</h2>
      <ol class="steps">
${d.steps.map((step) => `        <li>${esc(step)}</li>`).join("\n")}
      </ol>
      <h2>A typical example</h2>
      <p class="example">${esc(d.example)}</p>
    </section>`;
  const body = `    <h2>What it does</h2>
    <ul class="feature-list">
${list(p.features)}
    </ul>
    <h2>Who it is for</h2>
    <p>${esc(p.who)}</p>
    <h2>Highlights</h2>
    <ul class="feature-list">
${list(MODULE_MORE[p.slug].highlights)}
    </ul>
    <h2>Works with</h2>
    <p class="chips">${MODULE_MORE[p.slug].works_with.map((x) => `<span>${esc(x)}</span>`).join("")}</p>
    <h2>Questions about this module</h2>
${MODULE_MORE[p.slug].faqs.map((f) => `    <details class="faq-item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("\n")}`;
  write(`products/${p.slug}.html`, detailPage({
    prefix: "../", title: `${p.name} software`, description: p.summary, canonicalPath: `products/${p.slug}.html`,
    kicker: "Product", name: p.name, summary: p.summary, body, back: { href: "products.html", label: "All products" },
    extra: softwareSchema(p) + extra + relatedSection("Industries that use it", MODULE_LINKS[p.slug].industries.map((s) => industryLink(s)))
      + relatedSection("Example scenarios", MODULE_LINKS[p.slug].cases.map((s) => caseLink(s))),
  }));
}

const caseCards = CASES.map((c) => ({ name: c.name, summary: c.summary, href: `case-studies/${c.slug}.html` }));
write("case-studies.html", indexPage({
  title: "Case studies (example scenarios)", description: "Example scenarios showing how the ERP would fit a café, a consultancy, and a builders' merchant. Not customer stories.",
  canonicalPath: "case-studies.html", kicker: "Example scenarios", h1: "What it could look like on your floor",
  lead: "These are example scenarios, not customer stories. We have no paying customers yet. Real case studies replace them once first customers agree to be named.",
  cards: caseCards,
}));
for (const c of CASES) {
  const extra = `    <section class="detail-block">
      <h2>A day with the system</h2>
      <ol class="steps">
${CASE_DETAIL[c.slug].day.map((step) => `        <li>${esc(step)}</li>`).join("\n")}
      </ol>
    </section>`;
  const body = `    <h2>The problem</h2>
    <p>${esc(c.problem)}</p>
    <h2>Modules that would matter</h2>
    <ul class="feature-list">
${list(c.modules)}
    </ul>
    <h2>What a demo would show</h2>
    <p>${esc(c.demo)}</p>
    <p class="note"><strong>Example scenario.</strong> This describes a typical business, not a real customer.</p>`;
  write(`case-studies/${c.slug}.html`, detailPage({
    prefix: "../", title: c.name, description: c.summary, canonicalPath: `case-studies/${c.slug}.html`,
    kicker: "Example scenario", name: c.name, summary: c.summary, body,
    extra: extra + relatedSection("Modules that would matter", modulesFor("cases", c.slug).map((s) => productLink(s))),
    back: { href: "case-studies.html", label: "All scenarios" },
  }));
}

const projectCards = PROJECTS.map((p) => ({ name: p.name, summary: p.summary, href: `projects/${p.slug}.html` }));
write("projects.html", indexPage({
  title: "Projects", description: "How the QAVRIL LABS platform is engineered: one ledger, exact money, walled-off data, and how each piece is checked.",
  canonicalPath: "projects.html", kicker: "Projects", h1: "Under the hood",
  lead: "The engineering behind the books you can trust. Each deep dive shows how a core piece of QAVRIL LABS works.",
  cards: projectCards,
}));
for (const p of PROJECTS) {
  const extra = `    <section class="detail-block">
      <h2>What this means for you</h2>
      <p class="example">${esc(PROJECT_DETAIL[p.slug].meaning)}</p>
    </section>`;
  const body = `    <h2>What it does today</h2>
    <p>${esc(p.today)}</p>
`;
  write(`projects/${p.slug}.html`, detailPage({
    prefix: "../", title: p.name, description: p.summary, canonicalPath: `projects/${p.slug}.html`,
    kicker: "Project", name: p.name, summary: p.summary, body, extra, back: { href: "projects.html", label: "All projects" },
  }));
}

const industryCards = INDUSTRIES.map((i) => ({ name: i.name, summary: i.pains, href: `industries/${i.slug}.html` }));
write("industries.html", indexPage({
  title: "Industries", description: "How the ERP fits restaurants, clinics, construction, logistics, retail, schools, property, services and agriculture.",
  canonicalPath: "industries.html", kicker: "Industries", h1: "Built on the core, tuned to your trade",
  lead: "Every industry runs on the same core: the ledger, sales, purchasing and inventory. Industry packs add the specific workflows on top, and early customers choose which come first.",
  cards: industryCards,
}));
for (const i of INDUSTRIES) {
  const extra = `    <section class="detail-block">
      <h2>A typical example</h2>
      <p class="example">${esc(INDUSTRY_DETAIL[i.slug].example)}</p>
    </section>`;
  const body = `    <h2>The usual pain</h2>
    <p>${esc(i.pains)}</p>
    <h2>Where we start</h2>
    <p>${esc(i.first)}</p>
    <h2>Tell us your trade</h2>
    <p>Industry packs are chosen by the customers who need them. Mention your trade when you book a demo and we will weigh it.</p>`;
  write(`industries/${i.slug}.html`, detailPage({
    prefix: "../", title: `ERP for ${i.name.toLowerCase()}`, description: i.pains, canonicalPath: `industries/${i.slug}.html`,
    kicker: "Industry", name: i.name, summary: i.pains, body,
    extra: extra + relatedSection("Modules for this industry", modulesFor("industries", i.slug).map((s) => productLink(s))),
    back: { href: "industries.html", label: "All industries" },
  }));
}

write("book.html", bookPage());
write("signup.html", `${head("", "Start free", "Create your free QAVRIL LABS workspace in two minutes: books, sales and stock in one place, with AI bots that ask before they act.", "signup.html")}
${header("")}
${signupBody()}
${footer("")}`);
write("signin.html", `${head("", "Sign in", "Sign in to your QAVRIL LABS workspace with your workspace address, email and password.", "signin.html")}
${header("")}
${signinBody()}
${footer("")}`);

// Pricing: plans from PLANS, one-time setup, and how billing works. Figures are set in site-content.mjs.
const planCards = PLANS.map((plan) => {
  const price = plan.monthly === "Custom" ? "Custom" : `$${plan.monthly}<span> / month</span>`;
  const setup = plan.setup === "None" ? "No setup fee" : plan.setup === "Custom" ? "Setup agreed in writing" : `One-time setup: $${plan.setup}`;
  const action = plan.name === "Free" ? "Start free" : plan.name === "Enterprise" ? "Talk to us" : "Request this plan";
  const interest = plan.name === "Free" ? "trial" : "demo";
  return `      <article class="plan-card${plan.featured ? " plan-featured" : ""} reveal">
        ${plan.featured ? '<span class="tag tag-agents">Most chosen</span>' : ""}
        <h2>${esc(plan.name)}</h2>
        <p class="plan-tagline">${esc(plan.tagline)}</p>
        <p class="plan-price">${price}</p>
        <p class="plan-setup">${esc(setup)}</p>
        <ul class="feature-list">
${list(plan.includes)}
        </ul>
        <p class="note">${esc(plan.best)}</p>
        <a class="btn btn-lime" href="book.html?interest=${interest}&plan=${plan.name.toLowerCase()}" data-modal="${interest}">${action}</a>
      </article>`;
}).join("\n");
write("pricing.html", `${head("", "Pricing", "Simple plans from free. Monthly subscriptions, one-time setup, and no hidden charges. Request a plan through the form.", "pricing.html")}
${header("")}

  <main>
    <span class="kicker">Pricing</span>
    <h1>Simple plans, starting free</h1>
    <p class="lead">Pay monthly for the system, and pay once to set it up with you. The form starts both, and we confirm the exact amount in writing before you pay anything.</p>

    <div class="plan-grid">
${planCards}
    </div>

    <section class="detail-block">
      <h2>How billing works</h2>
      <ul class="feature-list">
        <li>Monthly plans are billed monthly. Annual billing gives two months free.</li>
        <li>The setup fee covers moving your opening records, setting up your chart of accounts, and training your team.</li>
        <li>Prices are shown in US dollars. Your local currency is shown on your written quote.</li>
        <li>Nothing is charged until you have seen the product and agreed to the written terms.</li>
        <li>Cancellation and data export when you leave are set out in those terms.</li>
      </ul>
    </section>

    <section class="detail-block">
      <h2>Start with the form</h2>
      <p>Tell us which plan you want and how many people will use it. We reply by email with the written quote and a date for your setup.</p>
      <p class="cta-row"><a class="btn btn-lime" href="book.html?interest=demo" data-modal="demo">Request a quote</a> <a class="btn btn-ghost" href="faq.html">Pricing questions</a></p>
    </section>
${ctaBlock("")}
  </main>

${footer("")}`);

// Blog: one page per article, with its own URL, dates and structured data.
const BLOG_DATE = "2026-11-02";
function blogPostPage(post) {
  const others = BLOG_POSTS.filter((p) => p.slug !== post.slug)
    .slice(0, 3)
    .map((p) => `        <li><a href="${p.slug}.html">${esc(p.title)}</a></li>`)
    .join("\n");
  const article = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: BLOG_DATE,
    dateModified: BLOG_DATE,
    author: { "@type": "Organization", name: "QAVRIL LABS" },
    publisher: { "@type": "Organization", name: "QAVRIL LABS" },
    mainEntityOfPage: `${BASE}/blog/${post.slug}.html`,
  });
  return `${head("../", post.title, post.description, `blog/${post.slug}.html`)}
  <script type="application/ld+json">${article}</script>
${header("../")}

  <main>
    <span class="kicker">Blog</span>
    <h1>${esc(post.title)}</h1>
    <p class="note">By the QAVRIL LABS team · Published ${BLOG_DATE}</p>
    <article class="post">
${post.body.replace(/href="([\w-]+\.html)/g, 'href="../$1')}
    </article>
${ctaBlock("../")}
    <section class="detail-block">
      <h2>More articles</h2>
      <ul class="feature-list">
${others}
      </ul>
    </section>
    <p class="note"><a href="../blog.html">&larr; All articles</a></p>
  </main>

${footer("../")}`;
}
for (const post of BLOG_POSTS) {
  write(`blog/${post.slug}.html`, blogPostPage(post));
}
const blogCards = BLOG_POSTS.map(
  (p) => `      <a class="item card-link" href="blog/${p.slug}.html">
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.description)}</p>
        <span class="more">Read more &rarr;</span>
      </a>`,
).join("\n");
const blogIndexLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "QAVRIL LABS blog",
  url: `${BASE}/blog.html`,
  blogPost: BLOG_POSTS.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: `${BASE}/blog/${p.slug}.html`, datePublished: BLOG_DATE })),
});
write("blog.html", `${head("", "The QAVRIL LABS blog", "Sharp, practical notes for business owners: one ledger, exact money, bots that ask first, reversals instead of edits, and faster month-ends.", "blog.html")}
  <script type="application/ld+json">${blogIndexLd}</script>
${header("")}

  <main>
    <span class="kicker">Blog</span>
    <h1>Run a sharper business</h1>
    <p class="lead">Practical articles for owners and managers of small and medium businesses.</p>
    <div class="grid">
${blogCards}
    </div>
${ctaBlock("")}
  </main>

${footer("")}`);

const botCards = BOTS.map((b) => `      <article class="item bot-card">
        ${botSvg(b)}
        
        <h3>${esc(b.name)}</h3>
        <p class="bot-role">${esc(b.role)}</p>
        <p>${esc(b.does)}</p>
        <h4>Automations</h4>
        <ul class="feature-list">
${b.automations.map((a) => `          <li>${esc(a)}</li>`).join("\n")}
        </ul>
        <p class="guard"><strong>Guardrail:</strong> ${esc(b.limits)}</p>
        <p><a class="more" href="bots/${b.slug}.html">Open ${esc(b.name)}'s page &rarr;</a></p>
      </article>`).join("\n");
for (const b of BOTS) {
  const d = BOT_DETAIL[b.slug];
  const others = BOTS.filter((o) => o.slug !== b.slug).map((o) => `        <li><a href="${o.slug}.html">${esc(o.name)}</a> · ${esc(o.role)}</li>`).join("\n");
  const feed = d.activity.map(([time, event, result]) => `        <li class="feed-row"><span class="feed-time">${esc(time)}</span><span class="feed-event">${esc(event)}</span><span class="feed-result">${esc(result)}</span></li>`).join("\n");
  write(`bots/${b.slug}.html`, `${head("../", `${b.name}: ${b.role}`, `${b.name}, the ${b.role.toLowerCase()}: what it does, its features, functions, automations and limits.`, `bots/${b.slug}.html`)}
${header("../")}

  <main>
    <section class="bot-hero-block">
      ${botSvg(b).replace('class="bot"', 'class="bot bot-hero"')}
      <div>

        <h1>${esc(b.name)}</h1>
        <p class="bot-role">${esc(b.role)}</p>
        <p class="lead">${esc(d.tagline)}</p>
        <p class="cta-row"><a class="btn btn-lime" href="../book.html?interest=demo" data-modal="demo">See ${esc(b.name)} in a demo</a> <a class="btn btn-ghost" href="../bots.html">All bots</a></p>
      </div>
    </section>

    <h2>What ${esc(b.name)} does</h2>
    <p>${esc(b.does)}</p>

    <h2>Works with</h2>
    <p class="chips">${d.works_with.map((x) => `<span>${esc(x)}</span>`).join("")}</p>

    <h2>Features</h2>
    <ul class="feature-list">
${d.features.map((x) => `        <li>${esc(x)}</li>`).join("\n")}
    </ul>

    <h2>Functions</h2>
    <div class="fn-grid">
${d.functions.map((x) => `      <div class="fn-card">${esc(x)}</div>`).join("\n")}
    </div>

    <h2>How a task runs, step by step</h2>
    <ol class="steps">
${d.workflow.map((x) => `        <li>${esc(x)}</li>`).join("\n")}
    </ol>

    <h2>Activity feed</h2>
    <p class="note">Sample entries that show the kind of record this bot keeps.</p>
    <ul class="activity-feed">
${feed}
    </ul>

    <h2>What you control</h2>
    <ul class="feature-list">
${BOT_CONTROLS[b.slug].map((x) => `        <li>${esc(x)}</li>`).join("\n")}
    </ul>

    <h2>Guardrails</h2>
    <p class="guard"><strong>Limit:</strong> ${esc(b.limits)} Every action is logged, and you can pause ${esc(b.name)} at any time.</p>

    <h2>Other bots</h2>
    <ul class="feature-list">
${others}
    </ul>
  </main>

${footer("../")}`);
}

write("bots.html", `${head("", "Meet the AI bots", "The AI bots that handle routine work: follow-ups, month-end checks, restocking, reminders, forecasts, duplicate checks and more, each inside limits you set.", "bots.html")}
${header("")}

  <main>
    <span class="kicker">AI bots</span>
    <h1>Meet the bots that do the routine work</h1>
    <p class="lead">Each bot has one job, a short list of automations, and clear limits. They draft and flag. A person approves anything that changes money, stock or customers.</p>
    <div class="grid">
${botCards}
    </div>
${ctaBlock("")}
  </main>

${footer("")}`);

const faqJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
});
const faqItems = FAQ.map((item) => `      <details class="faq-item">
        <summary>${esc(item.q)}</summary>
        <p>${esc(item.a)}</p>
      </details>`).join("\n");
write("faq.html", `${head("", "FAQ", "Answers to the questions we are asked most: trials, demos, countries, data, offline use, AI agents and pricing.", "faq.html")}
  <script type="application/ld+json">${faqJsonLd}</script>
${header("")}

  <main>
    <span class="kicker">FAQ</span>
    <h1>Questions we are asked</h1>
    <p class="lead">Short, direct answers. If yours is not here, book a demo and ask it on the call.</p>
${faqItems}
${ctaBlock("")}
  </main>

${footer("")}`);

write("availability.html", `${head("", "Go-live plan", "How QAVRIL LABS takes your business live in days: setup, data moved across, team training and your first live invoice.", "availability.html")}
${header("")}

  <main>
    <span class="kicker">Go-live plan</span>
    <h1>Live in days, not months</h1>
    <p class="lead">From first call to first live invoice in days, not months. Here is exactly how your go-live runs.</p>
    <ol class="golive">
${PENDING.map((row) => `      <li><strong>${esc(row.area)}</strong><span>${esc(row.item)}</span></li>`).join("\n")}
    </ol>
${ctaBlock("")}
  </main>

${footer("")}`);

// Requirements: what customers expect, each mapped to catalog IDs so it can be checked.
const requirementCards = REQUIREMENTS.map(
  (r) => `      <article class="item">
        <h3>${esc(r.name)}</h3>
        <p>${esc(r.covers)}</p>
      </article>`,
).join("\n");
write("requirements.html", `${head("", "What customers need from an ERP", "The requirements customers expect from an ERP, in plain words: multi-currency books, local tax, secure sign-in, audit trails and automation.", "requirements.html")}
${header("")}

  <main>
    <span class="kicker">Requirements</span>
    <h1>What customers need, built in</h1>
    <p class="lead">These are the requirements we design for. See how fast you go live on <a href="availability.html">the go-live plan</a>.</p>
    <div class="grid">
${requirementCards}
    </div>
${ctaBlock("")}
  </main>

${footer("")}`);

for (const page of [...INFO_PAGES, ...LEGAL_PAGES]) {
  write(page.path, infoPage(page));
}

// Sitemap for every generated page plus the root pages.
const paths = [
  "", "products.html", "case-studies.html", "projects.html", "industries.html", "book.html", "signup.html", "signin.html", "pricing.html", "faq.html", "bots.html", ...BOTS.map((b) => `bots/${b.slug}.html`), "requirements.html", "availability.html", "blog.html", "privacy.html",
  ...INFO_PAGES.map((p) => p.path),
  ...LEGAL_PAGES.map((p) => p.path),
  ...BLOG_POSTS.map((p) => `blog/${p.slug}.html`),
  ...PRODUCTS.map((p) => `products/${p.slug}.html`),
  ...CASES.map((c) => `case-studies/${c.slug}.html`),
  ...PROJECTS.map((p) => `projects/${p.slug}.html`),
  ...INDUSTRIES.map((i) => `industries/${i.slug}.html`),
];
const urls = paths.map((path) => `  <url>\n    <loc>${BASE}/${path}</loc>\n    <lastmod>${BLOG_DATE}</lastmod>\n  </url>`).join("\n");
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);

// The homepage module and industry lists come from the same data as the product and industry pages,
// so the counts cannot drift apart. Only the marked regions of index.html are rewritten.
function fillMarkers(relativePath, name, html) {
  const full = join(site, relativePath);
  const text = readFileSync(full, "utf8");
  const open = `<!-- ${name}:start -->`;
  const close = `<!-- ${name}:end -->`;
  const from = text.indexOf(open);
  const to = text.indexOf(close);
  if (from < 0 || to < 0) throw new Error(`Markers ${name} missing in ${relativePath}`);
  writeFileSync(full, `${text.slice(0, from + open.length)}\n${html}\n          ${text.slice(to)}`, "utf8");
}
fillMarkers("index.html", "modules", PRODUCTS.map((p) => `          <a class="card tilt reveal card-link" href="products/${p.slug}.html">
            <h3>${esc(p.name)}</h3>
            <p>${esc(p.summary)}</p>
            <span class="more">Read more &rarr;</span>
          </a>`).join("\n"));
fillMarkers("index.html", "bots", BOTS.map((b) => `          <a class="bot-widget reveal" href="bots/${b.slug}.html">
            ${botSvg(b)}
            <span class="widget-status"><i class="pulse"></i>On duty</span>
            <strong>${esc(b.name)}</strong>
            <span>${esc(b.role)}</span>
          </a>`).join("\n"));
fillMarkers("index.html", "levels", LEVELS.map((level, index) => `          <article class="level-card reveal">
            <span class="level-num">0${index + 1}</span>
            <h3>${esc(level.name)}</h3>
            <p>${esc(level.summary)}</p>
            <ul class="feature-list">
${level.items.map((item) => `              <li>${esc(item)}</li>`).join("\n")}
            </ul>
          </article>`).join("\n"));
fillMarkers("index.html", "industries", INDUSTRIES.map((i) => `          <a class="industry-card reveal" href="industries/${i.slug}.html">
            <h3>${esc(i.name)}</h3>
            <p>${esc(i.pains)}</p>
            <span class="more">See the fit &rarr;</span>
          </a>`).join("\n"));
fillMarkers("index.html", "industry-options", INDUSTRIES.map((i) => `              <option>${esc(i.name)}</option>`).join("\n"));
fillMarkers("index.html", "cases", CASES.map((c) => `          <a class="card tilt reveal card-link" href="case-studies/${c.slug}.html">
            <span class="tag tag-next">Example scenario</span>
            <h3>${esc(c.name)}</h3>
            <p>${esc(c.summary)}</p>
            <span class="more">Open the scenario &rarr;</span>
          </a>`).join("\n"));
fillMarkers("index.html", "blog", BLOG_POSTS.slice(0, 3).map((p, index) => `          <a class="card tilt reveal post-card" href="blog/${p.slug}.html">
            <span class="card-num">0${index + 1}</span>
            <h3>${esc(p.title)}</h3>
            <p>${esc(p.description)}</p>
          </a>`).join("\n"));
fillMarkers("index.html", "projects", PROJECTS.map((p) => `          <a class="card tilt reveal card-link" href="projects/${p.slug}.html">
            <h3>${esc(p.name)}</h3>
            <p>${esc(p.summary)}</p>
            <span class="more">Read more &rarr;</span>
          </a>`).join("\n"));

writeLlmsTxt();
console.log(`Wrote ${paths.length} pages to ${site}`);
