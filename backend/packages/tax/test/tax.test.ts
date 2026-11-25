import { describe, expect, it } from "vitest";
import { DomainError } from "@erp/kernel";
import { Money } from "@erp/money";
import { TaxRegistry, calculateTax, rateBpsOn, type TaxCode } from "../src";

const VAT_STANDARD: TaxCode = {
  code: "VAT_STD",
  jurisdiction: "KE",
  name: "VAT standard",
  recoverable: true,
  reverseCharge: false,
  rates: [
    { ratePercentBps: 1600, validFrom: "2023-07-01", validTo: "2025-06-30" },
    { ratePercentBps: 1600, validFrom: "2025-07-01" },
  ],
};

const REVERSE_CHARGE: TaxCode = {
  code: "RC_SERVICES",
  jurisdiction: "EU",
  name: "Reverse charge services",
  recoverable: true,
  reverseCharge: true,
  rates: [{ ratePercentBps: 2000, validFrom: "2020-01-01" }],
};

const usd = (decimal: string) => Money.fromDecimal(decimal, "USD");

describe("calculateTax", () => {
  it("adds tax to a net amount", () => {
    const result = calculateTax({ amount: usd("100.00"), taxCode: VAT_STANDARD, date: "2026-03-01" });
    expect(result.tax.toDecimal()).toBe("16.00");
    expect(result.gross.toDecimal()).toBe("116.00");
    expect(result.rateBps).toBe(1600);
  });

  it("extracts tax from a gross price", () => {
    const result = calculateTax({
      amount: usd("116.00"),
      taxCode: VAT_STANDARD,
      date: "2026-03-01",
      basis: "INCLUSIVE",
    });
    expect(result.net.toDecimal()).toBe("100.00");
    expect(result.tax.toDecimal()).toBe("16.00");
    expect(result.gross.toDecimal()).toBe("116.00");
  });

  it("rounds the tax, not the net, on exclusive amounts", () => {
    const result = calculateTax({ amount: usd("0.03"), taxCode: VAT_STANDARD, date: "2026-03-01" });
    expect(result.tax.toDecimal()).toBe("0.00");
    const half = calculateTax({ amount: usd("0.05"), taxCode: VAT_STANDARD, date: "2026-03-01" });
    expect(half.tax.toDecimal()).toBe("0.01");
  });

  it("supports banker's rounding when configured", () => {
    const up = calculateTax({ amount: Money.of(3, "USD"), taxCode: VAT_STANDARD, date: "2026-03-01" });
    const even = calculateTax({
      amount: Money.of(3, "USD"),
      taxCode: VAT_STANDARD,
      date: "2026-03-01",
      rounding: "HALF_EVEN",
    });
    expect(up.tax.minor).toBe(0n);
    expect(even.tax.minor).toBe(0n);
    const halfCase = calculateTax({
      amount: Money.of(25, "USD"),
      taxCode: { ...VAT_STANDARD, rates: [{ ratePercentBps: 1000, validFrom: "2020-01-01" }] },
      date: "2026-03-01",
      rounding: "HALF_EVEN",
    });
    expect(halfCase.tax.minor).toBe(2n);
  });

  it("moves reverse-charge tax off the invoice and onto the buyer", () => {
    const result = calculateTax({ amount: usd("100.00"), taxCode: REVERSE_CHARGE, date: "2026-03-01" });
    expect(result.tax.isZero()).toBe(true);
    expect(result.gross.toDecimal()).toBe("100.00");
    expect(result.selfAssessedTax.toDecimal()).toBe("20.00");
    expect(result.reverseCharge).toBe(true);
  });

  it("refuses reverse-charge amounts quoted as gross", () => {
    expect(() =>
      calculateTax({ amount: usd("120.00"), taxCode: REVERSE_CHARGE, date: "2026-03-01", basis: "INCLUSIVE" }),
    ).toThrow(DomainError);
  });

  it("returns negative tax for credit notes", () => {
    const result = calculateTax({ amount: usd("-100.00"), taxCode: VAT_STANDARD, date: "2026-03-01" });
    expect(result.tax.toDecimal()).toBe("-16.00");
  });
});

describe("rate effective dating", () => {
  it("selects the version in force on the transaction date", () => {
    const changing: TaxCode = {
      ...VAT_STANDARD,
      rates: [
        { ratePercentBps: 1600, validFrom: "2020-01-01", validTo: "2024-12-31" },
        { ratePercentBps: 1800, validFrom: "2025-01-01" },
      ],
    };
    expect(rateBpsOn(changing, "2024-12-31")).toBe(1600);
    expect(rateBpsOn(changing, "2025-01-01")).toBe(1800);
  });

  it("fails when no version covers the date", () => {
    expect(() => rateBpsOn(VAT_STANDARD, "2020-01-01")).toThrow(DomainError);
  });
});

describe("TaxRegistry", () => {
  it("rejects overlapping rate versions", () => {
    const registry = new TaxRegistry();
    const overlapping: TaxCode = {
      ...VAT_STANDARD,
      code: "BAD",
      rates: [
        { ratePercentBps: 1000, validFrom: "2020-01-01", validTo: "2024-12-31" },
        { ratePercentBps: 1200, validFrom: "2024-06-01" },
      ],
    };
    expect(() => registry.register(overlapping)).toThrow(/overlap/);
  });

  it("rejects open-ended versions followed by another version", () => {
    const registry = new TaxRegistry();
    const bad: TaxCode = {
      ...VAT_STANDARD,
      code: "BAD2",
      rates: [
        { ratePercentBps: 1000, validFrom: "2020-01-01" },
        { ratePercentBps: 1200, validFrom: "2025-01-01" },
      ],
    };
    expect(() => registry.register(bad)).toThrow(/overlap/);
  });

  it("rejects invalid rates and duplicate codes", () => {
    const registry = new TaxRegistry();
    expect(() =>
      registry.register({ ...VAT_STANDARD, code: "NEG", rates: [{ ratePercentBps: -1, validFrom: "2020-01-01" }] }),
    ).toThrow(DomainError);
    registry.register(VAT_STANDARD);
    expect(() => registry.register(VAT_STANDARD)).toThrow(/already registered/);
  });

  it("looks up registered codes", () => {
    const registry = new TaxRegistry();
    registry.register(VAT_STANDARD);
    expect(registry.get("VAT_STD").jurisdiction).toBe("KE");
    expect(() => registry.get("MISSING")).toThrow(DomainError);
  });
});
