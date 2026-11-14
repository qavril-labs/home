import { DomainError } from "@erp/kernel";

/**
 * HALF_UP: .5 rounds away from zero (the usual invoice rule).
 * HALF_EVEN: .5 rounds to the nearest even value (banker's rounding).
 * UP / DOWN: away from zero / toward zero.
 */
export type RoundingMode = "HALF_UP" | "HALF_EVEN" | "UP" | "DOWN";

/** Integer division with explicit rounding. Exact: no floating point involved. */
export function divRound(numerator: bigint, denominator: bigint, mode: RoundingMode = "HALF_UP"): bigint {
  if (denominator === 0n) {
    throw new DomainError("VALIDATION", "Division by zero");
  }
  const n = denominator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const quotient = n / d; // BigInt division truncates toward zero
  const remainder = n - quotient * d;
  if (remainder === 0n) {
    return quotient;
  }
  const sign = n < 0n ? -1n : 1n;
  const twiceRemainder = (remainder < 0n ? -remainder : remainder) * 2n;
  switch (mode) {
    case "DOWN":
      return quotient;
    case "UP":
      return quotient + sign;
    case "HALF_UP":
      return twiceRemainder >= d ? quotient + sign : quotient;
    case "HALF_EVEN":
      if (twiceRemainder > d) return quotient + sign;
      if (twiceRemainder === d && quotient % 2n !== 0n) return quotient + sign;
      return quotient;
  }
}
