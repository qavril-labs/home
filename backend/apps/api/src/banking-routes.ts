import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Pool } from "@erp/db";
import { withTenantTransaction } from "@erp/db";
import { DomainError, newId, type Clock } from "@erp/kernel";
import type { Principal } from "@erp/identity";

const BankLineInput = z.object({
  postedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
  reference: z.string().min(1).max(120),
  description: z.string().min(1).max(255),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a decimal string"),
  direction: z.enum(["IN", "OUT"]),
});

const ImportStatementBody = z.object({
  lines: z.array(BankLineInput).min(1).max(500),
});

const ReconcileBody = z.object({
  lineId: z.string().min(1),
  matchedRef: z.string().min(1),
});

const UnreconcileBody = z.object({
  lineId: z.string().min(1),
});

export interface BankingRouteDeps {
  readonly pool: Pool;
  readonly clock: Clock;
  readonly authenticate: (request: FastifyRequest) => Promise<Principal>;
}

export function registerBankingRoutes(app: FastifyInstance, deps: BankingRouteDeps): void {
  const { pool, clock, authenticate } = deps;

  async function signedIn(request: FastifyRequest): Promise<Principal> {
    return authenticate(request);
  }

  // 1. List Bank Lines (with optional status filter)
  app.get("/v1/banking/lines", async (request) => {
    const principal = await signedIn(request);
    const query = request.query as { status?: string };
    const status = query.status?.toUpperCase() || "ALL";

    return withTenantTransaction(pool, principal.tenantId, async (tx) => {
      let sql = "SELECT * FROM bank_lines";
      const params: any[] = [];
      if (status !== "ALL") {
        sql += " WHERE status = $1";
        params.push(status.charAt(0).toUpperCase() + status.slice(1).toLowerCase());
      }
      sql += " ORDER BY posted_date DESC, created_at DESC";

      const res = await tx.query(sql, params);
      const lines = res.rows.map((r) => ({
        id: r.id,
        postedDate: r.posted_date.toISOString ? r.posted_date.toISOString().split("T")[0] : String(r.posted_date),
        reference: r.reference,
        description: r.description,
        amount: Number(r.amount).toFixed(2),
        direction: r.direction,
        status: r.status,
        matchedRef: r.matched_ref ?? undefined,
        matchedLabel: r.matched_label ?? undefined,
        confidence: r.confidence ? Number(r.confidence) : undefined,
      }));
      return { ok: true, lines };
    });
  });

  // 2. Import Bank Statement Lines with Auto-Matching
  app.post("/v1/banking/statements/import", async (request, reply) => {
    const principal = await signedIn(request);
    const body = ImportStatementBody.parse(request.body);

    const imported = await withTenantTransaction(pool, principal.tenantId, async (tx) => {
      // Find open invoices and bills for matching
      const invoicesRes = await tx.query(
        "SELECT invoice_number, total, customer_name FROM invoices WHERE status IN ('ISSUED', 'PARTIALLY_PAID')"
      ).catch(() => ({ rows: [] }));
      const billsRes = await tx.query(
        "SELECT bill_number, total, supplier_name FROM bills WHERE status IN ('RECEIVED', 'PARTIALLY_PAID')"
      ).catch(() => ({ rows: [] }));

      // Find company id
      const compRes = await tx.query("SELECT id FROM companies LIMIT 1");
      const companyId = compRes.rows[0]?.id || principal.tenantId;

      const createdLines: any[] = [];
      const now = clock.now().toISOString();

      for (const line of body.lines) {
        const id = newId(clock.now().getTime());
        let status = "Unmatched";
        let matchedRef: string | null = null;
        let matchedLabel: string | null = null;
        let confidence: number | null = null;

        const lineAmount = parseFloat(line.amount);

        if (line.direction === "IN") {
          const match = invoicesRes.rows.find((inv: any) => Math.abs(parseFloat(inv.total) - lineAmount) < 0.01);
          if (match) {
            status = "Suggested";
            matchedRef = match.invoice_number;
            matchedLabel = match.customer_name;
            confidence = 94.5;
          }
        } else if (line.direction === "OUT") {
          const match = billsRes.rows.find((b: any) => Math.abs(parseFloat(b.total) - lineAmount) < 0.01);
          if (match) {
            status = "Suggested";
            matchedRef = match.bill_number;
            matchedLabel = match.supplier_name;
            confidence = 92.0;
          }
        }

        await tx.query(
          `INSERT INTO bank_lines (
            id, tenant_id, company_id, posted_date, reference, description,
            amount, direction, status, matched_ref, matched_label, confidence,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)`,
          [
            id,
            principal.tenantId,
            companyId,
            line.postedDate,
            line.reference,
            line.description,
            line.amount,
            line.direction,
            status,
            matchedRef,
            matchedLabel,
            confidence,
            now,
          ]
        );

        createdLines.push({
          id,
          postedDate: line.postedDate,
          reference: line.reference,
          description: line.description,
          amount: line.amount,
          direction: line.direction,
          status,
          matchedRef: matchedRef || undefined,
          matchedLabel: matchedLabel || undefined,
          confidence: confidence || undefined,
        });
      }

      return createdLines;
    });

    return reply.status(201).send({ ok: true, imported: imported.length, lines: imported });
  });

  // 3. Confirm / Reconcile Line
  app.post("/v1/banking/reconcile", async (request) => {
    const principal = await signedIn(request);
    const body = ReconcileBody.parse(request.body);

    return withTenantTransaction(pool, principal.tenantId, async (tx) => {
      const res = await tx.query(
        `UPDATE bank_lines 
         SET status = 'Reconciled', matched_ref = $1, confidence = 100.0, updated_at = now()
         WHERE id = $2 AND tenant_id = $3
         RETURNING *`,
        [body.matchedRef, body.lineId, principal.tenantId]
      );

      if (res.rowCount === 0) {
        throw new DomainError("NOT_FOUND", "Bank line not found");
      }

      return {
        ok: true,
        lineId: body.lineId,
        matchedRef: body.matchedRef,
        status: "Reconciled",
      };
    });
  });

  // 4. Unreconcile Line
  app.post("/v1/banking/unreconcile", async (request) => {
    const principal = await signedIn(request);
    const body = UnreconcileBody.parse(request.body);

    return withTenantTransaction(pool, principal.tenantId, async (tx) => {
      const res = await tx.query(
        `UPDATE bank_lines 
         SET status = 'Unmatched', matched_ref = NULL, matched_label = NULL, confidence = NULL, updated_at = now()
         WHERE id = $1 AND tenant_id = $2
         RETURNING *`,
        [body.lineId, principal.tenantId]
      );

      if (res.rowCount === 0) {
        throw new DomainError("NOT_FOUND", "Bank line not found");
      }

      return {
        ok: true,
        lineId: body.lineId,
        status: "Unmatched",
      };
    });
  });
}
