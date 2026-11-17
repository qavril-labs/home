import type { ApprovalRequest, ApprovalStatus, ApprovalStore } from "@erp/approvals";
import type { Queryable } from "./pool";

interface ApprovalRow {
  id: string;
  company_id: string;
  kind: string;
  reason: string;
  payload: Record<string, unknown>;
  requested_by: string;
  status: ApprovalStatus;
  requested_at: Date;
  decided_by: string | null;
  decided_at: Date | null;
  decision_note: string | null;
}

const COLUMNS = "id, company_id, kind, reason, payload, requested_by, status, requested_at, decided_by, decided_at, decision_note";

/** Postgres approval store. Use a transaction from withTenantTransaction so row-level security applies. */
export class PgApprovalStore implements ApprovalStore {
  constructor(private readonly db: Queryable, private readonly tenantId: string) {}

  async get(companyId: string, id: string): Promise<ApprovalRequest | undefined> {
    const { rows } = await this.db.query<ApprovalRow>(
      `SELECT ${COLUMNS} FROM approval_requests WHERE tenant_id = $1 AND company_id = $2 AND id = $3`,
      [this.tenantId, companyId, id],
    );
    return rows[0] ? toRequest(rows[0]) : undefined;
  }

  async save(request: ApprovalRequest): Promise<void> {
    await this.db.query(
      `INSERT INTO approval_requests (tenant_id, company_id, id, kind, reason, payload, requested_by, status,
                                      requested_at, decided_by, decided_at, decision_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (tenant_id, id) DO UPDATE
         SET status = EXCLUDED.status, decided_by = EXCLUDED.decided_by,
             decided_at = EXCLUDED.decided_at, decision_note = EXCLUDED.decision_note`,
      [
        this.tenantId,
        request.companyId,
        request.id,
        request.kind,
        request.reason,
        JSON.stringify(request.payload),
        request.requestedBy,
        request.status,
        request.requestedAt,
        request.decidedBy,
        request.decidedAt,
        request.decisionNote,
      ],
    );
  }

  async list(companyId: string, status?: ApprovalStatus): Promise<ApprovalRequest[]> {
    const { rows } = await this.db.query<ApprovalRow>(
      `SELECT ${COLUMNS} FROM approval_requests
        WHERE tenant_id = $1 AND company_id = $2 AND ($3::text IS NULL OR status = $3)
        ORDER BY requested_at, id`,
      [this.tenantId, companyId, status ?? null],
    );
    return rows.map(toRequest);
  }
}

function toRequest(row: ApprovalRow): ApprovalRequest {
  return {
    id: row.id,
    companyId: row.company_id,
    kind: row.kind,
    reason: row.reason,
    payload: row.payload,
    requestedBy: row.requested_by,
    status: row.status,
    requestedAt: row.requested_at.toISOString(),
    decidedBy: row.decided_by,
    decidedAt: row.decided_at ? row.decided_at.toISOString() : null,
    decisionNote: row.decision_note,
  };
}
