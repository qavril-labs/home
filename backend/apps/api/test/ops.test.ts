import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import { buildApp } from "../src/app";

const PLATFORM_KEY = "platform-key-for-tests-only-0123456789";

describe("operations basics", () => {
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

  it("reports ready when the database answers", async () => {
    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ready" });
  });

  it("reports unavailable when the database cannot be reached", async () => {
    const broken = buildApp({ pool: { query: async () => { throw new Error("down"); } } as never, platformKey: PLATFORM_KEY });
    const response = await broken.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(503);
    await broken.close();
  });

  it("echoes a well-formed request id and generates one otherwise", async () => {
    const given = await app.inject({ method: "GET", url: "/health", headers: { "x-request-id": "req-abc-12345" } });
    expect(given.headers["x-request-id"]).toBe("req-abc-12345");
    const generated = await app.inject({ method: "GET", url: "/health", headers: { "x-request-id": "bad id with spaces" } });
    expect(generated.headers["x-request-id"]).not.toBe("bad id with spaces");
    expect(generated.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("sends security headers on every response, including errors", async () => {
    for (const response of [
      await app.inject({ method: "GET", url: "/health" }),
      await app.inject({ method: "GET", url: "/v1/me" }),
    ]) {
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["x-frame-options"]).toBe("DENY");
      expect(response.headers["referrer-policy"]).toBe("no-referrer");
      expect(response.headers["content-security-policy"]).toBe("default-src 'none'; frame-ancestors 'none'");
      expect(response.headers["strict-transport-security"]).toBe("max-age=31536000");
    }
  });

  it("stops signed-in responses from being cached, but leaves public CMS cacheable", async () => {
    const signedIn = await app.inject({ method: "GET", url: "/v1/me" });
    expect(signedIn.headers["cache-control"]).toBe("no-store");
    const cms = await app.inject({ method: "GET", url: "/v1/public/cms/faqs" });
    expect(cms.headers["cache-control"]).toBeUndefined();
  });

  it("refuses bodies over 256 KB before parsing them", async () => {
    const huge = "x".repeat(300 * 1024);
    const response = await app.inject({
      method: "POST",
      url: "/v1/public/leads",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ name: huge, email: "a@b.co", interest: "demo", consent: true }),
    });
    expect(response.statusCode).toBe(413);
  });
});
