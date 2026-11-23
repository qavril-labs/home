import { DomainError, newId, type Clock } from "@erp/kernel";
import { toMinor, validateRule, type BankRule, type MatchOn, type OpenDocument, type RuleDirection } from "@erp/banking";
import type { Queryable } from "./pool";

export interface BankRuleView {
  id: string;
  name: string;
  priority: number;
  active: boolean;
  direction: RuleDirection;
  descriptionContains: string | null;
  amountMin: string | null;
  amountMax: string | null;
  matchOn: MatchOn;
  amountTolerance: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export type BankRuleInput = Omit<BankRuleView, "id" | "createdAt" | "updatedAt">;

interface RuleRow {
  id: string;
  name: string;
  priority: number;
  active: boolean;
  direction: RuleDirection;
  description_contains: string | null;
  amount_min: string | null;
  amount_max: string | null;
  match_on: MatchOn;
  amount_tolerance: string;
  confidence: number;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS =
  "id, name, priority, active, direction, description_contains, amount_min, amount_max, match_on, amount_tolerance, confidence, created_at, updated_at";

function view(row: RuleRow): BankRuleView {
  return {
    id: row.id,
    name: row.name,
    priority: row.priority,
    active: row.active,
    direction: row.direction,
    descriptionContains: row.description_contains,
    amountMin: row.amount_min,
    amountMax: row.amount_max,
    matchOn: row.match_on,
    amountTolerance: row.amount_tolerance,
    confidence: row.confidence,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** A rule as the engine reads it: amounts in minor units of the company currency. */
export function toEngineRule(rule: BankRuleInput & { id: string }, currency: string): BankRule {
  return {
    id: rule.id,
    name: rule.name,
    priority: rule.priority,
    active: rule.active,
    direction: rule.direction,
    descriptionContains: rule.descriptionContains,
    amountMinMinor: rule.amountMin === null ? null : toMinor(rule.amountMin, currency),
    amountMaxMinor: rule.amountMax === null ? null : toMinor(rule.amountMax, currency),
    matchOn: rule.matchOn,
    amountToleranceMinor: toMinor(rule.amountTolerance, currency),
    confidence: rule.confidence,
  };
}

/** Checks a rule input with the engine's own validation before it is stored. */
export function checkRuleInput(input: BankRuleInput, currency: string): void {
  validateRule(toEngineRule({ ...input, id: "check" }, currency));
}

function conflictOrRethrow(error: unknown, name: string): never {
  if ((error as { code?: string }).code === "23505") {
    throw new DomainError("CONFLICT", `A rule named "${name}" already exists`);
  }
  throw error;
}

export class PgBankingStore {
  constructor(
    private readonly db: Queryable,
    private readonly clock: Clock,
  ) {}

  async companyCurrency(): Promise<{ companyId: string; currency: string }> {
    const { rows } = await this.db.query<{ id: string; base_currency: string }>(
      "SELECT id, base_currency FROM companies ORDER BY created_at LIMIT 1",
    );
    const row = rows[0];
    if (!row) throw new DomainError("NOT_FOUND", "No company is set up for this workspace");
    return { companyId: row.id, currency: row.base_currency.trim() };
  }

  async listRules(): Promise<BankRuleView[]> {
    const { rows } = await this.db.query<RuleRow>(`SELECT ${COLUMNS} FROM bank_rules ORDER BY priority, id`);
    return rows.map(view);
  }

  async getRule(id: string): Promise<BankRuleView | null> {
    const { rows } = await this.db.query<RuleRow>(`SELECT ${COLUMNS} FROM bank_rules WHERE id = $1`, [id]);
    return rows[0] ? view(rows[0]) : null;
  }

  async createRule(tenantId: string, actorId: string, input: BankRuleInput): Promise<BankRuleView> {
    const id = newId(this.clock.now().getTime());
    const now = this.clock.now().toISOString();
    try {
      const { rows } = await this.db.query<RuleRow>(
        `INSERT INTO bank_rules (id, tenant_id, name, priority, active, direction, description_contains, amount_min, amount_max,
                                 match_on, amount_tolerance, confidence, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14) RETURNING ${COLUMNS}`,
        [id, tenantId, input.name, input.priority, input.active, input.direction, input.descriptionContains,
          input.amountMin, input.amountMax, input.matchOn, input.amountTolerance, input.confidence, actorId, now],
      );
      return view(rows[0] as RuleRow);
    } catch (error) {
      return conflictOrRethrow(error, input.name);
    }
  }

  async updateRule(id: string, input: BankRuleInput): Promise<BankRuleView> {
    let rows: RuleRow[];
    try {
      ({ rows } = await this.db.query<RuleRow>(
        `UPDATE bank_rules SET name=$2, priority=$3, active=$4, direction=$5, description_contains=$6, amount_min=$7,
                amount_max=$8, match_on=$9, amount_tolerance=$10, confidence=$11, updated_at=$12
         WHERE id=$1 RETURNING ${COLUMNS}`,
        [id, input.name, input.priority, input.active, input.direction, input.descriptionContains, input.amountMin,
          input.amountMax, input.matchOn, input.amountTolerance, input.confidence, this.clock.now().toISOString()],
      ));
    } catch (error) {
      return conflictOrRethrow(error, input.name);
    }
    if (!rows[0]) throw new DomainError("NOT_FOUND", "Bank rule not found");
    return view(rows[0]);
  }

  async deleteRule(id: string): Promise<boolean> {
    const result = await this.db.query("DELETE FROM bank_rules WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /** Open invoices and bills in the company currency, with the balance still to be paid. */
  async openDocuments(currency: string): Promise<OpenDocument[]> {
    const invoices = await this.db.query<{ invoice_number: string; name: string; balance_due: string }>(
      `SELECT i.invoice_number, p.name, i.balance_due FROM invoices i JOIN parties p ON p.id = i.party_id
       WHERE i.status IN ('issued','sent','partially_paid','overdue') AND i.currency = $1 AND i.balance_due > 0`,
      [currency],
    );
    const bills = await this.db.query<{ bill_number: string; name: string; balance_due: string }>(
      `SELECT b.bill_number, p.name, b.balance_due FROM bills b JOIN parties p ON p.id = b.supplier_id
       WHERE b.status IN ('approved','overdue') AND b.currency = $1 AND b.balance_due > 0`,
      [currency],
    );
    return [
      ...invoices.rows.map((r) => ({ kind: "invoice" as const, number: r.invoice_number, partyName: r.name, outstandingMinor: toMinor(r.balance_due, currency) })),
      ...bills.rows.map((r) => ({ kind: "bill" as const, number: r.bill_number, partyName: r.name, outstandingMinor: toMinor(r.balance_due, currency) })),
    ];
  }
}
