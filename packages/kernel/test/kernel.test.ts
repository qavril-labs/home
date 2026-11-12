import { describe, expect, it } from "vitest";
import { DomainError, FixedClock, isUuid, newId } from "../src";

describe("newId", () => {
  it("produces version 7 UUIDs", () => {
    const id = newId(1_700_000_000_000);
    expect(isUuid(id)).toBe(true);
    expect(id[14]).toBe("7");
  });

  it("sorts by creation time", () => {
    expect(newId(1_000_000) < newId(2_000_000)).toBe(true);
  });

  it("generates unique values", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(ids.size).toBe(1000);
  });
});

describe("DomainError", () => {
  it("maps error codes to HTTP statuses", () => {
    expect(new DomainError("CONFLICT", "duplicate").httpStatus).toBe(409);
    expect(new DomainError("UNAUTHENTICATED", "no session").httpStatus).toBe(401);
    expect(new DomainError("NOT_LICENSED", "module off").httpStatus).toBe(403);
  });
});

describe("FixedClock", () => {
  it("only moves when advanced", () => {
    const clock = new FixedClock(new Date("2026-01-01T00:00:00Z"));
    clock.advance(60_000);
    expect(clock.now().toISOString()).toBe("2026-01-01T00:01:00.000Z");
  });
});
