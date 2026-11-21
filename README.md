# QAVRIL LABS website

The public marketing site (`frontend/site/`) and its build and check scripts (`frontend/scripts/`).

- Site build: `npm --prefix frontend run site:build`
- Site check: `npm --prefix frontend run site:check` (checks links, structured data, and the lead form against `frontend/scripts/lead-form.contract.json`)
- Local preview: `npm --prefix frontend run site:serve`

Related repositories:
- `qavril-labs/website-api`: the lead endpoint and the content API (the CMS for pages, articles and FAQs)
- `qavril-labs/erp-contracts`: the ERP API contracts and product plans
- `qavril-labs/erp-legacy`: the first ERP monolith, kept for reference
- `qavril-labs/platform`, `procurement`, `stores`, `sales`, `production`, `finance`, `web-app`: the ERP product services and app

Still in this repository and waiting on the ERP web app: the signed-in pages (`frontend/site/app.html`, `app.js`, `account.js`, `bots/`, and the admin page's sign-in calls). Their backend calls point at the ERP API, which is not yet deployed.
