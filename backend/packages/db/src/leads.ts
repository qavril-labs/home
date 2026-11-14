import type { Pool } from "pg";

export interface LeadRow {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly company: string | null;
  readonly country: string | null;
  readonly interest: string;
  readonly industry: string | null;
  readonly message: string | null;
  readonly source: string;
  readonly createdAt: string;
  readonly slot?: string | null;
  readonly timezone?: string | null;
  readonly status?: string;
  readonly consentAt?: string | null;
}

interface LeadDbRow {
  id: string;
  name: string;
  email: string;
  company: string | null;
  country: string | null;
  interest: string;
  industry: string | null;
  message: string | null;
  source: string;
  created_at: Date;
  slot: string | null;
  timezone: string | null;
  status: string;
  consent_at: Date | null;
}

/** Most recent leads first. Operator tooling only: the public API never reads leads back. */
export async function listLeads(pool: Pool, limit: number): Promise<LeadRow[]> {
  const { rows } = await pool.query<LeadDbRow>(
    `SELECT id, name, email, company, country, interest, industry, message, source, created_at, slot, timezone, status, consent_at
       FROM leads
      ORDER BY created_at DESC
      LIMIT $1`,
    [limit],
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
    country: row.country,
    interest: row.interest,
    industry: row.industry,
    message: row.message,
    source: row.source,
    createdAt: row.created_at.toISOString(),
    slot: row.slot,
    timezone: row.timezone,
    status: row.status,
    consentAt: row.consent_at ? row.consent_at.toISOString() : null,
  }));
}

export const LEAD_CSV_HEADER = [
  "created_at",
  "name",
  "email",
  "company",
  "country",
  "interest",
  "industry",
  "message",
  "source",
  "id",
  "slot",
  "timezone",
  "status",
  "consent_at",
] as const;

/** Spreadsheets run a cell that starts with = + - @ as a formula. Prefix those cells so they stay text. */
function guardFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string | null): string {
  if (value === null) return "";
  const safe = guardFormula(value);
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** RFC 4180 CSV with a header row. Formula-like cells are neutralized. */
export function leadsToCsv(rows: readonly LeadRow[]): string {
  const lines = [LEAD_CSV_HEADER.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.createdAt,
        row.name,
        row.email,
        row.company,
        row.country,
        row.interest,
        row.industry,
        row.message,
        row.source,
        row.id,
        row.slot ?? null,
        row.timezone ?? null,
        row.status ?? "new",
        row.consentAt ?? null,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}
