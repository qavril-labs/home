// Scheduled scans for the project management bots (PSA-01 bots). Each scan runs per tenant, behind a
// transaction-scoped advisory lock so two worker replicas never run the same scan twice. A notification
// is claimed in bot_delivery_log before it is queued, so a repeated scan cannot send it again.
import { AuditLog } from "@erp/audit";
import { PgAuditStore, PgNotificationStore, PgPmBotsStore, withTenantTransaction, type Pool, type Queryable } from "@erp/db";
import { DomainError, newId, type Clock } from "@erp/kernel";
import { enqueueEmail, type EmailJobQueue } from "@erp/notifications";
import {
  MON_FRI_ALL_DAY,
  draftReminderDue,
  incidentsToEscalate,
  keys,
  type BlockerIncident,
} from "@erp/pm-bots";

export interface ScanDeps {
  pool: Pool;
  clock: Clock;
  emailQueue: EmailJobQueue;
}

export interface ScanReport {
  tenants: number;
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
}

const empty = (): ScanReport => ({ tenants: 0, claimed: 0, sent: 0, failed: 0, skipped: 0 });

/** Tenants are not row-level-secured, so listing them with the pool is allowed. */
async function activeTenantIds(pool: Pool): Promise<string[]> {
  const { rows } = await pool.query("SELECT id FROM tenants WHERE status = 'ACTIVE' ORDER BY id");
  return rows.map((r) => r.id as string);
}

interface PendingEmail {
  key: string;
  tenantId: string;
  to: string;
  subject: string;
  text: string;
  templateKey: string;
}

/** Queues each email after its claim committed, then records the outcome. A failed send stays visible in the log. */
async function sendClaimed(deps: ScanDeps, tenantId: string, pending: PendingEmail[], report: ScanReport): Promise<void> {
  for (const mail of pending) {
    let error: string | undefined;
    try {
      await enqueueEmail(new PgNotificationStore(deps.pool), deps.emailQueue, {
        tenantId, templateKey: mail.templateKey, to: mail.to, email: { subject: mail.subject, text: mail.text },
      });
    } catch (e) {
      error = e instanceof DomainError || e instanceof Error ? e.message : String(e);
    }
    await withTenantTransaction(deps.pool, tenantId, (tx) =>
      new PgPmBotsStore(tx).finishDelivery(mail.key, error ? "failed" : "sent", deps.clock.now(), error),
    );
    if (error) report.failed++;
    else report.sent++;
  }
}

async function auditBot(tx: Queryable, deps: ScanDeps, tenantId: string, action: string, entityType: string, entityId: string, after: Record<string, unknown>, botType: string): Promise<void> {
  await new AuditLog(new PgAuditStore(tx), deps.clock).record({
    tenantId, actorId: null, action, entityType, entityId, before: null,
    after: { actorType: "bot", botType, ...after }, requestId: null,
  });
}

/** Escalates blocker incidents past their working-hours SLA. Runs every 15 minutes. */
export async function runBlockerEscalationScan(deps: ScanDeps): Promise<ScanReport> {
  const report = empty();
  for (const tenantId of await activeTenantIds(deps.pool)) {
    report.tenants++;
    const pending: PendingEmail[] = [];
    await withTenantTransaction(deps.pool, tenantId, async (tx) => {
      const store = new PgPmBotsStore(tx);
      if (!(await store.tryScanLock(`pm-bots:blocker:${tenantId}`))) return;
      const now = deps.clock.now();
      const open = await store.openIncidents();
      for (const row of open) {
        const projectId = row.projectId ?? "";
        const cfgRow = await store.getConfig(projectId, "blocker_escalation");
        if (cfgRow && !cfgRow.enabled) continue;
        const cfg = cfgRow?.config ?? {};
        const policy = {
          calendar: MON_FRI_ALL_DAY,
          repeatEveryWorkingHours: typeof cfg.repeatEveryWorkingHours === "number" ? cfg.repeatEveryWorkingHours : undefined,
          maxEscalations: typeof cfg.maxEscalations === "number" ? cfg.maxEscalations : 3,
        };
        const incident: BlockerIncident = {
          id: row.id, tenantId, taskId: row.taskId ?? "", reason: row.reason, blockedByUserId: row.blockedByUserId,
          blockedAt: row.blockedAt, slaDueAt: row.slaDueAt, escalatedAt: row.escalatedAt,
          escalationCount: row.escalationCount, unblockedAt: null,
        };
        if (incidentsToEscalate([incident], now, policy).length === 0) continue;

        const ownerId = typeof cfg.escalationOwnerId === "string" ? cfg.escalationOwnerId : null;
        const key = keys.blocker(tenantId, row.id, `escalation-${row.escalationCount + 1}`);
        const base = { id: newId(), tenantId, projectId: row.projectId, key, botType: "blocker_escalation", entityId: row.id, recipientId: ownerId, channel: "email" };
        const email = ownerId ? await store.userEmail(ownerId) : null;
        if (!email) {
          // Nobody to tell. Record it once so the project can see why, and do not mark the incident escalated.
          if (await store.claimDelivery({ ...base, status: "skipped", error: ownerId ? "escalation owner has no active email" : "no escalation owner configured" })) report.skipped++;
          continue;
        }
        if (!(await store.claimDelivery({ ...base, status: "queued" }))) continue;
        await store.markIncidentEscalated(row.id, now);
        report.claimed++;
        await auditBot(tx, deps, tenantId, "pm.blocker.escalate", "blocker_incident", row.id, { escalationCount: row.escalationCount + 1, projectId: row.projectId }, "blocker_escalation");
        pending.push({
          key, tenantId, to: email, templateKey: "pm.blocker.escalation",
          subject: "Blocked past its deadline",
          text: `A blocker is still open after its working-hours deadline.\n\nReason: ${row.reason}\nBlocked since: ${row.blockedAt.toISOString()}\n`,
        });
      }
    });
    await sendClaimed(deps, tenantId, pending, report);
  }
  return report;
}

/** One reminder to the report's reviewer after 24 hours as a draft. A draft is never sent without approval. */
export async function runReportReminderScan(deps: ScanDeps): Promise<ScanReport> {
  const report = empty();
  for (const tenantId of await activeTenantIds(deps.pool)) {
    report.tenants++;
    const pending: PendingEmail[] = [];
    await withTenantTransaction(deps.pool, tenantId, async (tx) => {
      const store = new PgPmBotsStore(tx);
      if (!(await store.tryScanLock(`pm-bots:report:${tenantId}`))) return;
      const now = deps.clock.now();
      for (const draft of await store.draftsNeedingReminder(new Date(now.getTime() - 24 * 3_600_000))) {
        if (!draftReminderDue({ status: "draft", createdAt: draft.createdAt, remindedAt: null, sentAt: null }, now)) continue;
        const cfg = await store.getConfig(draft.projectId, "weekly_report");
        if (cfg && !cfg.enabled) continue;
        const reviewerId = typeof cfg?.config.reviewerId === "string" ? cfg.config.reviewerId : cfg?.updatedBy ?? null;
        const key = keys.weeklyReport(tenantId, draft.projectId, `${draft.weekStart}:reminder`);
        const base = { id: newId(), tenantId, projectId: draft.projectId, key, botType: "weekly_report", entityId: draft.id, recipientId: reviewerId, channel: "email" };
        const email = reviewerId ? await store.userEmail(reviewerId) : null;
        if (!email) {
          if (await store.claimDelivery({ ...base, status: "skipped", error: "no reviewer with an active email" })) report.skipped++;
          await store.markReportReminded(draft.id, now);
          continue;
        }
        if (!(await store.claimDelivery({ ...base, status: "queued" }))) continue;
        await store.markReportReminded(draft.id, now);
        report.claimed++;
        await auditBot(tx, deps, tenantId, "pm.report.remind", "weekly_report", draft.id, { projectId: draft.projectId }, "weekly_report");
        pending.push({
          key, tenantId, to: email, templateKey: "pm.report.reminder",
          subject: "Your weekly status report is waiting for approval",
          text: `The weekly report for the week starting ${draft.weekStart} is still a draft. It is not sent until you approve it.\n`,
        });
      }
    });
    await sendClaimed(deps, tenantId, pending, report);
  }
  return report;
}
