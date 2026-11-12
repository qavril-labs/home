# Conversion paths and lead capture: ERP platform marketing site

Scope: static site in `E:/SaaS/site`, the lead API route `POST /v1/public/leads` in `E:/SaaS/apps/api/src/app.ts`, and the lead storage and export code in `E:/SaaS/packages/db`. Read-only review of source files. The site was not run, no tests were run, and no rendering or accessibility tool was used. Browser-level claims are marked as unverified. Sources are local files, cited as `path:line`, because there are no external URLs.

Line numbers refer to the files as they stand on disk at the time of review.

## Q1. Where does a visitor who wants to buy get stuck?

### Takeaway
A visitor can book a demo slot or join a waitlist, but there is no self-serve path to a trial or a purchase. Pricing is "agreed on a call", the trial is a waitlist with no provisioning, and the demo has no real calendar. After submitting, the visitor gets only a generic "we will reply by email" message, and nothing in the code notifies anyone.

### Cited Findings

**CTA placement and consistency**
- The header button "Book a demo" is repeated on every page, so the primary conversion action is consistent across the site: `E:/SaaS/site/index.html:101`, `E:/SaaS/site/book.html:35`, `E:/SaaS/site/pending.html` (header), and similar lines on the product, industry, case-study and bot pages.
- The home page hero has two CTAs: "Get early access" links to `#join` with `data-interest="early_access"` (`E:/SaaS/site/index.html:118`), and "Book a 20-min call" opens the modal (`index.html:119`). The home page does not mention a free trial anywhere.
- The pricing block has one CTA, "Talk pricing", which opens the demo modal with demo preselected (`E:/SaaS/site/index.html:393-402`, CTA at line 399; `E:/SaaS/site/main.js:277`). A pricing question is therefore routed into a "demo slot" flow.
- "Request a free trial" appears on `products.html:111`, `faq.html:113`, `bots.html:170`, `pending.html`, `blog.html`, `industries.html`, the product pages, the project pages, and the case-study pages, but not on the home page. Trial CTAs are therefore spread across subpages, while the home page has none.
- The same action carries different labels: "Get early access", "Book a demo", "Book a 20-minute call", "Book a demo slot", "Talk pricing", "Request a free trial", and "Send my request" for submit.
- The 404 page (`E:/SaaS/site/404.html:44`) has only one CTA. The privacy page has none (`privacy.html`, one footer link only by grep count).

**Trial and purchase path**
- The trial is explicitly a waitlist: "trial access is not open yet" (`E:/SaaS/site/book.html:43`), "A free trial is a request for now. Self-service sign-up and trial accounts are not open." (`E:/SaaS/site/pending.html`, Access bullet), and the FAQ says the same (`E:/SaaS/site/faq.html:74`).
- The only ways to create a tenant are the platform-key endpoint `POST /v1/platform/tenants` (`E:/SaaS/apps/api/src/app.ts:111`) and product enablement via `POST /v1/platform/tenants/:tenantId/products` (`app.ts:222`). Both need `PLATFORM_ADMIN_KEY`. A trial request therefore has to be fulfilled by hand by an operator.
- Login exists in the API (`app.ts:140`), but the pending page says the ERP sign-in screen is not ready (`pending.html`, Platform bullet).
- Pricing has no numbers. The pricing card says "Pricing depends on company size, modules and country" (`index.html:398`), and the pending page says "There are no published price lists yet." There is no plan comparison, no checkout, and no order or quote form. The only path to paying is the call.

**Demo booking**
- There is no calendar. The book page says "We reply by email within one business day to confirm the slot" (`E:/SaaS/site/book.html:42`), and the pending page says "calendar booking is not connected" (`pending.html`, Access bullet).
- The "slot" is a free-text string picked from a fixed list of day and half-day options (`book.html:72-84`, `main.js:72-76` and `main.js:191-194` in the modal). It is concatenated into the `message` column as "Preferred slot: ...", so there is no structured slot, timezone, or duration.
- The home page form has no slot field at all (`index.html:505-560`), so a demo request from the home page carries no time preference.

**Mismatched forms across pages**
- The request types differ by form. Home page: `early_access`, `demo`, `partner` (`index.html:523-527`). Book page: `demo`, `trial`, `early_access` (`book.html:64-68`). Modal: `demo`, `trial` only (`main.js:190`). The API accepts `early_access`, `demo`, `partner`, `trial` (`apps/api/src/app.ts:34`). A trial request can therefore be made from the modal or book page but not from the home form.
- The industry lists differ. Home form: "Retail or pharmacy", "Restaurant or cafe", "Clinic or dental", and so on (`index.html`, about lines 530-540). Book page: "Restaurants and cafés", "Clinics and dental", and so on (`book.html:89-101`). The data is therefore not comparable across sources. The modal has no industry field at all (`main.js:182-199`), so modal leads have no industry or country.
- The modal shows a "Preferred slot" select even when "Free trial (request)" is chosen (`main.js:190-194`). That is a visible inconsistency.

### Inferences
- The conversion path has two dead ends for a buyer: the trial waitlist and the pricing call. Neither ends with a booked time or a paid plan inside the product.
- The home page is the main entry point (the book page is reached mainly through the modal), and it offers no trial and no slot. A visitor who wants a trial must go to a subpage to find the CTA.
- Because the "Talk pricing" and "Book a demo" CTAs both feed the same modal and table, a pricing enquiry and a demo request cannot be told apart in the data except by the free-text message.

### Gaps
- No analytics or event tracking was checked for in the site, so conversion measurement is unknown. Not reviewed: any analytics snippet in `index.html` or `main.js`. (No such code appears in `main.js`.)
- No real booking calendar, timezone, or confirmation mechanism was found anywhere in the repo.
- Whether the modal's visual layout and CTA visibility on phone widths works was not checked, because the site was not run. CSS is at `E:/SaaS/site/styles.css:659-700` (hover and pointer rules, modal) and `styles.css:752-760` (phone menu). This is unverified.

---

## Q2. Which form or modal behaviours could lose leads?

### Takeaway
The most likely loss points are configuration (the committed `apiBase` points at localhost, the mail fallback is silent, CORS may be unset), the rate limiter (it counts every attempt, including invalid and honeypot ones, and by default sees only the proxy IP), and the lack of any notification after a successful insert. Errors that do happen show a generic message with no field detail.

### Cited Findings

**Configuration that breaks submission**
- The committed site config points at `http://127.0.0.1:3001` (`E:/SaaS/site/config.js:7`). In a deployed browser, that address is the visitor's own machine, so every submission would fail. The comment says to edit it before going live (`config.js:1-4`). The contact email is a placeholder: `hello@your-domain.example` (`config.js:8`). It is shown in the network error message (`main.js:102`, `main.js:264`).
- If `apiBase` is empty, submission falls back to `mailto:` (`main.js:79-83` and `main.js:236-241`). The lead is not stored in the database. The form shows "Opening your email app so you can send the request" and does not reset or confirm. If the visitor has no mail client, the request is lost. The mailto subject is always "Early access request" (`main.js:37`), even for demo and trial requests.
- The API sends CORS headers only for origins in `CORS_ORIGINS` (`E:/SaaS/apps/api/src/app.ts:84`, `allowBrowserOrigin` at lines 165-174; config at `E:/SaaS/apps/api/src/config.ts`, default empty). If the site origin is not listed, the browser blocks the POST, and `main.js` shows "Network error" (`main.js:101-103`).

**Rate limiter**
- The limiter is keyed on `request.ip` (`app.ts:192`). `trustProxy` defaults to `false` (`app.ts:83`, `config.ts`, `TRUST_PROXY === "true"`). Behind a proxy or CDN, every visitor shares the proxy IP, so the limit (5 per 10 minutes, `app.ts:85`) would apply to the whole site.
- `allow()` records each hit before validation (`app.ts:192` runs before `LeadBody.parse` at `app.ts:195`). A visitor who makes five bad submissions, or a bot that submits the honeypot, uses up the allowance for 10 minutes. The honeypot check (`app.ts:196`) runs after the limiter.
- The limiter is in process memory (`E:/SaaS/apps/api/src/rate-limit.ts`, header comment). It resets on restart and is not shared across instances.
- The 429 message is "Too many tries from this network. Give it a few minutes." (`main.js:97`, `main.js:256`). It does not say how long, and it does not keep the typed data (the modal does keep it, but the page form resets only on success).

**Error handling**
- Only 201 is treated as success. 429 has its own message. Every other status, including the 400 validation error, shows "Something in the form didn't land. Check the fields and try again." (`main.js:98-100`, `main.js:258-260`). The API returns field-level `details` for validation (`app.ts:93-96`), but the client ignores them.
- The network error path keeps the typed values (the form is not reset, `main.js:101-103`). That is good, and the README says so (`E:/SaaS/site/README.md`, "Run locally").
- Double submission is limited to disabling the button during the request (`main.js:85`, `main.js:104`, `main.js:242`, `main.js:267`). There is no unique constraint on `leads.email` (`packages/db/migrations/0002_leads.sql:19` is a plain index). A visitor who retries after a timeout, after the server has already inserted, creates a duplicate row. The API does not deduplicate.

**Success state and modal behaviour**
- On success on the page form, the form resets and the status says "You're in. We have your request and will reply by email." (`main.js:93-95`). Nothing is shown about what happens next, and no request reference is given.
- On success in the modal, the dialog stays open, the form resets, and the status says "You're in. We reply by email to confirm your trial/slot" (`main.js:251-254`). There is no close button focus change and no next step.
- The "reply by email" promise depends entirely on a person reading the export (see Q3 section below).

**Attribution**
- `source` is taken only from `utm_source`, capped at 100 characters (`main.js:12-13`). `utm_campaign`, `utm_medium`, referrer, and landing page are not captured. The API defaults missing source to "direct" (`app.ts:211`).

### Inferences
- The most damaging single loss point is the committed `apiBase` plus the mailto fallback. Until the deployment edits `config.js`, a visitor either gets a network error (127.0.0.1) or an email draft that may never be sent.
- The rate limiter is likely to block real visitors in production unless `TRUST_PROXY=true` is set. The bad-attempt counting makes this worse for visitors who correct a mistake and retry.
- A failed submission gives no field-level guidance, so a visitor who hits a server-side validation error (for example an email the regex rejects) sees a generic message and may abandon.

### Gaps
- The deployed hosting, proxy setup, and `CORS_ORIGINS` value are not in the repo. Whether `TRUST_PROXY` and CORS are set is unknown.
- Whether the browser's native validation bubbles appear on mobile was not verified (no run).

---

## Q3. What minimum changes would make booking and trial requests complete?

### Takeaway
A workable first release needs five things: a valid `apiBase` and contact email, a notification and acknowledgement when a lead arrives, a stored record of consent, a structured slot and timezone, and a clear trial waitlist state. Self-serve trial and checkout are larger changes and sit outside a minimum.

### Cited Findings

**Form fields and necessity**
- Required today: name, email, consent, and interest. Optional: company, country, industry, message, slot (`index.html:505-560`, `book.html:45-111`, `main.js:190-194`).
- Missing for a demo: a phone number (optional, but it speeds up a slot confirmation), a timezone, and a structured slot value. The slot is stored only inside `message`. The `leads` table has no slot column (`packages/db/migrations/0002_leads.sql:6-17`).
- Missing for a trial: nothing blocks it, but no company size, country, or use case is required for triage. `country` is optional in the book form and absent in the modal.
- Required-field markers: only the `(optional)` text appears (`book.html:105`, `index.html` message label, `styles.css:127`). Required fields have no visible marker. This is a form-clarity gap, not a blocker.

**Consent is not recorded**
- `consent: z.literal(true)` is checked (`apps/api/src/app.ts:38`), but the INSERT does not store consent, a consent timestamp, or the privacy notice version (`app.ts:199-214`). The table has no consent column (`0002_leads.sql`). If the visitor later asks for proof of consent, the system cannot show it.
- The privacy notice is a draft: "A lawyer must review it before launch" (`E:/SaaS/site/README.md`, Files, `privacy.html`).

**Storage, export and follow-up**
- Storage: the API inserts into `leads` with no tenant ID and no row-level security, by design (`0002_leads.sql:1-4`, `app.ts:199-214`). Stored columns: name, email (lowercased), company, country, interest, industry, message, source, created_at, id.
- Export: `npm run leads:export -- [limit]` prints newest-first CSV (`packages/db/src/leads-cli.ts`, `packages/db/src/leads.ts`, `listLeads`). Default limit is 1000 (`leads-cli.ts`). Formula-like cells are neutralized (`leads.ts`, `guardFormula`).
- Follow-up: there is no operator notification, no webhook, no email, and no acknowledgement to the visitor. A search of `apps` and `packages` for notify, webhook, SMTP, mail and CRM found nothing relevant (the only hit was a generated product catalogue file). Follow-up is therefore a manual export.
- No lead status, owner, or notes column exists, so there is no way to track "contacted" or "booked" in the data. There is no delete or erase path for a lead on request.
- API tests exist for the lead route (`apps/api/test/leads.test.ts`, which queries the `leads` table). I did not read the whole file, so I have not confirmed which cases it covers. Follow-up is not tested.

**Documentation of the process**
- `packages/db/src/leads.ts` states that the public API "never reads leads back" (comment on `listLeads`). The site README describes export as the way to read leads (`E:/SaaS/site/README.md`, "Read the leads"), and `docs/phase-0-status.md:56` documents the same export flow.

### Inferences
Minimum changes, in priority order:
1. Set `apiBase` to the deployed API and `contactEmail` to a real mailbox in `E:/SaaS/site/config.js` (lines 7-8). Make the deployment fail loudly if either is still a placeholder. Remove or gate the mailto fallback so a request is never silently dropped.
2. Set `CORS_ORIGINS` and `TRUST_PROXY=true` (if behind a proxy) in the API environment. Change the limiter to count only accepted requests, or key on IP plus a per-form token, and show the retry time in the 429 message.
3. Record consent on insert: a `consent_at` timestamp and the privacy notice version. Add a migration. This needs the lawyer-reviewed notice first.
4. Add a notification to the operator (email or webhook) on each insert, and an acknowledgement email to the visitor. The insert and the notification should not share a failure path, so a notification failure does not drop the lead.
5. Store the slot and timezone as structured columns, and add a `status` column (new, contacted, booked, waitlisted). Add a `UNIQUE` or dedupe rule on `(email, interest)` within a window.
6. Use one request-type list and one industry list across all three forms (home, book page, modal), and add a trial option to the home form if trial requests are meant to be captured from there.
7. Make the trial state explicit in the success message: "You are on the trial waitlist. We email you when it opens." Do not show "reply to confirm your slot" for trial requests.
8. Show field-level errors from the API `details` array, and mark required fields visibly.

Larger changes, outside the minimum: a real calendar (for example a scheduling link or booking API), self-serve trial sign-up with a tenant-provisioning flow, and a checkout or quote flow with published plans.

### Gaps
- No evidence of a deployed API or DNS setup in the repo.
- Whether the privacy notice will meet the applicable law (for example GDPR or local equivalents) was not assessed. The repo says a lawyer must review it.
- The "one business day" reply promise has no tracking mechanism.

---

## Accessibility of the modal and forms

### Takeaway
The modal uses the native `<dialog>` element, which gives a focus trap, Escape to close, labelled controls, and a live status region. Its gaps are minor: focus return on close is not set explicitly, accidental backdrop clicks close the dialog without warning, and required fields have no visible marker or per-field error association.

### Cited Findings
- The modal is created with `aria-labelledby` (`main.js:181`), the title is set on open (`main.js:278`), the close button has `aria-label="Close"` (`main.js:185`), and labels are tied to inputs by `for` and `id` (`main.js:187-195`).
- The first field receives focus on open (`main.js:282`), and `showModal()` gives the native focus trap and Escape handling (`main.js:281`).
- Status messages go to `role="status"` with `aria-live="polite"` (`main.js:198`, `book.html:117`, `index.html` form-status).
- The honeypot is `aria-hidden` and `tabindex="-1"` (`main.js:196`, `book.html:112-114`). It is moved off-screen with `left: -9999px` (`styles.css:557`, `subpage.css:37`). This is an acceptable pattern for a bot trap.
- Backdrop click closes the dialog (`main.js:203-205`). Closing does not clear the form, so values persist on reopen. The status text is cleared on open (`main.js:279-280`).
- The modal CSS is duplicated in `styles.css:676-700` and `subpage.css:40-64`. Any change must be made twice.
- Invalid fields are described only by the browser's native bubble and a generic line "Fill in the highlighted fields and try again" (`main.js:54`, `main.js:218`). There is no `aria-invalid` and no per-field error text. Whether `:invalid` styling exists in the CSS was not checked.

### Inferences
- Screen reader users get a live status message, but not the field that failed. Sighted users rely on the native bubble.
- Focus is not explicitly returned to the triggering CTA when the modal closes. Native dialog behaviour in current browsers generally restores focus, but this was not tested.

### Gaps
- Not verified in a browser: focus return, screen reader output, phone layout, and whether the modal is usable on small screens. The site was not run.

---

## Mobile usability

### Takeaway
The phone menu is wired with `aria-expanded` and closes on link choice (`main.js:128-144`). The layout rules exist (`styles.css:752-760`), but rendering was not checked.

### Cited Findings
- The menu toggle sets `aria-expanded` and the `is-open` class (`main.js:132-136`), and closes on link click (`main.js:138-143`).
- Pointer-coarse rules are at `styles.css:659`. Modal layout is in the same file (`styles.css:676-700`).
- Phone inputs have no `type="tel"` or `inputmode`, because there is no phone field.

### Gaps
- Not verified: whether the header "Book a demo" button stays visible and tappable at phone widths, and whether the modal overflows on short screens.

---

## Pricing presentation and purchase blockers

### Takeaway
Pricing is presented as "agreed on a call", with no numbers and no self-serve purchase path. That is consistent with an early-access B2B model, but it means a buyer cannot reach a purchase without a human conversation.

### Cited Findings
- `index.html:393-402`: "Early-access pricing, agreed on a call"; "Nothing is charged until you have seen the product and agreed to terms."
- `pending.html`: "Pricing is agreed on a call. There are no published price lists yet."
- No checkout, quote, or order form was found in `E:/SaaS/site`.

### Inferences
- A visitor who wants to buy has no price to compare, no plan to pick, and no way to start paying, so the conversion path ends at the booking form.

### Gaps
- No pricing model, plan list, or currency policy exists in the repo. It cannot be assessed beyond "not published".

---

## Notes on what was not reviewed
- The `index.html` JSON-LD and SEO tags were not reviewed beyond the title and description. They do not affect conversion directly.
- `site:check` (the script in `CLAUDE.md`) was not run, per the constraints.
- The hosting configuration, DNS, and the production values of `CORS_ORIGINS`, `TRUST_PROXY`, and `DATABASE_URL` are not in the repo.
