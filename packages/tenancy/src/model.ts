/** Regions where tenant data can be pinned. Refined under PLT-21 (security and data residency). */
export const ALLOWED_REGIONS = ["EU", "US", "MEA", "APAC", "LATAM"] as const;

export type TenantStatus = "ACTIVE" | "SUSPENDED";

/** A customer organization. Every tenant-owned row carries its tenant ID. */
export interface Tenant {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly region: string;
  readonly status: TenantStatus;
  readonly createdAt: string;
}

/** A legal entity with its own books, currency, and tax registration. */
export interface Company {
  readonly id: string;
  readonly tenantId: string;
  readonly legalName: string;
  /** ISO 3166-1 alpha-2, e.g. "KE". */
  readonly countryCode: string;
  /** ISO 4217, e.g. "KES". */
  readonly baseCurrency: string;
  readonly fiscalYearStartMonth: number;
  readonly createdAt: string;
}

/** An operating location within a company: a shop, warehouse, or clinic. */
export interface Branch {
  readonly id: string;
  readonly tenantId: string;
  readonly companyId: string;
  readonly code: string;
  readonly name: string;
  /** IANA time zone, e.g. "Africa/Nairobi". */
  readonly timezone: string;
}
