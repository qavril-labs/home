import { describe, expect, it } from "vitest";
import { DomainError, FixedClock, newId } from "@erp/kernel";
import { InMemoryTenantRepository, TenantService, assertEntitled, missingDependencies, type ProductDefinition } from "../src";

const clock = () => new FixedClock(new Date("2026-03-01T00:00:00Z"));

describe("TenantService", () => {
  it("creates a tenant with a normalized slug", async () => {
    const service = new TenantService(new InMemoryTenantRepository(), clock());
    const tenant = await service.createTenant({ slug: " Acme-Ke ", name: "Acme Kenya", region: "MEA" });
    expect(tenant.slug).toBe("acme-ke");
    expect(tenant.status).toBe("ACTIVE");
  });

  it("rejects duplicate slugs and bad regions", async () => {
    const service = new TenantService(new InMemoryTenantRepository(), clock());
    await service.createTenant({ slug: "acme", name: "Acme", region: "EU" });
    await expect(service.createTenant({ slug: "acme", name: "Other", region: "EU" })).rejects.toThrow(/already taken/);
    await expect(service.createTenant({ slug: "beta", name: "Beta", region: "MARS" })).rejects.toThrow(DomainError);
  });

  it("validates company currency, country, and fiscal month", async () => {
    const service = new TenantService(new InMemoryTenantRepository(), clock());
    const tenant = await service.createTenant({ slug: "acme", name: "Acme", region: "MEA" });
    const company = await service.createCompany(tenant.id, {
      legalName: "Acme Kenya Ltd",
      countryCode: "KE",
      baseCurrency: "KES",
      fiscalYearStartMonth: 7,
    });
    expect(company.tenantId).toBe(tenant.id);
    await expect(
      service.createCompany(tenant.id, { legalName: "X", countryCode: "KEN", baseCurrency: "KES", fiscalYearStartMonth: 1 }),
    ).rejects.toThrow(/alpha-2/);
    await expect(
      service.createCompany(tenant.id, { legalName: "X", countryCode: "KE", baseCurrency: "ZZZ", fiscalYearStartMonth: 1 }),
    ).rejects.toThrow(/Unknown currency/);
    await expect(
      service.createCompany(tenant.id, { legalName: "X", countryCode: "KE", baseCurrency: "KES", fiscalYearStartMonth: 13 }),
    ).rejects.toThrow(/1 to 12/);
  });

  it("creates branches only under a company of the same tenant", async () => {
    const service = new TenantService(new InMemoryTenantRepository(), clock());
    const tenant = await service.createTenant({ slug: "acme", name: "Acme", region: "MEA" });
    const company = await service.createCompany(tenant.id, {
      legalName: "Acme Ltd",
      countryCode: "KE",
      baseCurrency: "KES",
      fiscalYearStartMonth: 1,
    });

    const branch = await service.createBranch(tenant.id, company.id, {
      code: "NBO01",
      name: "Nairobi CBD",
      timezone: "Africa/Nairobi",
    });
    expect(branch.companyId).toBe(company.id);

    await expect(
      service.createBranch(tenant.id, company.id, { code: "NBO01", name: "Duplicate", timezone: "Africa/Nairobi" }),
    ).rejects.toThrow(/already exists/);
    await expect(
      service.createBranch(newId(), company.id, { code: "MSA01", name: "Other tenant", timezone: "Africa/Nairobi" }),
    ).rejects.toThrow(/Company not found/);
    await expect(
      service.createBranch(tenant.id, company.id, { code: "BAD01", name: "Bad zone", timezone: "Mars/Olympus" }),
    ).rejects.toThrow(/time zone/);
  });
});

describe("entitlements", () => {
  const catalog = new Map<string, ProductDefinition>([
    ["MDM-03", { id: "MDM-03", name: "Chart of accounts", requires: [] }],
    ["FIN-01", { id: "FIN-01", name: "General ledger", requires: ["MDM-03"] }],
    ["FIN-02", { id: "FIN-02", name: "Receivables", requires: ["FIN-01", "SAL-04"] }],
    ["SAL-04", { id: "SAL-04", name: "Invoicing", requires: [] }],
  ]);

  it("reports missing dependencies", () => {
    expect(missingDependencies(["FIN-02"], catalog)).toEqual(["FIN-01", "SAL-04"]);
    expect(missingDependencies(["MDM-03", "FIN-01", "SAL-04", "FIN-02"], catalog)).toEqual([]);
  });

  it("rejects unknown products", () => {
    expect(() => missingDependencies(["NOPE-99"], catalog)).toThrow(/Unknown product/);
  });

  it("blocks access to products the tenant has not bought", () => {
    expect(() => assertEntitled(new Set(["FIN-01"]), "FIN-02")).toThrow(/not enabled/);
    expect(() => assertEntitled(new Set(["FIN-02"]), "FIN-02")).not.toThrow();
  });
});
