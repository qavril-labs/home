import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import { buildApp } from "../src/app";

const PLATFORM_KEY = "platform-key-for-tests-only-0123456789";

describe("live event stream tickets", () => {
  let db: TestDatabase;
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    db = await startTestDatabase();
    app = buildApp({ pool: db.appPool, platformKey: PLATFORM_KEY, signupRateLimit: { max: 50, windowMs: 600_000 } });
    const signup = await app.inject({
      method: "POST",
      url: "/v1/public/signup",
      payload: {
        name: "Stream Owner", email: "stream@example.com", password: "a long stream test password",
        company: "Stream Shop", countryCode: "US", baseCurrency: "USD", region: "US", consent: true,
      },
    });
    expect(signup.statusCode).toBe(201);
    token = signup.json().session.token;
  }, 600_000);

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  it("issues a ticket only to a signed-in user", async () => {
    expect((await app.inject({ method: "POST", url: "/v1/events/tickets" })).statusCode).toBe(401);
    const issued = await app.inject({ method: "POST", url: "/v1/events/tickets", headers: { authorization: `Bearer ${token}` } });
    expect(issued.statusCode).toBe(200);
    expect(issued.json().ticket).toMatch(/^[A-Za-z0-9_-]{30,}$/);
    expect(issued.json().ticket).not.toContain(token);
    expect(issued.json().expiresInSeconds).toBe(60);
  });

  it("refuses the stream with no credential, an unknown ticket, or the session token in the URL", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/events/stream" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/v1/events/stream?ticket=unknown-ticket-value-12345" })).statusCode).toBe(401);
    // The session token is never accepted in a URL, neither as a ticket nor as the legacy token parameter.
    expect((await app.inject({ method: "GET", url: `/v1/events/stream?ticket=${token}` })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: `/v1/events/stream?token=${token}` })).statusCode).toBe(401);
  });
});
