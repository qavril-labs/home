# ERP Platform marketing site: pages, content and gaps for SMB buyers

Scope: E:/SaaS/site (HTML) and the content data in E:/SaaS/scripts/site-content.mjs, site-extra.mjs, site-extra-2.mjs, site-extra-3.mjs. The site build was not run. Nothing was modified.

Word counts method: visible text was extracted from each HTML file with tags, scripts and styles stripped. Counts include the shared header nav (about 25 words), the footer line, and the demo/trial CTA block (about 25 words), so the substantive count is roughly 50 to 60 words lower than the figures below. Counts are approximate.

## Key Question 1: Which pages exist, and how much substantive text does each have?

### Takeaway
54 HTML files exist. The home page is the only long page (about 1,440 words including its JSON-LD). Most detail pages carry about 150 to 330 words of total text, of which roughly 100 to 270 is substantive. The project pages and several industry and case-study pages are thin, and the site has no pages for pricing, support, documentation, security detail, integrations, comparison or company information.

### Cited Findings

Top-level pages (13 files):
- [index.html](E:/SaaS/site/index.html) (about 1,443 words, longest page). Sections: hero ("Your business. One ERP. Zero spreadsheet chaos."), four "why it hits different" trust cards, a "chaos" section, a module roadmap by level (Level 0 to Level 4), an AI bots/automation block with eight bots, an industries list, a pricing teaser, a 4-question FAQ, a case-study teaser (3 of 5), a blog teaser (3 of 8), a projects teaser, and an early-access form with fields name, email, company, country and interest. The `ld+json` block has Organization (name and url only), SoftwareApplication and FAQPage.
- [products.html](E:/SaaS/site/products.html) (about 350 words). Lists 12 module cards, each one sentence, with a "Read more" link.
- [industries.html](E:/SaaS/site/industries.html) (about 340 words). Lists 11 industry cards.
- [faq.html](E:/SaaS/site/faq.html) (about 527 words). 15 Q&A pairs. This is the most useful buyer page in the site.
- [requirements.html](E:/SaaS/site/requirements.html) (about 327 words). 14 requirement cards (phones and offline, currency and language, local tax, payroll per country, data residency, secure sign-in, audit trail, integrations, automation, AI control, data export, payments, backups, messaging). Last card "AI bots and automations" renders the literal text "undefined" in the cards grid, a rendering defect.
- [pending.html](E:/SaaS/site/pending.html) (about 228 words). Nine plain-language "not ready yet" items. This is the honest status page.
- [book.html](E:/SaaS/site/book.html) (about 208 words). Demo and trial request form: name, email, company, country, request type (demo slot, free trial request, early-access updates), preferred slot (weekday morning/afternoon), industry, free-text, consent checkbox, hidden honeypot.
- [case-studies.html](E:/SaaS/site/case-studies.html) (about 208 words). Five example scenarios, explicitly labelled "not customer stories. We have no paying customers yet."
- [projects.html](E:/SaaS/site/projects.html) (about 165 words). Five "what is being built" cards.
- [bots.html](E:/SaaS/site/bots.html) (about 534 words). Eight bot cards plus three automation examples.
- [blog.html](E:/SaaS/site/blog.html) (about 932 words, second-longest). Eight article teasers with the first three written out in full, for example "Seven questions to ask before you choose an ERP" and "Why your invoice numbers should never skip." The other five are listed by title only in the source data. The blog is the best existing place for buyer education and is not linked from the home page navigation beyond the teaser.
- [privacy.html](E:/SaaS/site/privacy.html) (about 458 words). Per [README.md](E:/SaaS/site/README.md), this is "a draft privacy notice. A lawyer must review it before launch." The booking form links to it.
- [404.html](E:/SaaS/site/404.html) (about 235 words). Not a content page.

Product pages (12 files under [site/products](E:/SaaS/site/products)):
- general-ledger (about 324 words), sales-invoicing (268), purchasing (258), inventory (265), payroll-hr (265), pos (282), projects-field-service (264), document-capture (276), security (272), ai-agents (307), automation (289), ai-suite (280).
- Each page has a summary, feature list, "who it is for", a "How it works" set of 3 steps, a "typical example" paragraph, KPI tiles, services list (for example "Country payroll setup with a local expert", "Three-way matching setup") and functions list. Source: [site-content.mjs](E:/SaaS/scripts/site-content.mjs) PRODUCTS and REQUIREMENTS; [site-extra.mjs](E:/SaaS/scripts/site-extra.mjs) PRODUCT_DETAIL; [site-extra-2.mjs](E:/SaaS/scripts/site-extra-2.mjs) PRODUCT_MORE.
- Each product page shows an "Availability" line: "Modules are shown in demos as they are built. Ask on the call which parts are ready for your business." This is the only status signal on these pages. The feature lists are written in present tense.
- The ai-suite page's visual is labelled "Illustrative dashboard preview with sample data."

Case study pages (5 files under [site/case-studies](E:/SaaS/site/case-studies)): cafe-three-outlets (234), consultancy-two-people (218), builders-merchant (232), dental-clinic-two-chairs (227), school-fee-plans (222). Each has a problem paragraph, modules list, "a day with the system" (4 bullets), a "what a demo would show" paragraph and a disclaimer "Example scenario. This describes a typical business, not a real customer." Source: [site-content.mjs](E:/SaaS/scripts/site-content.mjs) CASES; [site-extra.mjs](E:/SaaS/scripts/site-extra.mjs) CASE_DETAIL.

Project pages (5 files under [site/projects](E:/SaaS/site/projects)): product-catalog (129), general-ledger-build (136), multi-currency (138), tenant-isolation (112), marketing-site (124). These are the thinnest pages on the site. Substantive text is roughly 50 to 80 words each, and each is aimed at internal build status rather than a buyer. The tenant-isolation page is 112 words total, with one sentence of "today" and one of "proof". Source: PROJECTS and PROJECT_DETAIL in the two data files.

Industry pages (11 files under [site/industries](E:/SaaS/site/industries)): restaurants (187), clinics (175), construction (181), logistics (183), retail-pharmacy (174), schools (169), property (169), professional-services (161), agriculture (173), hospitality (176), manufacturing (190). Each gives a "usual pain" sentence, "Where we start" (first module), a "tell us your trade" note, and one "typical example" paragraph. Thinnest of the content pages: about 100 to 120 substantive words. Source: INDUSTRIES and INDUSTRY_DETAIL.

Bot pages (8 files under [site/bots](E:/SaaS/site/bots)): each about 290 to 307 words total, with a "How a task runs" list of four steps, a "Features" list, "Functions", "Works with", a "Guardrails" line, and an "Activity feed". The feed is labelled "Sample entries that show the kind of record this bot keeps." Source: BOTS, BOT_DETAIL in site-extra-2.mjs and site-extra-3.mjs.

Other data: the file [site-content.mjs](E:/SaaS/scripts/site-content.mjs) REQUIREMENTS has an 'ai-bots' entry with a `today` and `proof` field and no `covers` field. This is the source of the "undefined" card described above.

Sitemap: [sitemap.xml](E:/SaaS/site/sitemap.xml) lists 53 URLs. The site has 54 HTML files; the difference is probably 404.html, which is correct to exclude. Not verified line by line.

### Inferences
- The site is a credible roadmap-plus-form site. Its weight is in product descriptions and FAQ, not in evidence, depth or buyer-decision material.
- Substantive depth per product or industry is roughly 100 to 270 words. A buyer comparing ERPs would reach the end of most pages in under two minutes.
- The blog is the richest non-core content, and it is not reachable from the product pages.

### Gaps
- No page reports the number of users or the company's own history, team, location, legal entity or contact phone. The Organization schema has only name and url, with a placeholder domain (`https://your-domain.example/`).
- No help centre, documentation, API reference, changelog or status page exists.

## Key Question 2: Which buyer questions from a typical SMB ERP evaluation are not answered anywhere?

### Takeaway
The site answers "what is the product" and "why it is different" well. It does not answer what it costs, how long go-live takes, how data gets in, which certifications it holds, which integrations exist today, how it compares with alternatives, or how support works. Each of these is a common SMB evaluation step.

### Cited Findings

Pricing transparency
- Teaser: "Early-access pricing, agreed on a call. Pricing depends on company size, modules and country." — [index.html](E:/SaaS/site/index.html); repeated in [faq.html](E:/SaaS/site/faq.html) and [pending.html](E:/SaaS/site/pending.html): "There are no published price lists yet."
- No plan names, per-user or per-module price, setup fee, training fee, or example monthly cost. The blog article "Seven questions to ask before you choose an ERP" asks the buyer to "Ask what is the full cost ... not only the monthly fee", but the site itself never states a monthly fee. — [blog.html](E:/SaaS/site/blog.html)
- No contract terms (term length, minimum commitment, cancellation, data export on exit).

Onboarding and implementation
- FAQ: "Will my staff need training? Yes, a short onboarding session is planned for each team." — [faq.html](E:/SaaS/site/faq.html)
- Products list "Services" such as "Chart of accounts design", "Stock count on go-live", "Opening balances migration", "Monthly close support" — [site-extra-2.mjs](E:/SaaS/scripts/site-extra-2.mjs) PRODUCT_MORE. These appear as service lines with no price, duration, who does the work, or a delivery steps page.
- No implementation timeline, phases, go-live checklist, project owner, customer responsibilities, or acceptance criteria.
- Blog "Your first month on a new system" is listed by title in [blog.html](E:/SaaS/site/blog.html) but its content is not written out, so no first-month plan is visible.

Data migration
- FAQ: "Can I move my data from QuickBooks or Tally? Import tools are on the roadmap. Early partners will be told about migration options before they commit." — [faq.html](E:/SaaS/site/faq.html); [pending.html](E:/SaaS/site/pending.html): "data import are not ready yet."
- No list of supported source systems, file formats (CSV, Excel, QuickBooks export), opening-balance process, or what happens to historic documents and document numbers.
- Requirements "Get your data out ... Exports and a migration path from other systems, so you are never locked in" — [requirements.html](E:/SaaS/site/requirements.html). No export formats are named, and the Security page lists "Export of your own records" as a function without saying it exists today.

Security and compliance detail
- Only generic statements: "Sign-in is protected", "Hashed passwords" (index badge), "Each customer's data is kept separate", "Full history of changes". — [index.html](E:/SaaS/site/index.html), [products/security.html](E:/SaaS/site/products/security.html)
- Requirements say "Region-pinned hosting, encryption at rest and in transit, and retention rules" and "Backups, disaster recovery and clear uptime targets" — [requirements.html](E:/SaaS/site/requirements.html). No hosting region, no encryption algorithms, no RPO/RTO, no uptime percentage, no retention periods.
- No mention of SOC 2, ISO 27001, GDPR or other data-protection compliance, no data processing agreement, no sub-processor list, no penetration-test or vulnerability-disclosure policy, no incident-notification commitment, no security.txt. A search of all HTML for "soc 2", "iso 27001", "gdpr", "pci" returned no hits.
- Security product page offers "Security review on request" as a service — [products/security.html](E:/SaaS/site/products/security.html).
- Privacy notice is a draft: "A lawyer must review it before launch." — [README.md](E:/SaaS/site/README.md), [privacy.html](E:/SaaS/site/privacy.html). There is no terms of service, acceptable use, cookie policy or accessibility statement page at all.
- Sign-in: requirements promise "Single sign-on, two-factor sign-in, and roles" — [requirements.html](E:/SaaS/site/requirements.html); pending page says "The sign-in screen for the ERP itself is not ready yet." — [pending.html](E:/SaaS/site/pending.html)

Integrations
- Requirements: "An API, signed webhooks, and connectors to banks, payment providers and carriers." — [requirements.html](E:/SaaS/site/requirements.html). No named connectors (no bank, M-Pesa, Stripe, Shopify, WhatsApp provider, accounting or e-invoice network). No API docs, no authentication description, no rate limits.
- Bot pages list "Works with: CRM and pipeline", "Email and SMS", "Bank lines" — [bots/pip.html](E:/SaaS/site/bots/pip.html) and others. No CRM module exists in the product list.
- Messaging: "SMS, WhatsApp, email and push notifications" — [requirements.html](E:/SaaS/site/requirements.html). Not on the pending list.

Industry coverage
- 11 industries, each with a pain paragraph and the first module to start with. The site says the vertical "industry packs" come later and are "chosen by the customers who need them". — [industries.html](E:/SaaS/site/industries.html), [industries/clinics.html](E:/SaaS/site/industries/clinics.html)
- No industry-specific feature lists, pricing, regulated-sector notes (clinical, pharmacy, cooperative payouts, school fee rules), or industry-specific examples from real operations.

Country and localisation
- "We are starting with one or two markets" — [faq.html](E:/SaaS/site/faq.html). The markets are never named. Examples use KES and shillings and a Nairobi shop, while the request form takes any country. A buyer cannot tell if their country is supported.
- "Translated screens, and right-to-left layouts" — [requirements.html](E:/SaaS/site/requirements.html). No language list.
- Tax returns and e-invoicing "added market by market" with no list of which markets or rules.

Comparison with alternatives
- No page compares the product to Zoho Books, Zoho One, Odoo, QuickBooks, Xero, Tally, ERPNext, Sage or any other option. The only comparison is the blog checklist "Seven questions to ask before you choose an ERP", which is generic and does not name alternatives. — [blog.html](E:/SaaS/site/blog.html)
- Nothing explains who should not buy the product, or what the product does not do compared with a mature suite. Given that no module is live, a buyer will ask this first.

Support
- Only "We reply by email within one business day" on the booking form — [book.html](E:/SaaS/site/book.html). No support hours, channels, response targets for paying customers, severity levels, or escalation path. The word "SLA" appears only in unrelated words such as "slate", "slash", so no SLA exists.
- Ticket Tess bot ("Customer support bot") is a product feature for the buyer's own customers, not support for the buyer. — [bots/ticket-tess.html](E:/SaaS/site/bots/ticket-tess.html)

Help and documentation
- None. No help centre, user guide, video library, knowledge base, release notes or API documentation. The FAQ is the only self-help content.

Customer proof
- Honest: the case studies say "These are example scenarios, not customers. We have no paying customers yet." — [case-studies.html](E:/SaaS/site/case-studies.html). No logos, testimonials, references, reviews, usage numbers, or design-partner quotes exist. The index says "Early access, limited design partner spots" but names no partner.
- The "From the build log" and projects pages describe engineering decisions, which is transparency but not proof of customer outcomes.

Company and trust basics
- No About page, team, founder bio, legal entity name, registered address, company number, phone number, or support hours. Contact is only the form and a "Talk pricing" button. Organization schema has no address, logo or contact point.

Trial and demo
- "A free trial is a request for now. Self-service sign-up and trial accounts are not open." — [pending.html](E:/SaaS/site/pending.html). Demo is a 20-minute "slot request" confirmed by email; "calendar booking is not connected." Both are stated, which is honest.

### Inferences
- A buyer who reads the whole site still cannot estimate the cost, the time to go live, the data migration effort, or the security certifications. These are usually the first four questions.
- The site is written for a design-partner audience who will accept roadmap uncertainty. A typical SMB buyer, who compares Zoho or Odoo, will need firmer commitments, even if they are "planned".

### Gaps
- No evidence was found for: uptime history, backup restore tests, support response times, named integration partners, real user counts, or country tax filing support. These are unanswered rather than wrong.

## Key Question 3: Which claims on the site are unsupported or risky?

### Takeaway
The site is mostly honest about status, with [pending.html](E:/SaaS/site/pending.html) and the example-scenario labels. The risky claims are present-tense features and compliance or security promises that the pending list says are not built, plus one invented-looking pricing and packaging statement and one stated "built" that conflicts with the pending list.

### Cited Findings

Direct conflicts with the pending list
- Pending list says "The sign-in screen for the ERP itself is not ready yet." — [pending.html](E:/SaaS/site/pending.html). Yet the index says "Level 0 Foundations: built ... Secure customer accounts" — [index.html](E:/SaaS/site/index.html), and the requirements page promises single sign-on and two-factor sign-in as things "we design for" — [requirements.html](E:/SaaS/site/requirements.html). The "built" label and the pending entry cannot both be true.
- Pending says "Notifications, document storage, printing, approval workflows and data import are not ready yet." — [pending.html](E:/SaaS/site/pending.html). But product pages describe approvals as a live feature: "Requisitions that a manager approves before they become orders" ([site-content.mjs](E:/SaaS/scripts/site-content.mjs), purchasing), and the requirements page says "SMS, WhatsApp, email and push notifications" ([requirements.html](E:/SaaS/site/requirements.html)).
- Pending says sales, purchasing, inventory, payroll and POS are not available. The product pages still use present tense for them, e.g. "Fast checkout with split payments", "Barcode scanning on a phone", "Payslips and pay runs" — [site-extra-2.mjs](E:/SaaS/scripts/site-extra-2.mjs) PRODUCT_MORE. The only disclaimer is the "Availability" line.
- Case study for the builders' merchant says "The multi-currency ledger that is already built handles this case" ([index.html](E:/SaaS/site/index.html) teaser). The pending list says "other modules do not post into it yet", and purchasing is not available, so the dollar-bill scenario cannot be run end to end today. The same case's demo text describes posting a dollar bill and reversing it.

Packaging and pricing
- Security product: "Included with every plan, not sold separately." — [products/security.html](E:/SaaS/site/products/security.html) and index product card. No plans exist, and pricing has no published price lists ([pending.html](E:/SaaS/site/pending.html)). Presented as a commitment.
- Pricing: "Design partners get early-access terms." — [index.html](E:/SaaS/site/index.html). No terms are described.

Unbuilt capabilities stated as requirements or features
- Mobile money, cards, bank transfer and QR payments, "reconciled automatically" — [requirements.html](E:/SaaS/site/requirements.html). No payment connector is on the pending list or anywhere else.
- "Connectors to banks, payment providers and carriers", "signed webhooks" — [requirements.html](E:/SaaS/site/requirements.html), and automation product page "Webhooks so your own systems can subscribe to events, with signed requests" ([site-content.mjs](E:/SaaS/scripts/site-content.mjs)). The pending list does not mention integrations or webhooks, so their status is unknown to a reader.
- "Clock-in with location", "statutory filings", "tax returns and e-invoices shaped for each country" — product and requirements pages. Pending says local rules are added "one country at a time, after review by local experts."
- "Region-pinned hosting" and "encryption at rest and in transit" — [requirements.html](E:/SaaS/site/requirements.html), security product. The FAQ says "Region-pinned hosting is planned." — [faq.html](E:/SaaS/site/faq.html). The requirements page states it as a design target without the word "planned".
- "Backups, disaster recovery and clear uptime targets" — [requirements.html](E:/SaaS/site/requirements.html). No targets are given, and no backup or DR status is on the pending list.
- "Translated screens, and right-to-left layouts" — [requirements.html](E:/SaaS/site/requirements.html). No language is shipped and no status is given.
- "Works with CRM and pipeline", "Works with email and SMS" for bots — [bots pages](E:/SaaS/site/bots). No CRM or messaging module exists.
- Clinics: "Insurance claims follow once the industry pack is added." — [industries/clinics.html](E:/SaaS/site/industries/clinics.html). No insurance module or industry pack is planned in the roadmap.

Trust and protection claims without evidence
- "Full history of changes ... cannot be altered afterwards" and "Gap-free document numbers" appear as green "Early access" badges in the index hero ([index.html](E:/SaaS/site/index.html)). The backing code exists in the repo design (CLAUDE.md audit and numbering rules), but no test evidence or external verification is public, and the audit trail is not on the pending list either.
- "Each customer's data is kept separate", "Records are only ever shown to the business that owns them" — [projects/tenant-isolation.html](E:/SaaS/site/projects/tenant-isolation.html). Stated as fact, with no tests or audit cited on the page. This is the core security promise in a multi-tenant product and is unverified publicly.
- "Exact to the cent, so totals always add up" — index and security product. Plausible design intent; no test evidence cited on the page.

Service-level and timing promises
- "We reply by email within one business day to confirm the slot." — [book.html](E:/SaaS/site/book.html). Not an SLA, but an operating promise with no owner or staffing stated. The pending list says "Nothing on this list is promised for a date," which is good, but the reply-time promise is not on that list.
- "A demo lasts about 20 minutes" and "Bring one real task" are fine as format statements.
- Roadmap levels on the index ("Level 1 Core ERP with design partners", "Level 2 Operations", "Level 3 Industry packs") imply an order and phases with no dates. The pending page does say no dates are promised, so this is mostly low risk, but the level labels can be read as commitments.

Invented-looking sample data
- Bot activity feeds name specific businesses and people: "Kamau Stores", "Blue Hills Cafe", "New starter Amina", invoice numbers such as "INV-352" and bill "BL-881". They are labelled "Sample entries" on [bots/pip.html](E:/SaaS/site/bots/pip.html), but the labels are not repeated for every feed. Confirm the label appears on all eight bot pages and on [bots.html](E:/SaaS/site/bots.html). Sample names that resemble real businesses carry a risk of being read as customers.
- The ai-suite page uses "Illustrative 3D preview ... with sample data", which is properly labelled.

Rendering and quality defects
- [requirements.html](E:/SaaS/site/requirements.html) shows the literal text "undefined" on the last card ("AI bots and automations") because the data entry in [site-content.mjs](E:/SaaS/scripts/site-content.mjs) has `today` and `proof` fields instead of `covers`. This is a visible error on a buyer page.
- The Organization schema in [index.html](E:/SaaS/site/index.html) and the SoftwareApplication "description" say "Cloud ERP for small and medium businesses covering finance, sales, inventory, purchasing and payroll." These are not live. Search engines may index this as a current product.
- Placeholder domain `https://your-domain.example/` appears in [llms.txt](E:/SaaS/site/llms.txt) and [sitemap.xml](E:/SaaS/site/sitemap.xml) and the JSON-LD. Launch blocker.

### Inferences
- The most damaging risk for a buyer is the mismatch between present-tense product copy and the "not available yet" list. A buyer who trusts the product page will assume a live module that the pending page says is not available.
- Compliance and security statements ("Region-pinned hosting", "encryption", "SSO", "2FA") are stated as requirements without a status tag, so they could be read as delivered.
- The "built" label on the foundations, and "Included with every plan", are the two statements most likely to be quoted back by a buyer or a regulator if the product does not match.

### Gaps
- No evidence in the files reviewed shows whether the integrations, webhooks, export, two-factor sign-in, encryption or backups are implemented. This needs a check against docs/phase-0-status.md, which was not read for this task.
- Whether the sample-entry label appears on every bot page was checked on [bots/pip.html](E:/SaaS/site/bots/pip.html) only.
- Whether the blog's five title-only articles have full text in blog.html was not checked.

## Summary of highest-priority fixes for the marketing copy (for the report writer)
1. Add a status tag ("Live", "In build", "Planned") to every product feature and every requirement card, matching pending.html.
2. Remove or qualify "Included with every plan" and "Early-access terms" until plans exist.
3. Reconcile "Level 0 Foundations: built" with the pending sign-in item.
4. Fix the "undefined" card on requirements.html.
5. Replace the placeholder domain and add a real Organization address and contact.
6. Add a pricing-model page (what is charged, setup fee, term) even if the figures are "agreed on a call".
7. Add an implementation page (steps, timeline range, who does the work) and a migration page (sources, formats, process).
8. Add a security and data page (hosting region, encryption, backups with RPO and RTO, sub-processors, certifications status), and finish the privacy notice.
9. Add an integrations list with status, and a support page with hours and channels.
10. Add at least one honest comparison page (who should choose Zoho or Odoo instead).
