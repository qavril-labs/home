import { DomainError } from "@erp/kernel";
import { getCurrency } from "./currency";
import { divRound, type RoundingMode } from "./rounding";

const DECIMAL_PATTERN = /^(-)?(\d+)(?:\.(\d+))?$/;

function compareBigint(a: bigint, b: bigint): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Immutable money amount, stored as integer minor units (cents, fils, and so on).
 * Arithmetic is exact. Never build an amount from a JavaScript float.
 */
export class Money {
  private constructor(
    readonly minor: bigint,
    readonly currency: string,
  ) {}

  static of(minor: bigint | number, currency: string): Money {
    getCurrency(currency);
    if (typeof minor === "number" && !Number.isSafeInteger(minor)) {
      throw new DomainError("VALIDATION", "Minor units must be a safe integer");
    }
    return new Money(BigInt(minor), currency);
  }

  static zero(currency: string): Money {
    return Money.of(0n, currency);
  }

  /** Parses a decimal string such as "1234.50" without floating point. */
  static fromDecimal(amount: string, currency: string): Money {
    const { minorUnits } = getCurrency(currency);
    const match = DECIMAL_PATTERN.exec(amount.trim());
    if (!match) {
      throw new DomainError("VALIDATION", `Invalid amount: ${amount}`);
    }
    const [, sign, whole = "0", fraction = ""] = match;
    if (fraction.length > minorUnits) {
      throw new DomainError("VALIDATION", `${currency} allows ${minorUnits} decimal places`);
    }
    const magnitude = BigInt(whole + fraction.padEnd(minorUnits, "0"));
    return new Money(sign ? -magnitude : magnitude, currency);
  }

  /** Decimal string with exactly the currency's minor-unit digits, e.g. "1234.50" or "1235" for JPY. */
  toDecimal(): string {
    const { minorUnits } = getCurrency(this.currency);
    const sign = this.minor < 0n ? "-" : "";
    const magnitude = (this.minor < 0n ? -this.minor : this.minor).toString();
    if (minorUnits === 0) {
      return sign + magnitude;
    }
    const padded = magnitude.padStart(minorUnits + 1, "0");
    const cut = padded.length - minorUnits;
    return `${sign}${padded.slice(0, cut)}.${padded.slice(cut)}`;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minor + other.minor, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minor - other.minor, this.currency);
  }

  negate(): Money {
    return new Money(-this.minor, this.currency);
  }

  /** Multiplies by numerator / denominator and rounds once, at the end. */
  scale(numerator: bigint, denominator: bigint, mode: RoundingMode = "HALF_UP"): Money {
    return new Money(divRound(this.minor * numerator, denominator, mode), this.currency);
  }

  /**
   * Splits the amount in proportion to `weights` without losing or inventing minor units.
   * Largest-remainder method: the parts always sum to the original amount.
   */
  allocate(weights: readonly bigint[]): Money[] {
    if (weights.length === 0 || weights.some((weight) => weight < 0n)) {
      throw new DomainError("VALIDATION", "Allocation weights must be non-negative and non-empty");
    }
    const total = weights.reduce((sum, weight) => sum + weight, 0n);
    if (total === 0n) {
      throw new DomainError("VALIDATION", "Allocation weights must not all be zero");
    }
    const sign = this.minor < 0n ? -1n : 1n;
    const magnitude = this.minor * sign;
    const shares = weights.map((weight) => (magnitude * weight) / total);
    const remainders = weights.map((weight) => (magnitude * weight) % total);
    let leftover = magnitude - shares.reduce((sum, share) => sum + share, 0n);
    const order = weights
      .map((_, index) => index)
      .sort((a, b) => compareBigint(remainders[b]!, remainders[a]!) || a - b);
    for (const index of order) {
      if (leftover === 0n) break;
      shares[index] = shares[index]! + 1n;
      leftover -= 1n;
    }
    return shares.map((share) => new Money(share * sign, this.currency));
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    return compareBigint(this.minor, other.minor);
  }

  isZero(): boolean {
    return this.minor === 0n;
  }

  isNegative(): boolean {
    return this.minor < 0n;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.minor === other.minor;
  }

  toJSON(): { amount: string; currency: string } {
    return { amount: this.toDecimal(), currency: this.currency };
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) {
      throw new DomainError("VALIDATION", `Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}
