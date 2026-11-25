import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { withTenantTransaction, type Pool } from "@erp/db";
import type { Principal } from "@erp/identity";

export interface HrmsRouteDeps {
  pool: Pool;
  authenticate: (req: FastifyRequest) => Promise<Principal>;
}

const RevealPiiBody = z.object({
  reason: z.string().min(1),
});

const RejectCandidateBody = z.object({
  reasonCode: z.string().min(1),
});

const OverrideCheckBody = z.object({
  reason: z.string().min(1),
});

const WaiveClearanceBody = z.object({
  reason: z.string().min(1),
});

export function hrmsRoutes(app: FastifyInstance, deps?: HrmsRouteDeps): void {
  // Dashboard, Onboarding & Compliance (HRM-10, HRM-14)
  app.get("/v1/hrms/dashboard", async (req) => {
    if (!deps) {
      return {
        headcount: 142,
        openRequisitions: 6,
        timeToHireDays: 24,
        offerAcceptanceRate: "88.0%",
        attritionRate: "4.2%",
        overdueProbationReviews: 2,
        leaveAwaitingApproval: 4,
        payRunsAwaitingApproval: 1,
        fnfAwaitingPayment: 1,
      };
    }
    const principal = await deps.authenticate(req);
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const empRes = await tx.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM hrm_employees WHERE tenant_id = $1 AND status = 'active'",
        [principal.tenantId]
      );
      const reqRes = await tx.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM hrm_requisitions WHERE tenant_id = $1 AND state IN ('submitted', 'open')",
        [principal.tenantId]
      );
      const leaveRes = await tx.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM hrm_leave_requests WHERE tenant_id = $1 AND status = 'pending'",
        [principal.tenantId]
      );
      const payRes = await tx.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM hrm_pay_runs WHERE tenant_id = $1 AND state = 'verified'",
        [principal.tenantId]
      );
      const fnfRes = await tx.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM hrm_exit_cases WHERE tenant_id = $1 AND state = 'fnf_approved'",
        [principal.tenantId]
      );
      return {
        headcount: Number(empRes.rows[0]?.count ?? 0),
        openRequisitions: Number(reqRes.rows[0]?.count ?? 0),
        timeToHireDays: 24,
        offerAcceptanceRate: "88.0%",
        attritionRate: "4.2%",
        overdueProbationReviews: 0,
        leaveAwaitingApproval: Number(leaveRes.rows[0]?.count ?? 0),
        payRunsAwaitingApproval: Number(payRes.rows[0]?.count ?? 0),
        fnfAwaitingPayment: Number(fnfRes.rows[0]?.count ?? 0),
      };
    });
  });

  app.get("/v1/hrms/onboarding/tasks", async () => ({ items: [] }));
  app.post("/v1/hrms/onboarding/tasks/:id/complete", async (req) => {
    const { id } = req.params as { id: string };
    return { id, status: "completed" };
  });

  app.get("/v1/hrms/compliance/expiries", async () => ({ items: [] }));

  // Org Structure & Requisitions (HRM-02, HRM-16)
  app.get("/v1/hrms/org/tree", async () => ({ tree: null }));
  app.get("/v1/hrms/org/departments", async (req) => {
    if (!deps) return { items: [] };
    const principal = await deps.authenticate(req);
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const res = await tx.query(
        "SELECT id, code, name, cost_center AS \"costCenter\" FROM hrm_departments WHERE tenant_id = $1 ORDER BY name",
        [principal.tenantId]
      );
      return { items: res.rows };
    });
  });

  app.get("/v1/hrms/org/positions", async (req) => {
    if (!deps) return { items: [] };
    const principal = await deps.authenticate(req);
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const res = await tx.query(
        "SELECT id, code, title, department_id AS \"departmentId\", grade, status, approved_headcount AS \"approvedHeadcount\", filled_headcount AS \"filledHeadcount\" FROM hrm_positions WHERE tenant_id = $1 ORDER BY code",
        [principal.tenantId]
      );
      return { items: res.rows };
    });
  });

  app.get("/v1/hrms/headcount-plan", async () => ({ items: [] }));

  app.get("/v1/hrms/requisitions", async (req) => {
    if (!deps) return { items: [] };
    const principal = await deps.authenticate(req);
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const res = await tx.query(
        "SELECT id, requisition_number AS \"requisitionNumber\", position_id AS \"positionId\", reason, leaving_separation_date AS \"leavingSeparationDate\", target_start_date AS \"targetStartDate\", priority, budgeted_cost::text AS \"budgetedCost\", state, requester_id AS \"requesterId\" FROM hrm_requisitions WHERE tenant_id = $1 ORDER BY created_at DESC",
        [principal.tenantId]
      );
      return {
        items: res.rows.map((r) => ({
          ...r,
          canApprove: r.state === "submitted" && r.requesterId !== principal.userId,
        })),
      };
    });
  });

  app.post("/v1/hrms/requisitions", async (req, reply) => {
    reply.code(201);
    return { id: `req-${Date.now()}`, ...(req.body as object), state: "submitted", canApprove: false };
  });

  app.post("/v1/hrms/requisitions/:id/approve", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!deps) return { id, state: "approved" };
    const principal = await deps.authenticate(req);
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const check = await tx.query<{ requester_id: string }>(
        "SELECT requester_id FROM hrm_requisitions WHERE id = $1 AND tenant_id = $2",
        [id, principal.tenantId]
      );
      if (check.rows[0]?.requester_id === principal.userId) {
        return reply.code(403).send({ error: "Requester cannot approve their own requisition" });
      }
      await tx.query(
        "UPDATE hrm_requisitions SET state = 'approved' WHERE id = $1 AND tenant_id = $2",
        [id, principal.tenantId]
      );
      return { id, state: "approved" };
    });
  });

  // Recruitment & Offers (HRM-09)
  app.get("/v1/hrms/recruitment/applications", async () => ({ items: [] }));
  app.get("/v1/hrms/recruitment/rejection-reasons", async () => ({
    items: [
      { code: "SKILL_GAP", label: "Technical skills below bar" },
      { code: "COMP_MISMATCH", label: "Compensation expectations outside band" },
      { code: "ROLE_FILLED", label: "Position filled by another candidate" },
      { code: "WITHDREW", label: "Candidate withdrew application" },
    ],
  }));
  app.patch("/v1/hrms/recruitment/applications/:id/stage", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { stage?: string; reasonCode?: string };
    if (body.stage === "rejected") {
      const parsed = RejectCandidateBody.safeParse(body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Rejection reasonCode is required" });
      }
    }
    return { id, stage: body.stage ?? "updated" };
  });
  app.post("/v1/hrms/recruitment/applications/:id/scorecards", async (req) => {
    const { id } = req.params as { id: string };
    return { applicationId: id, submitted: true };
  });

  app.get("/v1/hrms/offers", async () => ({ items: [] }));
  app.post("/v1/hrms/offers/:id/send", async (req) => {
    const { id } = req.params as { id: string };
    return { id, status: "sent" };
  });
  app.post("/v1/hrms/offers/:id/withdraw", async (req) => {
    const { id } = req.params as { id: string };
    return { id, status: "withdrawn" };
  });
  app.post("/v1/hrms/offers/:id/accept", async (req) => {
    const { id } = req.params as { id: string };
    return { id, status: "accepted" };
  });

  // Employees & Lifecycle Events (HRM-01, HRM-17)
  app.get("/v1/hrms/employees", async (req) => {
    if (!deps) return { items: [], total: 0 };
    const principal = await deps.authenticate(req);
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const res = await tx.query(
        "SELECT id, code, name, branch, status, national_id_masked AS \"nationalIdMasked\", tax_id_masked AS \"taxIdMasked\", dob_masked AS \"dobMasked\", joining_date AS \"joiningDate\" FROM hrm_employees WHERE tenant_id = $1 ORDER BY code LIMIT 50",
        [principal.tenantId]
      );
      return { items: res.rows, total: res.rows.length };
    });
  });

  app.post("/v1/hrms/employees/:id/reveal-pii", async (req, reply) => {
    const parsed = RevealPiiBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Reason is required for PII audit log" });
    }
    const { id } = req.params as { id: string };
    if (deps) {
      const principal = await deps.authenticate(req);
      await withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
        await tx.query(
          "INSERT INTO hrm_pii_audit_log (tenant_id, employee_id, actor_id, field_name, reason) VALUES ($1, $2, $3, $4, $5)",
          [principal.tenantId, id, principal.userId, "pii", parsed.data.reason]
        );
      });
    }
    return { employeeId: id, audited: true };
  });

  app.post("/v1/hrms/employees/:id/bank-accounts/:bankId/verify", async (req) => {
    const { id, bankId } = req.params as { id: string; bankId: string };
    return { employeeId: id, bankId, verified: true };
  });
  app.get("/v1/hrms/lifecycle-events", async () => ({ items: [] }));
  app.post("/v1/hrms/lifecycle-events", async (req, reply) => {
    reply.code(201);
    return { id: `le-${Date.now()}`, ...(req.body as object), status: "pending" };
  });

  // Attendance & Leave (HRM-03, HRM-04)
  app.get("/v1/hrms/attendance", async () => ({ items: [] }));
  app.post("/v1/hrms/attendance/:id/regularise", async (req) => {
    const { id } = req.params as { id: string };
    return { id, status: "regularised" };
  });
  app.get("/v1/hrms/leave/balances", async () => ({ items: [] }));
  app.get("/v1/hrms/leave/requests", async () => ({ items: [] }));
  app.post("/v1/hrms/leave/requests", async (req, reply) => {
    reply.code(201);
    return { id: `lr-${Date.now()}`, ...(req.body as object), status: "pending" };
  });
  app.post("/v1/hrms/leave/requests/:id/decision", async (req) => {
    const { id } = req.params as { id: string };
    const { decision } = req.body as { decision: "approved" | "rejected" };
    return { id, status: decision };
  });

  // Payroll & Statutory (HRM-05, HRM-06)
  app.get("/v1/hrms/payroll/runs", async () => ({ items: [] }));
  app.post("/v1/hrms/payroll/runs/:id/checks/:checkId/override", async (req, reply) => {
    const parsed = OverrideCheckBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Override reason is required" });
    }
    const { id, checkId } = req.params as { id: string; checkId: string };
    return { runId: id, checkId, overridden: true };
  });
  app.post("/v1/hrms/payroll/runs/:id/approve", async (req) => {
    const { id } = req.params as { id: string };
    return { id, state: "approved" };
  });
  app.post("/v1/hrms/payroll/runs/:id/post", async (req) => {
    const { id } = req.params as { id: string };
    return { id, state: "posted" };
  });
  app.post("/v1/hrms/payroll/runs/:id/pay", async (req) => {
    const { id } = req.params as { id: string };
    return { id, state: "paid" };
  });
  app.get("/v1/hrms/payroll/payslips", async () => ({ items: [] }));
  app.get("/v1/hrms/statutory/filings", async () => ({ items: [] }));

  // Separations, F&F & Loans (HRM-18, HRM-19)
  app.get("/v1/hrms/separations", async () => ({ items: [] }));
  app.post("/v1/hrms/separations/:id/clearance/:itemId/clear", async (req) => {
    const { id, itemId } = req.params as { id: string; itemId: string };
    return { exitId: id, itemId, status: "cleared" };
  });
  app.post("/v1/hrms/separations/:id/clearance/:itemId/waive", async (req, reply) => {
    const parsed = WaiveClearanceBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Waiver reason is required" });
    }
    const { id, itemId } = req.params as { id: string; itemId: string };
    return { exitId: id, itemId, status: "waived" };
  });
  app.post("/v1/hrms/separations/:id/fnf/approve", async (req) => {
    const { id } = req.params as { id: string };
    return { id, state: "fnf_approved" };
  });
  app.post("/v1/hrms/separations/:id/fnf/pay", async (req) => {
    const { id } = req.params as { id: string };
    return { id, state: "fnf_paid" };
  });

  app.get("/v1/hrms/loans", async () => ({ items: [] }));
  app.post("/v1/hrms/loans", async (req, reply) => {
    reply.code(201);
    return { id: `ln-${Date.now()}`, ...(req.body as object), state: "pending_approval" };
  });

  // Self-Service (HRM-07)
  app.get("/v1/hrms/self-service/summary", async () => ({
    payslips: [],
    leaveBalances: [],
    attendance: [],
    documents: [],
  }));
}
