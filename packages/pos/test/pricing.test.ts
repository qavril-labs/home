import { describe, expect, it } from "vitest";
import { DomainError } from "@erp/kernel";
import { Money } from "@erp/money";
import { priceLine, priceSale, type SaleLineInput } from "../src";

const kes = (decimal: string) => Money.fromDecimal(decimal, "KES");

function line(overrides: Partial<SaleLineInput> = {}): SaleLineInput {
  return {
    itemCode: "PARA-500",
    description: "Paracetamol 500mg",
    qty: 1n,
    unitPrice: kes("100.00"),
    taxRateBps: 1900n,
    taxMode: "EXCLUSIVE",
    revenueAccount: "4000",
    tracked: true,
    ...overrides,
  };
}

describe("pricing a sale line (TAX-001, TAX-002, DISC-001)", () => {
  it("adds exclusive tax on top of the price", () => {
    const priced = priceLine(line({ qty: 2n }), "KES");
    expect(priced.net.toDecimal()).toBe("200.00");
    expect(priced.tax.toDecimal()).toBe("38.00");
    expect(priced.total.toDecimal()).toBe("238.00");
  });

  it("takes inclusive tax out of the price, so the customer pays the price", () => {
    const priced = priceLine(line({ unitPrice: kes("119.00"), taxMode: "INCLUSIVE" }), "KES");
    expect(priced.total.toDecimal()).toBe("119.00");
    expect(priced.tax.toDecimal()).toBe("19.00");
    expect(priced.net.toDecimal()).toBe("100.00");
  });

  it("applies the line discount before tax, not after", () => {
    const priced = priceLine(line({ discount: kes("10.00") }), "KES");
    expect(priced.net.toDecimal()).toBe("90.00");
    expect(priced.tax.toDecimal()).toBe("17.10");
    expect(priced.total.toDecimal()).toBe("107.10");
  });

  it("rounds a half-cent tax up, in minor units (exclusive)", () => {
    // 0.05 at 19% is 0.0095, which rounds half up to 0.01.
    const priced = priceLine(line({ unitPrice: kes("0.05") }), "KES");
    expect(priced.tax.toDecimal()).toBe("0.01");
    expect(priced.total.toDecimal()).toBe("0.06");
  });

  it("rounds a half-cent tax inside an inclusive price, so net and tax still add to the price", () => {
    // 0.05 including 19% tax: the tax is 0.05 minus 0.05 / 1.19, which is 0.0084 and rounds to 0.01.
    const priced = priceLine(line({ unitPrice: kes("0.05"), taxMode: "INCLUSIVE" }), "KES");
    expect(priced.tax.toDecimal()).toBe("0.01");
    expect(priced.net.add(priced.tax).equals(priced.total)).toBe(true);
  });

  it("keeps the rate and mode it was priced at (TAX-004)", () => {
    const priced = priceLine(line({ taxRateBps: 750n, taxMode: "INCLUSIVE" }), "KES");
    expect(priced.taxRateBps).toBe(750n);
    expect(priced.taxMode).toBe("INCLUSIVE");
  });

  it("charges no tax at a zero rate", () => {
    const priced = priceLine(line({ taxRateBps: 0n }), "KES");
    expect(priced.tax.isZero()).toBe(true);
    expect(priced.total.toDecimal()).toBe("100.00");
  });

  it("works in a zero-decimal currency", () => {
    const priced = priceLine(
      { ...line(), unitPrice: Money.fromDecimal("1000", "JPY"), qty: 3n, discount: Money.fromDecimal("0", "JPY") },
      "JPY",
    );
    expect(priced.net.toDecimal()).toBe("3000");
    expect(priced.tax.toDecimal()).toBe("570");
    expect(priced.total.toDecimal()).toBe("3570");
  });

  it("refuses a discount larger than the line", () => {
    expect(() => priceLine(line({ discount: kes("150.00") }), "KES")).toThrow(DomainError);
  });

  it("refuses a zero or negative quantity, a negative price, and a rate above 100%", () => {
    expect(() => priceLine(line({ qty: 0n }), "KES")).toThrow(DomainError);
    expect(() => priceLine(line({ unitPrice: kes("-1.00") }), "KES")).toThrow(DomainError);
    expect(() => priceLine(line({ taxRateBps: 10_001n }), "KES")).toThrow(DomainError);
  });

  it("refuses a price in a different currency from the sale", () => {
    expect(() => priceLine(line({ unitPrice: Money.fromDecimal("10.00", "USD") }), "KES")).toThrow(DomainError);
  });
});

describe("pricing a sale", () => {
  it("makes the totals the sum of the lines, so rounding never loses or adds a cent", () => {
    const sale = priceSale(
      [
        line({ unitPrice: kes("0.05"), qty: 3n }),
        line({ itemCode: "BAND-AID", unitPrice: kes("0.15"), qty: 7n }),
        line({ itemCode: "SALINE", unitPrice: kes("33.33"), qty: 1n, taxMode: "INCLUSIVE" }),
      ],
      "KES",
    );
    const lineTotal = sale.lines.reduce((sum, item) => sum.add(item.total), Money.zero("KES"));
    expect(sale.total.equals(lineTotal)).toBe(true);
    expect(sale.total.equals(sale.subtotal.add(sale.tax))).toBe(true);
  });

  it("refuses a sale with no lines", () => {
    expect(() => priceSale([], "KES")).toThrow(DomainError);
  });
});
