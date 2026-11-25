import { newId, systemClock, type Clock } from "@erp/kernel";

export interface FieldChange {
  readonly field: string;
  readonly before: unknown;
  readonly after: unknown;
}

export interface AuditEntry {
  readonly id: string;
  readonly tenantId: string;
  readonly actorId: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly changes: readonly FieldChange[];
  readonly occurredAt: string;
  readonly requestId: string | null;
}

export interface AuditStore {
  append(entry: AuditEntry): Promise<void>;
  listForEntity(tenantId: string, entityType: string, entityId: string): Promise<AuditEntry[]>;
}

/** JSON-safe form of a value: bigints become strings, Money uses its toJSON. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, nested: unknown) =>
    typeof nested === "bigint" ? nested.toString() : nested,
  );
}

/** Field-level diff between two versions of a record. Unchanged fields are omitted. */
export function diffRecords(
  before: Readonly<Record<string, unknown>> | null,
  after: Readonly<Record<string, unknown>> | null,
): FieldChange[] {
  const fields = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changes: FieldChange[] = [];
  for (const field of [...fields].sort()) {
    const previous = before?.[field];
    const next = after?.[field];
    if (canonical(previous) !== canonical(next)) {
      changes.push({ field, before: toStored(previous), after: toStored(next) });
    }
  }
  return changes;
}

/** Stored form of a field value. A missing value is recorded as null. */
function toStored(value: unknown): unknown {
  return value === undefined ? null : (JSON.parse(canonical(value)) as unknown);
}

export interface RecordAuditInput {
  readonly tenantId: string;
  readonly actorId: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly before?: Readonly<Record<string, unknown>> | null;
  readonly after?: Readonly<Record<string, unknown>> | null;
  readonly requestId?: string | null;
}

export class AuditLog {
  constructor(
    private readonly store: AuditStore,
    private readonly clock: Clock = systemClock,
  ) {}

  /** Records a change. Returns null when a before and after were given but nothing changed. */
  async record(input: RecordAuditInput): Promise<AuditEntry | null> {
    const before = input.before ?? null;
    const after = input.after ?? null;
    const changes = diffRecords(before, after);
    if (changes.length === 0 && before !== null && after !== null) {
      return null;
    }
    const entry: AuditEntry = {
      id: newId(this.clock.now().getTime()),
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      changes,
      occurredAt: this.clock.now().toISOString(),
      requestId: input.requestId ?? null,
    };
    await this.store.append(entry);
    return entry;
  }
}
