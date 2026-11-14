import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import type { Clock } from "@erp/kernel";
import { buildApp } from "../src/app";
import { STARTER_ACCOUNTS, fiscalStartYear } from "../src/workspace";

const PLATFORM_KEY = "platform-key-for-tests-only-0123456789";
const clock: Clock = { now: () => new Date("2026-11-10T09:00:00Z") };

describe("fiscalStartYear", () => {
  it("uses this year once the start month has passed, last year before it", () => {
    expect(fiscalStartYear("2026-11-10", 1)).toBe(2026);
    expect(fiscalStartYear("2026-03-31", 4)).toBe(2025);
    expect(fiscalStartYear("2026-04-01", 4)).toBe(2026);
  });
});

describe("app dashboard routes", () => {
  let db: TestDatabase;
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    db = await startTestDatabase();
    app = buildApp({ pool: db.appPool, platformKey: PLATFORM_KEY, clock, signupRateLimit: { max: 50, windowMs: 600_000 } });
    const signup = await app.inject({
      method: "POST",
      url: "/v1/public/signup",
      payload: {
        name: "Dash Owner", email: "dash@example.com", password: "a long dashboard password", company: "Dash Shop",
        countryCode: "KE", baseCurrency: "KES", region: "MEA", consent: true,
      },
    });
    expect(signup.statusCode).toBe(201);
    token = signup.json().session.token;
  }, 600_000);

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  const auth = () => ({ authorization: `Bearer ${token}` });
  const overview = async () => (await app.inject({ method: "GET", url: "/v1/workspace/overview", headers: auth() })).json();
  const quick = (payload: object) => app.inject({ method: "POST", url: "/v1/workspace/quick-entries", headers: auth(), payload });

  it("starts a new workspace with the ledger on, starter accounts and zero totals", async () => {
    const body = await overview();
    expect(body.booksReady).toBe(true);
    expect(body.products).toEqual(expect.arrayContaining(["FIN-01", "MDM-03"]));
    expect(body.accounts).toHaveLength(STARTER_ACCOUNTS.length);
    expect(body.totals).toEqual({ cash: "0.00", revenue: "0.00", expenses: "0.00", profit: "0.00", receivable: "0.00", payable: "0.00" });
    expect(body.trend).toHaveLength(6);
    expect(body.trend[5].month).toBe("2026-11");
  });

  it("posts a sale, an expense and owner money, and the totals stay balanced", async () => {
    expect((await quick({ kind: "owner_investment", amount: "10000", date: "2026-11-01", via: "1100" })).statusCode).toBe(201);
    const sale = await quick({ kind: "sale", amount: "2500.50", date: "2026-11-05", via: "1000", account: "4000", memo: "Market day" });
    expect(sale.statusCode).toBe(201);
    expect(sale.json().reference).toBe("QE-2026-00002");
    expect((await quick({ kind: "expense", amount: "800", date: "2026-11-06", via: "1100", account: "6000" })).statusCode).toBe(201);

    const body = await overview();
    expect(body.totals.cash).toBe("11700.50");
    expect(body.totals.revenue).toBe("2500.50");
    expect(body.totals.expenses).toBe("800.00");
    expect(body.totals.profit).toBe("1700.50");
    expect(body.trend[5]).toEqual({ month: "2026-11", revenue: "2500.50", expenses: "800.00" });
    // Newest first: the 6 November rent, then the 5 November sale, then the owner money.
    expect(body.recent.map((e: { date: string }) => e.date)).toEqual(["2026-11-06", "2026-11-05", "2026-11-01"]);
    expect(body.recent[1].memo).toBe("Market day");
    const equity = body.accounts.find((a: { code: string }) => a.code === "3000");
    expect(equity.balance).toBe("10000.00");
  });

  it("rejects an expense posted to an income account, a zero amount and a bad amount", async () => {
    expect((await quick({ kind: "expense", amount: "10", date: "2026-11-06", via: "1100", account: "4000" })).statusCode).toBe(400);
    expect((await quick({ kind: "sale", amount: "0", date: "2026-11-06", via: "1100" })).statusCode).toBe(400);
    expect((await quick({ kind: "sale", amount: "1,000", date: "2026-11-06", via: "1100" })).statusCode).toBe(400);
  });

  it("tracks credit sales, customer payments and bills, and feeds the bot figures", async () => {
    expect((await quick({ kind: "sale", amount: "300", date: "2026-11-07", via: "1200", memo: "Invoice for Acme" })).statusCode).toBe(201);
    expect((await quick({ kind: "customer_payment", amount: "100", date: "2026-11-08", via: "1100", memo: "Acme part payment" })).statusCode).toBe(201);
    expect((await quick({ kind: "expense", amount: "50", date: "2026-11-08", via: "2000", account: "6200", memo: "Power bill" })).statusCode).toBe(201);
    // Same date, amount and note twice: Guard Gus should see it.
    await quick({ kind: "expense", amount: "20", date: "2026-11-09", via: "1000", account: "6900", memo: "Taxi" });
    await quick({ kind: "expense", amount: "20", date: "2026-11-09", via: "1000", account: "6900", memo: "Taxi" });
    expect((await quick({ kind: "customer_payment", amount: "10", date: "2026-11-09", via: "1200" })).statusCode).toBe(400);
    expect((await quick({ kind: "sale", amount: "10", date: "2026-11-09", via: "2000" })).statusCode).toBe(400);

    const body = await overview();
    expect(body.totals.receivable).toBe("200.00");
    expect(body.totals.payable).toBe("50.00");
    expect(body.insights.duplicates).toHaveLength(1);
    expect(body.insights.duplicates[0].date).toBe("2026-11-09");
    expect(body.insights.largestExpense.amount).toBe("800.00");
    expect(body.insights.entriesThisMonth).toBe(8);
    expect(body.insights.entriesWithoutNote).toBe(2);
  });

  it("is idempotent when setting up starter books again", async () => {
    const again = await app.inject({ method: "POST", url: "/v1/workspace/starter-books", headers: auth() });
    expect(again.statusCode).toBe(201);
    expect((await overview()).accounts).toHaveLength(STARTER_ACCOUNTS.length);
  });

  it("needs a session", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/workspace/overview" })).statusCode).toBe(401);
  });
});
