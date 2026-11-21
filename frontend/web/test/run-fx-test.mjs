import test from "node:test";
import assert from "node:assert/strict";

// FIN-08 Multi-Currency tests
import { convertToBaseCurrency, LIVE_EXCHANGE_RATES } from "../src/lib/fx-engine.ts";

test("FIN-08: Base currency identity conversion", () => {
  const result = convertToBaseCurrency(1000, "USD");
  assert.equal(result.baseAmount, 1000);
  assert.equal(result.baseCurrency, "USD");
  assert.equal(result.effectiveRate, 1.0);
  assert.equal(result.unrealizedGainLoss, 0);
});

test("FIN-08: Foreign currency spot conversion (EUR to USD)", () => {
  const result = convertToBaseCurrency(1000, "EUR");
  const expectedRate = LIVE_EXCHANGE_RATES.EUR.rateAgainstBase;
  assert.equal(result.effectiveRate, expectedRate);
  assert.equal(result.baseAmount, Math.round(1000 * expectedRate * 100) / 100);
});

test("FIN-08: Unrealized FX Gain / Loss calculation against historical booking rate", () => {
  // 10,000 EUR booked at 1.05 USD = 10,500 USD historical
  // Current spot rate = 1.085 USD = 10,850 USD current
  // Unrealized gain = +350 USD
  const result = convertToBaseCurrency(10000, "EUR", 1.05);
  assert.equal(result.unrealizedGainLoss, 350.0);
});

test("FIN-08: Unrealized FX Loss calculation when currency weakens", () => {
  // 10,000 EUR booked at 1.12 USD = 11,200 USD historical
  // Current spot rate = 1.085 USD = 10,850 USD current
  // Unrealized loss = -350 USD
  const result = convertToBaseCurrency(10000, "EUR", 1.12);
  assert.equal(result.unrealizedGainLoss, -350.0);
});

test("FIN-08: String amount normalization with currency signs", () => {
  const result = convertToBaseCurrency("€15,450.00", "EUR");
  const expectedRate = LIVE_EXCHANGE_RATES.EUR.rateAgainstBase;
  assert.equal(result.sourceAmount, 15450.0);
  assert.equal(result.baseAmount, Math.round(15450 * expectedRate * 100) / 100);
});
