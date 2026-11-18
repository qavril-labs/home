// Seeds the live tenant that the stock and till end-to-end tests sign in to, through the real API.
// Run once against a running API (npm run dev:all, or npm run dev:api):
//   node tests/e2e/fixtures/live-seed.mjs
// Safe to run again: if the tenant already exists, it is left as it is.
// Local development only. The platform key and the test password are placeholders for a local database.

const base = process.env.E2E_API_URL || "http://127.0.0.1:3012";
const platformKey = process.env.PLATFORM_ADMIN_KEY || "local-dev-only-platform-key-0123456789";

export const LIVE_TENANT = {
  slug: "e2e-live",
  email: "admin@e2e-live.example",
  password: "correct-horse-battery",
};

async function call(method, path, token, body, extraHeaders = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    const error = new Error(`${method} ${path} -> ${response.status}: ${text}`);
    error.status = response.status;
    throw error;
  }
  return json;
}

async function login() {
  return call("POST", "/v1/auth/login", undefined, {
    tenantSlug: LIVE_TENANT.slug,
    email: LIVE_TENANT.email,
    password: LIVE_TENANT.password,
  });
}

async function seed() {
  let session;
  try {
    session = await login();
  } catch (error) {
    if (error.status !== 401 && error.status !== 404) throw error;
    session = null;
  }
  if (session) {
    console.log(`Live tenant ${LIVE_TENANT.slug} already exists; nothing to do.`);
    return;
  }

  const created = await call(
    "POST",
    "/v1/platform/tenants",
    undefined,
    {
      tenant: { slug: LIVE_TENANT.slug, name: "E2E Live Ltd", region: "MEA" },
      company: { legalName: "E2E Live Ltd", countryCode: "KE", baseCurrency: "KES", fiscalYearStartMonth: 1 },
      admin: { email: LIVE_TENANT.email, password: LIVE_TENANT.password },
    },
    { "x-platform-key": platformKey },
  );
  const tenantId = created.tenant.id;
  const companyId = created.company.id;

  await call(
    "POST",
    `/v1/platform/tenants/${tenantId}/products`,
    undefined,
    { products: ["MDM-02", "MDM-03", "MDM-04", "PLT-05", "PLT-06", "PLT-15", "FIN-01", "FIN-05", "INV-01", "INV-03", "POS-01"] },
    { "x-platform-key": platformKey },
  );

  const { token } = await login();

  for (const [code, name, type] of [
    ["1000", "Cash", "ASSET"],
    ["1010", "Card clearing", "ASSET"],
    ["1020", "Mobile money clearing", "ASSET"],
    ["1300", "Stock on hand", "ASSET"],
    ["2050", "Goods received not invoiced", "LIABILITY"],
    ["2100", "Tax payable", "LIABILITY"],
    ["4000", "Sales", "REVENUE"],
    ["5000", "Cost of goods sold", "EXPENSE"],
    ["5100", "Expired stock written off", "EXPENSE"],
    ["5200", "Stock count variance", "EXPENSE"],
  ]) {
    await call("POST", "/v1/ledger/accounts", token, { companyId, code, name, type });
  }
  await call("POST", "/v1/ledger/fiscal-years", token, { companyId, startYear: 2026 });

  const accounts = { inventory: "1300", clearing: "2050", cogs: "5000", writeOff: "5100", countVariance: "5200" };
  const receipts = [
    { item: "PARA-500", batchNo: "PX-2026-03", expiresOn: "2026-03-10", qty: "20", unitCost: "2.50", reference: "E2E-PX" },
    { item: "PARA-500", batchNo: "PX-2026-12", expiresOn: "2026-12-01", qty: "15", unitCost: "3.00", reference: "E2E-PY" },
    { item: "PARA-500", batchNo: "PX-2027", expiresOn: "2027-06-30", qty: "40", unitCost: "2.00", reference: "E2E-PZ" },
    { item: "SOAP-100", batchNo: "SO-A", expiresOn: "2027-01-31", qty: "30", unitCost: "1.00", reference: "E2E-SO" },
  ];
  for (const row of receipts) {
    await call("POST", "/v1/inventory/receipts", token, {
      companyId,
      warehouse: "COUNTER",
      batchNo: row.batchNo,
      expiresOn: row.expiresOn,
      qty: row.qty,
      unitCost: row.unitCost,
      date: "2026-03-01",
      reference: row.reference,
      item: row.item,
      accounts,
    });
  }

  // One sale the payment does not cover, so the review queue has a sale to decide.
  await call("POST", "/v1/pos/sales/sync", token, {
    companyId,
    accounts: { cash: "1000", card: "1010", mobile: "1020", taxPayable: "2100", ...accounts },
    sales: [
      {
        id: "9a1f6c2e-3b4d-4e5f-8a6b-7c8d9e0f1a21",
        warehouse: "COUNTER",
        date: "2026-03-05",
        currency: "KES",
        lines: [
          { itemCode: "PARA-500", description: "Paracetamol 500mg", qty: "2", unitPrice: "10.00", taxRateBps: "1900", taxMode: "EXCLUSIVE", revenueAccount: "4000", tracked: true },
        ],
        tenders: [{ method: "CARD", amount: "5.00" }],
      },
    ],
  });
  console.log(`Seeded live tenant ${LIVE_TENANT.slug} (company ${companyId}).`);
}

// Runs only when this file is executed directly, not when a test imports LIVE_TENANT.
if (process.argv[1]?.endsWith("live-seed.mjs")) {
  seed().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
