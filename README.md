# ERP Platform

Foundation for a multi-tenant ERP for small and medium businesses. The product plan is in [ERP-Product-Catalog.md](ERP-Product-Catalog.md). The current build status is in [docs/phase-0-status.md](docs/phase-0-status.md).

## Quick start

Requirements: Node.js 22 or later, npm 10 or later.

The database and API tests need `TEST_DATABASE_URL` set to a Postgres URL whose role can create databases and roles. Each run creates and drops its own database. Without the variable, the tests try an embedded Postgres, which does not start on Windows in this build.

```bash
npm install
npm test
npm run typecheck
```

To run the API against a real database:

```bash
export DATABASE_URL=postgres://owner:password@localhost:5432/erp
export PLATFORM_ADMIN_KEY=$(openssl rand -hex 32)
npm run migrate
npm run dev:api
```

Create the first tenant:

```bash
curl -X POST http://127.0.0.1:3000/v1/platform/tenants \
  -H "x-platform-key: $PLATFORM_ADMIN_KEY" \
  -H "content-type: application/json" \
  -d '{"tenant":{"slug":"acme","name":"Acme Ltd","region":"MEA"},
       "company":{"legalName":"Acme Ltd","countryCode":"KE","baseCurrency":"KES","fiscalYearStartMonth":1},
       "admin":{"email":"admin@acme.example","password":"use-a-long-passphrase"}}'
```

## Database roles

Run migrations as the table owner. Run the application as a separate role that is not a superuser and does not bypass row-level security. The test helper in `packages/db/src/testing/embedded.ts` shows the required grants.
