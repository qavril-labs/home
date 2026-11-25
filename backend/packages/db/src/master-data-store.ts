import { DomainError, newId, type Clock } from "@erp/kernel";
import type { Queryable } from "./pool";

export interface PartyRecord {
  id: string;
  tenantId: string;
  companyId: string;
  name: string;
  partyType: "customer" | "supplier" | "both";
  email: string | null;
  phone: string | null;
  taxId: string | null;
  status: "active" | "hold" | "archived" | "inactive";
  balance: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ItemRecord {
  id: string;
  tenantId: string;
  companyId: string;
  sku: string;
  name: string;
  itemType: "goods" | "service" | "bundle";
  category: string | null;
  unit: string;
  unitPrice: string;
  stockQuantity: number;
  reorderPoint: number;
  status: "in_stock" | "low_stock" | "out_of_stock" | "discontinued";
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export class PgMasterDataStore {
  constructor(
    private readonly client: Queryable,
    private readonly tenantId: string,
    private readonly clock: Clock,
  ) {}

  // --- Parties (MDM-01) ---
  async listParties(
    companyId: string,
    filters: { partyType?: string; search?: string; status?: string } = {},
  ): Promise<PartyRecord[]> {
    let sql = `
      SELECT id, tenant_id, company_id, name, party_type, email, phone, tax_id,
             status, balance::text, metadata, created_at, updated_at
        FROM parties
       WHERE tenant_id = $1 AND company_id = $2
    `;
    const params: unknown[] = [this.tenantId, companyId];

    if (filters.partyType) {
      params.push(filters.partyType);
      sql += ` AND (party_type = $${params.length} OR party_type = 'both')`;
    }
    if (filters.status) {
      params.push(filters.status);
      sql += ` AND status = $${params.length}`;
    }
    if (filters.search) {
      params.push(`%${filters.search.toLowerCase()}%`);
      sql += ` AND (lower(name) LIKE $${params.length} OR lower(email) LIKE $${params.length})`;
    }

    sql += " ORDER BY name ASC";
    const { rows } = await this.client.query<any>(sql, params);
    return rows.map(mapParty);
  }

  async findParty(id: string): Promise<PartyRecord | null> {
    const { rows } = await this.client.query<any>(
      `SELECT id, tenant_id, company_id, name, party_type, email, phone, tax_id,
              status, balance::text, metadata, created_at, updated_at
         FROM parties
        WHERE tenant_id = $1 AND id = $2`,
      [this.tenantId, id],
    );
    return rows[0] ? mapParty(rows[0]) : null;
  }

  async createParty(
    companyId: string,
    input: {
      name: string;
      partyType: "customer" | "supplier" | "both";
      email?: string | null;
      phone?: string | null;
      taxId?: string | null;
      status?: "active" | "hold" | "archived" | "inactive";
      balance?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<PartyRecord> {
    const id = newId(this.clock.now().getTime());
    const now = this.clock.now().toISOString();
    const { rows } = await this.client.query<any>(
      `INSERT INTO parties (id, tenant_id, company_id, name, party_type, email, phone, tax_id, status, balance, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
       RETURNING id, tenant_id, company_id, name, party_type, email, phone, tax_id, status, balance::text, metadata, created_at, updated_at`,
      [
        id,
        this.tenantId,
        companyId,
        input.name.trim(),
        input.partyType,
        input.email?.trim() || null,
        input.phone?.trim() || null,
        input.taxId?.trim() || null,
        input.status || "active",
        input.balance || "0.00",
        JSON.stringify(input.metadata || {}),
        now,
      ],
    );
    return mapParty(rows[0]);
  }

  async updateParty(
    id: string,
    input: {
      name?: string;
      partyType?: "customer" | "supplier" | "both";
      email?: string | null;
      phone?: string | null;
      taxId?: string | null;
      status?: "active" | "hold" | "archived" | "inactive";
      metadata?: Record<string, unknown>;
    },
  ): Promise<PartyRecord> {
    const existing = await this.findParty(id);
    if (!existing) throw new DomainError("NOT_FOUND", `Party ${id} not found`);

    const now = this.clock.now().toISOString();
    const { rows } = await this.client.query<any>(
      `UPDATE parties
          SET name = COALESCE($3, name),
              party_type = COALESCE($4, party_type),
              email = COALESCE($5, email),
              phone = COALESCE($6, phone),
              tax_id = COALESCE($7, tax_id),
              status = COALESCE($8, status),
              metadata = COALESCE($9, metadata),
              updated_at = $10
        WHERE tenant_id = $1 AND id = $2
        RETURNING id, tenant_id, company_id, name, party_type, email, phone, tax_id, status, balance::text, metadata, created_at, updated_at`,
      [
        this.tenantId,
        id,
        input.name ? input.name.trim() : null,
        input.partyType || null,
        input.email !== undefined ? input.email?.trim() || null : null,
        input.phone !== undefined ? input.phone?.trim() || null : null,
        input.taxId !== undefined ? input.taxId?.trim() || null : null,
        input.status || null,
        input.metadata ? JSON.stringify(input.metadata) : null,
        now,
      ],
    );
    return mapParty(rows[0]);
  }

  async deleteParty(id: string): Promise<void> {
    const res = await this.client.query("DELETE FROM parties WHERE tenant_id = $1 AND id = $2", [this.tenantId, id]);
    if (res.rowCount === 0) throw new DomainError("NOT_FOUND", `Party ${id} not found`);
  }

  // --- Items (MDM-02) ---
  async listItems(
    companyId: string,
    filters: { category?: string; search?: string; status?: string; itemType?: string } = {},
  ): Promise<ItemRecord[]> {
    let sql = `
      SELECT id, tenant_id, company_id, sku, name, item_type, category, unit,
             unit_price::text, stock_quantity, reorder_point, status, metadata,
             created_at, updated_at
        FROM items
       WHERE tenant_id = $1 AND company_id = $2
    `;
    const params: unknown[] = [this.tenantId, companyId];

    if (filters.itemType) {
      params.push(filters.itemType);
      sql += ` AND item_type = $${params.length}`;
    }
    if (filters.category) {
      params.push(filters.category);
      sql += ` AND category = $${params.length}`;
    }
    if (filters.status) {
      params.push(filters.status);
      sql += ` AND status = $${params.length}`;
    }
    if (filters.search) {
      params.push(`%${filters.search.toLowerCase()}%`);
      sql += ` AND (lower(name) LIKE $${params.length} OR lower(sku) LIKE $${params.length})`;
    }

    sql += " ORDER BY sku ASC";
    const { rows } = await this.client.query<any>(sql, params);
    return rows.map(mapItem);
  }

  async findItem(id: string): Promise<ItemRecord | null> {
    const { rows } = await this.client.query<any>(
      `SELECT id, tenant_id, company_id, sku, name, item_type, category, unit,
              unit_price::text, stock_quantity, reorder_point, status, metadata,
              created_at, updated_at
         FROM items
        WHERE tenant_id = $1 AND id = $2`,
      [this.tenantId, id],
    );
    return rows[0] ? mapItem(rows[0]) : null;
  }

  async createItem(
    companyId: string,
    input: {
      sku: string;
      name: string;
      itemType?: "goods" | "service" | "bundle";
      category?: string | null;
      unit?: string;
      unitPrice?: string;
      stockQuantity?: number;
      reorderPoint?: number;
      status?: "in_stock" | "low_stock" | "out_of_stock" | "discontinued";
      metadata?: Record<string, unknown>;
    },
  ): Promise<ItemRecord> {
    const id = newId(this.clock.now().getTime());
    const now = this.clock.now().toISOString();
    const { rows } = await this.client.query<any>(
      `INSERT INTO items (id, tenant_id, company_id, sku, name, item_type, category, unit, unit_price, stock_quantity, reorder_point, status, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
       RETURNING id, tenant_id, company_id, sku, name, item_type, category, unit, unit_price::text, stock_quantity, reorder_point, status, metadata, created_at, updated_at`,
      [
        id,
        this.tenantId,
        companyId,
        input.sku.trim(),
        input.name.trim(),
        input.itemType || "goods",
        input.category?.trim() || null,
        input.unit || "pcs",
        input.unitPrice || "0.00",
        input.stockQuantity ?? 0,
        input.reorderPoint ?? 0,
        input.status || "in_stock",
        JSON.stringify(input.metadata || {}),
        now,
      ],
    );
    return mapItem(rows[0]);
  }

  async updateItem(
    id: string,
    input: {
      name?: string;
      itemType?: "goods" | "service" | "bundle";
      category?: string | null;
      unit?: string;
      unitPrice?: string;
      stockQuantity?: number;
      reorderPoint?: number;
      status?: "in_stock" | "low_stock" | "out_of_stock" | "discontinued";
      metadata?: Record<string, unknown>;
    },
  ): Promise<ItemRecord> {
    const existing = await this.findItem(id);
    if (!existing) throw new DomainError("NOT_FOUND", `Item ${id} not found`);

    const now = this.clock.now().toISOString();
    const { rows } = await this.client.query<any>(
      `UPDATE items
          SET name = COALESCE($3, name),
              item_type = COALESCE($4, item_type),
              category = COALESCE($5, category),
              unit = COALESCE($6, unit),
              unit_price = COALESCE($7, unit_price),
              stock_quantity = COALESCE($8, stock_quantity),
              reorder_point = COALESCE($9, reorder_point),
              status = COALESCE($10, status),
              metadata = COALESCE($11, metadata),
              updated_at = $12
        WHERE tenant_id = $1 AND id = $2
        RETURNING id, tenant_id, company_id, sku, name, item_type, category, unit, unit_price::text, stock_quantity, reorder_point, status, metadata, created_at, updated_at`,
      [
        this.tenantId,
        id,
        input.name ? input.name.trim() : null,
        input.itemType || null,
        input.category !== undefined ? input.category?.trim() || null : null,
        input.unit || null,
        input.unitPrice || null,
        input.stockQuantity !== undefined ? input.stockQuantity : null,
        input.reorderPoint !== undefined ? input.reorderPoint : null,
        input.status || null,
        input.metadata ? JSON.stringify(input.metadata) : null,
        now,
      ],
    );
    return mapItem(rows[0]);
  }

  async deleteItem(id: string): Promise<void> {
    const res = await this.client.query("DELETE FROM items WHERE tenant_id = $1 AND id = $2", [this.tenantId, id]);
    if (res.rowCount === 0) throw new DomainError("NOT_FOUND", `Item ${id} not found`);
  }
}

function mapParty(r: any): PartyRecord {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    companyId: r.company_id,
    name: r.name,
    partyType: r.party_type,
    email: r.email,
    phone: r.phone,
    taxId: r.tax_id,
    status: r.status,
    balance: r.balance,
    metadata: typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata || {},
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

function mapItem(r: any): ItemRecord {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    companyId: r.company_id,
    sku: r.sku,
    name: r.name,
    itemType: r.item_type,
    category: r.category,
    unit: r.unit,
    unitPrice: r.unit_price,
    stockQuantity: Number(r.stock_quantity),
    reorderPoint: Number(r.reorder_point),
    status: r.status,
    metadata: typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata || {},
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}
