import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { IdentityService } from "@erp/identity";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import { PgIdentityRepository, withTenantTransaction } from "@erp/db";
import { buildApp } from "../src/app";

const PLATFORM_KEY = "platform-key-for-tests-only-0123456789";
const PASSWORD = "correct-horse-battery";
// The catalog chain for POS-01 and the stock products (see pos.test.ts).
const PRODUCTS = ["MDM-02", "MDM-03", "MDM-04", "PLT-05", "PLT-06", "PLT-15", "FIN-01", "FIN-05", "INV-01", "INV-03", "POS-01"];
const ACCOUNTS = { inventory: "1300", clearing: "2050", cogs: "5000", writeOff: "5100", countVariance: "5200" };
const POS_ACCOUNTS = { cash: "1000", card: "1010", mobile: "1020", taxPayable: "2100", ...ACCOUNTS };

describe("inventory and POS workflows (transfers, approvals, counts, import, review)", () => {
  let db: TestDatabase;
  let app: FastifyInstance;
  let tenantId: string;
  let companyId: string;
  let ownerToken: string;
  let managerToken: string;

  const call = (method: "GET" | "POST", url: string, token: string | null, payload?: object) =>
    app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload });

  const login = async (email: string): Promise<string> => {
    const response = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { tenantSlug: "flow-co", email, password: PASSWORD } });
    return response.json().token as string;
  };

  async function trialBalanceRow(account: string) {
    const trial = await call("GET", `/v1/ledger/trial-balance?companyId=${companyId}&asOf=2026-12-31`, ownerToken);
    return trial.json().rows.find((row: { account: string }) => row.account === account) as
      | { debit: { amount: string }; credit: { amount: string } }
      | undefined;
  }

  const receipt = (overrides: Record<string, unknown>) => ({
    companyId,
    warehouse: "MAIN",
    batchNo: "B1",
    expiresOn: "2026-12-31",
    qty: "10",
    unitCost: "2.50",
    date: "2026-03-01",
    reference: `GRN-${Math.random().toString(36).slice(2, 10)}`,
    accounts: ACCOUNTS,
    ...overrides,
  });

  beforeAll(async () => {
    db = await startTestDatabase();
    app = buildApp({ pool: db.appPool, platformKey: PLATFORM_KEY });
    const created = await app.inject({
      method: "POST",
      url: "/v1/platform/tenants",
      headers: { "x-platform-key": PLATFORM_KEY },
      payload: {
        tenant: { slug: "flow-co", name: "Flow Co", region: "MEA" },
        company: { legalName: "Flow Co Ltd", countryCode: "KE", baseCurrency: "KES", fiscalYearStartMonth: 1 },
        admin: { email: "owner@flow.example", password: PASSWORD },
      },
    });
    expect(created.statusCode).toBe(201);
    tenantId = created.json().tenant.id;
    companyId = created.json().company.id;
    const enabled = await app.inject({
      method: "POST",
      url: `/v1/platform/tenants/${tenantId}/products`,
      headers: { "x-platform-key": PLATFORM_KEY },
      payload: { products: PRODUCTS },
    });
    expect(enabled.statusCode, enabled.body).toBe(200);

    // A second administrator, so one person can request and another can decide.
    await withTenantTransaction(db.appPool, tenantId, (tx) =>
      new IdentityService(new PgIdentityRepository(tx), tenantId).createUser({
        email: "manager@flow.example",
        password: PASSWORD,
        roles: ["tenant_admin"],
      }),
    );
    ownerToken = await login("owner@flow.example");
    managerToken = await login("manager@flow.example");

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
    ] as const) {
      const made = await call("POST", "/v1/ledger/accounts", ownerToken, { companyId, code, name, type });
      expect(made.statusCode).toBe(201);
    }
    expect((await call("POST", "/v1/ledger/fiscal-years", ownerToken, { companyId, startYear: 2026 })).statusCode).toBe(201);
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  it("transfers stock between warehouses, keeping the batch, its expiry and cost, with no change to the stock account", async () => {
    expect((await call("POST", "/v1/inventory/receipts", ownerToken, receipt({ item: "TR-ITEM", batchNo: "A", qty: "10", reference: "TR-GRN" }))).statusCode).toBe(201);
    const before = await trialBalanceRow("1300");

    const moved = await call("POST", "/v1/inventory/transfers", ownerToken, {
      companyId,
      fromWarehouse: "MAIN",
      toWarehouse: "BACK",
      item: "TR-ITEM",
      qty: "4",
      date: "2026-03-05",
      reference: "TR-1",
    });

    expect(moved.statusCode, moved.body).toBe(201);
    expect(moved.json().transferred).toBe("4");
    const batches = (await call("GET", `/v1/inventory/batches?companyId=${companyId}&item=TR-ITEM`, ownerToken)).json();
    const back = batches.find((batch: { warehouse: string }) => batch.warehouse === "BACK");
    expect(back).toMatchObject({ batchNo: "A", expiresOn: "2026-12-31", balance: "4", unitCost: { amount: "2.50", currency: "KES" } });
    expect(batches.find((batch: { warehouse: string }) => batch.warehouse === "MAIN")?.balance).toBe("6");
    expect(await trialBalanceRow("1300")).toEqual(before);
  });

  it("a write-off waits for a second person: the requester cannot approve it, and the approver's decision carries it out", async () => {
    expect((await call("POST", "/v1/inventory/receipts", ownerToken, receipt({ item: "WO-ITEM", batchNo: "OLD", expiresOn: "2026-03-10", qty: "5", reference: "WO-GRN" }))).statusCode).toBe(201);

    const requested = await call("POST", "/v1/inventory/write-offs", ownerToken, {
      companyId,
      warehouse: "MAIN",
      item: "WO-ITEM",
      date: "2026-03-11",
      reference: "WO-1",
      reason: "Expired on the shelf and destroyed as policy requires.",
      accounts: ACCOUNTS,
    });
    expect(requested.statusCode, requested.body).toBe(202);
    const approvalId = requested.json().id as string;
    expect(requested.json()).toMatchObject({ status: "PENDING", kind: "INVENTORY_WRITE_OFF" });
    const stillThere = (await call("GET", `/v1/inventory/batches?companyId=${companyId}&item=WO-ITEM`, ownerToken)).json();
    expect(stillThere[0].balance).toBe("5");

    const selfApproval = await call("POST", `/v1/approvals/${approvalId}/approve`, ownerToken, { companyId });
    expect(selfApproval.statusCode).toBe(403);

    const approved = await call("POST", `/v1/approvals/${approvalId}/approve`, managerToken, { companyId, note: "Confirmed expired." });
    expect(approved.statusCode, approved.body).toBe(200);
    expect(approved.json()).toMatchObject({ status: "APPROVED", effect: { written: true, cost: { amount: "12.50", currency: "KES" } } });
    const after = (await call("GET", `/v1/inventory/batches?companyId=${companyId}&item=WO-ITEM`, ownerToken)).json();
    expect(after[0].balance).toBe("0");
    expect((await trialBalanceRow("5100"))?.debit).toEqual({ amount: "12.50", currency: "KES" });
  });

  it("refuses to request a write-off when nothing has expired", async () => {
    const response = await call("POST", "/v1/inventory/write-offs", ownerToken, {
      companyId,
      warehouse: "MAIN",
      item: "WO-ITEM",
      date: "2026-03-11",
      reference: "WO-NONE",
      reason: "Checking whether anything is left to write off.",
      accounts: ACCOUNTS,
    });
    expect(response.statusCode).toBe(409);
  });

  it("a stock count is taken, submitted, rejected, reopened, and applied only when a second person approves", async () => {
    expect((await call("POST", "/v1/inventory/receipts", ownerToken, receipt({ warehouse: "COUNT-ROOM", item: "CT-ITEM", batchNo: "C", qty: "6", unitCost: "2.00", reference: "CT-GRN" }))).statusCode).toBe(201);

    const started = await call("POST", "/v1/inventory/counts", ownerToken, { companyId, warehouse: "COUNT-ROOM", date: "2026-03-05" });
    expect(started.statusCode, started.body).toBe(201);
    const count = started.json();
    expect(count.status).toBe("OPEN");
    // Counted blind: the expected quantity is withheld from the count while it is open.
    expect(count.lines[0]).not.toHaveProperty("expected");
    const batchId = count.lines[0].batchId as string;

    expect((await call("POST", `/v1/inventory/counts/${count.id}/lines`, ownerToken, { companyId, batchId, counted: "5" })).statusCode).toBe(200);
    const submitted = await call("POST", `/v1/inventory/counts/${count.id}/submit`, ownerToken, {
      companyId,
      reason: "Monthly count of the counter fridge.",
      accounts: ACCOUNTS,
    });
    expect(submitted.statusCode, submitted.body).toBe(202);
    expect(submitted.json().count.status).toBe("SUBMITTED");
    const firstApproval = submitted.json().approval.id as string;
    expect((await call("POST", `/v1/inventory/counts/${count.id}/submit`, ownerToken, { companyId, reason: "Submitting it again.", accounts: ACCOUNTS })).statusCode).toBe(409);

    const rejected = await call("POST", `/v1/approvals/${firstApproval}/reject`, managerToken, { companyId, note: "Recount the fridge tomorrow." });
    expect(rejected.statusCode).toBe(200);
    const reopened = (await call("GET", `/v1/inventory/counts?companyId=${companyId}`, ownerToken)).json().find((item: { id: string }) => item.id === count.id);
    expect(reopened.status).toBe("OPEN");

    const resubmitted = await call("POST", `/v1/inventory/counts/${count.id}/submit`, ownerToken, { companyId, reason: "Recounted and confirmed.", accounts: ACCOUNTS });
    expect(resubmitted.statusCode).toBe(202);
    const secondApproval = resubmitted.json().approval.id as string;
    expect((await call("POST", `/v1/approvals/${secondApproval}/approve`, ownerToken, { companyId })).statusCode).toBe(403);

    const applied = await call("POST", `/v1/approvals/${secondApproval}/approve`, managerToken, { companyId });
    expect(applied.statusCode, applied.body).toBe(200);
    expect(applied.json().effect).toMatchObject({ countStatus: "APPLIED", adjustments: 1, netValue: { amount: "-2.00", currency: "KES" } });
    expect((await trialBalanceRow("5200"))?.debit).toEqual({ amount: "2.00", currency: "KES" });
    const batches = (await call("GET", `/v1/inventory/batches?companyId=${companyId}&item=CT-ITEM`, ownerToken)).json();
    expect(batches[0].balance).toBe("5");
  });

  it("imports receipts from a CSV: a dry run writes nothing, the real import reconciles to the ledger, and a repeat creates nothing", async () => {
    const csv = [
      "warehouse,item,batch_no,expires_on,qty,unit_cost,date,reference",
      "MAIN,IM-ITEM,I1,2026-12-31,4,1.50,2026-03-01,IMP-1",
      "MAIN,IM-ITEM,I2,,3,1.50,2026-03-01,IMP-2",
    ].join("\n");
    const query = `companyId=${companyId}&inventory=1300&clearing=2050&cogs=5000&writeOff=5100`;
    const upload = (url: string) =>
      app.inject({ method: "POST", url, headers: { authorization: `Bearer ${ownerToken}`, "content-type": "text/csv" }, payload: csv });

    const dry = await upload(`/v1/inventory/imports/receipts?${query}`);
    expect(dry.statusCode, dry.body).toBe(200);
    expect(dry.json()).toMatchObject({ rows: 2, applied: false, totalQty: "7", totalValue: { amount: "10.50", currency: "KES" } });
    expect((await call("GET", `/v1/inventory/batches?companyId=${companyId}&item=IM-ITEM`, ownerToken)).json()).toEqual([]);

    const real = await upload(`/v1/inventory/imports/receipts?${query}&dryRun=false`);
    expect(real.statusCode, real.body).toBe(200);
    expect(real.json()).toMatchObject({ applied: true, created: 2, repeated: 0, createdValue: { amount: "10.50", currency: "KES" } });
    expect(real.json().reconciliation).toMatchObject({ change: { amount: "10.50", currency: "KES" }, reconciled: true });

    const repeat = await upload(`/v1/inventory/imports/receipts?${query}&dryRun=false`);
    expect(repeat.json()).toMatchObject({ applied: true, created: 0, repeated: 2 });
    expect(repeat.json().reconciliation).toMatchObject({ change: { amount: "0.00", currency: "KES" }, reconciled: true });
  });

  it("a file with a bad row is not imported at all, and the error names the file row", async () => {
    const csv = [
      "warehouse,item,batch_no,expires_on,qty,unit_cost,date,reference",
      "MAIN,BAD-ITEM,G1,2026-12-31,2,1.50,2026-03-01,BAD-1",
      "MAIN,BAD-ITEM,G2,2026-12-31,ten,1.50,2026-03-01,BAD-2",
    ].join("\n");
    const response = await app.inject({
      method: "POST",
      url: `/v1/inventory/imports/receipts?companyId=${companyId}&inventory=1300&clearing=2050&cogs=5000&writeOff=5100&dryRun=false`,
      headers: { authorization: `Bearer ${ownerToken}`, "content-type": "text/csv" },
      payload: csv,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().applied).toBe(false);
    expect(response.json().errors.map((error: { row: number }) => error.row)).toEqual([2]);
    expect((await call("GET", `/v1/inventory/batches?companyId=${companyId}&item=BAD-ITEM`, ownerToken)).json()).toEqual([]);
  });

  it("a sale above the bill-discount threshold is kept for review until a manager approves the discount, then posted", async () => {
    expect((await call("POST", "/v1/inventory/receipts", ownerToken, receipt({ warehouse: "COUNTER", item: "PARA-500", batchNo: "P", qty: "20", reference: "PARA-GRN" }))).statusCode).toBe(201);
    const saleId = "5f0d2c1e-7a5b-4c1d-9e2f-0a1b2c3d4e51";
    const synced = await call("POST", "/v1/pos/sales/sync", ownerToken, {
      companyId,
      accounts: POS_ACCOUNTS,
      discountApprovalAbove: "5.00",
      sales: [
        {
          id: saleId,
          warehouse: "COUNTER",
          date: "2026-03-05",
          currency: "KES",
          lines: [{ itemCode: "PARA-500", description: "Paracetamol", qty: "2", unitPrice: "10.00", taxRateBps: "1900", taxMode: "EXCLUSIVE", revenueAccount: "4000", tracked: true }],
          tenders: [{ method: "CASH", amount: "11.90" }],
          billDiscount: { amount: "10.00", reason: "Loyalty card" },
        },
      ],
    });
    expect(synced.statusCode, synced.body).toBe(200);
    expect(synced.json().results[0]).toMatchObject({ status: "NEEDS_REVIEW", reasons: ["DISCOUNT_NEEDS_APPROVAL"] });
    const stillThere = (await call("GET", `/v1/inventory/batches?companyId=${companyId}&item=PARA-500&warehouse=COUNTER`, ownerToken)).json();
    expect(stillThere[0].balance).toBe("20");

    const request = await call("POST", "/v1/approvals", ownerToken, {
      companyId,
      kind: "POS_BILL_DISCOUNT",
      reason: "Loyalty card discount agreed by the store manager.",
      payload: { saleId, amount: "10.00" },
    });
    expect(request.statusCode).toBe(201);
    const approved = await call("POST", `/v1/approvals/${request.json().id}/approve`, managerToken, { companyId });
    expect(approved.statusCode).toBe(200);

    const reviewed = await call("POST", `/v1/pos/sales/${saleId}/review`, ownerToken, {
      companyId,
      decision: "POST",
      reason: "Manager approved the loyalty discount.",
      billDiscountApprovalId: request.json().id,
      discountApprovalAbove: "5.00",
      accounts: POS_ACCOUNTS,
    });
    expect(reviewed.statusCode, reviewed.body).toBe(200);
    expect(reviewed.json()).toMatchObject({
      sale: { effectiveStatus: "POSTED", billDiscountApprovedBy: null, billDiscount: { amount: "10.00", currency: "KES" } },
      decision: { decision: "POSTED", postedOn: "2026-03-05", cost: { amount: "5.00", currency: "KES" } },
    });
    const afterPost = (await call("GET", `/v1/inventory/batches?companyId=${companyId}&item=PARA-500&warehouse=COUNTER`, ownerToken)).json();
    expect(afterPost[0].balance).toBe("18");
  });

  it("a sale dated in a period that is not open is kept for review, then posted on an open date", async () => {
    const saleId = "5f0d2c1e-7a5b-4c1d-9e2f-0a1b2c3d4e52";
    const synced = await call("POST", "/v1/pos/sales/sync", ownerToken, {
      companyId,
      accounts: POS_ACCOUNTS,
      sales: [
        {
          id: saleId,
          warehouse: "COUNTER",
          date: "2025-06-10",
          currency: "KES",
          lines: [{ itemCode: "PARA-500", description: "Paracetamol", qty: "1", unitPrice: "10.00", taxRateBps: "1900", taxMode: "EXCLUSIVE", revenueAccount: "4000", tracked: true }],
          tenders: [{ method: "CASH", amount: "11.90" }],
        },
      ],
    });
    expect(synced.json().results[0]).toMatchObject({ status: "NEEDS_REVIEW" });
    expect(synced.json().results[0].reasons[0]).toMatch(/^PERIOD_CLOSED/);

    const posted = await call("POST", `/v1/pos/sales/${saleId}/review`, ownerToken, {
      companyId,
      decision: "POST",
      reason: "Entered late; posting to the open period.",
      date: "2026-03-10",
      accounts: POS_ACCOUNTS,
    });
    expect(posted.statusCode, posted.body).toBe(200);
    expect(posted.json().decision).toMatchObject({ postedOn: "2026-03-10" });
    expect(posted.json().decision.number).toMatch(/^POS-2026-/);

    const again = await call("POST", `/v1/pos/sales/${saleId}/review`, ownerToken, {
      companyId,
      decision: "VOID",
      reason: "Trying to void a sale already posted.",
      accounts: POS_ACCOUNTS,
    });
    expect(again.statusCode).toBe(409);
  });

  it("a sale still short of payment is refused for review until the payments are reconciled; a sale can be voided", async () => {
    const shortId = "5f0d2c1e-7a5b-4c1d-9e2f-0a1b2c3d4e53";
    const voidId = "5f0d2c1e-7a5b-4c1d-9e2f-0a1b2c3d4e54";
    const line = [{ itemCode: "PARA-500", description: "Paracetamol", qty: "1", unitPrice: "10.00", taxRateBps: "1900", taxMode: "EXCLUSIVE", revenueAccount: "4000", tracked: true }];
    const synced = await call("POST", "/v1/pos/sales/sync", ownerToken, {
      companyId,
      accounts: POS_ACCOUNTS,
      sales: [
        { id: shortId, warehouse: "COUNTER", date: "2026-03-05", currency: "KES", lines: line, tenders: [{ method: "CARD", amount: "1.00" }] },
        { id: voidId, warehouse: "COUNTER", date: "2026-03-05", currency: "KES", lines: line, tenders: [{ method: "CARD", amount: "1.00" }] },
      ],
    });
    expect(synced.json().results.map((r: { status: string }) => r.status)).toEqual(["NEEDS_REVIEW", "NEEDS_REVIEW"]);

    const refused = await call("POST", `/v1/pos/sales/${shortId}/review`, ownerToken, { companyId, decision: "POST", reason: "Card terminal total reconciled.", accounts: POS_ACCOUNTS });
    expect(refused.statusCode).toBe(409);
    expect(refused.json().reasons).toEqual(["PAYMENT_SHORT"]);

    const reconciled = await call("POST", `/v1/pos/sales/${shortId}/review`, ownerToken, {
      companyId,
      decision: "POST",
      reason: "Card terminal total reconciled.",
      tenders: [{ method: "CASH", amount: "11.90" }],
      accounts: POS_ACCOUNTS,
    });
    expect(reconciled.statusCode, reconciled.body).toBe(200);
    expect(reconciled.json().decision.tenders).toEqual([{ method: "CASH", amount: { amount: "11.90", currency: "KES" } }]);

    const voided = await call("POST", `/v1/pos/sales/${voidId}/review`, ownerToken, {
      companyId,
      decision: "VOID",
      reason: "Duplicate of a sale already recorded.",
      accounts: POS_ACCOUNTS,
    });
    expect(voided.statusCode).toBe(200);
    expect(voided.json().sale.effectiveStatus).toBe("VOIDED");

    const pending = (await call("GET", `/v1/pos/sales?companyId=${companyId}&status=NEEDS_REVIEW&pending=true`, ownerToken)).json();
    const ids = pending.map((sale: { id: string }) => sale.id);
    expect(ids).not.toContain(shortId);
    expect(ids).not.toContain(voidId);
  });
});
