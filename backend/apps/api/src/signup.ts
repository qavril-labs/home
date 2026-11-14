import { randomBytes } from "node:crypto";
import { z } from "zod";
import { AuditLog } from "@erp/audit";
import { createEvent } from "@erp/events";
import { IdentityService, type Principal } from "@erp/identity";
import { ALLOWED_REGIONS, TenantService, type Company, type Tenant } from "@erp/tenancy";
import {
  PgAuditStore,
  PgIdentityRepository,
  PgOutboxStore,
  PgTenantRepository,
  withTenantTransaction,
  type Pool,
} from "@erp/db";
import { DomainError, newId, type Clock } from "@erp/kernel";
import { setUpStarterBooks } from "./workspace";

export interface ProvisionInput {
  readonly tenant: { readonly slug: string; readonly name: string; readonly region: string };
  readonly company: {
    readonly legalName: string;
    readonly countryCode: string;
    readonly baseCurrency: string;
    readonly fiscalYearStartMonth: number;
  };
  readonly admin: { readonly email: string; readonly password: string };
}

/**
 * Creates a tenant, its first company and its administrator in one transaction, with an audit
 * entry and a tenancy.tenant.created event. Used by the platform bootstrap and by public sign-up.
 */
export async function provisionTenant(pool: Pool, clock: Clock, input: ProvisionInput, actor: "platform" | "self_signup") {
  const tenantId = newId(clock.now().getTime());
  return withTenantTransaction(pool, tenantId, async (tx) => {
    const tenants = new TenantService(new PgTenantRepository(tx), clock);
    const tenant = await tenants.createTenant(input.tenant, tenantId);
    const company = await tenants.createCompany(tenant.id, input.company);
    const admin = await new IdentityService(new PgIdentityRepository(tx), tenant.id, clock).createUser({
      email: input.admin.email,
      password: input.admin.password,
      roles: ["tenant_admin"],
    });
    await new AuditLog(new PgAuditStore(tx), clock).record({
      tenantId: tenant.id,
      actorId: null,
      action: "CREATE",
      entityType: "tenant",
      entityId: tenant.id,
      after: { slug: tenant.slug, name: tenant.name, region: tenant.region, via: actor },
    });
    if (actor === "self_signup") {
      // Self-service workspaces start with the ledger on, a starter chart of accounts and this fiscal year.
      await setUpStarterBooks(tx, tenant.id, company, clock);
    }
    await new PgOutboxStore(tx).append([
      createEvent("tenancy.tenant.created", tenant.id, { tenantId: tenant.id, slug: tenant.slug, via: actor }, clock),
    ]);
    return { tenant, company, admin };
  });
}

export const SignupBody = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  password: z.string().min(12).max(256),
  company: z.string().trim().min(1).max(160),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  /** Books are kept in US dollars unless another currency is sent. */
  baseCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default("USD"),
  region: z.enum(ALLOWED_REGIONS),
  /** Optional workspace address. Derived from the company name when left out. */
  workspace: z.string().trim().toLowerCase().max(63).optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
  consent: z.literal(true),
  /** Honeypot. Real visitors never fill this in. */
  website: z.string().max(200).optional(),
});
export type SignupInput = z.infer<typeof SignupBody>;

/** Turns a company name into a workspace slug: lowercase letters, digits and single hyphens. */
export function slugFromCompany(company: string): string {
  const base = company
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return base.length >= 2 ? base : `workspace-${base}`.replace(/-+$/g, "");
}

export interface SignupResult {
  readonly tenant: Tenant;
  readonly company: Company;
  readonly session: { readonly token: string; readonly expiresAt: string; readonly principal: Principal };
}

/**
 * Self-service sign-up. When the workspace address was derived (not chosen), a taken address gets
 * a short random suffix and is tried again, so two shops called "Corner Café" can both sign up.
 */
export async function signUp(pool: Pool, clock: Clock, body: SignupInput): Promise<SignupResult> {
  const chosen = body.workspace && body.workspace.length > 0 ? body.workspace : undefined;
  const base = chosen ?? slugFromCompany(body.company);
  let created: Awaited<ReturnType<typeof provisionTenant>> | undefined;
  for (let attempt = 0; attempt < 4 && !created; attempt += 1) {
    const slug = attempt === 0 ? base : `${base.slice(0, 56)}-${randomBytes(3).toString("hex")}`;
    try {
      created = await provisionTenant(
        pool,
        clock,
        {
          tenant: { slug, name: body.company, region: body.region },
          company: {
            legalName: body.company,
            countryCode: body.countryCode,
            baseCurrency: body.baseCurrency,
            fiscalYearStartMonth: body.fiscalYearStartMonth ?? 1,
          },
          admin: { email: body.email, password: body.password },
        },
        "self_signup",
      );
    } catch (error) {
      const slugTaken = error instanceof DomainError && error.code === "CONFLICT" && /slug/i.test(error.message);
      const uniqueRace = (error as { code?: string }).code === "23505";
      if (chosen && slugTaken) {
        throw new DomainError("CONFLICT", `The workspace address "${chosen}" is taken. Try another.`, { field: "workspace" });
      }
      if (!(slugTaken || uniqueRace) || chosen) throw error;
    }
  }
  if (!created) {
    throw new DomainError("CONFLICT", "Could not find a free workspace address. Choose one yourself.", { field: "workspace" });
  }
  const { tenant, company } = created;
  const session = await withTenantTransaction(pool, tenant.id, (tx) =>
    new IdentityService(new PgIdentityRepository(tx), tenant.id, clock).login(body.email, body.password),
  );
  return { tenant, company, session };
}
