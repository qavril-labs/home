import type { FastifyInstance } from "fastify";
import { z } from "zod";

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

export function hrmsRoutes(app: FastifyInstance): void {
  // Dashboard, Onboarding & Compliance (HRM-10, HRM-14)
  app.get("/hrms/dashboard", async () => ({
    headcount: 142,
    openRequisitions: 6,
    timeToHireDays: 24,
    offerAcceptanceRate: "88.0%",
    attritionRate: "4.2%",
    overdueProbationReviews: 2,
    leaveAwaitingApproval: 4,
    payRunsAwaitingApproval: 1,
    fnfAwaitingPayment: 1,
  }));

  app.get("/hrms/onboarding/tasks", async () => ({ items: [] }));
  app.post("/hrms/onboarding/tasks/:id/complete", async (req) => {
    const { id } = req.params as { id: string };
    return { id, status: "completed" };
  });

  app.get("/hrms/compliance/expiries", async () => ({ items: [] }));

  // Org Structure & Requisitions (HRM-02, HRM-16)
  app.get("/hrms/org/tree", async () => ({ tree: null }));
  app.get("/hrms/org/departments", async () => ({ items: [] }));
  app.get("/hrms/org/positions", async () => ({ items: [] }));
  app.get("/hrms/headcount-plan", async () => ({ items: [] }));
  app.get("/hrms/requisitions", async () => ({ items: [] }));
  app.post("/hrms/requisitions", async (req, reply) => {
    reply.code(201);
    return { id: `req-${Date.now()}`, ...(req.body as object), state: "submitted", canApprove: false };
  });
  app.post("/hrms/requisitions/:id/approve", async (req) => {
    const { id } = req.params as { id: string };
    return { id, state: "approved" };
  });

  // Recruitment & Offers (HRM-09)
  app.get("/hrms/recruitment/applications", async () => ({ items: [] }));
  app.get("/hrms/recruitment/rejection-reasons", async () => ({
    items: [
      { code: "SKILL_GAP", label: "Technical skills below bar" },
      { code: "COMP_MISMATCH", label: "Compensation expectations outside band" },
      { code: "ROLE_FILLED", label: "Position filled by another candidate" },
      { code: "WITHDREW", label: "Candidate withdrew application" },
    ],
  }));
  app.patch("/hrms/recruitment/applications/:id/stage", async (req, reply) => {
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
  app.post("/hrms/recruitment/applications/:id/scorecards", async (req) => {
    const { id } = req.params as { id: string };
    return { applicationId: id, submitted: true };
  });

  app.get("/hrms/offers", async () => ({ items: [] }));
  app.post("/hrms/offers/:id/send", async (req) => {
    const { id } = req.params as { id: string };
    return { id, status: "sent" };
  });
  app.post("/hrms/offers/:id/withdraw", async (req) => {
    const { id } = req.params as { id: string };
    return { id, status: "withdrawn" };
  });
  app.post("/hrms/offers/:id/accept", async (req) => {
    const { id } = req.params as { id: string };
    return { id, status: "accepted" };
  });

  // Employees & Lifecycle Events (HRM-01, HRM-17)
  app.get("/hrms/employees", async () => ({ items: [], total: 0 }));
  app.post("/hrms/employees/:id/reveal-pii", async (req, reply) => {
    const parsed = RevealPiiBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Reason is required for PII audit log" });
    }
    const { id } = req.params as { id: string };
    return { employeeId: id, audited: true };
  });
  app.post("/hrms/employees/:id/bank-accounts/:bankId/verify", async (req) => {
    const { id, bankId } = req.params as { id: string; bankId: string };
    return { employeeId: id, bankId, verified: true };
  });
  app.get("/hrms/lifecycle-events", async () => ({ items: [] }));
  app.post("/hrms/lifecycle-events", async (req, reply) => {
    reply.code(201);
    return { id: `le-${Date.now()}`, ...(req.body as object), status: "pending" };
  });

  // Attendance & Leave (HRM-03, HRM-04)
  app.get("/hrms/attendance", async () => ({ items: [] }));
  app.post("/hrms/attendance/:id/regularise", async (req) => {
    const { id } = req.params as { id: string };
    return { id, status: "regularised" };
  });
  app.get("/hrms/leave/balances", async () => ({ items: [] }));
  app.get("/hrms/leave/requests", async () => ({ items: [] }));
  app.post("/hrms/leave/requests", async (req, reply) => {
    reply.code(201);
    return { id: `lr-${Date.now()}`, ...(req.body as object), status: "pending" };
  });
  app.post("/hrms/leave/requests/:id/decision", async (req) => {
    const { id } = req.params as { id: string };
    const { decision } = req.body as { decision: "approved" | "rejected" };
    return { id, status: decision };
  });

  // Payroll & Statutory (HRM-05, HRM-06)
  app.get("/hrms/payroll/runs", async () => ({ items: [] }));
  app.post("/hrms/payroll/runs/:id/checks/:checkId/override", async (req, reply) => {
    const parsed = OverrideCheckBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Override reason is required" });
    }
    const { id, checkId } = req.params as { id: string; checkId: string };
    return { runId: id, checkId, overridden: true };
  });
  app.post("/hrms/payroll/runs/:id/approve", async (req) => {
    const { id } = req.params as { id: string };
    return { id, state: "approved" };
  });
  app.post("/hrms/payroll/runs/:id/post", async (req) => {
    const { id } = req.params as { id: string };
    return { id, state: "posted" };
  });
  app.post("/hrms/payroll/runs/:id/pay", async (req) => {
    const { id } = req.params as { id: string };
    return { id, state: "paid" };
  });
  app.get("/hrms/payroll/payslips", async () => ({ items: [] }));
  app.get("/hrms/statutory/filings", async () => ({ items: [] }));

  // Separations, F&F & Loans (HRM-18, HRM-19)
  app.get("/hrms/separations", async () => ({ items: [] }));
  app.post("/hrms/separations/:id/clearance/:itemId/clear", async (req) => {
    const { id, itemId } = req.params as { id: string; itemId: string };
    return { exitId: id, itemId, status: "cleared" };
  });
  app.post("/hrms/separations/:id/clearance/:itemId/waive", async (req, reply) => {
    const parsed = WaiveClearanceBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Waiver reason is required" });
    }
    const { id, itemId } = req.params as { id: string; itemId: string };
    return { exitId: id, itemId, status: "waived" };
  });
  app.post("/hrms/separations/:id/fnf/approve", async (req) => {
    const { id } = req.params as { id: string };
    return { id, state: "fnf_approved" };
  });
  app.post("/hrms/separations/:id/fnf/pay", async (req) => {
    const { id } = req.params as { id: string };
    return { id, state: "fnf_paid" };
  });

  app.get("/hrms/loans", async () => ({ items: [] }));
  app.post("/hrms/loans", async (req, reply) => {
    reply.code(201);
    return { id: `ln-${Date.now()}`, ...(req.body as object), state: "pending_approval" };
  });

  // Self-Service (HRM-07)
  app.get("/hrms/self-service/summary", async () => ({
    payslips: [],
    leaveBalances: [],
    attendance: [],
    documents: [],
  }));
}
