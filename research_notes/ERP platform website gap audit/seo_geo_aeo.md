# SEO, GEO and AEO readiness of the ERP Platform marketing site

Scope: static site in [E:/SaaS/site](E:/SaaS/site), read from files only. The build was not run and no files were changed. No web search was run, so statements about search engines or AI vendors are reasoning or memory, and are marked as such. Other researchers' notes in this folder cover content and competitors; this note focuses on technical and search-readiness signals.

Inventory: 53 indexable HTML pages (12 root pages, 12 product pages, 5 case studies, 5 projects, 11 industries, 8 bots) plus [404.html](E:/SaaS/site/404.html). The generator [build-site-pages.mjs](E:/SaaS/scripts/build-site-pages.mjs) writes the product, case study, project, industry and bot pages, the booking page, FAQ, pending, requirements, bots index, sitemap and llms.txt. [index.html](E:/SaaS/site/index.html), [blog.html](E:/SaaS/site/blog.html), [faq.html](E:/SaaS/site/faq.html), [robots.txt](E:/SaaS/site/robots.txt) and [products.html](E:/SaaS/site/products.html)-style index pages are partly hand-maintained, so they can drift from the generator. Example: the homepage industry list and llms.txt disagree (see KQ1).

---

## KQ1. Which pages lack unique titles, descriptions or structured data?

### Takeaway
Every indexable page has its own title and description, and the detail pages are built from unique content fields, so duplication is not the main problem. The real gaps are: placeholder domain in every canonical, sitemap and llms.txt URL; no Open Graph or Twitter tags on 52 of 53 pages; structured data stops at BreadcrumbList on the generated pages; the blog has no per-article URLs or dates; and the homepage and llms.txt disagree with the generated content.

### Cited Findings

Titles and descriptions (checked by grep and by reading the generator):
- Every page except 404 has `<title>` and `<meta name="description">`. Detail pages use the pattern `{Name} | ERP Platform` from [build-site-pages.mjs](E:/SaaS/scripts/build-site-pages.mjs) line 108, so titles are the bare module, industry or bot name (e.g. "Restaurants and cafés | ERP Platform", "General ledger | ERP Platform"). They carry no category term such as "accounting software", "POS system" or "for small business". Source: [restaurants.html](E:/SaaS/site/industries/restaurants.html) line 6, [pos.html](E:/SaaS/site/products/pos.html) line 6.
- Product detail meta description equals the product summary, which is also the lead paragraph on the page (build-site-pages.mjs line 333). Source: [pos.html](E:/SaaS/site/products/pos.html) line 7.
- Industry meta descriptions are the "pain" sentence, e.g. "Stock that expires, tills that stop when the internet drops, and tickets that get lost between the counter and the kitchen." These describe a problem, not an ERP offer, and they are not "ERP for X" phrasing. Source: [restaurants.html](E:/SaaS/site/industries/restaurants.html) line 7; data in [site-content.mjs](E:/SaaS/scripts/site-content.mjs) lines 258–268.
- Index-level titles are generic: "Products", "Projects", "Industries" (with H1s such as "The modules, one system", "Built on the core, tuned to your trade"). Source: [build-site-pages.mjs](E:/SaaS/scripts/build-site-pages.mjs) lines 295–297, 368–370, 389–391.
- Homepage title is the strongest on the site: "ERP for Small Businesses, Without the Spreadsheet Chaos | ERP Platform" (about 70 characters, so it may truncate in results). Source: [index.html](E:/SaaS/site/index.html) line 6. Its description is about 150 characters and reads well.
- Duplication: I found no exact duplicate titles or descriptions when reading the generator output sources. I did not run a programmatic dedupe, so treat this as "none seen", not "none".

Canonical and domain:
- All canonicals, og:url, og:image, sitemap `<loc>`, robots `Sitemap:` line, and llms.txt links use the placeholder `https://your-domain.example` (set in [build-site-pages.mjs](E:/SaaS/scripts/build-site-pages.mjs) line 13 and in [index.html](E:/SaaS/site/index.html) lines 8, 20, 22, 30; [robots.txt](E:/SaaS/site/robots.txt) line 4; [sitemap.xml](E:/SaaS/site/sitemap.xml)). [config.js](E:/SaaS/site/config.js) also has `hello@your-domain.example` and `https://api.your-domain.example`. Until the real domain is set, no canonical or sitemap URL is valid for search or AI retrieval. This is the first blocker.
- Every page has a canonical tag (except 404), and each canonical matches its own path. Good.

Open Graph and social:
- Only [index.html](E:/SaaS/site/index.html) has `og:` and `twitter:` tags, including a 1200x630 image ([og-image.png](E:/SaaS/site/og-image.png), 66 KB, confirmed by the build check's own rules). A grep for `property="og:` returns 0 on all 52 other pages. Shared links to a product, industry or bot page will show no image and fall back to whatever the platform guesses.

Structured data by page type (grep counts of `application/ld+json`):
- Homepage [index.html](E:/SaaS/site/index.html) lines 32–75: `@graph` with Organization (name and url only, no logo, no contact point, no sameAs, no founder, no legal name), SoftwareApplication (name, category, OS, description; no offers, no featureList, no publisher) and FAQPage with 4 questions that match the visible FAQ.
- FAQ [faq.html](E:/SaaS/site/faq.html) line 14 BreadcrumbList; line 17 FAQPage with 16 questions, matching the visible FAQ.
- Blog [blog.html](E:/SaaS/site/blog.html) lines 14–27: one `Blog` object with `blogPost` listing 4 `BlogPosting` items. Problems: the 8 articles in the table of contents (lines 57–64) produce 4 entries, so `stock-counts`, `paying-suppliers`, `bots-and-you` and `first-month-online` are missing; the `url` values are fragments (`blog.html#month-end`), not unique URLs; there is no `datePublished`, `dateModified`, `author` or `publisher`.
- All 41 generated detail pages (12 products, 5 case studies, 5 projects, 11 industries, 8 bots) and the generated index pages carry only BreadcrumbList, written by `crumbs()` in [build-site-pages.mjs](E:/SaaS/scripts/build-site-pages.mjs) lines 88–100.
- Bug: bot pages. `SECTION_NAMES` (line 85) has no `bots` key, so the middle breadcrumb has no `name`. Example: [pip.html](E:/SaaS/site/bots/pip.html) line 14 has `{"position":2,"item":".../bots.html"}` with no name. Google's breadcrumb rules expect a name on every item (memory, not checked this session). Fix: add `bots: "Bots"` (or "AI bots") to `SECTION_NAMES`.
- Breadcrumb on the case-study, project and industry index pages: none for root index pages except via head(), which does produce one. Fine.
- No Product, Service, Article, HowTo or Event schema anywhere. Product detail pages have "How it works" steps in an `<ol>` (e.g. [pos.html](E:/SaaS/site/products/pos.html) lines 73–78) that could be HowTo content (but see KQ2 notes on HowTo).
- Pending, requirements, book, bots index and privacy pages: BreadcrumbList only, except FAQ/blog as above.

Index consistency (affects what AI assistants summarise):
- Homepage module grid ([index.html](E:/SaaS/site/index.html) lines 212–263) shows 10 cards. The site has 12 product pages. Missing from the homepage grid: Document capture and Security and tenant isolation.
- Homepage industry tags (lines 379–389) list 9 industries. The site and llms.txt list 11; "Hotels and guesthouses" and "Small manufacturers" are missing from the homepage.
- Homepage projects (lines 482–495) list 3 of 5 projects.
- Blog table of contents lists 8 posts; the blog's JSON-LD lists 4; the homepage teaser links to 3.

Headings:
- Homepage has one H1 (line 111) and H2 per section, with H3 for cards. Clean.
- Subpages have H1 = name, then H2 "What it does", "Who it is for", "Availability", and in the detail block "Services", "Functions", "How it works", "A typical example". Hierarchy is valid. The H2s are generic; "Functions" and "Services" carry no search terms.
- Industry H1 is only the trade name ("Restaurants and cafés"), with no "ERP" term. Source: [restaurants.html](E:/SaaS/site/industries/restaurants.html) line 40s.
- Index H1s are brand-voice headlines, not keywords (e.g. "Questions we are asked", "Meet the bots that do the routine work").

Images and alt text:
- Subpage dashboard images are PNGs at [img/dashboards/*.png](E:/SaaS/site/img/dashboards) (12 files, about 225–255 KB each, roughly 2.9 MB total). Each has `width="1600" height="900" loading="lazy"` and alt text of the form "Illustrative 3D preview of the Retail and restaurant POS screen, with sample data" ([pos.html](E:/SaaS/site/products/pos.html) line 56). Dimensions are set, alt is present and labelled as illustrative; the figcaption repeats the disclaimer. Two issues: "3D" can make AI summaries describe a 3D product, and the alt names the screen but not what it shows. Suggested: "Sample-data preview of the POS sales screen showing today's takings".
- Index has no `<img>`. Hero art uses an SVG and a Three.js scene (`aria-hidden`), which is decorative and correct.
- Bot avatars are inline SVG with `aria-hidden="true"`; correct.
- The generator also writes SVG versions to `img/dashboards/*.svg` (build-site-pages.mjs line 291), but the pages reference the PNGs. The SVG files are unused by the pages; PNG renders come from [render-product-images.py](E:/SaaS/scripts/render-product-images.py), which I did not run or read.

Internal linking:
- Header nav on every page includes Products, Case studies, Projects, Industries, Blog, FAQ (so the footer and header give hub links). Good.
- Product, industry and case-study body text links only to "All products"-type back links and the CTA. Modules named in industry text ("Inventory and sales first, then POS and kitchen screens") and in case studies ("Modules that would matter") are plain text, not links. Products do not link to industries or case studies, and vice versa. Result: spoke pages are orphans from each other; only the hubs link to them.
- Blog articles contain only one internal product link (the demo CTA in the first-demo article, [blog.html](E:/SaaS/site/blog.html) line 97). No article links to a product or to the bots page.
- Bot pages link to each other (good) and to the bots index and a demo CTA.

Sitemap:
- [sitemap.xml](E:/SaaS/site/sitemap.xml) lists 53 URLs, which matches the 53 indexable pages. 404 is correctly excluded. No `lastmod`, so there are no freshness signals for crawlers.

robots:
- [robots.txt](E:/SaaS/site/robots.txt): `User-agent: *` allows all; explicit allow blocks for GPTBot, ClaudeBot, PerplexityBot and Google-Extended. Not listed: OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, Applebot-Extended (memory of vendor crawler names; not verified this session). Because `*` already allows everything, these lines do not block anything. The decision to allow or block is a business choice; the current file grants AI crawlers the same as everyone.

### Inferences
- The strongest fix for the homepage is to swap the placeholder domain and add Organization fields (logo, contact, sameAs, legal name). The homepage already has good title and description.
- Breadcrumb fix and OG/Twitter on the generator output would close most structured-data gaps with one change each, since all pages come from `head()` in build-site-pages.mjs.
- Because the homepage grid, industry tags and llms.txt disagree, AI assistants will get different counts of modules and industries depending on which page they read. Single-source the lists from [site-content.mjs](E:/SaaS/scripts/site-content.mjs).

### Gaps
- Actual crawl or Rich Results Test results: not run (no network, no build). The JSON-LD validity claim relies on the build check script's stated rules, which I did not run.
- Whether the real hosting serves a custom 404 status: not visible in files.
- Whether duplicate titles exist across all 53 pages: not checked programmatically.

---

## KQ2. Which high-intent search topics have no page at all?

### Takeaway
The site covers the platform's own modules and a few trades, but has no page for the search terms a small-business buyer types: a country or market term, POS-plus-ERP, pricing, comparisons with named alternatives, a definition of ERP, or the "free trial" question. Some topics exist but under the wrong section (multi-currency is under Projects). Several existing pages target a term only in body copy, not in H1 or title.

### Cited Findings
Search of all site files for market and competitor terms (grep over [E:/SaaS/site](E:/SaaS/site) and scripts):
- "Kenya", "M-Pesa", "KES", "Nairobi": no marketing page targets Kenya. Only hits are an example paragraph in [general-ledger.html](E:/SaaS/site/products/general-ledger.html) line 82 ("A shop in Nairobi buys stock in dollars") and a bot feed line in [ledger-lou.html](E:/SaaS/site/bots/ledger-lou.html) line 84 ("Bank line KES 42,000 unmatched"). The FAQ says only "We are starting with one or two markets" ([faq.html](E:/SaaS/site/faq.html) line 82); the markets are never named.
- Competitor names (Zoho, Odoo, QuickBooks, Xero, Sage, ERPNext, Tally): no comparison page. QuickBooks and Tally appear only in FAQ/homepage import questions. Source: [faq.html](E:/SaaS/site/faq.html) line 89; [index.html](E:/SaaS/site/index.html) line 68.
- Pricing: no page with figures. The homepage says pricing is "agreed on a call" ([index.html](E:/SaaS/site/index.html) lines 395–400); the FAQ repeats it (faq.html line 106). No "what it costs" content.
- "What is ERP?" definition: no page. Blog covers choosing an ERP but not defining it ([blog.html](E:/SaaS/site/blog.html) lines 80–91).
- "ERP with POS": [pos.html](E:/SaaS/site/products/pos.html) exists as "Retail and restaurant POS" with no "ERP" in title or H1, and the POS module is Level 2 (not yet live; [index.html](E:/SaaS/site/index.html) line 240). A buyer searching "ERP with POS" finds a not-yet-built module with no statement of how POS would post to the ledger beyond the example paragraph.
- "ERP for restaurants": [restaurants.html](E:/SaaS/site/industries/restaurants.html) exists, but the body is three short sections plus the same CTA; no mention of the POS page as the solution except through plain text.
- "Free ERP trial": FAQ says trial access is not open and gives a waitlist ([faq.html](E:/SaaS/site/faq.html) line 74). Accurate, but the query is answered with a negative.
- Multi-currency: the page is [projects/multi-currency.html](E:/SaaS/site/projects/multi-currency.html), under Projects, with a build-log tone. The product page for ledger is the nearest buyer-intent page. High intent for "multi-currency accounting software" is served by a project page.
- Payroll: [payroll-hr.html](E:/SaaS/site/products/payroll-hr.html) exists; the homepage says rules are added "one country at a time", so no country is named.
- E-invoicing: requirements mention "Local tax and e-invoicing" ([site-content.mjs](E:/SaaS/scripts/site-content.mjs) line 155) with no page or named regime.
- Implementation and migration: FAQ says import tools are on the roadmap. No migration or onboarding page; the blog's "first month" post is the only related content.
- Industry-specific and product-category terms that have a page but thin body copy: "inventory management software" (inventory page H1 is "Inventory"), "accounting software for small business" (ledger page H1 is "General ledger"), "clinic management software" ([clinics.html](E:/SaaS/site/industries/clinics.html)), "school fee management" ([schools.html](E:/SaaS/site/industries/schools.html) and [school-fee-plans.html](E:/SaaS/site/case-studies/school-fee-plans.html), which is an example scenario).

Suggested target topics with no page (search intent reasoning, not measured volume):
1. ERP for small business (generic head term): needs a dedicated landing page, not just the homepage.
2. Cloud ERP in Kenya (and any other first market): needs a market page naming the country, currency, payment rails and the tax rules that are live versus planned.
3. ERP with POS / POS with inventory and accounting: a page that explains the POS-to-ledger flow, with status stated.
4. ERP for restaurants: upgrade the existing industry page, title and H1 to include "ERP" and link to POS and inventory.
5. What is an ERP? (definition page; strong for AI answers and for "ERP meaning" queries).
6. ERP pricing for small business: a pricing page with the pricing basis (per user, per module, per country) even if numbers come on a call.
7. Comparison pages: QuickBooks, Zoho Books, Odoo, Tally (who should choose the other tool). Source for competitor facts should be the other researchers' note, not this one.
8. Data migration from QuickBooks, Tally or Excel (process, what is supported, status).
9. E-invoicing and tax compliance for the first market.
10. Offline POS and kitchen display for restaurants (POS page subsection could become its own page if the terms are searched).

### Inferences
- Several high-intent terms already have a page, but in the wrong place or with the wrong words. Moving multi-currency and the POS page into product-first titles, and adding "ERP" to restaurant and retail titles, is cheap.
- Because the first market is unnamed, AI assistants asked "ERP for Kenya" will likely answer "not stated". That is accurate, but it loses the query entirely. Naming the first market, even as "planned", closes that gap.

### Gaps
- Search volumes and competitor SERP results were not measured (no web search run). Intent ranking above is reasoning only.
- Whether the target market is Kenya is an assumption from the user's example term list, not confirmed in the files; the files only mention Nairobi as an example shop.
- No check of local regulations (e-invoicing, payroll) was performed.

---

## KQ3. What must change so that AI assistants describe the company accurately?

### Takeaway
The site is honest about status (it says "Not yet", "planned", "Nothing here is live yet"), which is good for accuracy. The problem is that status is stated in a few places but not in the product copy, and the machine-readable layer (SoftwareApplication, llms.txt, sitemap) describes a finished product in present tense. An assistant summarising the company is likely to say the product covers finance, sales, inventory, purchasing and payroll, with POS and AI agents, without saying that these are not yet available.

### Cited Findings
- SoftwareApplication description: "Cloud ERP for small and medium businesses covering finance, sales, inventory, purchasing and payroll." Present tense, no availability ([index.html](E:/SaaS/site/index.html) line 46).
- llms.txt top line: "Cloud ERP ... finance, sales, inventory, purchasing, payroll, POS, and AI agents with automation." The only status sentence is "Modules are shown in demos as they are built; availability is confirmed on the call." ([llms.txt](E:/SaaS/site/llms.txt) lines 3, 5). POS, payroll and AI agents are Level 2 or 4 on the roadmap ([index.html](E:/SaaS/site/index.html) lines 214–262, 340–370).
- llms.txt "Products" entries use the product summary as present-tense marketing (e.g. POS: "Checkout that keeps working when the internet drops"). No "status: planned" tag per item.
- Honest status is present in: homepage tag labels ("Level 1", "Level 2", "Level 4"); pending page ([pending.html](E:/SaaS/site/pending.html)); FAQ answer "Can I use it today? Not yet." ([faq.html](E:/SaaS/site/faq.html) line 70); the "Availability" section on every product page ("Modules are shown in demos as they are built"). The tags are visual, not text an assistant reads as a status word. Check by reading: the homepage "Level 1" tags are spans with classes only.
- Bot pages say "Level 4 · plan" and "Sample entries" ([pip.html](E:/SaaS/site/bots/pip.html) lines 43, 82), which is the honest signal, but the bots index H1 "Meet the bots that do the routine work" is present tense.
- Organization schema has only name and url. An assistant asked "who makes ERP Platform, where, and how do I contact them" has no entity facts on the site beyond the placeholder email in config.js. No About page, no team, no legal entity, no address, no founding date. "ERP Platform" is a generic name that collides with many ERP products; there is no `alternateName` or legal name to disambiguate.
- No pricing numbers, no named markets, no named currency rails beyond "shillings" and "dollars" in a case study ([index.html](E:/SaaS/site/index.html) lines 445–447). An assistant asked "how much does it cost" or "does it support my country" will find no answer on the site.
- Blog has no dates and no author, so an assistant cannot tell how current the posts are.
- No llms.txt entry for the FAQ or the blog, and no status line, last-updated date or contact. The llms.txt file is generated by [build-site-pages.mjs](E:/SaaS/scripts/build-site-pages.mjs) lines 15–42; FAQ and blog links are not in the generator's list.
- The homepage FAQ and FAQ page answer "Can I use it today? Not yet", which is the most useful AI-quotable sentence on the site. It appears on two pages and in JSON-LD on both, which is good.

### Inferences
Ordered by likely effect on AI summaries (inference, not measured):
1. Replace `your-domain.example` everywhere (build-site-pages.mjs line 13; index.html canonicals and og tags; robots.txt; sitemap; llms.txt is derived from BASE; config.js). Without a real domain, citations and links point nowhere.
2. Add a status line to every product, industry and bot summary, in text: for example "Status: planned, shown in demos as built" or "Status: in build with design partners". Repeat it in the SoftwareApplication description and in llms.txt, and add a "Status" section to llms.txt listing live, in build, planned.
3. Name the first market, currency and payment rails, and say what is not supported yet, on a single "Where it is available" page linked from llms.txt and the FAQ. Replace "one or two markets" with the actual market.
4. Publish a short "About" page and fill Organization: legal name, country, founding date, logo, contact point, sameAs links to the company's own profiles, a clear `alternateName` if the brand is shortened. This disambiguates the generic name.
5. Give the blog one URL per article (e.g. /blog/month-end.html), with datePublished, dateModified and author in BlogPosting, and list all 8 posts in the Blog schema.
6. Make llms.txt the single source for AI: add a "Last updated" date, a status line, the FAQ and blog links, the contact, and the pricing basis. Keep the "Facts" line; it is good. Fix the homepage module, industry and project counts to match.
7. Add a pricing basis page (even if prices are on a call): what it depends on, what is included, what a trial would include. Assistants will otherwise say "unknown" and may quote a competitor.
8. Make the homepage and llms.txt use the same counts: 12 modules, 11 industries, 5 projects, 5 case studies, 8 bots.
9. Consider adding robots lines for OAI-SearchBot, Claude-SearchBot, Claude-User and Applebot-Extended if the business wants explicit control. This is a policy decision; the current `*` allow already permits them.
10. Note for the owner: [faq.html](E:/SaaS/site/faq.html) and [index.html](E:/SaaS/site/index.html) say "Not yet" for trials and use, which is accurate. Keep it, and link it from llms.txt.

### Gaps
- No AI assistant output was tested. The claim that assistants will describe the product as finished is an inference from the copy and schema, not an observed result.
- I did not verify how Google, Bing or the AI vendors treat FAQPage, HowTo or SoftwareApplication. From memory: Google limited FAQ rich results in 2023 and removed HowTo rich results; SoftwareApplication rich results need offers or ratings. These should be checked against current vendor docs before acting.
- Whether the actual domain will use a `/blog/` path or the current single page is not decided in the files.

---

## Speed and page-performance risks (from files only; no measurement)

### Cited Findings
- Google Fonts CSS is a render-blocking stylesheet on every page ([index.html](E:/SaaS/site/index.html) line 14; subpages line 11). Two families with weights 400–800. `display=swap` is set (good). Preconnect appears on the homepage only; subpages do not preconnect.
- The homepage loads [config.js](E:/SaaS/site/config.js) and [main.js](E:/SaaS/site/main.js) at the end of body (not `defer`). Subpages do the same.
- main.js imports a Three.js hero scene dynamically from `cdn.jsdelivr.net/npm/three@0.160.0` ([scene3d.js](E:/SaaS/site/scene3d.js) line 3), gated by `fineHover && motionOk && .scene3d` ([main.js](E:/SaaS/site/main.js) lines 287–292). This is a large third-party script on the homepage only. The gating is good; the cost is still a risk for LCP and Total Blocking Time, to be measured.
- Dashboard PNGs: 12 files of about 225–255 KB at 1600x900, lazy-loaded (see KQ1). Recompress or use WebP/AVIF with width-based srcset; the displayed size is smaller than 1600 px on most layouts.
- Reveal animations: `.js .reveal` starts at opacity 0 and is shown by IntersectionObserver ([styles.css](E:/SaaS/site/styles.css) lines 596–601; [main.js](E:/SaaS/site/main.js) lines 109–125). Content is visible to crawlers that do not run JS (no `js` class on initial HTML, since main.js adds it on load), so this does not hide text from AI crawlers. Good.
- The lead form posts to `apiBase`, which is a placeholder in [config.js](E:/SaaS/site/config.js) line 2; there is no server-rendered fallback, so the form is inert until configured.

### Gaps
- No Lighthouse, WebPageTest or Search Console data. These risks are from reading the files.

---

## Prioritised fix list (for the report writer)

1. Set the real domain in the generator (BASE), index.html, robots.txt, config.js; rebuild sitemap and llms.txt.
2. Add Open Graph and Twitter tags to the generator `head()`, with per-page og:image (or the site default).
3. Fix the bots breadcrumb (`SECTION_NAMES.bots`).
4. Add status wording to product, bot and industry summaries; align SoftwareApplication description and llms.txt with it.
5. Name the first market; add a "where it is available" section and a pricing-basis section.
6. Expand Organization schema and add an About page.
7. Give each blog article its own URL, date and author; list all posts in Blog schema; add internal links from articles to product pages.
8. Add pages for "ERP for small business", "What is an ERP", "ERP with POS", pricing basis, and at least one honest comparison.
9. Add cross-links between product, industry and case-study pages.
10. Single-source module, industry and project counts; update homepage grid to 12 modules, 11 industries, 5 projects.
11. Compress dashboard PNGs; defer or gate the homepage 3D script (already gated; verify with a measurement).

## Overall gaps in this audit
- No build run, no file changes, no web search, no crawl or Rich Results validation, no AI assistant test. Each claim above cites a file or line; external platform rules are marked as memory.
