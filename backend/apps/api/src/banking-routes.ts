import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { AuditLog } from "@erp/audit";
import { fromMinor, matchLine, toMinor, type MatchOutcome } from "@erp/banking";
import type { Pool } from "@erp/db";
import {
  PgAuditStore,
  PgBankingStore,
  checkRuleInput,
  toEngineRule,
  withTenantTransaction,
  type BankRuleInput,
  type BankRuleView,
} from "@erp/db";
import { DomainError, newId, type Clock } from "@erp/kernel";
import { hasPermission, type Principal } from "@erp/identity";

const DECIMAL = /^\d+(\.\d{1,2})?$/;
const decimal = z.string().regex(DECIMAL, "Amount must be a decimal string");

const BankLineInput = z.object({
  postedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
  reference: z.string().min(1).max(120),
  description: z.string().min(1).max(255),
  amount: decimal,
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

const RuleBody = z.object({
  name: z.string().trim().min(1).max(120),
  priority: z.number().int().min(1).max(10000).default(100),
  active: z.boolean().default(true),
  direction: z.enum(["IN", "OUT", "ANY"]).default("ANY"),
  descriptionContains: z.string().trim().min(1).max(120).nullable().default(null),
  amountMin: decimal.nullable().default(null),
  amountMax: decimal.nullable().default(null),
  matchOn: z.enum(["amount", "reference", "amount_and_reference"]).default("amount"),
  amountTolerance: decimal.default("0.00"),
  confidence: z.number().int().min(1).max(100).default(90),
});

const IdParams = z.object({ id: z.string().uuid() });

export interface BankingRouteDeps {
  readonly pool: Pool;
  readonly clock: Clock;
  readonly authenticate: (request: FastifyRequest) => Promise<Principal>;
}

interface LineRow {
  id: string;
  posted_date: Date | string;
  reference: string;
  description: string;
  amount: string;
  direction: "IN" | "OUT";
  status: "Unmatched" | "Suggested" | "Reconciled";
  matched_ref: string | null;
  matched_label: string | null;
  confidence: string | null;
  rule_id: string | null;
  rule_name: string | null;
}

function lineView(r: LineRow) {
  return {
    id: r.id,
    postedDate: r.posted_date instanceof Date ? r.posted_date.toISOString().split("T")[0] : String(r.posted_date),
    reference: r.reference,
    description: r.description,
    amount: r.amount,
    direction: r.direction,
    status: r.status,
    matchedRef: r.matched_ref ?? undefined,
    matchedLabel: r.matched_label ?? undefined,
    confidence: r.confidence === null ? undefined : Number(r.confidence),
    ruleId: r.rule_id ?? undefined,
    ruleName: r.rule_name ?? undefined,
  };
}

/** What to store on a line for an engine outcome. Ambiguous or no match leaves the line unmatched. */
function suggestionColumns(outcome: MatchOutcome) {
  if (outcome.status === "SUGGESTED") {
    return {
      status: "Suggested",
      matchedRef: outcome.document.number,
      matchedLabel: outcome.document.partyName,
      confidence: outcome.confidence,
      ruleId: outcome.ruleId,
      ruleName: outcome.ruleName,
    };
  }
  return { status: "Unmatched", matchedRef: null, matchedLabel: null, confidence: null, ruleId: null, ruleName: null };
}

export function registerBankingRoutes(app: FastifyInstance, deps: BankingRouteDeps): void {
  const { pool, clock, authenticate } = deps;

  async function signedIn(request: FastifyRequest, permission?: string): Promise<Principal> {
    const principal = await authenticate(request);
    if (permission && !hasPermission(principal.permissions, permission)) {
      throw new DomainError("FORBIDDEN", `Missing permission ${permission}`);
    }
    return principal;
  }

  function ruleSnapshot(rule: BankRuleView | BankRuleInput): Record<string, unknown> {
    return {
      name: rule.name, priority: rule.priority, active: rule.active, direction: rule.direction,
      descriptionContains: rule.descriptionContains, amountMin: rule.amountMin, amountMax: rule.amountMax,
      matchOn: rule.matchOn, amountTolerance: rule.amountTolerance, confidence: rule.confidence,
    };
  }

  // 1. List Bank Lines (with optional status filter)
  app.get("/v1/banking/lines", async (request) => {
    const principal = await signedIn(request, "fin.report.read");
    const query = request.query as { status?: string };
    const wanted = query.status?.toLowerCase() ?? "all";
    const status = ["unmatched", "suggested", "reconciled"].includes(wanted)
      ? wanted.charAt(0).toUpperCase() + wanted.slice(1)
      : null;

    return withTenantTransaction(pool, principal.tenantId, async (tx) => {
      const res = status
        ? await tx.query<LineRow>("SELECT * FROM bank_lines WHERE status = $1 ORDER BY posted_date DESC, created_at DESC", [status])
        : await tx.query<LineRow>("SELECT * FROM bank_lines ORDER BY posted_date DESC, created_at DESC");
      return { ok: true, lines: res.rows.map(lineView) };
    });
  });

  // 2. Import Bank Statement Lines. Each line is matched by the tenant's rules (FIN-04).
  app.post("/v1/banking/statements/import", async (request, reply) => {
    const principal = await signedIn(request, "fin.journal.post");
    const body = ImportStatementBody.parse(request.body);

    const result = await withTenantTransaction(pool, principal.tenantId, async (tx) => {
      const store = new PgBankingStore(tx, clock);
      const { companyId, currency } = await store.companyCurrency();
      const rules = (await store.listRules()).map((rule) => toEngineRule(rule, currency));
      const documents = await store.openDocuments(currency);
      const now = clock.now().toISOString();
      const created: ReturnType<typeof lineView>[] = [];
      let ambiguous = 0;

      for (const line of body.lines) {
        const amountMinor = toMinor(line.amount, currency);
        const outcome = matchLine(
          { reference: line.reference, description: line.description, direction: line.direction, amountMinor },
          rules,
          documents,
        );
        if (outcome.status === "AMBIGUOUS") ambiguous += 1;
        const s = suggestionColumns(outcome);
        const id = newId(clock.now().getTime());
        const inserted = await tx.query<LineRow>(
          `INSERT INTO bank_lines (id, tenant_id, company_id, posted_date, reference, description, amount, direction,
                                   status, matched_ref, matched_label, confidence, rule_id, rule_name, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15) RETURNING *`,
          [id, principal.tenantId, companyId, line.postedDate, line.reference, line.description,
            fromMinor(amountMinor, currency), line.direction, s.status, s.matchedRef, s.matchedLabel, s.confidence,
            s.ruleId, s.ruleName, now],
        );
        created.push(lineView(inserted.rows[0] as LineRow));
      }
      await new AuditLog(new PgAuditStore(tx), clock).record({
        tenantId: principal.tenantId,
        actorId: principal.userId,
        action: "bank.statement.import",
        entityType: "bank_statement",
        entityId: newId(clock.now().getTime()),
        before: null,
        after: { lines: created.length, suggested: created.filter((l) => l.status === "Suggested").length, ambiguous },
        requestId: request.id,
      });
      return { created, ambiguous };
    });

    return reply.status(201).send({ ok: true, imported: result.created.length, ambiguous: result.ambiguous, lines: result.created });
  });

  // 3. Confirm / Reconcile Line
  app.post("/v1/banking/reconcile", async (request) => {
    const principal = await signedIn(request, "fin.journal.post");
    const body = ReconcileBody.parse(request.body);

    return withTenantTransaction(pool, principal.tenantId, async (tx) => {
      const res = await tx.query(
        `UPDATE bank_lines
         SET status = 'Reconciled', matched_ref = $1, confidence = 100.0, updated_at = now()
         WHERE id = $2 AND tenant_id = $3
         RETURNING *`,
        [body.matchedRef, body.lineId, principal.tenantId],
      );
      if (res.rowCount === 0) {
        throw new DomainError("NOT_FOUND", "Bank line not found");
      }
      await new AuditLog(new PgAuditStore(tx), clock).record({
        tenantId: principal.tenantId, actorId: principal.userId, action: "bank.line.reconcile",
        entityType: "bank_line", entityId: body.lineId, before: null,
        after: { status: "Reconciled", matchedRef: body.matchedRef }, requestId: request.id,
      });
      return { ok: true, lineId: body.lineId, matchedRef: body.matchedRef, status: "Reconciled" };
    });
  });

  // 4. Unreconcile Line
  app.post("/v1/banking/unreconcile", async (request) => {
    const principal = await signedIn(request, "fin.journal.post");
    const body = UnreconcileBody.parse(request.body);

    return withTenantTransaction(pool, principal.tenantId, async (tx) => {
      const res = await tx.query(
        `UPDATE bank_lines
         SET status = 'Unmatched', matched_ref = NULL, matched_label = NULL, confidence = NULL,
             rule_id = NULL, rule_name = NULL, updated_at = now()
         WHERE id = $1 AND tenant_id = $2
         RETURNING *`,
        [body.lineId, principal.tenantId],
      );
      if (res.rowCount === 0) {
        throw new DomainError("NOT_FOUND", "Bank line not found");
      }
      await new AuditLog(new PgAuditStore(tx), clock).record({
        tenantId: principal.tenantId, actorId: principal.userId, action: "bank.line.unreconcile",
        entityType: "bank_line", entityId: body.lineId, before: null, after: { status: "Unmatched" }, requestId: request.id,
      });
      return { ok: true, lineId: body.lineId, status: "Unmatched" };
    });
  });

  // 5. Rules: list
  app.get("/v1/banking/rules", async (request) => {
    const principal = await signedIn(request, "fin.report.read");
    return withTenantTransaction(pool, principal.tenantId, async (tx) => {
      const rules = await new PgBankingStore(tx, clock).listRules();
      return { ok: true, rules };
    });
  });

  // 6. Rules: create
  app.post("/v1/banking/rules", async (request, reply) => {
    const principal = await signedIn(request, "fin.journal.post");
    const input = RuleBody.parse(request.body);
    const rule = await withTenantTransaction(pool, principal.tenantId, async (tx) => {
      const store = new PgBankingStore(tx, clock);
      const { currency } = await store.companyCurrency();
      checkRuleInput(input, currency);
      const created = await store.createRule(principal.tenantId, principal.userId, input);
      await new AuditLog(new PgAuditStore(tx), clock).record({
        tenantId: principal.tenantId, actorId: principal.userId, action: "bank.rule.create",
        entityType: "bank_rule", entityId: created.id, before: null, after: ruleSnapshot(created), requestId: request.id,
      });
      return created;
    });
    return reply.status(201).send({ ok: true, rule });
  });

  // 7. Rules: update
  app.put("/v1/banking/rules/:id", async (request) => {
    const principal = await signedIn(request, "fin.journal.post");
    const { id } = IdParams.parse(request.params);
    const input = RuleBody.parse(request.body);
    return withTenantTransaction(pool, principal.tenantId, async (tx) => {
      const store = new PgBankingStore(tx, clock);
      const before = await store.getRule(id);
      if (!before) throw new DomainError("NOT_FOUND", "Bank rule not found");
      const { currency } = await store.companyCurrency();
      checkRuleInput(input, currency);
      const updated = await store.updateRule(id, input);
      await new AuditLog(new PgAuditStore(tx), clock).record({
        tenantId: principal.tenantId, actorId: principal.userId, action: "bank.rule.update",
        entityType: "bank_rule", entityId: id, before: ruleSnapshot(before), after: ruleSnapshot(updated), requestId: request.id,
      });
      return { ok: true, rule: updated };
    });
  });

  // 8. Rules: delete (a rule is configuration; the audit entry keeps what it was)
  app.delete("/v1/banking/rules/:id", async (request) => {
    const principal = await signedIn(request, "fin.journal.post");
    const { id } = IdParams.parse(request.params);
    return withTenantTransaction(pool, principal.tenantId, async (tx) => {
      const store = new PgBankingStore(tx, clock);
      const before = await store.getRule(id);
      if (!before) throw new DomainError("NOT_FOUND", "Bank rule not found");
      await store.deleteRule(id);
      await new AuditLog(new PgAuditStore(tx), clock).record({
        tenantId: principal.tenantId, actorId: principal.userId, action: "bank.rule.delete",
        entityType: "bank_rule", entityId: id, before: ruleSnapshot(before), after: null, requestId: request.id,
      });
      return { ok: true, id };
    });
  });

  // 9. Apply the rules again to lines that are not reconciled. Safe to repeat; reconciled lines never change.
  app.post("/v1/banking/rules/apply", async (request) => {
    const principal = await signedIn(request, "fin.journal.post");
    return withTenantTransaction(pool, principal.tenantId, async (tx) => {
      const store = new PgBankingStore(tx, clock);
      const { currency } = await store.companyCurrency();
      const rules = (await store.listRules()).map((rule) => toEngineRule(rule, currency));
      const documents = await store.openDocuments(currency);
      const open = await tx.query<LineRow>("SELECT * FROM bank_lines WHERE status IN ('Unmatched','Suggested') ORDER BY posted_date, id");
      let suggested = 0;
      let ambiguous = 0;
      let unmatched = 0;
      let changed = 0;
      for (const row of open.rows) {
        const outcome = matchLine(
          { reference: row.reference, description: row.description, direction: row.direction, amountMinor: toMinor(row.amount, currency) },
          rules,
          documents,
        );
        const s = suggestionColumns(outcome);
        if (outcome.status === "SUGGESTED") suggested += 1;
        else if (outcome.status === "AMBIGUOUS") ambiguous += 1;
        else unmatched += 1;
        const same = row.status === s.status && (row.matched_ref ?? null) === s.matchedRef && (row.rule_id ?? null) === s.ruleId
          && (row.confidence === null ? null : Number(row.confidence)) === s.confidence;
        if (same) continue;
        changed += 1;
        await tx.query(
          `UPDATE bank_lines SET status=$2, matched_ref=$3, matched_label=$4, confidence=$5, rule_id=$6, rule_name=$7, updated_at=$8 WHERE id=$1`,
          [row.id, s.status, s.matchedRef, s.matchedLabel, s.confidence, s.ruleId, s.ruleName, clock.now().toISOString()],
        );
      }
      await new AuditLog(new PgAuditStore(tx), clock).record({
        tenantId: principal.tenantId, actorId: principal.userId, action: "bank.rules.apply",
        entityType: "bank_rules_run", entityId: newId(clock.now().getTime()), before: null,
        after: { evaluated: open.rows.length, suggested, ambiguous, unmatched, changed }, requestId: request.id,
      });
      return { ok: true, evaluated: open.rows.length, suggested, ambiguous, unmatched, changed };
    });
  });
}
