import type { Item, ItemStore, Party, PartyKind, PartyStore } from "@erp/master-data";
import type { Queryable } from "./pool";

interface PartyRow {
  id: string;
  company_id: string;
  kind: PartyKind;
  name: string;
  tax_id: string | null;
  email: string | null;
  currency: string | null;
  active: boolean;
}

interface ItemRow {
  company_id: string;
  code: string;
  name: string;
  unit: string;
  revenue_account: string | null;
  active: boolean;
}

const PARTY_COLUMNS = "id, company_id, kind, name, tax_id, email, currency, active";
const ITEM_COLUMNS = "company_id, code, name, unit, revenue_account, active";

/** Postgres party store. Use a transaction from withTenantTransaction so row-level security applies. */
export class PgPartyStore implements PartyStore {
  constructor(private readonly db: Queryable, private readonly tenantId: string) {}

  async get(companyId: string, id: string): Promise<Party | undefined> {
    const { rows } = await this.db.query<PartyRow>(
      `SELECT ${PARTY_COLUMNS} FROM parties WHERE tenant_id = $1 AND company_id = $2 AND id = $3`,
      [this.tenantId, companyId, id],
    );
    return rows[0] ? toParty(rows[0]) : undefined;
  }

  async findByTaxId(companyId: string, taxId: string): Promise<Party | undefined> {
    const { rows } = await this.db.query<PartyRow>(
      `SELECT ${PARTY_COLUMNS} FROM parties WHERE tenant_id = $1 AND company_id = $2 AND tax_id = $3`,
      [this.tenantId, companyId, taxId],
    );
    return rows[0] ? toParty(rows[0]) : undefined;
  }

  async save(party: Party): Promise<void> {
    await this.db.query(
      `INSERT INTO parties (tenant_id, company_id, id, kind, name, tax_id, email, currency, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (tenant_id, id) DO UPDATE
         SET kind = EXCLUDED.kind, name = EXCLUDED.name, tax_id = EXCLUDED.tax_id,
             email = EXCLUDED.email, currency = EXCLUDED.currency, active = EXCLUDED.active`,
      [this.tenantId, party.companyId, party.id, party.kind, party.name, party.taxId, party.email, party.currency, party.active],
    );
  }

  async list(companyId: string): Promise<Party[]> {
    const { rows } = await this.db.query<PartyRow>(
      `SELECT ${PARTY_COLUMNS} FROM parties WHERE tenant_id = $1 AND company_id = $2 ORDER BY name`,
      [this.tenantId, companyId],
    );
    return rows.map(toParty);
  }
}

/** Postgres item store. Use a transaction from withTenantTransaction so row-level security applies. */
export class PgItemStore implements ItemStore {
  constructor(private readonly db: Queryable, private readonly tenantId: string) {}

  async get(companyId: string, code: string): Promise<Item | undefined> {
    const { rows } = await this.db.query<ItemRow>(
      `SELECT ${ITEM_COLUMNS} FROM items WHERE tenant_id = $1 AND company_id = $2 AND code = $3`,
      [this.tenantId, companyId, code],
    );
    return rows[0] ? toItem(rows[0]) : undefined;
  }

  async save(item: Item): Promise<void> {
    await this.db.query(
      `INSERT INTO items (tenant_id, company_id, code, name, unit, revenue_account, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tenant_id, company_id, code) DO UPDATE
         SET name = EXCLUDED.name, unit = EXCLUDED.unit,
             revenue_account = EXCLUDED.revenue_account, active = EXCLUDED.active`,
      [this.tenantId, item.companyId, item.code, item.name, item.unit, item.revenueAccount, item.active],
    );
  }

  async list(companyId: string): Promise<Item[]> {
    const { rows } = await this.db.query<ItemRow>(
      `SELECT ${ITEM_COLUMNS} FROM items WHERE tenant_id = $1 AND company_id = $2 ORDER BY code`,
      [this.tenantId, companyId],
    );
    return rows.map(toItem);
  }
}

function toParty(row: PartyRow): Party {
  return {
    id: row.id,
    companyId: row.company_id,
    kind: row.kind,
    name: row.name,
    taxId: row.tax_id,
    email: row.email,
    currency: row.currency?.trim() ?? null,
    active: row.active,
  };
}

function toItem(row: ItemRow): Item {
  return {
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    unit: row.unit,
    revenueAccount: row.revenue_account,
    active: row.active,
  };
}
