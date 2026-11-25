import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import type { Clock } from "@erp/kernel";
import { buildApp } from "../src/app";

const PLATFORM_KEY = "platform-key-for-tests-only-0123456789";
const clock: Clock = { now: () => new Date("2026-11-10T09:00:00Z") };

describe("idempotent quick entries", () => {
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
        name: "Idem Owner", email: "idem@example.com", password: "a long idempotency password", company: "Idem Shop",
        countryCode: "US", baseCurrency: "USD", region: "US", consent: true,
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
  const post = (payload: object, key?: string) =>
    app.inject({
      method: "POST",
      url: "/v1/workspace/quick-entries",
      headers: { ...auth(), ...(key ? { "idempotency-key": key } : {}) },
      payload,
    });
  const capital = { kind: "owner_investment", amount: "100.00", date: "2026-11-01", via: "1100", memo: "Capital" };
  const monthEntries = async () =>
    (await app.inject({ method: "GET", url: "/v1/workspace/insights", headers: auth() })).json().insights.entriesThisMonth as number;

  it("posts once when the same key is sent twice, and returns the same reference", async () => {
    const first = await post(capital, "idem-key-0001");
    const second = await post(capital, "idem-key-0001");
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.json()).toEqual(first.json());
    expect(await monthEntries()).toBe(1);
  });

  it("refuses a reused key for a different request", async () => {
    const other = await post({ ...capital, amount: "250.00" }, "idem-key-0001");
    expect(other.statusCode).toBe(409);
    expect(other.json().error.code).toBe("CONFLICT");
    expect(await monthEntries()).toBe(1);
  });

  it("treats requests with no key as independent, as before", async () => {
    expect((await post(capital)).statusCode).toBe(201);
    expect((await post(capital)).statusCode).toBe(201);
    expect(await monthEntries()).toBe(3);
  });

  it("refuses a malformed key", async () => {
    const response = await post(capital, "bad key!");
    expect(response.statusCode).toBe(400);
  });

  it("releases the key when the write fails, so the corrected request can use it", async () => {
    const failed = await post({ ...capital, amount: "0" }, "idem-key-0002");
    expect(failed.statusCode).toBe(400);
    const retried = await post(capital, "idem-key-0002");
    expect(retried.statusCode).toBe(201);
    expect(await monthEntries()).toBe(4);
  });

  it("does not let one tenant's key collide with another's", async () => {
    const signup = await app.inject({
      method: "POST",
      url: "/v1/public/signup",
      payload: {
        name: "Other Owner", email: "other-idem@example.com", password: "another long idempotency password", company: "Other Shop",
        countryCode: "US", baseCurrency: "USD", region: "US", consent: true,
      },
    });
    const otherToken = signup.json().session.token;
    const response = await app.inject({
      method: "POST",
      url: "/v1/workspace/quick-entries",
      headers: { authorization: `Bearer ${otherToken}`, "idempotency-key": "idem-key-0001" },
      payload: { ...capital, amount: "999.00" },
    });
    expect(response.statusCode).toBe(201);
  });
});
