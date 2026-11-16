import { describe, expect, it } from "vitest";
import { DomainError } from "@erp/kernel";
import {
  MemoryItemStore,
  MemoryPartyStore,
  createItem,
  createParty,
  deactivateParty,
  validateItem,
  validateParty,
} from "../src";

const COMPANY = "11111111-1111-7111-8111-111111111111";
const OTHER_COMPANY = "22222222-2222-7222-8222-222222222222";

describe("party validation", () => {
  it("trims names and normalises the currency, and turns empty optional fields into null", () => {
    const party = validateParty({ kind: "CUSTOMER", name: "  Blue Hills Cafe  ", taxId: " P051234567X ", email: " ", currency: "kes" });
    expect(party).toEqual({ kind: "CUSTOMER", name: "Blue Hills Cafe", taxId: "P051234567X", email: null, currency: "KES" });
  });

  it("rejects an unknown kind, an empty name, a bad tax ID, a bad email and a bad currency", () => {
    expect(() => validateParty({ kind: "VENDOR" as never, name: "A" })).toThrow(DomainError);
    expect(() => validateParty({ kind: "CUSTOMER", name: "   " })).toThrow(DomainError);
    expect(() => validateParty({ kind: "CUSTOMER", name: "A", taxId: "bad id!" })).toThrow(DomainError);
    expect(() => validateParty({ kind: "CUSTOMER", name: "A", email: "not-an-email" })).toThrow(DomainError);
    expect(() => validateParty({ kind: "CUSTOMER", name: "A", currency: "KE" })).toThrow(DomainError);
  });
});

describe("parties", () => {
  it("creates a party and refuses a second party with the same tax ID in the same company", async () => {
    const store = new MemoryPartyStore();
    const first = await createParty(store, COMPANY, { kind: "CUSTOMER", name: "Blue Hills", taxId: "T-1" });
    expect(first).toMatchObject({ active: true, companyId: COMPANY });
    await expect(createParty(store, COMPANY, { kind: "SUPPLIER", name: "Other", taxId: "T-1" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("allows the same tax ID in another company", async () => {
    const store = new MemoryPartyStore();
    await createParty(store, COMPANY, { kind: "CUSTOMER", name: "Blue Hills", taxId: "T-1" });
    const elsewhere = await createParty(store, OTHER_COMPANY, { kind: "CUSTOMER", name: "Blue Hills", taxId: "T-1" });
    expect(elsewhere.companyId).toBe(OTHER_COMPANY);
  });

  it("deactivates a party and does not show it to another company", async () => {
    const store = new MemoryPartyStore();
    const party = await createParty(store, COMPANY, { kind: "BOTH", name: "Kamau Stores" });
    const off = await deactivateParty(store, COMPANY, party.id);
    expect(off.active).toBe(false);
    expect(await store.get(OTHER_COMPANY, party.id)).toBeUndefined();
  });

  it("refuses to deactivate a party that does not exist", async () => {
    await expect(deactivateParty(new MemoryPartyStore(), COMPANY, "33333333-3333-7333-8333-333333333333")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("items", () => {
  it("normalises the code and unit, and refuses a duplicate code in the same company", async () => {
    expect(validateItem({ code: " milk.1l ", name: "Milk 1 L", unit: "ea", revenueAccount: "4000" })).toEqual({
      code: "MILK.1L",
      name: "Milk 1 L",
      unit: "EA",
      revenueAccount: "4000",
    });
    const store = new MemoryItemStore();
    await createItem(store, COMPANY, { code: "MILK", name: "Milk", unit: "L" });
    await expect(createItem(store, COMPANY, { code: "milk", name: "Milk again", unit: "L" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects a code with spaces and a unit with digits", () => {
    expect(() => validateItem({ code: "BAD CODE", name: "x", unit: "EA" })).toThrow(DomainError);
    expect(() => validateItem({ code: "OK", name: "x", unit: "K9" })).toThrow(DomainError);
  });
});
