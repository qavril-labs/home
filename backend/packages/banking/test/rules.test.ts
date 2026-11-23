import { describe, expect, it } from "vitest";
import { DEFAULT_RULE, fromMinor, matchLine, toMinor, validateRule, type BankLineInput, type BankRule, type OpenDocument } from "../src";

const rule = (over: Partial<BankRule> = {}): BankRule => ({
  id: "r1", name: "Rule", priority: 10, active: true, direction: "ANY",
  descriptionContains: null, amountMinMinor: null, amountMaxMinor: null,
  matchOn: "amount", amountToleranceMinor: 0n, confidence: 90, ...over,
});
const inv = (number: string, minor: bigint): OpenDocument => ({ kind: "invoice", number, partyName: "Acme", outstandingMinor: minor });
const bill = (number: string, minor: bigint): OpenDocument => ({ kind: "bill", number, partyName: "Supplier", outstandingMinor: minor });
const lineIn = (amountMinor: bigint, over: Partial<BankLineInput> = {}): BankLineInput => ({
  reference: "REF1", description: "Payment received", direction: "IN", amountMinor, ...over,
});

describe("money handling (no floats)", () => {
  it("parses decimal strings exactly, including half-cent-looking values", () => {
    expect(toMinor("0.10", "USD")).toBe(10n);
    expect(toMinor("1234.56", "USD")).toBe(123456n);
    expect(toMinor("500", "JPY")).toBe(500n);
    expect(toMinor("1.234", "KWD")).toBe(1234n);
    expect(fromMinor(123456n, "USD")).toBe("1234.56");
  });
  it("refuses more decimals than the currency allows", () => {
    expect(() => toMinor("1.005", "USD")).toThrow();
    expect(() => toMinor("1.5", "JPY")).toThrow();
  });
  it("matches amounts that would differ under float rounding", () => {
    // 0.1 + 0.2 style traps: 100.10 vs 100.10 must be exact, 100.10 vs 100.11 must not.
    expect(matchLine(lineIn(10010n), [], [inv("INV-1", 10010n)]).status).toBe("SUGGESTED");
    expect(matchLine(lineIn(10010n), [], [inv("INV-1", 10011n)]).status).toBe("NO_MATCH");
  });
});

describe("matchLine", () => {
  it("suggests the single exact-amount invoice for money in, using the default rule", () => {
    const out = matchLine(lineIn(5000n), [], [inv("INV-1", 5000n), bill("BILL-1", 5000n)]);
    expect(out).toMatchObject({ status: "SUGGESTED", ruleId: null, confidence: DEFAULT_RULE.confidence });
    if (out.status === "SUGGESTED") expect(out.document.number).toBe("INV-1");
  });
  it("matches money out only against bills", () => {
    const out = matchLine(lineIn(5000n, { direction: "OUT" }), [], [inv("INV-1", 5000n), bill("BILL-1", 5000n)]);
    expect(out.status === "SUGGESTED" && out.document.number).toBe("BILL-1");
  });
  it("never guesses when two documents fit", () => {
    const out = matchLine(lineIn(5000n), [], [inv("INV-1", 5000n), inv("INV-2", 5000n)]);
    expect(out.status).toBe("AMBIGUOUS");
    if (out.status === "AMBIGUOUS") expect(out.candidates).toHaveLength(2);
  });
  it("uses a rule's tolerance and configured confidence", () => {
    const rules = [rule({ amountToleranceMinor: 50n, confidence: 77 })];
    const out = matchLine(lineIn(4960n), rules, [inv("INV-1", 5000n)]);
    expect(out).toMatchObject({ status: "SUGGESTED", ruleId: "r1", confidence: 77 });
    expect(matchLine(lineIn(4949n), rules, [inv("INV-1", 5000n)]).status).toBe("NO_MATCH");
  });
  it("matches on a reference found in the line text", () => {
    const rules = [rule({ matchOn: "reference" })];
    const docs = [inv("INV-0042", 9999n), inv("INV-0043", 5000n)];
    const out = matchLine(lineIn(5000n, { reference: "Pay INV-0042 thanks" }), rules, docs);
    expect(out.status === "SUGGESTED" && out.document.number).toBe("INV-0042");
  });
  it("requires both when matching on amount and reference", () => {
    const rules = [rule({ matchOn: "amount_and_reference" })];
    const docs = [inv("INV-1", 5000n)];
    // The rule needs both; without the reference it finds nothing, so the default (amount only) decides.
    expect(matchLine(lineIn(5000n, { reference: "no number" }), rules, docs)).toMatchObject({ status: "SUGGESTED", ruleId: null });
    expect(matchLine(lineIn(5000n, { reference: "INV-1" }), rules, docs)).toMatchObject({ status: "SUGGESTED", ruleId: "r1" });
  });
  it("filters by description text, direction and amount range", () => {
    const docs = [inv("INV-1", 5000n)];
    const text = [rule({ descriptionContains: "STRIPE" })];
    expect(matchLine(lineIn(5000n, { description: "stripe payout" }), text, docs)).toMatchObject({ ruleId: "r1" });
    // The text filter fails, so the default rule decides instead.
    expect(matchLine(lineIn(5000n, { description: "bank transfer" }), text, docs)).toMatchObject({ ruleId: null });
    const range = [rule({ amountMinMinor: 6000n })];
    expect(matchLine(lineIn(5000n), range, docs)).toMatchObject({ ruleId: null });
    const out = [rule({ direction: "OUT" })];
    expect(matchLine(lineIn(5000n), out, docs)).toMatchObject({ ruleId: null });
  });
  it("skips inactive rules and orders by priority, then id", () => {
    const docs = [inv("INV-1", 5000n)];
    const rules = [
      rule({ id: "b", name: "B", priority: 5, confidence: 60 }),
      rule({ id: "a", name: "A", priority: 5, confidence: 70 }),
      rule({ id: "z", name: "Off", priority: 1, active: false, confidence: 99 }),
    ];
    expect(matchLine(lineIn(5000n), rules, docs)).toMatchObject({ ruleId: "a", confidence: 70 });
    expect(matchLine(lineIn(5000n), [...rules].reverse(), docs)).toMatchObject({ ruleId: "a" });
  });
  it("lets a later rule resolve what an earlier rule found ambiguous", () => {
    const docs = [inv("INV-1", 5000n), inv("INV-2", 5000n)];
    const rules = [
      rule({ id: "broad", priority: 1 }),
      rule({ id: "exact", priority: 2, matchOn: "reference", confidence: 95 }),
    ];
    expect(matchLine(lineIn(5000n, { reference: "INV-2" }), rules, docs)).toMatchObject({ status: "SUGGESTED", ruleId: "exact" });
    // With no reference to narrow it, the ambiguity stands and nothing is guessed.
    expect(matchLine(lineIn(5000n), rules, docs)).toMatchObject({ status: "AMBIGUOUS", ruleId: "broad" });
  });
  it("falls through to the next rule when one finds nothing", () => {
    const rules = [rule({ id: "r1", priority: 1, matchOn: "reference" }), rule({ id: "r2", priority: 2, confidence: 55 })];
    expect(matchLine(lineIn(5000n), rules, [inv("INV-1", 5000n)])).toMatchObject({ ruleId: "r2", confidence: 55 });
  });
  it("handles zero-decimal currencies and negative document balances without matching them", () => {
    expect(matchLine(lineIn(1500n), [], [inv("INV-J", 1500n)]).status).toBe("SUGGESTED");
    expect(matchLine(lineIn(1500n), [], [inv("INV-N", -1500n)]).status).toBe("NO_MATCH");
  });
});

describe("validateRule", () => {
  it("accepts a sound rule", () => expect(() => validateRule(rule())).not.toThrow());
  it("rejects bad confidence, tolerance and ranges", () => {
    expect(() => validateRule(rule({ confidence: 0 }))).toThrow();
    expect(() => validateRule(rule({ confidence: 101 }))).toThrow();
    expect(() => validateRule(rule({ confidence: 50.5 }))).toThrow();
    expect(() => validateRule(rule({ amountToleranceMinor: -1n }))).toThrow();
    expect(() => validateRule(rule({ amountMinMinor: 10n, amountMaxMinor: 5n }))).toThrow();
    expect(() => validateRule(rule({ matchOn: "reference", amountToleranceMinor: 1n }))).toThrow();
  });
});
