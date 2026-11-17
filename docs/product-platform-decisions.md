# Product and platform decisions

Status: agreed by the owner. Record of the answers given during planning. Change a decision here, in a pull request, with the reason.

Related: [product-split-plan.md](product-split-plan.md) (products, APIs, events, build order) and [process-flow-product-map.md](process-flow-product-map.md) (process to product map). Neither names the reference client; keep it that way.

## 1. Structure

| Decision | Answer |
|---|---|
| Deployment | Separate repositories: `platform`, `procurement`, `stores`, `sales`, `production`, `finance`, plus a web app repository owned by Antigravity |
| Repository owner | GitHub organisation `qavril-labs`. All six product repositories are private |
| Stack | Same as the current backend: TypeScript, Node 20 or later, Fastify, Postgres (node-postgres), BullMQ with Redis, Vitest |
| Shared code | Versioned npm packages on GitHub Packages, published from `platform`: `@qavril/kernel`, `@qavril/money`, `@qavril/events-types`, `@qavril/api-client`. Products pin versions |
| Day one | Each repository is scaffolded: README, CI, lint, tests, tsconfig, Dockerfile, and an empty health route |
| Web app | Separate repository, owned by Antigravity. Contains the launcher and the screens. Built from the contracts only |
| Naming | Functional names with no brand prefix in repository names, API prefixes, launcher and tables. Names: Platform, Procurement, Stores, Sales, Production, Finance |

## 2. Database

| Decision | Answer |
|---|---|
| Neon projects | One per repository, in AWS Singapore (`aws-ap-southeast-1`): `qavril-saas` (platform, the core project in [infrastructure.md](infrastructure.md)), `qavril-procurement`, `qavril-stores`, `qavril-sales`, `qavril-production`, `qavril-finance`, and `qavril-agents` (renamed from `uaap`, the agent service) |
| Roles | One owner role runs migrations. Each product's API runs as its own app role, with no rights to other products' databases |
| Tenant isolation | Every tenant table has `tenant_id` and row-level security. Tenant data is queried only through `withTenantTransaction` |
| Branches | `main` (production), `dev` (shared development), and one short-lived branch per pull request for migration tests |
| Local development | Postgres in Docker. Tests use `TEST_DATABASE_URL`, set to a local role that can create databases |
| Money | `bigint` minor units with a currency code, through `@qavril/money`. Amounts cross the API as decimal strings |
| Cross-product data | No product queries another product's database. Reads go through the platform API, or a local copy filled by events |
| Point-in-time history | **Decided: 6 hours**, the maximum on the current Neon plan. A 7-day window was refused by the plan. The owner chose to keep 6 hours. Because the restore window is short, production needs scheduled logical backups (`pg_dump` to S3 with a tested restore) before real data is loaded. Not yet built |
| Backups | Until the window is extended, scheduled logical backups are required before production data is loaded |

## 3. Hosting, events and secrets

| Decision | Answer |
|---|---|
| Hosting | Each product is its own ECS service, behind the gateway. Each repository builds and deploys its own container |
| Events | Outbox table in each product's database, written in the same transaction as the business change. A relay worker publishes to one shared Redis with BullMQ. Queues are named by product and tenant |
| Environments | `dev`, `staging` and `prod` per repository |
| Secrets | AWS Secrets Manager, injected at deploy time. Local `.env` files for development only |
| Currency and tax | INR and GST in the first release. Tax rules are data (PLT-04), so other countries can be added later |

## 4. Review and delivery

| Decision | Answer |
|---|---|
| Protected `main` | CI must pass. One approval required |
| Contract changes | Any change to a contract file in `contracts/`, or to a screen-facing API, needs Antigravity's approval |
| Contracts | Draft contracts for `platform` and `procurement` are in `contracts/` (`platform.openapi.yaml`, `procurement.openapi.yaml`). Not yet reviewed |

## 5. Still open

1. Scheduled production backups (`pg_dump` to S3), needed because the restore window is 6 hours (see section 2).
2. The first tenant and seed data: use neutral sample companies only.
3. Repository-level branch protection settings, to be applied in GitHub once the repositories hold code.
