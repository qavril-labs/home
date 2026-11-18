import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Signs the live test tenant in once, before any browser opens, and stores the token for the tests to read.
// Local development only: the tenant is the one live-seed.mjs creates.
const here = dirname(fileURLToPath(import.meta.url));
const API = process.env.E2E_API_URL || "http://127.0.0.1:3012";
const TENANT = { slug: "e2e-live", email: "admin@e2e-live.example", password: "correct-horse-battery" };

export default async function globalSetup(): Promise<void> {
  const login = await fetch(`${API}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenantSlug: TENANT.slug, email: TENANT.email, password: TENANT.password }),
  });
  if (!login.ok) {
    throw new Error(`The live tenant is not there (login returned ${login.status}). Seed it first: node tests/e2e/fixtures/live-seed.mjs`);
  }
  const { token } = (await login.json()) as { token: string };
  const companies = await fetch(`${API}/v1/companies`, { headers: { authorization: `Bearer ${token}` } });
  const { companies: list } = (await companies.json()) as { companies: { id: string }[] };
  if (list.length === 0) throw new Error("The live tenant has no company.");

  const file = resolve(here, "../.auth/live.json");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ token, companyId: list[0].id }));
}
