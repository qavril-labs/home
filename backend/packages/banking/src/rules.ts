// FIN-04 bank rules engine. Pure and deterministic: no clock, no database, no floats.
// A rule decides whether a bank line may be suggested against one open invoice or bill.
// The engine only suggests. Confirming a match is a separate, human step.
import { DomainError } from "@erp/kernel";
import { Money } from "@erp/money";

export type LineDirection = "IN" | "OUT";
export type RuleDirection = LineDirection | "ANY";
export type MatchOn = "amount" | "reference" | "amount_and_reference";

export interface BankRule {
  readonly id: string;
  readonly name: string;
  /** Lower runs first. Ties break on id so the order never depends on storage order. */
  readonly priority: number;
  readonly active: boolean;
  readonly direction: RuleDirection;
  /** Case-insensitive text that the line description must contain. */
  readonly descriptionContains: string | null;
  readonly amountMinMinor: bigint | null;
  readonly amountMaxMinor: bigint | null;
  readonly matchOn: MatchOn;
  /** A document matches on amount when |line - document| is at most this many minor units. */
  readonly amountToleranceMinor: bigint;
  /** Confidence (1 to 100) reported when this rule produces a suggestion. Configured, never computed. */
  readonly confidence: number;
}

export interface BankLineInput {
  readonly reference: string;
  readonly description: string;
  readonly direction: LineDirection;
  readonly amountMinor: bigint;
}

export interface OpenDocument {
  readonly kind: "invoice" | "bill";
  readonly number: string;
  readonly partyName: string;
  readonly outstandingMinor: bigint;
}

export type MatchOutcome =
  | { readonly status: "SUGGESTED"; readonly ruleId: string | null; readonly ruleName: string; readonly document: OpenDocument; readonly confidence: number }
  | { readonly status: "AMBIGUOUS"; readonly ruleId: string | null; readonly ruleName: string; readonly candidates: readonly OpenDocument[] }
  | { readonly status: "NO_MATCH" };

/** Used when a tenant has no active rule that applies: one document with exactly the same amount. */
export const DEFAULT_RULE: BankRule = {
  id: "default",
  name: "Default: exact amount, one document",
  priority: Number.MAX_SAFE_INTEGER,
  active: true,
  direction: "ANY",
  descriptionContains: null,
  amountMinMinor: null,
  amountMaxMinor: null,
  matchOn: "amount",
  amountToleranceMinor: 0n,
  confidence: 80,
};

export function validateRule(rule: BankRule): void {
  if (!Number.isInteger(rule.confidence) || rule.confidence < 1 || rule.confidence > 100) {
    throw new DomainError("VALIDATION", "Confidence must be a whole number from 1 to 100");
  }
  if (rule.amountToleranceMinor < 0n) {
    throw new DomainError("VALIDATION", "Amount tolerance cannot be negative");
  }
  if (rule.amountMinMinor !== null && rule.amountMaxMinor !== null && rule.amountMinMinor > rule.amountMaxMinor) {
    throw new DomainError("VALIDATION", "Minimum amount is above the maximum");
  }
  if (rule.amountMinMinor !== null && rule.amountMinMinor < 0n) {
    throw new DomainError("VALIDATION", "Amounts are positive; direction says money in or out");
  }
  if (rule.matchOn === "reference" && rule.amountToleranceMinor > 0n) {
    throw new DomainError("VALIDATION", "Tolerance applies only when matching on amount");
  }
}

/** Parses a decimal string into minor units for a currency, with no floating point. */
export function toMinor(amount: string, currency: string): bigint {
  return Money.fromDecimal(amount, currency).minor;
}

/** Formats minor units as a decimal string for a currency. */
export function fromMinor(minor: bigint, currency: string): string {
  return Money.of(minor, currency).toDecimal();
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function ruleApplies(rule: BankRule, line: BankLineInput): boolean {
  if (!rule.active) return false;
  if (rule.direction !== "ANY" && rule.direction !== line.direction) return false;
  if (rule.descriptionContains !== null) {
    if (!line.description.toLowerCase().includes(rule.descriptionContains.toLowerCase())) return false;
  }
  if (rule.amountMinMinor !== null && line.amountMinor < rule.amountMinMinor) return false;
  if (rule.amountMaxMinor !== null && line.amountMinor > rule.amountMaxMinor) return false;
  return true;
}

function candidatesFor(rule: BankRule, line: BankLineInput, documents: readonly OpenDocument[]): OpenDocument[] {
  const wantedKind = line.direction === "IN" ? "invoice" : "bill";
  const text = `${line.reference} ${line.description}`.toLowerCase();
  return documents.filter((doc) => {
    if (doc.kind !== wantedKind) return false;
    const amountOk = absolute(doc.outstandingMinor - line.amountMinor) <= rule.amountToleranceMinor;
    const referenceOk = doc.number.length > 0 && text.includes(doc.number.toLowerCase());
    if (rule.matchOn === "amount") return amountOk;
    if (rule.matchOn === "reference") return referenceOk;
    return amountOk && referenceOk;
  });
}

/**
 * Runs the rules in priority order against one line. A rule that finds exactly one document
 * suggests it. A rule that finds several is ambiguous: it suggests nothing, and later rules still
 * get a chance to narrow it down (for example a rule that matches on the reference). If no rule
 * suggests, an ambiguous result is reported with the candidates of the first ambiguous rule.
 * With no applicable rule that finds anything, the default rule runs last.
 */
export function matchLine(
  line: BankLineInput,
  rules: readonly BankRule[],
  documents: readonly OpenDocument[],
): MatchOutcome {
  const ordered = [...rules].sort((a, b) => a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let ambiguous: MatchOutcome | null = null;
  for (const rule of [...ordered, DEFAULT_RULE]) {
    if (!ruleApplies(rule, line)) continue;
    const found = candidatesFor(rule, line, documents);
    if (found.length === 0) continue;
    const ruleId = rule.id === DEFAULT_RULE.id ? null : rule.id;
    if (found.length === 1) {
      return { status: "SUGGESTED", ruleId, ruleName: rule.name, document: found[0] as OpenDocument, confidence: rule.confidence };
    }
    ambiguous ??= { status: "AMBIGUOUS", ruleId, ruleName: rule.name, candidates: found };
  }
  return ambiguous ?? { status: "NO_MATCH" };
}
