import type { Branch, Company, Tenant } from "./model";
import type { TenantRepository } from "./service";

/** Repository for unit tests. Production uses the Postgres repository in @erp/db. */
export class InMemoryTenantRepository implements TenantRepository {
  private readonly tenants = new Map<string, Tenant>();
  private readonly companies = new Map<string, Company>();
  private readonly branches = new Map<string, Branch>();

  async insertTenant(tenant: Tenant): Promise<void> {
    this.tenants.set(tenant.id, tenant);
  }

  async findTenantBySlug(slug: string): Promise<Tenant | null> {
    return [...this.tenants.values()].find((tenant) => tenant.slug === slug) ?? null;
  }

  async findTenantById(id: string): Promise<Tenant | null> {
    return this.tenants.get(id) ?? null;
  }

  async insertCompany(company: Company): Promise<void> {
    this.companies.set(company.id, company);
  }

  async findCompany(companyId: string): Promise<Company | null> {
    return this.companies.get(companyId) ?? null;
  }

  async insertBranch(branch: Branch): Promise<void> {
    this.branches.set(branch.id, branch);
  }

  async findBranchByCode(companyId: string, code: string): Promise<Branch | null> {
    return [...this.branches.values()].find((branch) => branch.companyId === companyId && branch.code === code) ?? null;
  }
}
