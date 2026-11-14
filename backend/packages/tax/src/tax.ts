import { DomainError } from "@erp/kernel";
import { Money, type RoundingMode } from "@erp/money";

/** One version of a tax rate. Versions for a code must not overlap. */
export interface TaxRateVersion {
  /** Basis points: 1500 means 15.00%. Integers only. */
  readonly ratePercentBps: number;
  /** YYYY-MM-DD, inclusive. */
  readonly validFrom: string;
  /** YYYY-MM-DD, inclusive. Omit when open-ended. */
  readonly validTo?: string;
}

/** Tax configuration is data. Country packs supply these; the engine does not hard-code rates. */
export interface TaxCode {
  readonly code: string;
  readonly jurisdiction: string;
  readonly name: string;
  readonly rates: readonly TaxRateVersion[];
  /** Input tax the company can reclaim. */
  readonly recoverable: boolean;
  /** The buyer accounts for the tax; the invoice shows none. */
  readonly reverseCharge: boolean;
}

export type PriceBasis = "EXCLUSIVE" | "INCLUSIVE";

export interface CalculateTaxInput {
  readonly amount: Money;
  readonly taxCode: TaxCode;
  /** Business date, YYYY-MM-DD. Selects the rate version. */
  readonly date: string;
  /** EXCLUSIVE: amount is the net price. INCLUSIVE: amount is the gross price. */
  readonly basis?: PriceBasis;
  readonly rounding?: RoundingMode;
}

export interface TaxResult {
  readonly taxCode: string;
  readonly rateBps: number;
  readonly net: Money;
  /** Tax shown on the invoice. Zero for reverse charge. */
  readonly tax: Money;
  readonly gross: Money;
  /** Tax the buyer must self-account for under reverse charge. Zero otherwise. */
  readonly selfAssessedTax: Money;
  readonly reverseCharge: boolean;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function rateBpsOn(code: TaxCode, date: string): number {
  assertDate(date);
  const version = code.rates.find(
    (rate) => rate.validFrom <= date && (rate.validTo === undefined || date <= rate.validTo),
  );
  if (!version) {
    throw new DomainError("UNPROCESSABLE", `No ${code.code} rate applies on ${date}`);
  }
  return version.ratePercentBps;
}

export function calculateTax(input: CalculateTaxInput): TaxResult {
  const { amount, taxCode, date, basis = "EXCLUSIVE", rounding = "HALF_UP" } = input;
  const rateBps = rateBpsOn(taxCode, date);
  const bps = BigInt(rateBps);
  const zero = Money.zero(amount.currency);

  if (basis === "INCLUSIVE") {
    if (taxCode.reverseCharge) {
      throw new DomainError("VALIDATION", "Reverse-charge amounts must be exclusive of tax");
    }
    const net = amount.scale(10_000n, 10_000n + bps, rounding);
    return {
      taxCode: taxCode.code,
      rateBps,
      net,
      tax: amount.subtract(net),
      gross: amount,
      selfAssessedTax: zero,
      reverseCharge: false,
    };
  }

  const computed = amount.scale(bps, 10_000n, rounding);
  if (taxCode.reverseCharge) {
    return {
      taxCode: taxCode.code,
      rateBps,
      net: amount,
      tax: zero,
      gross: amount,
      selfAssessedTax: computed,
      reverseCharge: true,
    };
  }
  return {
    taxCode: taxCode.code,
    rateBps,
    net: amount,
    tax: computed,
    gross: amount.add(computed),
    selfAssessedTax: zero,
    reverseCharge: false,
  };
}

/** Holds the tax codes for a tenant and rejects configuration that would make rates ambiguous. */
export class TaxRegistry {
  private readonly codes = new Map<string, TaxCode>();

  register(code: TaxCode): void {
    if (this.codes.has(code.code)) {
      throw new DomainError("CONFLICT", `Tax code ${code.code} is already registered`);
    }
    assertRateVersions(code);
    this.codes.set(code.code, code);
  }

  get(code: string): TaxCode {
    const found = this.codes.get(code);
    if (!found) {
      throw new DomainError("VALIDATION", `Unknown tax code: ${code}`);
    }
    return found;
  }
}

function assertRateVersions(code: TaxCode): void {
  for (const rate of code.rates) {
    assertDate(rate.validFrom);
    if (rate.validTo !== undefined) {
      assertDate(rate.validTo);
      if (rate.validTo < rate.validFrom) {
        throw new DomainError("VALIDATION", `${code.code}: validTo is before validFrom`);
      }
    }
    if (!Number.isInteger(rate.ratePercentBps) || rate.ratePercentBps < 0 || rate.ratePercentBps > 10_000) {
      throw new DomainError("VALIDATION", `${code.code}: rate must be between 0 and 10000 basis points`);
    }
  }
  const sorted = [...code.rates].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  for (let index = 1; index < sorted.length; index++) {
    const previous = sorted[index - 1]!;
    const current = sorted[index]!;
    if (previous.validTo === undefined || current.validFrom <= previous.validTo) {
      throw new DomainError("VALIDATION", `${code.code}: rate versions overlap`);
    }
  }
}

function assertDate(value: string): void {
  if (!DATE_PATTERN.test(value)) {
    throw new DomainError("VALIDATION", `Expected a YYYY-MM-DD date, got ${value}`);
  }
}
