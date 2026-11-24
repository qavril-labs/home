import type { Queryable } from "./pool";

/** Plain SQL for the project management bots. Every call runs inside a tenant transaction (row-level security). */

export interface BotConfigRow {
  botType: string;
  enabled: boolean;
  config: Record<string, unknown>;
  updatedBy: string | null;
  updatedAt: string;
}

export interface BotLogRow {
  id: string;
  botType: string;
  entityId: string;
  recipientId: string | null;
  channel: string;
  status: string;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface TriageRow {
  id: string;
  taskId: string;
  suggestedCategory: string | null;
  suggestedPriority: string | null;
  suggestedTeamId: string | null;
  duplicateOfTaskId: string | null;
  confidence: number;
  status: "pending" | "accepted" | "overridden";
  resolvedBy: string | null;
  resolvedAt: string | null;
}

export interface StandupRow {
  projectId: string;
  userId: string;
  standupDate: string;
  yesterday: string;
  today: string;
  blockers: string;
  submittedAt: string;
}

export interface ReportRow {
  id: string;
  projectId: string;
  weekStart: string;
  weekEnd: string;
  healthStatus: "green" | "amber" | "red";
  status: "draft" | "approved" | "sent";
  sentAt: string | null;
  summary: Record<string, number>;
}

const iso = (v: Date | string | null): string | null => (v === null ? null : v instanceof Date ? v.toISOString() : String(v));
const day = (v: Date | string): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

export class PgPmBotsStore {
  constructor(private readonly db: Queryable) {}

  async listConfigs(projectId: string): Promise<BotConfigRow[]> {
    const { rows } = await this.db.query(
      "SELECT bot_type, enabled, config_json, updated_by, updated_at FROM bot_configs WHERE project_id = $1",
      [projectId],
    );
    return rows.map((r) => ({
      botType: r.bot_type, enabled: r.enabled, config: r.config_json, updatedBy: r.updated_by, updatedAt: iso(r.updated_at)!,
    }));
  }

  async getConfig(projectId: string, botType: string): Promise<BotConfigRow | null> {
    return (await this.listConfigs(projectId)).find((c) => c.botType === botType) ?? null;
  }

  async upsertConfig(
    id: string, tenantId: string, projectId: string, botType: string, enabled: boolean,
    config: Record<string, unknown>, userId: string, at: Date,
  ): Promise<BotConfigRow> {
    const { rows } = await this.db.query(
      `INSERT INTO bot_configs (id, tenant_id, project_id, bot_type, enabled, config_json, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (tenant_id, project_id, bot_type)
       DO UPDATE SET enabled = EXCLUDED.enabled, config_json = EXCLUDED.config_json,
                     updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at
       RETURNING bot_type, enabled, config_json, updated_by, updated_at`,
      [id, tenantId, projectId, botType, enabled, JSON.stringify(config), userId, at],
    );
    const r = rows[0]!;
    return { botType: r.bot_type, enabled: r.enabled, config: r.config_json, updatedBy: r.updated_by, updatedAt: iso(r.updated_at)! };
  }

  /** Bot types that have jobs in the dead-letter queue. */
  async deadLetterBotTypes(): Promise<Set<string>> {
    const { rows } = await this.db.query("SELECT DISTINCT bot_type FROM bot_dead_letter_queue");
    return new Set(rows.map((r) => r.bot_type as string));
  }

  /** Keyset page, newest first. The cursor is "<created_at iso>|<id>". */
  async listLogs(projectId: string, botType: string, limit: number, cursor?: string): Promise<{ logs: BotLogRow[]; nextCursor: string | null }> {
    const params: unknown[] = [projectId, botType, limit + 1];
    let after = "";
    if (cursor) {
      const [at, id] = cursor.split("|");
      params.push(at, id);
      after = "AND (created_at, id) < ($4::timestamptz, $5)";
    }
    const { rows } = await this.db.query(
      `SELECT id, bot_type, entity_id, recipient_id, channel, status, error, created_at, sent_at
         FROM bot_delivery_log
        WHERE project_id = $1 AND bot_type = $2 ${after}
        ORDER BY created_at DESC, id DESC LIMIT $3`,
      params,
    );
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      logs: page.map((r) => ({
        id: r.id, botType: r.bot_type, entityId: r.entity_id, recipientId: r.recipient_id, channel: r.channel,
        status: r.status, error: r.error, createdAt: iso(r.created_at)!, sentAt: iso(r.sent_at),
      })),
      nextCursor: rows.length > limit && last ? `${iso(last.created_at)}|${last.id}` : null,
    };
  }

  private triage(r: Record<string, any>): TriageRow {
    return {
      id: r.id, taskId: r.task_id, suggestedCategory: r.suggested_category, suggestedPriority: r.suggested_priority,
      suggestedTeamId: r.suggested_team_id, duplicateOfTaskId: r.duplicate_of_task_id, confidence: Number(r.confidence),
      status: r.status, resolvedBy: r.resolved_by, resolvedAt: iso(r.resolved_at),
    };
  }

  /** Newest suggestion for a task, whatever its state. */
  async latestTriage(taskId: string): Promise<TriageRow | null> {
    const { rows } = await this.db.query(
      "SELECT * FROM triage_suggestions WHERE task_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE",
      [taskId],
    );
    return rows[0] ? this.triage(rows[0]) : null;
  }

  async resolveTriage(
    id: string, status: "accepted" | "overridden", userId: string, at: Date,
    chosen?: { category?: string; priority?: string; teamId?: string },
  ): Promise<TriageRow> {
    const { rows } = await this.db.query(
      `UPDATE triage_suggestions
          SET status = $2, resolved_by = $3, resolved_at = $4,
              suggested_category = COALESCE($5, suggested_category),
              suggested_priority = COALESCE($6, suggested_priority),
              suggested_team_id = COALESCE($7, suggested_team_id)
        WHERE id = $1 RETURNING *`,
      [id, status, userId, at, chosen?.category ?? null, chosen?.priority ?? null, chosen?.teamId ?? null],
    );
    return this.triage(rows[0]!);
  }

  async upsertStandup(id: string, tenantId: string, r: StandupRow): Promise<StandupRow> {
    const { rows } = await this.db.query(
      `INSERT INTO standup_responses (id, tenant_id, project_id, user_id, standup_date, yesterday, today, blockers, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (tenant_id, project_id, user_id, standup_date)
       DO UPDATE SET yesterday = EXCLUDED.yesterday, today = EXCLUDED.today, blockers = EXCLUDED.blockers, submitted_at = EXCLUDED.submitted_at
       RETURNING project_id, user_id, standup_date, yesterday, today, blockers, submitted_at`,
      [id, tenantId, r.projectId, r.userId, r.standupDate, r.yesterday, r.today, r.blockers, r.submittedAt],
    );
    const x = rows[0]!;
    return {
      projectId: x.project_id, userId: x.user_id, standupDate: day(x.standup_date), yesterday: x.yesterday,
      today: x.today, blockers: x.blockers, submittedAt: iso(x.submitted_at)!,
    };
  }

  /** True when a new incident was opened; false when this person already has one for the day. */
  async openStandupIncident(
    id: string, tenantId: string, projectId: string, userId: string, standupDate: string,
    reason: string, blockedAt: Date, slaDueAt: Date,
  ): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `INSERT INTO blocker_incidents (id, tenant_id, project_id, source, reported_by, standup_date, reason, blocked_at, sla_due_at)
       VALUES ($1, $2, $3, 'standup', $4, $5, $6, $7, $8)
       ON CONFLICT (tenant_id, project_id, reported_by, standup_date) WHERE source = 'standup' DO NOTHING`,
      [id, tenantId, projectId, userId, standupDate, reason, blockedAt, slaDueAt],
    );
    return (rowCount ?? 0) > 0;
  }

  private report(r: Record<string, any>): ReportRow {
    return {
      id: r.id, projectId: r.project_id, weekStart: day(r.week_start), weekEnd: day(r.week_end),
      healthStatus: r.health_status, status: r.status, sentAt: iso(r.sent_at), summary: r.summary_json,
    };
  }

  async getReport(projectId: string, reportId: string): Promise<ReportRow | null> {
    const { rows } = await this.db.query(
      "SELECT * FROM weekly_reports WHERE project_id = $1 AND id = $2 FOR UPDATE",
      [projectId, reportId],
    );
    return rows[0] ? this.report(rows[0]) : null;
  }

  async setReportStatus(reportId: string, status: "approved" | "sent", at: Date | null): Promise<ReportRow> {
    const { rows } = await this.db.query(
      "UPDATE weekly_reports SET status = $2, sent_at = COALESCE($3, sent_at) WHERE id = $1 RETURNING *",
      [reportId, status, at],
    );
    return this.report(rows[0]!);
  }

  /** Open blocker incidents that have not been closed. The scanner decides which are due. */
  async openIncidents(): Promise<OpenIncidentRow[]> {
    const { rows } = await this.db.query(
      `SELECT id, project_id, task_id, reason, blocked_by_user_id, reported_by, blocked_at, sla_due_at, escalated_at, escalation_count
         FROM blocker_incidents WHERE unblocked_at IS NULL ORDER BY sla_due_at, id`,
    );
    return rows.map((r) => ({
      id: r.id, projectId: r.project_id, taskId: r.task_id, reason: r.reason, blockedByUserId: r.blocked_by_user_id,
      reportedBy: r.reported_by, blockedAt: new Date(r.blocked_at), slaDueAt: new Date(r.sla_due_at),
      escalatedAt: r.escalated_at ? new Date(r.escalated_at) : null, escalationCount: r.escalation_count,
    }));
  }

  async markIncidentEscalated(id: string, at: Date): Promise<void> {
    await this.db.query(
      "UPDATE blocker_incidents SET escalated_at = $2, escalation_count = escalation_count + 1 WHERE id = $1 AND unblocked_at IS NULL",
      [id, at],
    );
  }

  /** True exactly once per key. The unique key on (tenant, idempotency_key) is what stops a double send. */
  async claimDelivery(d: {
    id: string; tenantId: string; projectId: string | null; key: string; botType: string;
    entityId: string; recipientId: string | null; channel: string; status: "queued" | "skipped"; error?: string;
  }): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `INSERT INTO bot_delivery_log (id, tenant_id, project_id, idempotency_key, bot_type, entity_id, recipient_id, channel, status, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
      [d.id, d.tenantId, d.projectId, d.key, d.botType, d.entityId, d.recipientId, d.channel, d.status, d.error ?? null],
    );
    return (rowCount ?? 0) > 0;
  }

  async finishDelivery(key: string, status: "sent" | "failed", at: Date, error?: string): Promise<void> {
    await this.db.query(
      `UPDATE bot_delivery_log SET status = $2, attempts = attempts + 1, error = $3, sent_at = CASE WHEN $2 = 'sent' THEN $4::timestamptz END
        WHERE idempotency_key = $1`,
      [key, status, error ?? null, at],
    );
  }

  async userEmail(userId: string): Promise<string | null> {
    const { rows } = await this.db.query("SELECT email FROM users WHERE id = $1 AND status = 'ACTIVE'", [userId]);
    return rows[0]?.email ?? null;
  }

  /** Drafts older than the cutoff that have not been reminded about. */
  async draftsNeedingReminder(createdBefore: Date): Promise<{ id: string; projectId: string; weekStart: string; createdAt: Date }[]> {
    const { rows } = await this.db.query(
      "SELECT id, project_id, week_start, created_at FROM weekly_reports WHERE status = 'draft' AND reminded_at IS NULL AND created_at <= $1",
      [createdBefore],
    );
    return rows.map((r) => ({ id: r.id, projectId: r.project_id, weekStart: day(r.week_start), createdAt: new Date(r.created_at) }));
  }

  async markReportReminded(id: string, at: Date): Promise<void> {
    await this.db.query("UPDATE weekly_reports SET reminded_at = $2 WHERE id = $1 AND reminded_at IS NULL", [id, at]);
  }

  /** Takes a transaction-scoped lock so two worker replicas never run the same scan for a tenant. */
  async tryScanLock(name: string): Promise<boolean> {
    const { rows } = await this.db.query("SELECT pg_try_advisory_xact_lock(hashtext($1)) AS ok", [name]);
    return rows[0]?.ok === true;
  }
}

export interface OpenIncidentRow {
  id: string;
  projectId: string | null;
  taskId: string | null;
  reason: string;
  blockedByUserId: string | null;
  reportedBy: string | null;
  blockedAt: Date;
  slaDueAt: Date;
  escalatedAt: Date | null;
  escalationCount: number;
}
