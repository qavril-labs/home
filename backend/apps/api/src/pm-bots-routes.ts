import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { PgOutboxStore, PgPmBotsStore, withTenantTransaction, type Pool } from "@erp/db";
import { createEvent } from "@erp/events";
import { DomainError, newId, type Clock } from "@erp/kernel";
import { hasPermission, type Principal } from "@erp/identity";
import {
  BOT_TYPES,
  MON_FRI_ALL_DAY,
  approveReport,
  defaultBotConfig,
  hasBlocker,
  isBotType,
  openBlockerIncident,
  resolveSuggestion,
  submitStandup,
  validateBlockReason,
  type BotType,
} from "@erp/pm-bots";
import { auditWrite } from "./audit-write";

const PUT_BODY = z.object({ enabled: z.boolean(), config: z.record(z.string(), z.unknown()).optional() });
const TRIAGE_BODY = z.object({
  decision: z.enum(["accept", "override"]),
  category: z.string().trim().min(1).max(80).optional(),
  priority: z.string().trim().min(1).max(40).optional(),
  teamId: z.string().trim().min(1).max(80).optional(),
});
const STANDUP_BODY = z.object({
  yesterday: z.string().max(4000).default(""),
  today: z.string().max(4000).default(""),
  blockers: z.string().max(4000).default(""),
});
const LOG_QUERY = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export interface PmBotsRouteDeps {
  readonly pool: Pool;
  readonly clock: Clock;
  readonly authenticate: (request: FastifyRequest) => Promise<Principal>;
}

const ANY_BOT_PERMISSION = ["pm.bots.configure", "pm.bots.override", "pm.bots.view_logs"];

function parseBotType(value: string): BotType {
  if (!isBotType(value)) throw new DomainError("VALIDATION", `botType must be one of ${BOT_TYPES.join(", ")}`);
  return value;
}

/** Standup time is "HH:MM" in the project's fixed offset. Returns the local date and the cutoff instant. */
function standupWindow(now: Date, config: Record<string, unknown>): { date: string; cutoff: Date } {
  const offset = typeof config.timezoneOffsetMinutes === "number" ? config.timezoneOffsetMinutes : 0;
  const [h, m] = String(config.time ?? "09:30").split(":").map((x) => Number.parseInt(x, 10));
  const cutoffMinutes = typeof config.cutoffMinutes === "number" ? config.cutoffMinutes : 45;
  const local = new Date(now.getTime() + offset * 60_000);
  const date = local.toISOString().slice(0, 10);
  const startLocalMs = Date.parse(`${date}T00:00:00Z`) + ((h ?? 9) * 60 + (m ?? 30)) * 60_000;
  return { date, cutoff: new Date(startLocalMs + cutoffMinutes * 60_000 - offset * 60_000) };
}

export function registerPmBotsRoutes(app: FastifyInstance, deps: PmBotsRouteDeps): void {
  const { pool, clock, authenticate } = deps;

  async function signedIn(request: FastifyRequest, permission?: string | string[]): Promise<Principal> {
    const principal = await authenticate(request);
    const needed = permission === undefined ? [] : Array.isArray(permission) ? permission : [permission];
    if (needed.length > 0 && !needed.some((p) => hasPermission(principal.permissions, p))) {
      throw new DomainError("FORBIDDEN", `Missing permission ${needed.join(" or ")}`);
    }
    return principal;
  }

  // 1. The five bots for a project, with defaults for any never configured.
  app.get("/v1/projects/:projectId/bots", async (request) => {
    const principal = await signedIn(request, ANY_BOT_PERMISSION);
    const { projectId } = request.params as { projectId: string };
    return withTenantTransaction(pool, principal.tenantId, async (tx) => {
      const store = new PgPmBotsStore(tx);
      const [rows, dead] = await Promise.all([store.listConfigs(projectId), store.deadLetterBotTypes()]);
      const bots = BOT_TYPES.map((botType) => {
        const row = rows.find((r) => r.botType === botType);
        return {
          botType,
          enabled: row?.enabled ?? false,
          config: row?.config ?? defaultBotConfig(botType),
          updatedBy: row?.updatedBy ?? null,
          updatedAt: row?.updatedAt ?? null,
          deadLetterWarning: dead.has(botType),
        };
      });
      return { bots };
    });
  });

  // 2. Enable, disable or configure one bot.
  app.put("/v1/projects/:projectId/bots/:botType", async (request) => {
    const principal = await signedIn(request, "pm.bots.configure");
    const params = request.params as { projectId: string; botType: string };
    const botType = parseBotType(params.botType);
    const body = PUT_BODY.parse(request.body);
    return withTenantTransaction(pool, principal.tenantId, async (tx) => {
      const store = new PgPmBotsStore(tx);
      const before = await store.getConfig(params.projectId, botType);
      const config = body.config ?? before?.config ?? defaultBotConfig(botType);
      const saved = await store.upsertConfig(
        newId(), principal.tenantId, params.projectId, botType, body.enabled, config, principal.userId, clock.now(),
      );
      await auditWrite(tx, clock, principal, request, {
        action: "pm.bot.configure", entityType: "bot_config", entityId: `${params.projectId}:${botType}`,
        before: before ? { enabled: before.enabled, config: before.config } : null,
        after: { enabled: saved.enabled, config: saved.config },
      });
      return { ...saved, deadLetterWarning: false };
    });
  });

  // 3. Delivery log for one bot.
  app.get("/v1/projects/:projectId/bots/:botType/logs", async (request) => {
    const principal = await signedIn(request, "pm.bots.view_logs");
    const params = request.params as { projectId: string; botType: string };
    const botType = parseBotType(params.botType);
    const query = LOG_QUERY.parse(request.query);
    return withTenantTransaction(pool, principal.tenantId, (tx) =>
      new PgPmBotsStore(tx).listLogs(params.projectId, botType, query.limit, query.cursor),
    );
  });

  // 4. Accept or override a triage suggestion.
  app.post("/v1/tasks/:taskId/triage/resolve", async (request) => {
    const principal = await signedIn(request, "pm.bots.override");
    const { taskId } = request.params as { taskId: string };
    const body = TRIAGE_BODY.parse(request.body);
    return withTenantTransaction(pool, principal.tenantId, async (tx) => {
      const store = new PgPmBotsStore(tx);
      const current = await store.latestTriage(taskId);
      if (!current || current.status !== "pending") {
        if (current) throw new DomainError("CONFLICT", "This suggestion was already resolved");
        throw new DomainError("NOT_FOUND", "No triage suggestion for this task");
      }
      const status = resolveSuggestion(current.status, body.decision);
      const chosen = body.decision === "override" ? { category: body.category, priority: body.priority, teamId: body.teamId } : undefined;
      const resolved = await store.resolveTriage(current.id, status, principal.userId, clock.now(), chosen);
      await auditWrite(tx, clock, principal, request, {
        action: `pm.triage.${status}`, entityType: "triage_suggestion", entityId: current.id,
        before: { status: current.status, category: current.suggestedCategory, priority: current.suggestedPriority, teamId: current.suggestedTeamId },
        after: { status: resolved.status, category: resolved.suggestedCategory, priority: resolved.suggestedPriority, teamId: resolved.suggestedTeamId },
      });
      return resolved;
    });
  });

  // 5. Submit or edit today's standup response. A blocker opens one incident per person and day.
  app.post("/v1/projects/:projectId/standup/respond", async (request) => {
    const principal = await signedIn(request);
    const { projectId } = request.params as { projectId: string };
    const body = STANDUP_BODY.parse(request.body);
    return withTenantTransaction(pool, principal.tenantId, async (tx) => {
      const store = new PgPmBotsStore(tx);
      const now = clock.now();
      const config = (await store.getConfig(projectId, "daily_standup"))?.config ?? defaultBotConfig("daily_standup");
      const { date, cutoff } = standupWindow(now, config);
      const result = submitStandup(
        [],
        { projectId, userId: principal.userId, standupDate: date, ...body, submittedAt: now },
        cutoff,
      );
      const saved = await store.upsertStandup(newId(), principal.tenantId, {
        projectId, userId: principal.userId, standupDate: date, ...body, submittedAt: now.toISOString(),
      });
      let incidentOpened = false;
      if (result.blockerEvent && hasBlocker(body.blockers)) {
        let reason: string | null = null;
        try {
          reason = validateBlockReason(body.blockers);
        } catch {
          reason = null; // too short to track as an incident; the digest still shows it
        }
        if (reason) {
          const incident = openBlockerIncident({
            id: newId(), tenantId: principal.tenantId, taskId: "", reason, blockedAt: now, calendar: MON_FRI_ALL_DAY,
          });
          incidentOpened = await store.openStandupIncident(
            incident.id, principal.tenantId, projectId, principal.userId, date, reason, now, incident.slaDueAt,
          );
          if (incidentOpened) {
            await new PgOutboxStore(tx).append([
              createEvent("standup.blocker_reported", principal.tenantId, { projectId, userId: principal.userId, standupDate: date, text: reason }, clock),
            ]);
          }
        }
      }
      await auditWrite(tx, clock, principal, request, {
        action: "pm.standup.respond", entityType: "standup_response", entityId: `${projectId}:${principal.userId}:${date}`,
        after: { standupDate: date, late: result.late, blockerReported: incidentOpened },
      });
      return { ...saved, late: result.late };
    });
  });

  // 6. Approve a draft weekly report. The delivery job sends it and then marks it sent.
  app.post("/v1/projects/:projectId/reports/:reportId/approve", async (request) => {
    const principal = await signedIn(request, "pm.bots.override");
    const { projectId, reportId } = request.params as { projectId: string; reportId: string };
    return withTenantTransaction(pool, principal.tenantId, async (tx) => {
      const store = new PgPmBotsStore(tx);
      const report = await store.getReport(projectId, reportId);
      if (!report) throw new DomainError("NOT_FOUND", "Report not found");
      if (report.status !== "draft") throw new DomainError("CONFLICT", "Only a draft report can be approved");
      approveReport({ status: report.status, createdAt: new Date(0), remindedAt: null, sentAt: null });
      const updated = await store.setReportStatus(report.id, "approved", null);
      await auditWrite(tx, clock, principal, request, {
        action: "pm.report.approve", entityType: "weekly_report", entityId: report.id,
        before: { status: report.status }, after: { status: updated.status },
      });
      return updated;
    });
  });
}
