# Marketing site

A static landing page with lead capture. There is no build step and no framework, so it can be hosted on any static host.

## Files

- `index.html`: the page, with SEO and social tags, JSON-LD (Organization, SoftwareApplication, FAQPage), and the early-access form.
- `styles.css`: the design, responsive layout, phone menu styling, and reduced-motion support.
- `main.js`: form validation, submission to the API, the mailto fallback, the phone menu, scroll reveals, and the cursor glow.
- `config.js`: the API base URL and the contact email.
- `privacy.html`: a draft privacy notice. A lawyer must review it before launch.
- `404.html`: the not-found page.
- `robots.txt` and `sitemap.xml`: crawler files.
- `og-image.png`: the 1200 x 630 social preview image.
- `favicon.svg`: the icon.

## Run locally

From the repository root, start the API. It needs a database and a platform key:

```bash
DATABASE_URL=postgres://user:password@127.0.0.1:5432/erp_dev \
PLATFORM_ADMIN_KEY=$(openssl rand -hex 32) \
CORS_ORIGINS=http://127.0.0.1:8080 \
npm run dev:api
```

In a second terminal, serve the site:

```bash
cd site
python -m http.server 8080 --bind 127.0.0.1
```

Open http://127.0.0.1:8080/. Submitting the form posts to `apiBase` in `config.js`. If the API is not running, the form shows a network error and keeps what the visitor typed.

## Check the site

```bash
npm run site:check
```

This runs without a browser. It fails on broken in-page anchors and missing local files, on structured FAQ data that differs from the visible FAQ, on form fields the API would reject, on sitemap entries that do not exist, and on a bad preview image. It also lists launch placeholders as warnings. The warnings are expected until the domain and privacy details are settled.

## Read the leads

Leads are stored in the `leads` table. Export them as CSV:

```bash
DATABASE_URL=postgres://user:password@127.0.0.1:5432/erp_dev npm run leads:export -- 500 > leads.csv
```

The export neutralizes spreadsheet formulas. Keep the CSV files out of git: `.gitignore` already excludes `leads*.csv`.

## Done locally

- Bold, playful visual design with motion that respects reduced-motion preferences.
- Phone layout checked for horizontal overflow, with a working menu.
- Form validation, submission, and error messages, checked end to end against the local API and database.
- Preview image, 404 page, sitemap, robots file, and structured data.
- Lead export command and the site check.

## Before deploying (needs your input)

1. **Domain.** Replace `your-domain.example` in `index.html`, `robots.txt`, `sitemap.xml`, and `privacy.html`. The site check warns until this is done.
2. **Config.** Set `apiBase` in `config.js` to the deployed API URL, and set `contactEmail`. The local value points at localhost.
3. **Sign-up.** `signup.html` and `signin.html` post to `/v1/public/signup` and `/v1/auth/login` on `apiBase`. Sign-ups are limited to 5 per IP per hour and sign-ins to 20 per 10 minutes. The session token is kept in `sessionStorage` only. There is no email verification or password reset yet.
4. **API host.** Set `CORS_ORIGINS` to the site's origin, for example `https://www.your-domain.example`. Set `TRUST_PROXY=true` if the API runs behind a proxy, so the rate limit applies per visitor.
5. **Privacy notice.** A lawyer must review `privacy.html`, and its six placeholders must be filled in.
6. **Brand.** "QAVRIL LABS" is a working name. Check trademark availability before using it publicly.
7. **Pricing promise.** The page says nothing is charged until someone has seen the product and agreed to terms. Keep that promise.

## What the page claims

Every claim on the page should match what the product does today. Modules are labeled with their phase. Do not add a module, integration, or certification to the page until it ships.
