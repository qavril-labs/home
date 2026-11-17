import { DomainError } from "@erp/kernel";
import { Money } from "@erp/money";

/**
 * Pricing for a POS sale (POS-01), in the order the business rules give (BR-002): each line's item discount
 * comes first (DISC-001), then the bill discount is shared across the lines, and tax is worked out last on
 * what is left (TAX-001). Tax is added to the price (exclusive) or is already inside it (inclusive), chosen per
 * line (TAX-002). Each line keeps the rate and mode it was priced at (TAX-004). Rounding is per line, half up,
 * in minor units, and each share of the bill discount is a whole minor unit, so the parts add up to the total exactly.
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
  /** Discount on the whole line, in the sale currency, applied before the bill discount. Defaults to none. */
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
  /** The item discount on this line. */
  readonly discount: Money;
  /** This line's share of the bill discount. Zero when the sale has none. */
  readonly billDiscount: Money;
  readonly taxRateBps: bigint;
  readonly taxMode: TaxMode;
  readonly revenueAccount: string;
  readonly tracked: boolean;
  /** Revenue for the line, excluding tax, after every discount. */
  readonly net: Money;
  readonly tax: Money;
  /** What the customer pays for the line. */
  readonly total: Money;
}

export interface PricedSale {
  readonly lines: readonly PricedLine[];
  /** The bill discount for the whole sale. Zero when there is none. */
  readonly billDiscount: Money;
  readonly subtotal: Money;
  readonly tax: Money;
  readonly total: Money;
}

interface LineBase {
  readonly input: SaleLineInput;
  readonly discount: Money;
  /** The line after its item discount, and before the bill discount and tax. */
  readonly afterDiscount: Money;
}

/** The part of pricing that does not depend on the bill discount: validation and the item discount. */
function baseOf(input: SaleLineInput, currency: string): LineBase {
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
  return { input, discount, afterDiscount: gross.subtract(discount) };
}

/** Applies this line's share of the bill discount, then works out its tax and total. */
function finish(base: LineBase, share: Money): PricedLine {
  const { input } = base;
  if (share.isNegative() || share.compare(base.afterDiscount) > 0) {
    throw new DomainError("VALIDATION", `Bill discount share for ${input.itemCode} is more than the line`);
  }
  const afterBill = base.afterDiscount.subtract(share);

  let net: Money;
  let tax: Money;
  let total: Money;
  if (input.taxMode === "EXCLUSIVE") {
    net = afterBill;
    tax = net.scale(input.taxRateBps, BASIS_POINTS, "HALF_UP");
    total = net.add(tax);
  } else {
    total = afterBill;
    // The tax inside a price of total is total minus total / (1 + rate).
    tax = total.subtract(total.scale(BASIS_POINTS, BASIS_POINTS + input.taxRateBps, "HALF_UP"));
    net = total.subtract(tax);
  }

  return {
    itemCode: input.itemCode.trim(),
    description: input.description.trim(),
    qty: input.qty,
    unitPrice: input.unitPrice,
    discount: base.discount,
    billDiscount: share,
    taxRateBps: input.taxRateBps,
    taxMode: input.taxMode,
    revenueAccount: input.revenueAccount,
    tracked: input.tracked,
    net,
    tax,
    total,
  };
}

/** Prices one line on its own. The bill discount share defaults to none. */
export function priceLine(input: SaleLineInput, currency: string, billShare?: Money): PricedLine {
  const base = baseOf(input, currency);
  return finish(base, billShare ?? Money.zero(currency));
}

/**
 * Prices every line and adds them up. The bill discount is shared across the lines in proportion to what each
 * line costs after its item discount, so the shares add up to the bill discount exactly. The lines are the
 * source of truth; the totals are their sums.
 */
export function priceSale(
  lines: readonly SaleLineInput[],
  currency: string,
  options: { readonly billDiscount?: Money } = {},
): PricedSale {
  if (lines.length === 0) {
    throw new DomainError("VALIDATION", "A sale needs at least one line");
  }
  const bases = lines.map((line) => baseOf(line, currency));
  const zero = Money.zero(currency);
  const billDiscount = options.billDiscount ?? zero;
  if (billDiscount.isNegative() || billDiscount.currency !== currency) {
    throw new DomainError("VALIDATION", `Bill discount must be zero or more, in ${currency}`);
  }
  const bill = bases.reduce((sum, base) => sum.add(base.afterDiscount), zero);
  if (billDiscount.compare(bill) > 0) {
    throw new DomainError("VALIDATION", "Bill discount is more than the bill");
  }
  const shares = billDiscount.isZero()
    ? bases.map(() => zero)
    : billDiscount.allocate(bases.map((base) => base.afterDiscount.minor));
  const priced = bases.map((base, index) => finish(base, shares[index]!));
  return {
    lines: priced,
    billDiscount,
    subtotal: priced.reduce((sum, line) => sum.add(line.net), zero),
    tax: priced.reduce((sum, line) => sum.add(line.tax), zero),
    total: priced.reduce((sum, line) => sum.add(line.total), zero),
  };
}
