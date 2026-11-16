import type { ScenarioParameters, ScenarioProjection, ScenarioBotAlert } from "../types";

export const DEFAULT_BASELINE_PARAMS: ScenarioParameters = {
  scenarioName: "Current Trajectory (Baseline)",
  revenueGrowthDelta: 0,
  cogsInflationDelta: 0,
  opexHiringCount: 0,
  averageSalaryPerHire: "10000.00",
  dsoDaysDelta: 0,
  priceIncreaseDelta: 0,
};

export const SCENARIO_PRESETS: Record<string, ScenarioParameters> = {
  baseline: DEFAULT_BASELINE_PARAMS,
  recession_shock: {
    scenarioName: "Macro Shock (-25% Demand)",
    revenueGrowthDelta: -25,
    cogsInflationDelta: 8,
    opexHiringCount: 0,
    averageSalaryPerHire: "10000.00",
    dsoDaysDelta: 30,
    priceIncreaseDelta: -5,
  },
  supply_chain_crunch: {
    scenarioName: "Supply Chain & Cost Inflation (+22% COGS)",
    revenueGrowthDelta: 5,
    cogsInflationDelta: 22,
    opexHiringCount: 1,
    averageSalaryPerHire: "10000.00",
    dsoDaysDelta: 15,
    priceIncreaseDelta: 8,
  },
  hyper_expansion: {
    scenarioName: "Series A Hyper-Expansion (+40% Scale)",
    revenueGrowthDelta: 40,
    cogsInflationDelta: 12,
    opexHiringCount: 6,
    averageSalaryPerHire: "12500.00",
    dsoDaysDelta: 10,
    priceIncreaseDelta: 5,
  },
  liquidity_squeeze: {
    scenarioName: "Customer Liquidity Squeeze (+45 Days DSO)",
    revenueGrowthDelta: -10,
    cogsInflationDelta: 5,
    opexHiringCount: 0,
    averageSalaryPerHire: "10000.00",
    dsoDaysDelta: 45,
    priceIncreaseDelta: 0,
  },
};

export interface BaselineFinancials {
  cash: number; // e.g. 148500
  monthlyRevenue: number; // e.g. 84200
  monthlyExpense: number; // e.g. 52100
  payablesDue: number; // e.g. 38400
  receivablesDue: number; // e.g. 64200
}

export function calculateScenarioProjection(
  params: ScenarioParameters,
  baseline: BaselineFinancials = {
    cash: 148500.0,
    monthlyRevenue: 84200.0,
    monthlyExpense: 52100.0,
    payablesDue: 38400.0,
    receivablesDue: 64200.0,
  }
): ScenarioProjection {
  // 1. Calculate Revenue with Price & Volume Adjustments
  const volumeMultiplier = 1 + params.revenueGrowthDelta / 100;
  const priceMultiplier = 1 + params.priceIncreaseDelta / 100;
  const projectedMonthlyRevenue = baseline.monthlyRevenue * volumeMultiplier * priceMultiplier;

  // 2. Calculate COGS & OPEX
  // COGS roughly 45% of expenses
  const baselineCogs = baseline.monthlyExpense * 0.45;
  const baselineOpex = baseline.monthlyExpense * 0.55;

  const cogsMultiplier = 1 + params.cogsInflationDelta / 100;
  const projectedCogs = baselineCogs * volumeMultiplier * cogsMultiplier;

  // Additional salary burden
  const salaryPerHire = parseFloat(params.averageSalaryPerHire) || 10000;
  const additionalPayroll = params.opexHiringCount * salaryPerHire;
  const projectedMonthlyExpense = projectedCogs + baselineOpex + additionalPayroll;

  // 3. Monthly Net Cashflow
  const monthlyNet = projectedMonthlyRevenue - projectedMonthlyExpense;

  // 4. Working Capital Drag (DSO impact on collections)
  // Each 30 days delay in DSO holds back 1 month's worth of revenue collection
  const dsoDragPerMonth = (params.dsoDaysDelta / 30) * (projectedMonthlyRevenue * 0.25);

  // 5. Projected Cash Milestones
  const cash30d = Math.max(0, baseline.cash + monthlyNet - dsoDragPerMonth * 0.35);
  const cash60d = Math.max(0, cash30d + monthlyNet - dsoDragPerMonth * 0.35);
  const cash90d = Math.max(0, cash60d + monthlyNet - dsoDragPerMonth * 0.3);

  // 6. Runway Months
  let runwayMonths = 99;
  if (monthlyNet < 0) {
    const netBurn = Math.abs(monthlyNet);
    runwayMonths = Number((baseline.cash / netBurn).toFixed(1));
  } else {
    runwayMonths = 36; // Positive cashflow
  }

  // 7. Risk Score & Level Calculation
  let riskScore = 15; // baseline low risk
  if (monthlyNet < 0) riskScore += 35;
  if (runwayMonths < 6) riskScore += 30;
  else if (runwayMonths < 12) riskScore += 15;
  if (params.dsoDaysDelta >= 30) riskScore += 15;
  if (params.cogsInflationDelta >= 15) riskScore += 10;
  if (cash90d < baseline.cash * 0.5) riskScore += 15;

  riskScore = Math.min(100, Math.max(0, riskScore));

  let riskLevel: "low" | "moderate" | "severe" | "critical" = "low";
  if (riskScore >= 75) riskLevel = "critical";
  else if (riskScore >= 50) riskLevel = "severe";
  else if (riskScore >= 30) riskLevel = "moderate";

  // 8. Bot Alerts Matrix
  const botAlerts: ScenarioBotAlert[] = [];

  // Forecast Finn
  if (runwayMonths < 6) {
    botAlerts.push({
      botId: "finn",
      botName: "Forecast Finn",
      botColor: "violet",
      headline: `Critical Runway Warning: ${runwayMonths} months to zero cash`,
      severity: "act",
      recommendation: "Activate overdraft facility or curtail discretionary OPEX immediately.",
    });
  } else if (monthlyNet < 0) {
    botAlerts.push({
      botId: "finn",
      botName: "Forecast Finn",
      botColor: "violet",
      headline: `Net Cash Burn at $${Math.abs(monthlyNet).toLocaleString()}/month`,
      severity: "watch",
      recommendation: "Monitor DSO collections closely and defer non-essential capex.",
    });
  } else {
    botAlerts.push({
      botId: "finn",
      botName: "Forecast Finn",
      botColor: "violet",
      headline: "Surplus Liquidity Generating +$" + monthlyNet.toLocaleString() + "/mo",
      severity: "good",
      recommendation: "Reinvest free cash into high-margin inventory or yield reserves.",
    });
  }

  // Guard Gus
  if (params.cogsInflationDelta > 15) {
    botAlerts.push({
      botId: "gus",
      botName: "Guard Gus",
      botColor: "pink",
      headline: `Gross Margin Compression: COGS rising +${params.cogsInflationDelta}%`,
      severity: "act",
      recommendation: "Trigger supplier price renegotiation (PRC-02) and enforce mandatory quote matching.",
    });
  }

  // Restock Rex
  if (params.revenueGrowthDelta > 20) {
    botAlerts.push({
      botId: "rex",
      botName: "Restock Rex",
      botColor: "lime",
      headline: `Stockout Risk: Demand surge of +${params.revenueGrowthDelta}% exceeds safety buffer`,
      severity: "watch",
      recommendation: "Increase reorder buffer points across top 10 Fast-Moving SKUs (FMCG).",
    });
  }

  // Chase Chloe
  if (params.dsoDaysDelta > 20) {
    botAlerts.push({
      botId: "chloe",
      botName: "Chase Chloe",
      botColor: "cyan",
      headline: `Debtor Aging Escalation: Collections slipping by +${params.dsoDaysDelta} days`,
      severity: "act",
      recommendation: "Enable automated dunning cadence (SAL-04) at 7-day intervals with early payment discounts.",
    });
  }

  return {
    scenarioName: params.scenarioName,
    projectedRunwayMonths: runwayMonths,
    projectedCash30d: cash30d.toFixed(2),
    projectedCash60d: cash60d.toFixed(2),
    projectedCash90d: cash90d.toFixed(2),
    netCashflowDelta: monthlyNet.toFixed(2),
    monthlyBurnRate: (projectedMonthlyExpense).toFixed(2),
    riskScore,
    riskLevel,
    botAlerts,
  };
}
