import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { hasPermission, type Principal } from "@erp/identity";
import { DomainError, type Clock } from "@erp/kernel";
import { createItem, createParty, deactivateParty, PARTY_KINDS, type Item, type Party } from "@erp/master-data";
import { assertEntitled, type Company } from "@erp/tenancy";
import {
  PgItemStore,
  PgPartyStore,
  PgTenantRepository,
  listEntitlements,
  withTenantTransaction,
  type Pool,
} from "@erp/db";

const PartyBody = z.object({
  companyId: z.uuid(),
  kind: z.enum(PARTY_KINDS),
  name: z.string(),
  taxId: z.string().nullish(),
  email: z.string().nullish(),
  currency: z.string().nullish(),
});

const ItemBody = z.object({
  companyId: z.uuid(),
  code: z.string(),
  name: z.string(),
  unit: z.string(),
  revenueAccount: z.string().nullish(),
});

const CompanyQuery = z.object({ companyId: z.uuid() });
const PartyParams = z.object({ id: z.uuid() });

export interface MasterDataRouteDeps {
  readonly pool: Pool;
  readonly clock: Clock;
  readonly authenticate: (request: FastifyRequest) => Promise<Principal>;
}

/**
 * Party (MDM-01) and item (MDM-02) routes. Each one needs a signed-in user, the permission for the
 * action, and the product enabled for the tenant. The company must belong to the caller's tenant.
 */
export function registerMasterDataRoutes(app: FastifyInstance, deps: MasterDataRouteDeps): void {
  async function withMasterData<T>(
    request: FastifyRequest,
    permission: string,
    product: "MDM-01" | "MDM-02",
    companyId: string,
    work: (tx: Parameters<Parameters<typeof withTenantTransaction>[2]>[0], tenantId: string, company: Company) => Promise<T>,
  ): Promise<T> {
    const principal = await deps.authenticate(request);
    if (!hasPermission(principal.permissions, permission)) {
      throw new DomainError("FORBIDDEN", `Missing permission ${permission}`);
    }
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      assertEntitled(await listEntitlements(tx), product);
      const company = await new PgTenantRepository(tx).findCompany(companyId);
      if (!company) {
        throw new DomainError("NOT_FOUND", "Company not found");
      }
      return work(tx, principal.tenantId, company);
    });
  }

  app.post("/v1/master/parties", async (request, reply) => {
    const body = PartyBody.parse(request.body);
    const party: Party = await withMasterData(request, "mdm.parties.write", "MDM-01", body.companyId, (tx, tenantId) =>
      createParty(new PgPartyStore(tx, tenantId), body.companyId, {
        kind: body.kind,
        name: body.name,
        taxId: body.taxId ?? null,
        email: body.email ?? null,
        currency: body.currency ?? null,
      }),
    );
    return reply.status(201).send(party);
  });

  app.get("/v1/master/parties", async (request) => {
    const query = CompanyQuery.parse(request.query);
    return withMasterData(request, "mdm.parties.read", "MDM-01", query.companyId, (tx, tenantId) =>
      new PgPartyStore(tx, tenantId).list(query.companyId),
    );
  });

  app.post("/v1/master/parties/:id/deactivate", async (request) => {
    const { id } = PartyParams.parse(request.params);
    const body = CompanyQuery.parse(request.body);
    return withMasterData(request, "mdm.parties.write", "MDM-01", body.companyId, (tx, tenantId) =>
      deactivateParty(new PgPartyStore(tx, tenantId), body.companyId, id),
    );
  });

  app.post("/v1/master/items", async (request, reply) => {
    const body = ItemBody.parse(request.body);
    const item: Item = await withMasterData(request, "mdm.items.write", "MDM-02", body.companyId, (tx, tenantId) =>
      createItem(new PgItemStore(tx, tenantId), body.companyId, {
        code: body.code,
        name: body.name,
        unit: body.unit,
        revenueAccount: body.revenueAccount ?? null,
      }),
    );
    return reply.status(201).send(item);
  });

  app.get("/v1/master/items", async (request) => {
    const query = CompanyQuery.parse(request.query);
    return withMasterData(request, "mdm.items.read", "MDM-02", query.companyId, (tx, tenantId) =>
      new PgItemStore(tx, tenantId).list(query.companyId),
    );
  });
}
