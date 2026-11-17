import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import { buildApp } from "../src/app";

const PLATFORM_KEY = "platform-key-for-tests-only-0123456789";

describe("CMS admin key", () => {
  let db: TestDatabase;
  let app: FastifyInstance;

  beforeAll(async () => {
    db = await startTestDatabase();
    app = buildApp({ pool: db.appPool, platformKey: PLATFORM_KEY });
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  it("refuses the admin routes with no key, a wrong key, or a key of the wrong length", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/admin/cms/overview" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/v1/admin/cms/overview", headers: { "x-admin-key": "wrong" } })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/v1/admin/cms/overview", headers: { "x-admin-key": PLATFORM_KEY + "x" } })).statusCode).toBe(401);
  });

  it("accepts the key in the header or as a bearer token", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/admin/cms/overview", headers: { "x-admin-key": PLATFORM_KEY } })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/v1/admin/cms/overview", headers: { authorization: `Bearer ${PLATFORM_KEY}` } })).statusCode).toBe(200);
  });

  it("verifies the key through the auth route without accepting a missing one", async () => {
    expect((await app.inject({ method: "POST", url: "/v1/admin/cms/auth/verify", payload: {} })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/v1/admin/cms/auth/verify", payload: { key: PLATFORM_KEY } })).statusCode).toBe(200);
  });
});
