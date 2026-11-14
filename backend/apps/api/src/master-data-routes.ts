import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { hasPermission, type Principal } from "@erp/identity";
import { DomainError, type Clock } from "@erp/kernel";
import type { Company } from "@erp/tenancy";
import {
  PgMasterDataStore,
  PgLedgerStore,
  PgTenantRepository,
  withTenantTransaction,
  type Pool,
  type Queryable,
} from "@erp/db";
import { Ledger, type AccountType } from "@erp/ledger";

async function firstCompany(tx: Queryable, tenantId: string): Promise<Company> {
  const { rows } = await tx.query<{ id: string }>(
    "SELECT id FROM companies WHERE tenant_id = $1 ORDER BY id LIMIT 1",
    [tenantId],
  );
  const id = rows[0]?.id;
  const company = id ? await new PgTenantRepository(tx).findCompany(id) : null;
  if (!company) throw new DomainError("NOT_FOUND", "This workspace has no company yet");
  return company;
}

const CreatePartyBody = z.object({
  name: z.string().trim().min(1).max(200),
  partyType: z.enum(["customer", "supplier", "both"]),
  email: z.string().trim().email().max(254).optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  taxId: z.string().trim().max(50).optional().or(z.literal("")),
  status: z.enum(["active", "hold", "archived", "inactive"]).optional(),
  balance: z.string().trim().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const UpdatePartyBody = CreatePartyBody.partial();

const CreateItemBody = z.object({
  sku: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  itemType: z.enum(["goods", "service", "bundle"]).optional(),
  category: z.string().trim().max(80).optional().or(z.literal("")),
  unit: z.string().trim().max(20).optional(),
  unitPrice: z.string().trim().regex(/^\d{1,13}(\.\d{1,2})?$/).optional(),
  stockQuantity: z.number().int().optional(),
  reorderPoint: z.number().int().optional(),
  status: z.enum(["in_stock", "low_stock", "out_of_stock", "discontinued"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const UpdateItemBody = CreateItemBody.partial().omit({ sku: true });

const CreateAccountBody = z.object({
  code: z.string().trim().min(1).max(20).regex(/^[0-9A-Za-z.-]+$/),
  name: z.string().trim().min(1).max(120),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
});

const UpdateAccountBody = z.object({
  name: z.string().trim().min(1).max(120),
  active: z.boolean().optional(),
});

export interface MasterDataRouteDeps {
  readonly pool: Pool;
  readonly clock: Clock;
  readonly authenticate: (request: FastifyRequest) => Promise<Principal>;
}

export function registerMasterDataRoutes(app: FastifyInstance, deps: MasterDataRouteDeps): void {
  async function signedIn(request: FastifyRequest, permission?: string): Promise<Principal> {
    const principal = await deps.authenticate(request);
    if (permission && !hasPermission(principal.permissions, permission)) {
      throw new DomainError("FORBIDDEN", `Missing permission ${permission}`);
    }
    return principal;
  }

  // ==========================================
  // MDM-01: Customers & Suppliers (Parties)
  // ==========================================
  app.get("/v1/master-data/parties", async (request) => {
    const principal = await signedIn(request);
    const query = request.query as { partyType?: string; status?: string; search?: string };
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const company = await firstCompany(tx, principal.tenantId);
      const store = new PgMasterDataStore(tx, principal.tenantId, deps.clock);
      return store.listParties(company.id, query);
    });
  });

  app.get("/v1/master-data/parties/:id", async (request) => {
    const principal = await signedIn(request);
    const { id } = request.params as { id: string };
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const store = new PgMasterDataStore(tx, principal.tenantId, deps.clock);
      const party = await store.findParty(id);
      if (!party) throw new DomainError("NOT_FOUND", `Party ${id} not found`);
      return party;
    });
  });

  app.post("/v1/master-data/parties", async (request, reply) => {
    const principal = await signedIn(request);
    const body = CreatePartyBody.parse(request.body);
    const created = await withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const company = await firstCompany(tx, principal.tenantId);
      const store = new PgMasterDataStore(tx, principal.tenantId, deps.clock);
      return store.createParty(company.id, {
        name: body.name,
        partyType: body.partyType,
        email: body.email,
        phone: body.phone,
        taxId: body.taxId,
        status: body.status,
        balance: body.balance,
        metadata: body.metadata,
      });
    });
    return reply.status(201).send(created);
  });

  app.put("/v1/master-data/parties/:id", async (request) => {
    const principal = await signedIn(request);
    const { id } = request.params as { id: string };
    const body = UpdatePartyBody.parse(request.body);
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const store = new PgMasterDataStore(tx, principal.tenantId, deps.clock);
      return store.updateParty(id, body);
    });
  });

  app.delete("/v1/master-data/parties/:id", async (request, reply) => {
    const principal = await signedIn(request);
    const { id } = request.params as { id: string };
    await withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const store = new PgMasterDataStore(tx, principal.tenantId, deps.clock);
      await store.deleteParty(id);
    });
    return reply.status(204).send();
  });

  // ==========================================
  // MDM-02: Items & Catalog
  // ==========================================
  app.get("/v1/master-data/items", async (request) => {
    const principal = await signedIn(request);
    const query = request.query as { itemType?: string; category?: string; status?: string; search?: string };
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const company = await firstCompany(tx, principal.tenantId);
      const store = new PgMasterDataStore(tx, principal.tenantId, deps.clock);
      return store.listItems(company.id, query);
    });
  });

  app.get("/v1/master-data/items/:id", async (request) => {
    const principal = await signedIn(request);
    const { id } = request.params as { id: string };
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const store = new PgMasterDataStore(tx, principal.tenantId, deps.clock);
      const item = await store.findItem(id);
      if (!item) throw new DomainError("NOT_FOUND", `Item ${id} not found`);
      return item;
    });
  });

  app.post("/v1/master-data/items", async (request, reply) => {
    const principal = await signedIn(request);
    const body = CreateItemBody.parse(request.body);
    const created = await withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const company = await firstCompany(tx, principal.tenantId);
      const store = new PgMasterDataStore(tx, principal.tenantId, deps.clock);
      return store.createItem(company.id, {
        sku: body.sku,
        name: body.name,
        itemType: body.itemType,
        category: body.category,
        unit: body.unit,
        unitPrice: body.unitPrice,
        stockQuantity: body.stockQuantity,
        reorderPoint: body.reorderPoint,
        status: body.status,
        metadata: body.metadata,
      });
    });
    return reply.status(201).send(created);
  });

  app.put("/v1/master-data/items/:id", async (request) => {
    const principal = await signedIn(request);
    const { id } = request.params as { id: string };
    const body = UpdateItemBody.parse(request.body);
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const store = new PgMasterDataStore(tx, principal.tenantId, deps.clock);
      return store.updateItem(id, body);
    });
  });

  app.delete("/v1/master-data/items/:id", async (request, reply) => {
    const principal = await signedIn(request);
    const { id } = request.params as { id: string };
    await withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const store = new PgMasterDataStore(tx, principal.tenantId, deps.clock);
      await store.deleteItem(id);
    });
    return reply.status(204).send();
  });

  // ==========================================
  // MDM-03: Chart of Accounts
  // ==========================================
  app.get("/v1/master-data/accounts", async (request) => {
    const principal = await signedIn(request);
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const company = await firstCompany(tx, principal.tenantId);
      const store = new PgLedgerStore(tx, principal.tenantId);
      return store.listAccounts(company.id);
    });
  });

  app.post("/v1/master-data/accounts", async (request, reply) => {
    const principal = await signedIn(request);
    const body = CreateAccountBody.parse(request.body);
    const created = await withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const company = await firstCompany(tx, principal.tenantId);
      const store = new PgLedgerStore(tx, principal.tenantId);
      const ledger = new Ledger(store, company.id, company.baseCurrency, deps.clock);
      return ledger.createAccount({
        code: body.code,
        name: body.name,
        type: body.type as AccountType,
      });
    });
    return reply.status(201).send(created);
  });

  app.put("/v1/master-data/accounts/:code", async (request) => {
    const principal = await signedIn(request);
    const { code } = request.params as { code: string };
    const body = UpdateAccountBody.parse(request.body);
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const company = await firstCompany(tx, principal.tenantId);
      const store = new PgLedgerStore(tx, principal.tenantId);
      const { rows } = await tx.query<any>(
        `UPDATE ledger_accounts
            SET name = COALESCE($4, name),
                active = COALESCE($5, active)
          WHERE tenant_id = $1 AND company_id = $2 AND code = $3
          RETURNING code, name, account_type AS type, active`,
        [principal.tenantId, company.id, code, body.name || null, body.active ?? null],
      );
      if (rows.length === 0) throw new DomainError("NOT_FOUND", `Account ${code} not found`);
      return rows[0];
    });
  });
}
