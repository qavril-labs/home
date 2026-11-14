import { describe, expect, it } from "vitest";
import { DomainError } from "@erp/kernel";
import { FX_SCALE, FxRateTable, Money, divRound, parseRate } from "../src";

describe("Money", () => {
  it("parses and prints decimals with the currency's minor units", () => {
    expect(Money.fromDecimal("1234.5", "USD").toDecimal()).toBe("1234.50");
    expect(Money.fromDecimal("-0.05", "USD").minor).toBe(-5n);
    expect(Money.fromDecimal("1234", "JPY").toDecimal()).toBe("1234");
    expect(Money.fromDecimal("12.345", "KWD").toDecimal()).toBe("12.345");
  });

  it("rejects more decimal places than the currency allows", () => {
    expect(() => Money.fromDecimal("1.001", "USD")).toThrow(DomainError);
    expect(() => Money.fromDecimal("1.5", "JPY")).toThrow(DomainError);
  });

  it("rejects unknown currencies and unsafe numbers", () => {
    expect(() => Money.of(100, "XXX")).toThrow(DomainError);
    expect(() => Money.of(0.1, "USD")).toThrow(DomainError);
  });

  it("refuses to mix currencies", () => {
    const usd = Money.fromDecimal("1.00", "USD");
    const eur = Money.fromDecimal("1.00", "EUR");
    expect(() => usd.add(eur)).toThrow(/Currency mismatch/);
  });

  it("allocates without losing or inventing minor units", () => {
    const parts = Money.of(100, "USD").allocate([1n, 1n, 1n]);
    expect(parts.map((part) => part.minor)).toEqual([34n, 33n, 33n]);
    const total = parts.reduce((sum, part) => sum.add(part));
    expect(total.minor).toBe(100n);
  });

  it("allocates negative amounts symmetrically", () => {
    const parts = Money.of(-100, "USD").allocate([1n, 1n, 1n]);
    expect(parts.map((part) => part.minor)).toEqual([-34n, -33n, -33n]);
  });

  it("keeps the sum exact for large weights", () => {
    const parts = Money.of(999_999_999, "EUR").allocate([7n, 11n, 13n, 17n]);
    const sum = parts.reduce((total, part) => total.add(part));
    expect(sum.minor).toBe(999_999_999n);
  });

  it("scales with one final rounding step", () => {
    expect(Money.of(1000, "USD").scale(1500n, 10_000n).minor).toBe(150n);
    expect(Money.of(1, "USD").scale(1n, 2n, "HALF_UP").minor).toBe(1n);
  });

  it("serializes to a decimal string, never a float", () => {
    expect(JSON.stringify({ total: Money.fromDecimal("10.10", "USD") })).toBe(
      '{"total":{"amount":"10.10","currency":"USD"}}',
    );
  });
});

describe("divRound", () => {
  it("rounds half values according to the mode", () => {
    expect(divRound(5n, 2n, "HALF_UP")).toBe(3n);
    expect(divRound(5n, 2n, "HALF_EVEN")).toBe(2n);
    expect(divRound(7n, 2n, "HALF_EVEN")).toBe(4n);
    expect(divRound(-5n, 2n, "HALF_UP")).toBe(-3n);
    expect(divRound(-5n, 2n, "HALF_EVEN")).toBe(-2n);
    expect(divRound(5n, 2n, "DOWN")).toBe(2n);
    expect(divRound(5n, 2n, "UP")).toBe(3n);
  });

  it("handles a negative denominator", () => {
    expect(divRound(5n, -2n, "HALF_UP")).toBe(-3n);
  });

  it("throws on division by zero", () => {
    expect(() => divRound(1n, 0n)).toThrow(DomainError);
  });
});

describe("FxRateTable", () => {
  it("parses rates without floating point", () => {
    expect(parseRate("1.085")).toBe(108_500_000n);
    expect(parseRate("0.5")).toBe(50_000_000n);
    expect(() => parseRate("0")).toThrow(DomainError);
    expect(() => parseRate("1.123456789")).toThrow(DomainError);
  });

  it("converts using the rate in effect on the transaction date", () => {
    const table = new FxRateTable();
    table.add({ base: "USD", quote: "EUR", effectiveDate: "2026-01-01", rate: parseRate("0.90") });
    table.add({ base: "USD", quote: "EUR", effectiveDate: "2026-06-01", rate: parseRate("0.92") });

    const usd = Money.fromDecimal("100.00", "USD");
    expect(table.convert(usd, "EUR", "2026-03-15").toDecimal()).toBe("90.00");
    expect(table.convert(usd, "EUR", "2026-06-01").toDecimal()).toBe("92.00");
  });

  it("derives inverse rates", () => {
    const table = new FxRateTable();
    table.add({ base: "USD", quote: "EUR", effectiveDate: "2026-01-01", rate: parseRate("0.92") });
    const eur = Money.fromDecimal("100.00", "EUR");
    expect(table.convert(eur, "USD", "2026-02-01").toDecimal()).toBe("108.70");
  });

  it("converts between currencies with different minor units", () => {
    const table = new FxRateTable();
    table.add({ base: "USD", quote: "JPY", effectiveDate: "2026-01-01", rate: parseRate("150") });
    expect(table.convert(Money.fromDecimal("100.00", "USD"), "JPY", "2026-01-02").toDecimal()).toBe("15000");
    expect(table.convert(Money.fromDecimal("1", "JPY"), "USD", "2026-01-02").toDecimal()).toBe("0.01");
  });

  it("fails when no rate exists on or before the date", () => {
    const table = new FxRateTable();
    table.add({ base: "USD", quote: "EUR", effectiveDate: "2026-01-01", rate: parseRate("0.9") });
    expect(() => table.rateOn("USD", "EUR", "2025-12-31")).toThrow(DomainError);
  });

  it("rejects duplicate rates for the same day", () => {
    const table = new FxRateTable();
    const rate = { base: "USD", quote: "EUR", effectiveDate: "2026-01-01", rate: parseRate("0.9") };
    table.add(rate);
    expect(() => table.add(rate)).toThrow(/already exists/);
  });

  it("returns the scale for identical currencies", () => {
    expect(new FxRateTable().rateOn("USD", "USD", "2026-01-01")).toBe(FX_SCALE);
  });
});
