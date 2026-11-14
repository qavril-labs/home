import type { AuditEntry, AuditStore, FieldChange } from "@erp/audit";
import type { DomainEvent, OutboxEntry, OutboxStore, ProcessedStore } from "@erp/events";
import type { IdentityRepository, SessionRecord, UserRecord, UserStatus } from "@erp/identity";
import type { CounterStore } from "@erp/numbering";
import type { Branch, Company, Tenant, TenantRepository, TenantStatus } from "@erp/tenancy";
import type { Queryable } from "./pool";

const iso = (value: Date): string => value.toISOString();

/**
 * Gap-free counter. The row lock is held until the caller's transaction ends, and a rollback
 * reverts the increment, so a number is only consumed by a document that was saved.
 */
export class PgCounterStore implements CounterStore {
  constructor(private readonly db: Queryable) {}

  async nextValue(tenantId: string, counterKey: string): Promise<bigint> {
    const { rows } = await this.db.query<{ allocated: string }>(
      `INSERT INTO number_counters (tenant_id, counter_key, next_value)
       VALUES ($1, $2, 2)
       ON CONFLICT (tenant_id, counter_key)
       DO UPDATE SET next_value = number_counters.next_value + 1
       RETURNING next_value - 1 AS allocated`,
      [tenantId, counterKey],
    );
    return BigInt(rows[0]!.allocated);
  }
}

interface OutboxRow {
  id: string;
  tenant_id: string;
  type: string;
  payload: unknown;
  occurred_at: Date;
  attempts: number;
}

export class PgOutboxStore implements OutboxStore {
  constructor(private readonly db: Queryable) {}

  async append(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.db.query(
        "INSERT INTO outbox_events (id, tenant_id, type, payload, occurred_at) VALUES ($1, $2, $3, $4, $5)",
        [event.id, event.tenantId, event.type, JSON.stringify(event.payload), event.occurredAt],
      );
    }
  }

  /** One statement leases the rows, so concurrent dispatchers never take the same event. */
  async claim(limit: number, leaseMs: number): Promise<OutboxEntry[]> {
    const { rows } = await this.db.query<OutboxRow>(
      `UPDATE outbox_events
          SET locked_until = now() + make_interval(secs => $2::double precision / 1000.0)
        WHERE id IN (
          SELECT id FROM outbox_events
           WHERE delivered_at IS NULL
             AND failed_at IS NULL
             AND (locked_until IS NULL OR locked_until < now())
           ORDER BY occurred_at
           LIMIT $1
           FOR UPDATE SKIP LOCKED
        )
        RETURNING id, tenant_id, type, payload, occurred_at, attempts`,
      [limit, leaseMs],
    );
    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      type: row.type,
      payload: row.payload,
      occurredAt: iso(row.occurred_at),
      attempts: row.attempts,
    }));
  }

  async markDelivered(eventId: string): Promise<void> {
    await this.db.query("UPDATE outbox_events SET delivered_at = now(), locked_until = NULL WHERE id = $1", [eventId]);
  }

  async recordFailure(eventId: string, error: string, maxAttempts: number): Promise<void> {
    await this.db.query(
      `UPDATE outbox_events
          SET attempts = attempts + 1,
              last_error = $2,
              locked_until = NULL,
              failed_at = CASE WHEN attempts + 1 >= $3 THEN now() END
        WHERE id = $1`,
      [eventId, error, maxAttempts],
    );
  }
}

export class PgProcessedStore implements ProcessedStore {
  constructor(private readonly db: Queryable) {}

  async has(consumer: string, eventId: string): Promise<boolean> {
    const { rows } = await this.db.query(
      "SELECT 1 FROM processed_events WHERE consumer = $1 AND event_id = $2",
      [consumer, eventId],
    );
    return rows.length > 0;
  }

  async mark(consumer: string, eventId: string): Promise<void> {
    await this.db.query(
      "INSERT INTO processed_events (consumer, event_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [consumer, eventId],
    );
  }
}

interface AuditRow {
  id: string;
  tenant_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  changes: FieldChange[];
  request_id: string | null;
  occurred_at: Date;
}

export class PgAuditStore implements AuditStore {
  constructor(private readonly db: Queryable) {}

  async append(entry: AuditEntry): Promise<void> {
    await this.db.query(
      `INSERT INTO audit_log
         (id, tenant_id, actor_id, action, entity_type, entity_id, changes, request_id, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.id,
        entry.tenantId,
        entry.actorId,
        entry.action,
        entry.entityType,
        entry.entityId,
        JSON.stringify(entry.changes),
        entry.requestId,
        entry.occurredAt,
      ],
    );
  }

  async listForEntity(tenantId: string, entityType: string, entityId: string): Promise<AuditEntry[]> {
    const { rows } = await this.db.query<AuditRow>(
      `SELECT id, tenant_id, actor_id, action, entity_type, entity_id, changes, request_id, occurred_at
         FROM audit_log
        WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3
        ORDER BY occurred_at, id`,
      [tenantId, entityType, entityId],
    );
    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      changes: row.changes,
      occurredAt: iso(row.occurred_at),
      requestId: row.request_id,
    }));
  }
}

interface UserRow {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  roles: string[];
  status: UserStatus;
  created_at: Date;
}

interface SessionRow {
  token_hash: string;
  tenant_id: string;
  user_id: string;
  expires_at: Date;
}

const userColumns = "id, tenant_id, email, password_hash, roles, status, created_at";

function userFromRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    email: row.email,
    passwordHash: row.password_hash,
    roles: row.roles,
    status: row.status,
    createdAt: iso(row.created_at),
  };
}

/** Tenant-bound: pass a transaction from withTenantTransaction so RLS applies. */
export class PgIdentityRepository implements IdentityRepository {
  constructor(private readonly db: Queryable) {}

  async insertUser(user: UserRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, roles, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [user.id, user.tenantId, user.email, user.passwordHash, [...user.roles], user.status, user.createdAt],
    );
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const { rows } = await this.db.query<UserRow>(`SELECT ${userColumns} FROM users WHERE email = $1`, [email]);
    return rows[0] ? userFromRow(rows[0]) : null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const { rows } = await this.db.query<UserRow>(`SELECT ${userColumns} FROM users WHERE id = $1`, [id]);
    return rows[0] ? userFromRow(rows[0]) : null;
  }

  async insertSession(session: SessionRecord): Promise<void> {
    await this.db.query(
      "INSERT INTO sessions (token_hash, tenant_id, user_id, expires_at) VALUES ($1, $2, $3, $4)",
      [session.tokenHash, session.tenantId, session.userId, session.expiresAt],
    );
  }

  async findSession(tokenHash: string): Promise<SessionRecord | null> {
    const { rows } = await this.db.query<SessionRow>(
      "SELECT token_hash, tenant_id, user_id, expires_at FROM sessions WHERE token_hash = $1",
      [tokenHash],
    );
    const row = rows[0];
    return row
      ? { tokenHash: row.token_hash, tenantId: row.tenant_id, userId: row.user_id, expiresAt: iso(row.expires_at) }
      : null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.db.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
  }
}

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  region: string;
  status: TenantStatus;
  created_at: Date;
}

interface CompanyRow {
  id: string;
  tenant_id: string;
  legal_name: string;
  country_code: string;
  base_currency: string;
  fiscal_year_start_month: number;
  created_at: Date;
}

interface BranchRow {
  id: string;
  tenant_id: string;
  company_id: string;
  code: string;
  name: string;
  timezone: string;
}

const tenantFromRow = (row: TenantRow): Tenant => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  region: row.region,
  status: row.status,
  createdAt: iso(row.created_at),
});

const companyFromRow = (row: CompanyRow): Company => ({
  id: row.id,
  tenantId: row.tenant_id,
  legalName: row.legal_name,
  countryCode: row.country_code,
  baseCurrency: row.base_currency,
  fiscalYearStartMonth: row.fiscal_year_start_month,
  createdAt: iso(row.created_at),
});

const branchFromRow = (row: BranchRow): Branch => ({
  id: row.id,
  tenantId: row.tenant_id,
  companyId: row.company_id,
  code: row.code,
  name: row.name,
  timezone: row.timezone,
});

/**
 * `tenants` has no RLS: it is the registry used to find a tenant before its context is set.
 * Company and branch rows are tenant-bound, so pass a transaction from withTenantTransaction.
 */
export class PgTenantRepository implements TenantRepository {
  constructor(private readonly db: Queryable) {}

  async insertTenant(tenant: Tenant): Promise<void> {
    await this.db.query(
      "INSERT INTO tenants (id, slug, name, region, status, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [tenant.id, tenant.slug, tenant.name, tenant.region, tenant.status, tenant.createdAt],
    );
  }

  async findTenantBySlug(slug: string): Promise<Tenant | null> {
    const { rows } = await this.db.query<TenantRow>(
      "SELECT id, slug, name, region, status, created_at FROM tenants WHERE slug = $1",
      [slug],
    );
    return rows[0] ? tenantFromRow(rows[0]) : null;
  }

  async findTenantById(id: string): Promise<Tenant | null> {
    const { rows } = await this.db.query<TenantRow>(
      "SELECT id, slug, name, region, status, created_at FROM tenants WHERE id = $1",
      [id],
    );
    return rows[0] ? tenantFromRow(rows[0]) : null;
  }

  async insertCompany(company: Company): Promise<void> {
    await this.db.query(
      `INSERT INTO companies
         (id, tenant_id, legal_name, country_code, base_currency, fiscal_year_start_month, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        company.id,
        company.tenantId,
        company.legalName,
        company.countryCode,
        company.baseCurrency,
        company.fiscalYearStartMonth,
        company.createdAt,
      ],
    );
  }

  async findCompany(companyId: string): Promise<Company | null> {
    const { rows } = await this.db.query<CompanyRow>(
      `SELECT id, tenant_id, legal_name, country_code, base_currency, fiscal_year_start_month, created_at
         FROM companies WHERE id = $1`,
      [companyId],
    );
    return rows[0] ? companyFromRow(rows[0]) : null;
  }

  async insertBranch(branch: Branch): Promise<void> {
    await this.db.query(
      "INSERT INTO branches (id, tenant_id, company_id, code, name, timezone) VALUES ($1, $2, $3, $4, $5, $6)",
      [branch.id, branch.tenantId, branch.companyId, branch.code, branch.name, branch.timezone],
    );
  }

  async findBranchByCode(companyId: string, code: string): Promise<Branch | null> {
    const { rows } = await this.db.query<BranchRow>(
      "SELECT id, tenant_id, company_id, code, name, timezone FROM branches WHERE company_id = $1 AND code = $2",
      [companyId, code],
    );
    return rows[0] ? branchFromRow(rows[0]) : null;
  }
}
