import { createHash } from "node:crypto";
import type { AuditEntry } from "./audit";

/** Hash of the element before the first entry in a tenant's chain. */
export const GENESIS_HASH = "0".repeat(64);

/** The fields that are covered by an entry's hash. Excludes the chain fields themselves. */
type HashedFields = Omit<AuditEntry, "sequence" | "prevHash" | "hash">;

/**
 * JSON with object keys sorted and bigints written as strings. The same value always gives the same
 * text, so a hash computed at write time can be recomputed after the row is read back.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/** Hash of one entry, linked to the entry before it. Changing any covered field changes the hash. */
export function chainHash(entry: HashedFields, sequence: number, prevHash: string): string {
  const covered = {
    id: entry.id,
    tenantId: entry.tenantId,
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    changes: entry.changes,
    occurredAt: entry.occurredAt,
    requestId: entry.requestId,
    sequence,
    prevHash,
  };
  return createHash("sha256").update(stableStringify(covered)).digest("hex");
}

export type ChainVerdict =
  | { readonly ok: true; readonly checked: number; readonly unchained: number }
  | { readonly ok: false; readonly brokenAt: number; readonly reason: string };

/**
 * Checks a tenant's chain from the first entry. Entries without a sequence are older than the chain
 * and are counted, not checked. Any edited, removed or reordered entry is reported at its sequence.
 */
export function verifyChain(entries: readonly AuditEntry[]): ChainVerdict {
  const unchained = entries.filter((entry) => entry.sequence === undefined).length;
  const chained = entries
    .filter((entry): entry is AuditEntry & { sequence: number; prevHash: string; hash: string } =>
      entry.sequence !== undefined && entry.prevHash !== undefined && entry.hash !== undefined,
    )
    .sort((a, b) => a.sequence - b.sequence);

  let expectedPrev = GENESIS_HASH;
  let expectedSequence = chained[0]?.sequence ?? 1;
  for (const entry of chained) {
    if (entry.sequence !== expectedSequence) {
      return { ok: false, brokenAt: entry.sequence, reason: "a sequence number is missing" };
    }
    if (entry.prevHash !== expectedPrev) {
      return { ok: false, brokenAt: entry.sequence, reason: "the link to the previous entry does not match" };
    }
    const recomputed = chainHash(entry, entry.sequence, entry.prevHash);
    if (recomputed !== entry.hash) {
      return { ok: false, brokenAt: entry.sequence, reason: "the entry content has changed since it was written" };
    }
    expectedPrev = entry.hash;
    expectedSequence += 1;
  }
  return { ok: true, checked: chained.length, unchained };
}
