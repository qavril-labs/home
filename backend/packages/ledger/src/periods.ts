import { DomainError } from "@erp/kernel";

export type PeriodStatus = "OPEN" | "CLOSED";

/** A calendar month used as an accounting period. Entries are dated inside exactly one period. */
export interface FiscalPeriod {
  /** YYYY-MM of the month. */
  readonly id: string;
  /** YYYY-MM-DD, inclusive. */
  readonly startDate: string;
  /** YYYY-MM-DD, inclusive. */
  readonly endDate: string;
  readonly status: PeriodStatus;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function assertIsoDate(value: string): void {
  if (!DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new DomainError("VALIDATION", `Expected a YYYY-MM-DD date, got ${value}`);
  }
}

/**
 * Twelve monthly periods for the fiscal year that starts in `startMonth` of `startYear`.
 * A fiscal year starting in July 2026 covers 2026-07 through 2027-06.
 */
export function monthlyPeriods(startYear: number, startMonth: number): FiscalPeriod[] {
  if (!Number.isInteger(startYear) || startYear < 1900 || startYear > 2999) {
    throw new DomainError("VALIDATION", "Fiscal year must be between 1900 and 2999");
  }
  if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) {
    throw new DomainError("VALIDATION", "Fiscal year start month must be 1 to 12");
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  return Array.from({ length: 12 }, (_, offset) => {
    const monthIndex = startMonth - 1 + offset;
    const year = startYear + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      id: `${year}-${pad(month)}`,
      startDate: `${year}-${pad(month)}-01`,
      endDate: `${year}-${pad(month)}-${pad(lastDay)}`,
      status: "OPEN" as const,
    };
  });
}

export function periodContaining(periods: readonly FiscalPeriod[], date: string): FiscalPeriod {
  assertIsoDate(date);
  const found = periods.find((period) => period.startDate <= date && date <= period.endDate);
  if (!found) {
    throw new DomainError("UNPROCESSABLE", `No fiscal period covers ${date}`);
  }
  return found;
}
