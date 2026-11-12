import { describe, expect, it } from "vitest";
import { DomainError, FixedClock, newId } from "@erp/kernel";
import {
  IdentityService,
  InMemoryIdentityRepository,
  createSessionToken,
  expandRoles,
  hasPermission,
  hashPassword,
  tenantFromToken,
  verifyPassword,
} from "../src";

const PASSWORD = "correct-horse-battery";

describe("passwords", () => {
  it("hash and verify without storing the password", async () => {
    const stored = await hashPassword(PASSWORD);
    expect(stored).not.toContain(PASSWORD);
    expect(await verifyPassword(PASSWORD, stored)).toBe(true);
    expect(await verifyPassword("wrong-password-value", stored)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword(PASSWORD)).not.toBe(await hashPassword(PASSWORD));
  });

  it("enforces a minimum length", async () => {
    await expect(hashPassword("short")).rejects.toThrow(DomainError);
  });

  it("returns false for malformed stored hashes", async () => {
    expect(await verifyPassword(PASSWORD, "not-a-hash")).toBe(false);
  });
});

describe("permissions", () => {
  it("matches exact, wildcard, and global grants", () => {
    expect(hasPermission(["fin.journal.post"], "fin.journal.post")).toBe(true);
    expect(hasPermission(["fin.*"], "fin.journal.post")).toBe(true);
    expect(hasPermission(["fin.*"], "sal.order.read")).toBe(false);
    expect(hasPermission(["*"], "anything.at.all")).toBe(true);
    expect(hasPermission(["fin.journal.read"], "fin.journal.post")).toBe(false);
  });

  it("expands roles into a sorted, de-duplicated list", () => {
    expect(expandRoles(["accountant", "accountant"])).toEqual(["fin.*", "prc.*", "sal.*"]);
    expect(expandRoles(["unknown-role"])).toEqual([]);
  });
});

describe("session tokens", () => {
  it("embed the tenant so the server can pick the right context", () => {
    const tenant = newId();
    const token = createSessionToken(tenant);
    expect(tenantFromToken(token)).toBe(tenant);
    expect(tenantFromToken("not-a-token")).toBeNull();
    expect(tenantFromToken(`${newId()}`)).toBeNull();
  });
});

describe("IdentityService", () => {
  const tenantId = newId();
  const clock = new FixedClock(new Date("2026-03-01T09:00:00Z"));

  function setup() {
    const repo = new InMemoryIdentityRepository();
    const service = new IdentityService(repo, tenantId, clock);
    return { repo, service };
  }

  it("creates users with normalized emails and no password in the response", async () => {
    const { service } = setup();
    const user = await service.createUser({ email: " Ada@Example.COM ", password: PASSWORD, roles: ["tenant_admin"] });
    expect(user.email).toBe("ada@example.com");
    expect("passwordHash" in user).toBe(false);
  });

  it("rejects duplicate emails and unknown roles", async () => {
    const { service } = setup();
    await service.createUser({ email: "ada@example.com", password: PASSWORD, roles: [] });
    await expect(service.createUser({ email: "ADA@example.com", password: PASSWORD, roles: [] })).rejects.toThrow(
      /already registered/,
    );
    await expect(service.createUser({ email: "bo@example.com", password: PASSWORD, roles: ["god"] })).rejects.toThrow(
      /Unknown roles/,
    );
  });

  it("logs in, authenticates the session, and logs out", async () => {
    const { service } = setup();
    await service.createUser({ email: "ada@example.com", password: PASSWORD, roles: ["tenant_admin"] });

    const session = await service.login("ada@example.com", PASSWORD);
    expect(session.principal.permissions).toEqual(["*"]);
    expect((await service.authenticate(session.token)).userId).toBe(session.principal.userId);

    await service.logout(session.token);
    await expect(service.authenticate(session.token)).rejects.toThrow(/invalid or expired/);
  });

  it("gives the same error for unknown users and wrong passwords", async () => {
    const { service } = setup();
    await service.createUser({ email: "ada@example.com", password: PASSWORD, roles: [] });
    const wrongPassword = service.login("ada@example.com", "definitely-wrong-password");
    const unknownUser = service.login("nobody@example.com", PASSWORD);
    await expect(wrongPassword).rejects.toThrow("Invalid credentials");
    await expect(unknownUser).rejects.toThrow("Invalid credentials");
  });

  it("expires sessions after the TTL", async () => {
    const repo = new InMemoryIdentityRepository();
    const service = new IdentityService(repo, tenantId, clock, 60_000);
    await service.createUser({ email: "ada@example.com", password: PASSWORD, roles: [] });
    const session = await service.login("ada@example.com", PASSWORD);

    clock.advance(60_001);
    await expect(service.authenticate(session.token)).rejects.toThrow(/expired/);
  });

  it("stores only the hash of the session token", async () => {
    const repo = new InMemoryIdentityRepository();
    const service = new IdentityService(repo, tenantId, clock);
    await service.createUser({ email: "ada@example.com", password: PASSWORD, roles: [] });
    const session = await service.login("ada@example.com", PASSWORD);
    expect(await repo.findSession(session.token)).toBeNull();
  });

  it("refuses a session that belongs to another tenant", async () => {
    const repo = new InMemoryIdentityRepository();
    const service = new IdentityService(repo, tenantId, clock);
    await service.createUser({ email: "ada@example.com", password: PASSWORD, roles: [] });
    const session = await service.login("ada@example.com", PASSWORD);

    const otherTenant = new IdentityService(repo, newId(), clock);
    await expect(otherTenant.authenticate(session.token)).rejects.toThrow(/invalid or expired/);
  });
});
