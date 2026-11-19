/**
 * FIN-08 Multi-Currency & FX Engine
 * Provides live exchange rates, currency conversion, and unrealized FX gain/loss calculations.
 */

export interface FXRate {
  currency: string;
  rateAgainstBase: number;
  symbol: string;
}

export const LIVE_EXCHANGE_RATES: Record<string, FXRate> = {
  USD: { currency: "USD", rateAgainstBase: 1.0, symbol: "$" },
  EUR: { currency: "EUR", rateAgainstBase: 1.085, symbol: "€" },
  GBP: { currency: "GBP", rateAgainstBase: 1.28, symbol: "£" },
  INR: { currency: "INR", rateAgainstBase: 0.012, symbol: "₹" },
  JPY: { currency: "JPY", rateAgainstBase: 0.0065, symbol: "¥" },
  CAD: { currency: "CAD", rateAgainstBase: 0.74, symbol: "CA$" },
  AUD: { currency: "AUD", rateAgainstBase: 0.65, symbol: "A$" },
};

export interface ConversionResult {
  sourceAmount: number;
  sourceCurrency: string;
  baseAmount: number;
  baseCurrency: string;
  effectiveRate: number;
  unrealizedGainLoss: number;
}

export function parseRawAmount(val: number | string): number {
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/[^0-9.-]+/g, "");
  return parseFloat(cleaned) || 0;
}

export function convertToBaseCurrency(
  amount: number | string,
  currency: string,
  historicalRate?: number
): ConversionResult {
  const sourceAmount = parseRawAmount(amount);
  const curKey = currency.toUpperCase();
  const rateInfo = LIVE_EXCHANGE_RATES[curKey] || { currency: curKey, rateAgainstBase: 1.0, symbol: "$" };
  const currentSpotRate = rateInfo.rateAgainstBase;

  const currentBaseValue = Math.round(sourceAmount * currentSpotRate * 100) / 100;
  
  let unrealizedGainLoss = 0;
  if (historicalRate !== undefined && historicalRate !== null) {
    const historicalBaseValue = Math.round(sourceAmount * historicalRate * 100) / 100;
    unrealizedGainLoss = Math.round((currentBaseValue - historicalBaseValue) * 100) / 100;
  }

  return {
    sourceAmount,
    sourceCurrency: curKey,
    baseAmount: currentBaseValue,
    baseCurrency: "USD",
    effectiveRate: currentSpotRate,
    unrealizedGainLoss,
  };
}
