import { DomainError, newId, type Clock } from "@erp/kernel";
import type { Queryable } from "./pool";

export interface ApprovalRequestRecord {
  id: string;
  tenantId: string;
  companyId: string;
  botId: string;
  botName: string;
  actionType: string;
  title: string;
  summary: string;
  amount?: string | null;
  currency: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  status: "pending" | "approved" | "rejected" | "executed" | "cancelled";
  payload: Record<string, unknown>;
  confidenceScore: number;
  requestedAt: string;
  decidedAt?: string | null;
  decidedBy?: string | null;
  decisionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentAuditLogRecord {
  id: string;
  tenantId: string;
  companyId: string;
  botId: string;
  eventType: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  hashChain?: string | null;
  createdAt: string;
}

export interface CreateApprovalRequestInput {
  id?: string;
  companyId: string;
  botId: string;
  botName: string;
  actionType: string;
  title: string;
  summary: string;
  amount?: string | null;
  currency?: string;
  riskLevel?: "low" | "medium" | "high" | "critical";
  payload?: Record<string, unknown>;
  confidenceScore?: number;
}

export interface DecideApprovalInput {
  id: string;
  decision: "approved" | "rejected";
  decidedBy: string;
  reason?: string;
}

export interface RecordAgentAuditLogInput {
  id?: string;
  companyId: string;
  botId: string;
  eventType: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
  hashChain?: string;
}

export class PgApprovalsStore {
  constructor(private readonly clock: Clock = { now: () => new Date() }) {}

  async listApprovalRequests(
    client: Queryable,
    params: {
      status?: string;
      botId?: string;
      limit?: number;
    } = {}
  ): Promise<ApprovalRequestRecord[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.status && params.status !== "all") {
      values.push(params.status);
      conditions.push(`status = $${values.length}`);
    }

    if (params.botId) {
      values.push(params.botId);
      conditions.push(`bot_id = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(params.limit || 100, 200);

    const query = `
      SELECT
        id, tenant_id, company_id, bot_id, bot_name, action_type, title,
        summary, amount, currency, risk_level, status, payload, confidence_score,
        requested_at, decided_at, decided_by, decision_reason, created_at, updated_at
      FROM approval_requests
      ${whereClause}
      ORDER BY requested_at DESC
      LIMIT ${limit};
    `;

    const res = await client.query(query, values);

    return res.rows.map((r: any) => ({
      id: r.id,
      tenantId: r.tenant_id,
      companyId: r.company_id,
      botId: r.bot_id,
      botName: r.bot_name,
      actionType: r.action_type,
      title: r.title,
      summary: r.summary,
      amount: r.amount ? parseFloat(r.amount).toFixed(2) : null,
      currency: r.currency,
      riskLevel: r.risk_level,
      status: r.status,
      payload: r.payload || {},
      confidenceScore: parseFloat(r.confidence_score) || 95.0,
      requestedAt: r.requested_at.toISOString(),
      decidedAt: r.decided_at ? r.decided_at.toISOString() : null,
      decidedBy: r.decided_by,
      decisionReason: r.decision_reason,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));
  }

  async findApprovalRequest(client: Queryable, id: string): Promise<ApprovalRequestRecord | null> {
    const res = await client.query(
      `
      SELECT
        id, tenant_id, company_id, bot_id, bot_name, action_type, title,
        summary, amount, currency, risk_level, status, payload, confidence_score,
        requested_at, decided_at, decided_by, decision_reason, created_at, updated_at
      FROM approval_requests
      WHERE id = $1;
      `,
      [id]
    );

    if (res.rowCount === 0 || !res.rows[0]) return null;
    const r = res.rows[0];

    return {
      id: r.id,
      tenantId: r.tenant_id,
      companyId: r.company_id,
      botId: r.bot_id,
      botName: r.bot_name,
      actionType: r.action_type,
      title: r.title,
      summary: r.summary,
      amount: r.amount ? parseFloat(r.amount).toFixed(2) : null,
      currency: r.currency,
      riskLevel: r.risk_level,
      status: r.status,
      payload: r.payload || {},
      confidenceScore: parseFloat(r.confidence_score) || 95.0,
      requestedAt: r.requested_at.toISOString(),
      decidedAt: r.decided_at ? r.decided_at.toISOString() : null,
      decidedBy: r.decided_by,
      decisionReason: r.decision_reason,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    };
  }

  async createApprovalRequest(
    client: Queryable,
    tenantId: string,
    input: CreateApprovalRequestInput
  ): Promise<ApprovalRequestRecord> {
    const id = input.id || `appr-${newId()}`;
    const now = this.clock.now();

    const query = `
      INSERT INTO approval_requests (
        id, tenant_id, company_id, bot_id, bot_name, action_type, title,
        summary, amount, currency, risk_level, status, payload, confidence_score,
        requested_at, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, 'pending', $12, $13,
        $14, $14, $14
      )
      RETURNING *;
    `;

    const res = await client.query(query, [
      id,
      tenantId,
      input.companyId,
      input.botId,
      input.botName,
      input.actionType,
      input.title,
      input.summary,
      input.amount || null,
      input.currency || "USD",
      input.riskLevel || "medium",
      JSON.stringify(input.payload || {}),
      input.confidenceScore || 95.0,
      now,
    ]);

    const r = res.rows[0];
    if (!r) throw new Error("Database query returned empty result");
    return {
      id: r.id,
      tenantId: r.tenant_id,
      companyId: r.company_id,
      botId: r.bot_id,
      botName: r.bot_name,
      actionType: r.action_type,
      title: r.title,
      summary: r.summary,
      amount: r.amount ? parseFloat(r.amount).toFixed(2) : null,
      currency: r.currency,
      riskLevel: r.risk_level,
      status: r.status,
      payload: r.payload || {},
      confidenceScore: parseFloat(r.confidence_score) || 95.0,
      requestedAt: r.requested_at.toISOString(),
      decidedAt: null,
      decidedBy: null,
      decisionReason: null,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    };
  }

  async decideApproval(
    client: Queryable,
    input: DecideApprovalInput
  ): Promise<ApprovalRequestRecord> {
    const now = this.clock.now();

    const res = await client.query(
      `
      UPDATE approval_requests
      SET
        status = $1,
        decided_at = $2,
        decided_by = $3,
        decision_reason = $4,
        updated_at = $2
      WHERE id = $5 AND status = 'pending'
      RETURNING *;
      `,
      [input.decision, now, input.decidedBy, input.reason || null, input.id]
    );

    if (res.rowCount === 0) {
      const existing = await this.findApprovalRequest(client, input.id);
      if (!existing) {
        throw new DomainError("NOT_FOUND", `Approval request not found: ${input.id}`);
      }
      throw new DomainError(
        "CONFLICT",
        `Approval request already resolved: current status is '${existing.status}'`
      );
    }

    const r = res.rows[0];
    if (!r) throw new Error("Database query returned empty result");
    return {
      id: r.id,
      tenantId: r.tenant_id,
      companyId: r.company_id,
      botId: r.bot_id,
      botName: r.bot_name,
      actionType: r.action_type,
      title: r.title,
      summary: r.summary,
      amount: r.amount ? parseFloat(r.amount).toFixed(2) : null,
      currency: r.currency,
      riskLevel: r.risk_level,
      status: r.status,
      payload: r.payload || {},
      confidenceScore: parseFloat(r.confidence_score) || 95.0,
      requestedAt: r.requested_at.toISOString(),
      decidedAt: r.decided_at ? r.decided_at.toISOString() : null,
      decidedBy: r.decided_by,
      decisionReason: r.decision_reason,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    };
  }

  async listAgentAuditLogs(
    client: Queryable,
    params: { botId?: string; limit?: number } = {}
  ): Promise<AgentAuditLogRecord[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.botId) {
      values.push(params.botId);
      conditions.push(`bot_id = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(params.limit || 100, 200);

    const res = await client.query(
      `
      SELECT
        id, tenant_id, company_id, bot_id, event_type, action,
        entity_type, entity_id, details, hash_chain, created_at
      FROM agent_audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit};
      `,
      values
    );

    return res.rows.map((r: any) => ({
      id: r.id,
      tenantId: r.tenant_id,
      companyId: r.company_id,
      botId: r.bot_id,
      eventType: r.event_type,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      details: r.details || {},
      hashChain: r.hash_chain,
      createdAt: r.created_at.toISOString(),
    }));
  }

  async recordAgentAuditLog(
    client: Queryable,
    tenantId: string,
    input: RecordAgentAuditLogInput
  ): Promise<AgentAuditLogRecord> {
    const id = input.id || `audit-${newId()}`;
    const now = this.clock.now();

    const res = await client.query(
      `
      INSERT INTO agent_audit_logs (
        id, tenant_id, company_id, bot_id, event_type, action,
        entity_type, entity_id, details, hash_chain, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
      `,
      [
        id,
        tenantId,
        input.companyId,
        input.botId,
        input.eventType,
        input.action,
        input.entityType,
        input.entityId,
        JSON.stringify(input.details || {}),
        input.hashChain || null,
        now,
      ]
    );

    const r = res.rows[0];
    if (!r) throw new Error("Database query returned empty result");
    return {
      id: r.id,
      tenantId: r.tenant_id,
      companyId: r.company_id,
      botId: r.bot_id,
      eventType: r.event_type,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      details: r.details || {},
      hashChain: r.hash_chain,
      createdAt: r.created_at.toISOString(),
    };
  }
}
