import { createHash } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { claimIdempotencyKey, storeIdempotencyResponse, type Queryable } from "@erp/db";
import { DomainError } from "@erp/kernel";

const KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

/** The Idempotency-Key header, or undefined when the client sent none. Malformed keys are refused. */
export function idempotencyKeyFrom(request: FastifyRequest): string | undefined {
  const raw = request.headers["idempotency-key"];
  if (raw === undefined) return undefined;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !KEY_PATTERN.test(value)) {
    throw new DomainError("VALIDATION", "Idempotency-Key must be 8 to 128 letters, digits, dots, colons, dashes or underscores");
  }
  return value;
}

/** A stable fingerprint of the parsed request: the same fields in any order give the same hash. */
export function requestHash(payload: unknown): string {
  return createHash("sha256").update(canonical(payload)).digest("hex");
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`);
  return `{${entries.join(",")}}`;
}

export interface IdempotentResult {
  readonly status: number;
  readonly body: unknown;
  /** True when this response was replayed from an earlier identical request. */
  readonly replayed: boolean;
}

/**
 * Runs `work` once per key. Must be called inside the tenant transaction, so the key and the write
 * commit or roll back together. Without a key, `work` simply runs.
 */
export async function runIdempotent(
  tx: Queryable,
  opts: { tenantId: string; scope: string; key: string | undefined; payload: unknown },
  work: () => Promise<{ status: number; body: unknown }>,
): Promise<IdempotentResult> {
  if (opts.key === undefined) return { ...(await work()), replayed: false };
  const hash = requestHash(opts.payload);
  const claim = await claimIdempotencyKey(tx, opts.tenantId, opts.scope, opts.key, hash);
  if (claim.claimed) {
    const result = await work();
    await storeIdempotencyResponse(tx, opts.tenantId, opts.scope, opts.key, result.status, result.body);
    return { ...result, replayed: false };
  }
  const existing = claim.existing!;
  if (existing.requestHash !== hash) {
    throw new DomainError("CONFLICT", "This Idempotency-Key was already used for a different request");
  }
  if (existing.statusCode === null) {
    throw new DomainError("CONFLICT", "A request with this Idempotency-Key is still in progress. Try again shortly.");
  }
  return { status: existing.statusCode, body: existing.response, replayed: true };
}
