import { DomainError } from "@erp/kernel";
import { getCurrency } from "./currency";
import { Money } from "./money";
import { divRound, type RoundingMode } from "./rounding";

/** Rates are stored as integers scaled by 10^8 (eight decimal places). */
export const FX_SCALE = 100_000_000n;

export interface FxRate {
  /** One unit of `base` ... */
  readonly base: string;
  /** ... equals `rate` units of `quote`. */
  readonly quote: string;
  /** Business date the rate applies from, YYYY-MM-DD (inclusive). */
  readonly effectiveDate: string;
  /** Rate scaled by FX_SCALE. */
  readonly rate: bigint;
}

/** Parses a decimal rate such as "1.0850" into a scaled integer. */
export function parseRate(decimal: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,8}))?$/.exec(decimal.trim());
  if (!match) {
    throw new DomainError("VALIDATION", `Invalid rate: ${decimal}`);
  }
  const [, whole = "0", fraction = ""] = match;
  const scaled = BigInt(whole + fraction.padEnd(8, "0"));
  if (scaled <= 0n) {
    throw new DomainError("VALIDATION", "Rate must be positive");
  }
  return scaled;
}

const pairKey = (base: string, quote: string): string => `${base}/${quote}`;

/** Effective-dated exchange rates. Inverse rates are derived automatically. */
export class FxRateTable {
  private readonly rates = new Map<string, FxRate[]>();

  add(rate: FxRate): void {
    getCurrency(rate.base);
    getCurrency(rate.quote);
    if (rate.base === rate.quote) {
      throw new DomainError("VALIDATION", "Base and quote currencies must differ");
    }
    if (rate.rate <= 0n) {
      throw new DomainError("VALIDATION", "Rate must be positive");
    }
    const key = pairKey(rate.base, rate.quote);
    const list = this.rates.get(key) ?? [];
    if (list.some((existing) => existing.effectiveDate === rate.effectiveDate)) {
      throw new DomainError("CONFLICT", `A rate for ${key} on ${rate.effectiveDate} already exists`);
    }
    list.push(rate);
    list.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
    this.rates.set(key, list);
  }

  /** Rate from `base` to `quote` in effect on `date`. */
  rateOn(base: string, quote: string, date: string): bigint {
    if (base === quote) {
      return FX_SCALE;
    }
    const direct = this.latest(base, quote, date);
    if (direct !== undefined) {
      return direct;
    }
    const inverse = this.latest(quote, base, date);
    if (inverse !== undefined) {
      return divRound(FX_SCALE * FX_SCALE, inverse, "HALF_UP");
    }
    throw new DomainError("UNPROCESSABLE", `No ${base}/${quote} rate on or before ${date}`);
  }

  convert(money: Money, quote: string, date: string, mode: RoundingMode = "HALF_UP"): Money {
    if (money.currency === quote) {
      return money;
    }
    const rate = this.rateOn(money.currency, quote, date);
    const shift = getCurrency(quote).minorUnits - getCurrency(money.currency).minorUnits;
    const numerator = money.minor * rate * 10n ** BigInt(Math.max(shift, 0));
    const denominator = FX_SCALE * 10n ** BigInt(Math.max(-shift, 0));
    return Money.of(divRound(numerator, denominator, mode), quote);
  }

  private latest(base: string, quote: string, date: string): bigint | undefined {
    let found: FxRate | undefined;
    for (const rate of this.rates.get(pairKey(base, quote)) ?? []) {
      if (rate.effectiveDate > date) break;
      found = rate;
    }
    return found?.rate;
  }
}
