import { DomainError, newId, systemClock, type Clock } from "@erp/kernel";
import { getCurrency } from "@erp/money";
import { ALLOWED_REGIONS, type Branch, type Company, type Tenant } from "./model";

export interface TenantRepository {
  insertTenant(tenant: Tenant): Promise<void>;
  findTenantBySlug(slug: string): Promise<Tenant | null>;
  findTenantById(id: string): Promise<Tenant | null>;
  insertCompany(company: Company): Promise<void>;
  findCompany(companyId: string): Promise<Company | null>;
  insertBranch(branch: Branch): Promise<void>;
  findBranchByCode(companyId: string, code: string): Promise<Branch | null>;
}

export interface CreateTenantInput {
  readonly slug: string;
  readonly name: string;
  readonly region: string;
}

export interface CreateCompanyInput {
  readonly legalName: string;
  readonly countryCode: string;
  readonly baseCurrency: string;
  readonly fiscalYearStartMonth: number;
}

export interface CreateBranchInput {
  readonly code: string;
  readonly name: string;
  readonly timezone: string;
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;

function requireText(value: string, label: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    throw new DomainError("VALIDATION", `${label} must be 1 to ${maxLength} characters`);
  }
  return trimmed;
}

function isValidTimeZone(zone: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export class TenantService {
  constructor(
    private readonly repo: TenantRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  /** The caller supplies the ID so the tenant row and its first rows can share one transaction. */
  async createTenant(input: CreateTenantInput, id: string = newId(this.clock.now().getTime())): Promise<Tenant> {
    const slug = input.slug.trim().toLowerCase();
    if (!SLUG_PATTERN.test(slug)) {
      throw new DomainError("VALIDATION", "Slug must be 2 to 63 lowercase letters, digits, or hyphens");
    }
    if (!(ALLOWED_REGIONS as readonly string[]).includes(input.region)) {
      throw new DomainError("VALIDATION", `Region must be one of ${ALLOWED_REGIONS.join(", ")}`);
    }
    const name = requireText(input.name, "Tenant name", 200);
    if (await this.repo.findTenantBySlug(slug)) {
      throw new DomainError("CONFLICT", `Slug "${slug}" is already taken`);
    }
    const tenant: Tenant = {
      id,
      slug,
      name,
      region: input.region,
      status: "ACTIVE",
      createdAt: this.clock.now().toISOString(),
    };
    await this.repo.insertTenant(tenant);
    return tenant;
  }

  async createCompany(tenantId: string, input: CreateCompanyInput): Promise<Company> {
    const legalName = requireText(input.legalName, "Legal name", 200);
    if (!/^[A-Z]{2}$/.test(input.countryCode)) {
      throw new DomainError("VALIDATION", "Country must be an ISO 3166-1 alpha-2 code");
    }
    getCurrency(input.baseCurrency);
    if (!Number.isInteger(input.fiscalYearStartMonth) || input.fiscalYearStartMonth < 1 || input.fiscalYearStartMonth > 12) {
      throw new DomainError("VALIDATION", "Fiscal year start month must be 1 to 12");
    }
    const company: Company = {
      id: newId(this.clock.now().getTime()),
      tenantId,
      legalName,
      countryCode: input.countryCode,
      baseCurrency: input.baseCurrency,
      fiscalYearStartMonth: input.fiscalYearStartMonth,
      createdAt: this.clock.now().toISOString(),
    };
    await this.repo.insertCompany(company);
    return company;
  }

  async createBranch(tenantId: string, companyId: string, input: CreateBranchInput): Promise<Branch> {
    const company = await this.repo.findCompany(companyId);
    if (!company || company.tenantId !== tenantId) {
      throw new DomainError("NOT_FOUND", "Company not found");
    }
    if (!/^[A-Z0-9]{1,10}$/.test(input.code)) {
      throw new DomainError("VALIDATION", "Branch code must be 1 to 10 uppercase letters or digits");
    }
    const name = requireText(input.name, "Branch name", 200);
    if (!isValidTimeZone(input.timezone)) {
      throw new DomainError("VALIDATION", `Unknown time zone: ${input.timezone}`);
    }
    if (await this.repo.findBranchByCode(companyId, input.code)) {
      throw new DomainError("CONFLICT", `Branch code ${input.code} already exists in this company`);
    }
    const branch: Branch = {
      id: newId(this.clock.now().getTime()),
      tenantId,
      companyId,
      code: input.code,
      name,
      timezone: input.timezone,
    };
    await this.repo.insertBranch(branch);
    return branch;
  }
}
