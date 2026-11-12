# Competitor website benchmark: Zoho and Odoo vs ERP Platform site

Scope: public marketing-site patterns at Zoho (Zoho One, Zoho Books) and Odoo (odoo.com pricing and app pages), compared with the static site in `E:/SaaS/site` (73 HTML and supporting files read by file inventory, plus `index.html` and `products.html` read in full).

Verification status: Two live fetches were made (odoo.com/pricing, zoho.com/one/pricing). Fetch results were produced by a small summarising model, so treat exact figures as indicative. Most price figures came from third-party search snippets (Capterra, Cloudwards, partner sites) and are NOT verified against the vendor pages. Where a figure is not verified, it is marked as such. No competitor numbers below should go into marketing copy without a fresh check on the vendor site.

## Key questions

### Key Question 1: Which sections or content types do Zoho and Odoo use that the platform site has no equivalent for?

#### Takeaway
Both competitors publish a visible, self-serve pricing page, a large app or module catalogue with per-app pages, a free-trial or free-tier path that needs no sales call, and a demo or trial CTA alongside their pricing. The platform site has none of the pricing numbers, no free trial length, no free tier, no comparison or calculator, and no help or docs layer.

#### Cited findings (competitor side)
- Odoo lists per-user pricing on its own pricing page, with a Yearly/Monthly toggle, a free "One App Free" tier (unlimited users, one app), and a "FREE TRIAL" button. Live fetch, currency shown as Rs, no date shown: Standard Rs 580 per user/month yearly, Custom Rs 1,080 yearly; the page does not state the trial length. [odoo.com/pricing](https://www.odoo.com/pricing) (fetched; figures in the page's displayed currency)
- Odoo's pricing page states that all paid plans include hosting, support and maintenance; it lists what is not included (implementation, IAP credits such as SMS, custom-code maintenance). [odoo.com/pricing](https://www.odoo.com/pricing) (fetched)
- Odoo support is listed as email, Monday to Friday, 24/5, in four languages, on the pricing page. [odoo.com/pricing](https://www.odoo.com/pricing) (fetched)
- Odoo's US-dollar figure (Standard about US$31.10 per user/month billed annually, US$38.90 monthly) is reported by third-party listings and was NOT confirmed on the vendor page in this session because the fetch returned Rs prices. [Capterra Odoo pricing](https://capterra.com/p/135618/Odoo/pricing/) (unverified against vendor)
- Zoho One has a Monthly/Yearly toggle, a "Calculate your savings" link to a TCO calculator, a "View Plan Details" link per plan, and no comparison table on the page read. Plans are Essentials (no price shown in fetch), Standard flexible-user (US$90 shown, billing period not stated) and Standard all-employee (no price shown). A free trial of Essentials is mentioned in the FAQ, length not stated. [zoho.com/one/pricing](https://www.zoho.com/one/pricing/) (fetched)
- Zoho One has a published pricing FAQ on a separate page (zoho.com/one/pricing/faq.html), which is where the licensing rule (all employees on payroll for the All-Employee plan) is explained. [Zoho One pricing FAQ](https://www.zoho.com/one/pricing/faq.html) (listed in search, content not fetched)
- Zoho Books publishes a 14-day trial and a free plan limited by annual revenue (search snippet describes a 50K USD threshold). Help pages and a documentation index exist (trial-signup.md in the KB). [Zoho Books trial sign-up KB](https://www.zoho.com/books/kb/subscription/trial-signup.html) (search result; trial length from search summary, not fetched directly)
- Odoo's "Free Trial" and "Demo" offers appear mainly through partner sites (30-day trial reported by partners). No official first-party trial length was verified. [Odoo partner trial example](https://captivea.com/free-odoo-trial) (partner marketing, not first-party)

#### Cited findings (platform site side, from `E:/SaaS/site`)
- `pricing` is a single block on `index.html` ("Early-access pricing, agreed on a call") with a "Talk pricing" button. There is no pricing page and no price points. (`index.html`, section id `pricing`)
- No free plan, no free trial length, no trial sign-up flow: `products.html` has a "Request a free trial" button that routes to `book.html?interest=trial`, and index says "Nothing is charged until you have seen the product." (`products.html`, `index.html`)
- No calculator, no plan comparison, no competitor comparison page. A search of the site for calculator, compare, pricing, and trial returned only the single pricing block, the trial button, and text references. (site-wide grep)
- No help centre, docs, API reference, webinars, changelog, or status page were found in the file list. The file list includes `blog.html`, `faq.html`, `requirements.html`, `projects/*`, `bots/*`, `industries/*`, `case-studies/*`, `products/*` only. (site file list, Glob `**/*.html`)
- Module pages exist for 12 products (`products/general-ledger.html`, `sales-invoicing.html`, `purchasing.html`, `inventory.html`, `payroll-hr.html`, `pos.html`, `projects-field-service.html`, `document-capture.html`, `security.html`, `ai-agents.html`, `automation.html`, `ai-suite.html`), plus a bots section of 8 bot pages. Competitor-style app pages exist in form, but no per-module pricing, screenshots of live product, or integration list was seen on the module pages read (only dashboard SVGs under `img/dashboards/`).
- Industry pages exist for 10 verticals (`industries/restaurants.html`, `clinics.html`, `construction.html`, `logistics.html`, `property.html`, `retail-pharmacy.html`, `schools.html`, `agriculture.html`, `hospitality.html`, `manufacturing.html`, `professional-services.html`). The index tags them as "Industry packs come after the core", so they are positioning pages, not verified feature packs.
- Case studies are explicitly labelled "example scenarios, not customers" on `index.html` and in the `case-studies/*` pages, so there is no customer proof of any kind.
- Trust elements on the platform site: four "Why it hits different" cards (walled-off data, money to the cent, un-rewritable history, locked-down logins), a ticker of claims, and `products/security.html`. No certifications, no third-party audits, no logos, no testimonials, no reviews (no G2 or Capterra presence referenced).
- Blog exists (`blog.html`, three posts on the homepage, "From the build log"). No webinars or video.
- FAQ: four questions on the homepage and `faq.html` (14 grep hits). Covers "can I use it today", countries, data location, migration from QuickBooks or Tally.
- Structured data: Organization, SoftwareApplication, FAQPage on the homepage; BreadcrumbList on product pages.
- Interactive tools: a booking modal (`book.html`), a lead form (`#lead-form` on index), and bot widgets that link to bot pages. No calculator, demo sandbox, comparison, or ROI tool.

#### Inferences
- Competitors separate "buy now" (pricing page, free tier, trial) from "talk to sales" (demo). The platform site collapses both into one "Talk pricing" CTA, which for an SMB evaluator reads as a sales gate.
- The platform site cannot publish prices yet (early access, no price list). That is a real constraint, so the gap is the absence of a stated pricing model (what drives price, what is included, what the early-access terms are), not the absence of numbers.
- Trust in these competitor sites rests on scale signals (customer logos, reviews, certifications, support hours, hosting terms) that the platform site does not yet have. Its "Walled-off data" and "History you can't rewrite" claims are the right kind of trust, but unsupported by any artefact a buyer can inspect.

#### Gaps
- Verified Odoo USD prices from the vendor page: the live fetch returned Rs prices and no USD figure. Needs a re-check with a US locale.
- Zoho One Essentials price and trial length: not shown in the fetched page.
- Odoo trial length: not stated on the vendor page fetched.
- Zoho Books industry-specific pages: search returned none. Not verified on the live site.
- Whether Zoho or Odoo publish verified customer case studies: the search surfaced only one unverified Toyota reference from a slideshare; not checked on odoo.com.

### Key Question 2: Which of those are essential for an SMB evaluator, and which are optional at launch?

#### Takeaway
For an SMB evaluator on a pre-launch product, the essentials are: a stated pricing model and early-access terms on a standalone page, a clear "what can I do now" status line, a real demo or sample environment or a screenshot tour, the FAQ answers buyers ask first (data location, migration, support hours, what happens to my data if I leave), and at least one trust artefact that can be inspected (security page with specifics, not claims). Optional at launch: a calculator, a comparison table, a full docs or help centre, webinars, and industry-specific case studies.

#### Cited findings
- Competitor pricing and trial pages carry hosting, support and included-services notes as standard. [odoo.com/pricing](https://www.odoo.com/pricing) (fetched): hosting, support hours and not-included items are listed.
- Zoho One offers a TCO calculator. [zoho.com/one/pricing](https://www.zoho.com/one/pricing/) (fetched): "Calculate your savings" link.
- The platform's own FAQ already asks the most likely evaluator questions (usage now, countries, data location, migration) (`faq.html`, `index.html` FAQ block). Those answers are non-committal ("planned", "on the roadmap"). That is honest, but it leaves evaluators without a decision.

#### Inferences
- Essential for an SMB evaluator at launch (inferred from the competitor pattern and the platform's own FAQ questions):
  1. Standalone pricing or early-access terms page with what is included and what is not. The current single block is not enough.
  2. Clear, honest availability status on each module (already present as Level tags on the homepage; keep and repeat on product pages).
  3. Demo path or screenshot tour: the product pages use SVG dashboard placeholders (`img/dashboards/*.svg`). Real screenshots or a short recorded walk-through would close the largest credibility gap.
  4. Expanded FAQ covering data export, exit terms, support hours, and backup. Competitors answer these on pricing or FAQ pages.
  5. A security page with specifics (encryption at rest and in transit, backup frequency, where data is hosted, who can access it). The current `products/security.html` should be checked for concrete claims.
  6. A status line on the social proof: "pilot customers: none yet" is honest. A short "who we are" block with a named founder or team builds trust for SMB buyers.
- Optional at launch:
  - ROI or price calculator: useful later, needs confirmed pricing first.
  - Comparison table versus Zoho and Odoo: legally and reputationally risky without verified numbers; defer, and do not publish until figures are checked against vendor sites on a fixed date.
  - Full help centre, API docs, changelog: needed when a product is live, not during early access.
  - Webinars and video library: optional.
  - Industry pack pages with specifics: keep the current positioning pages but do not add claims about features that do not exist.
  - Customer logo wall and reviews: not available; do not fake them. Use design-partner language only if partners agree.

#### Gaps
- No evidence was gathered on conversion effect of each element. Prioritisation is from pattern and buyer logic, not measured data.

### Key Question 3: What minimum set would make the platform site credible next to them?

#### Takeaway
A credible minimum set for launch: (1) a standalone pricing page that explains the early-access model and drivers of price without making up numbers, (2) module pages that show real screenshots, status, and what the module does today, (3) a sourced security and data page, (4) an FAQ expanded to cover export, exit, support and backup, (5) a working demo or booking path with a stated response time, and (6) a short "how we are building this" page with real build evidence (the existing project and blog pages can carry that). Calculators, comparison tables, and customer logos can wait until real data exists.

#### Cited findings
- Competitors' minimum visible set includes pricing, free tier or trial, a demo CTA, support terms, and module catalogue pages. [odoo.com/pricing](https://www.odoo.com/pricing) (fetched); [zoho.com/one/pricing](https://www.zoho.com/one/pricing/) (fetched).
- Platform site already has: module catalogue (12 pages), industries (10 pages), FAQ with structured data, blog, booking and lead form, privacy page, and a status tag system. These are the foundations to build on.

#### Inferences
- Minimum set, in priority order:
  1. Pricing page (`pricing.html`): early-access terms, what drives price (company size, modules, country), what is included, what is not, and when money is taken. No invented numbers.
  2. Real product visuals on module pages: replace the SVG placeholders with screenshots of the built screens (General ledger is built, so it is first).
  3. Security page with specifics and a clear statement of what is not yet certified.
  4. FAQ extended with export, exit, support hours, backup, and data location detail.
  5. Trial or demo path with a stated response time and what the evaluator gets (a sandbox is a later step).
  6. Build-status page or dated changelog pulled from the existing project pages, so the "built vs planned" claim is checkable.
- Not needed at launch: calculator, comparison table, help centre, webinars, customer logos, review badges.

#### Gaps
- No data on what SMB evaluators in the target market expect from a pre-launch ERP. Recommend a short interview round with the design partners before committing to the pricing page layout.

## Sources
- [odoo.com/pricing](https://www.odoo.com/pricing), live fetch, Rs currency, no date shown
- [zoho.com/one/pricing](https://www.zoho.com/one/pricing/), live fetch
- [zoho.com/one/pricing/faq.html](https://www.zoho.com/one/pricing/faq.html), search result only
- [zoho.com/books/kb/subscription/trial-signup.html](https://www.zoho.com/books/kb/subscription/trial-signup.html), search result only
- [Capterra Zoho One pricing](https://www.capterra.com/p/166175/Zoho-One/pricing/), search result (third party)
- [Capterra Odoo pricing](https://capterra.com/p/135618/Odoo/pricing/), search result (third party)
- [captivea.com/free-odoo-trial](https://captivea.com/free-odoo-trial), partner marketing, not first-party
- Platform site: `E:/SaaS/site/index.html`, `E:/SaaS/site/products.html` (read in full); file inventory and grep across `E:/SaaS/site`.
