import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PgTenantRepository, PgPmBotsStore, withTenantTransaction } from "@erp/db";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import { newId, type Clock } from "@erp/kernel";
import { TenantService } from "@erp/tenancy";
import { runBlockerEscalationScan, runReportReminderScan } from "../src/pm-bots-jobs";

const H = 3_600_000;
const start = new Date("2026-11-24T12:00:00Z"); // a Tuesday
let nowMs = start.getTime();
const clock: Clock = { now: () => new Date(nowMs) };

describe("PM bot scans (BE-P2, BE-P3, BE-N2, WS-N3)", () => {
  let db: TestDatabase;
  let tenantId: string;
  let ownerId: string;
  const jobs: { name: string; data: unknown }[] = [];
  const emailQueue = { add: async (name: string, data: unknown) => void jobs.push({ name, data }) };
  const deps = () => ({ pool: db.appPool, clock, emailQueue });

  beforeAll(async () => {
    db = await startTestDatabase();
    tenantId = newId();
    ownerId = newId();
    await withTenantTransaction(db.appPool, tenantId, async (tx) => {
      await new TenantService(new PgTenantRepository(tx)).createTenant({ slug: "pm-scan", name: "pm-scan", region: "EU" }, tenantId);
      await tx.query("INSERT INTO users (id, tenant_id, email, password_hash, roles) VALUES ($1, $2, 'boss@example.com', 'x', '{}')", [ownerId, tenantId]);
      const store = new PgPmBotsStore(tx);
      await store.upsertConfig(newId(), tenantId, "p1", "blocker_escalation", true, { escalationOwnerId: ownerId }, ownerId, start);
      await store.upsertConfig(newId(), tenantId, "p1", "weekly_report", true, { reviewerId: ownerId }, ownerId, start);
      for (const id of ["open-1", "closed-1"]) {
        await tx.query(
          `INSERT INTO blocker_incidents (id, tenant_id, project_id, task_id, reason, blocked_at, sla_due_at, unblocked_at)
           VALUES ($1, $2, 'p1', $1, 'Waiting on keys', $3, $4, $5)`,
          [id, tenantId, start, new Date(start.getTime() + 24 * H), id === "closed-1" ? start : null],
        );
      }
      await tx.query(
        `INSERT INTO weekly_reports (id, tenant_id, project_id, week_start, week_end, summary_json, health_status, created_at)
         VALUES ('r1', $1, 'p1', '2026-11-16', '2026-11-22', '{}', 'green', $2)`,
        [tenantId, start],
      );
    });
  }, 180_000);

  afterAll(async () => {
    await db?.stop();
  });

  it("does nothing before the SLA", async () => {
    nowMs = start.getTime() + 23 * H;
    expect((await runBlockerEscalationScan(deps())).claimed).toBe(0);
  });

  it("BE-P2 escalates an open incident once after the SLA, and skips a closed one (BE-P3, BE-N2)", async () => {
    nowMs = start.getTime() + 25 * H;
    const first = await runBlockerEscalationScan(deps());
    expect(first).toMatchObject({ claimed: 1, sent: 1, failed: 0 });
    const second = await runBlockerEscalationScan(deps());
    expect(second.claimed).toBe(0);
    const log = await db.adminPool.query("SELECT entity_id, status FROM bot_delivery_log WHERE bot_type = 'blocker_escalation'");
    expect(log.rows).toEqual([{ entity_id: "open-1", status: "sent" }]);
    const audit = await db.adminPool.query("SELECT changes FROM audit_log WHERE action = 'pm.blocker.escalate'");
    expect(audit.rowCount).toBe(1);
  });

  it("WS-N3 reminds the reviewer once about a draft older than 24 hours and leaves it a draft", async () => {
    nowMs = start.getTime() + 25 * H;
    expect((await runReportReminderScan(deps())).sent).toBe(1);
    expect((await runReportReminderScan(deps())).claimed).toBe(0);
    const r = await db.adminPool.query("SELECT status FROM weekly_reports WHERE id = 'r1'");
    expect(r.rows[0].status).toBe("draft");
  });
});
