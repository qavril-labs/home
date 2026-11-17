import { DomainError } from "@erp/kernel";
import { Money } from "@erp/money";

/**
 * Pricing for a POS sale (POS-01). A discount reduces the line before tax (DISC-001 and TAX-001). Tax is
 * added to the price (exclusive) or is already inside it (inclusive), chosen per line (TAX-002). Each line
 * keeps the rate and mode it was priced at, so a later rate change never rewrites an old sale (TAX-004).
 * Rounding is per line, half up, in minor units, so the lines always add up to the sale total exactly.
 */

export type TaxMode = "EXCLUSIVE" | "INCLUSIVE";

/** Rates are in basis points: 1900 is 19%, 1 is 0.01%. */
const BASIS_POINTS = 10_000n;

export interface SaleLineInput {
  readonly itemCode: string;
  readonly description: string;
  readonly qty: bigint;
  /** Price per unit before any discount. Includes tax when taxMode is INCLUSIVE. */
  readonly unitPrice: Money;
  /** Discount on the whole line, in the sale currency. Defaults to none. */
  readonly discount?: Money;
  readonly taxRateBps: bigint;
  readonly taxMode: TaxMode;
  readonly revenueAccount: string;
  /** True for stock items, issued first to expire first. False for services, which take no stock. */
  readonly tracked: boolean;
}

export interface PricedLine {
  readonly itemCode: string;
  readonly description: string;
  readonly qty: bigint;
  readonly unitPrice: Money;
  readonly discount: Money;
  readonly taxRateBps: bigint;
  readonly taxMode: TaxMode;
  readonly revenueAccount: string;
  readonly tracked: boolean;
  /** Revenue for the line, excluding tax. */
  readonly net: Money;
  readonly tax: Money;
  /** What the customer pays for the line. */
  readonly total: Money;
}

export interface PricedSale {
  readonly lines: readonly PricedLine[];
  readonly subtotal: Money;
  readonly tax: Money;
  readonly total: Money;
}

export function priceLine(input: SaleLineInput, currency: string): PricedLine {
  if (input.itemCode.trim().length === 0) {
    throw new DomainError("VALIDATION", "Every sale line needs an item code");
  }
  if (input.qty <= 0n) {
    throw new DomainError("VALIDATION", `Quantity for ${input.itemCode} must be above zero`);
  }
  if (input.unitPrice.isNegative() || input.unitPrice.currency !== currency) {
    throw new DomainError("VALIDATION", `Price for ${input.itemCode} must be zero or more, in ${currency}`);
  }
  if (input.taxRateBps < 0n || input.taxRateBps > BASIS_POINTS) {
    throw new DomainError("VALIDATION", `Tax rate for ${input.itemCode} must be between 0% and 100%`);
  }
  const discount = input.discount ?? Money.zero(currency);
  if (discount.isNegative() || discount.currency !== currency) {
    throw new DomainError("VALIDATION", `Discount for ${input.itemCode} must be zero or more, in ${currency}`);
  }

  const gross = Money.of(input.unitPrice.minor * input.qty, currency);
  if (discount.compare(gross) > 0) {
    throw new DomainError("VALIDATION", `Discount for ${input.itemCode} is more than the line`);
  }
  const afterDiscount = gross.subtract(discount);

  let net: Money;
  let tax: Money;
  let total: Money;
  if (input.taxMode === "EXCLUSIVE") {
    net = afterDiscount;
    tax = net.scale(input.taxRateBps, BASIS_POINTS, "HALF_UP");
    total = net.add(tax);
  } else {
    total = afterDiscount;
    // The tax inside a price of total is total minus total / (1 + rate).
    tax = total.subtract(total.scale(BASIS_POINTS, BASIS_POINTS + input.taxRateBps, "HALF_UP"));
    net = total.subtract(tax);
  }

  return {
    itemCode: input.itemCode.trim(),
    description: input.description.trim(),
    qty: input.qty,
    unitPrice: input.unitPrice,
    discount,
    taxRateBps: input.taxRateBps,
    taxMode: input.taxMode,
    revenueAccount: input.revenueAccount,
    tracked: input.tracked,
    net,
    tax,
    total,
  };
}

/** Prices every line and adds them up. The lines are the source of truth; the totals are their sums. */
export function priceSale(lines: readonly SaleLineInput[], currency: string): PricedSale {
  if (lines.length === 0) {
    throw new DomainError("VALIDATION", "A sale needs at least one line");
  }
  const priced = lines.map((line) => priceLine(line, currency));
  const zero = Money.zero(currency);
  return {
    lines: priced,
    subtotal: priced.reduce((sum, line) => sum.add(line.net), zero),
    tax: priced.reduce((sum, line) => sum.add(line.tax), zero),
    total: priced.reduce((sum, line) => sum.add(line.total), zero),
  };
}
