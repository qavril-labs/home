import { DomainError } from "@erp/kernel";
import { addWorkingHours, type WorkingCalendar } from "./calendar";

export interface BlockerIncident {
  id: string;
  tenantId: string;
  taskId: string;
  reason: string;
  blockedByUserId: string | null;
  blockedAt: Date;
  slaDueAt: Date;
  escalatedAt: Date | null;
  escalationCount: number;
  unblockedAt: Date | null;
}

export function validateBlockReason(reason: string | null | undefined): string {
  const trimmed = (reason ?? "").trim();
  if (trimmed.length < 5) throw new DomainError("VALIDATION", "A blocker reason needs at least 5 characters");
  return trimmed;
}

export interface OpenBlockerInput {
  id: string;
  tenantId: string;
  taskId: string;
  reason: string;
  blockedByUserId?: string | null;
  blockedAt: Date;
  slaHours?: number;
  calendar: WorkingCalendar;
}

export function openBlockerIncident(input: OpenBlockerInput): BlockerIncident {
  return {
    id: input.id,
    tenantId: input.tenantId,
    taskId: input.taskId,
    reason: validateBlockReason(input.reason),
    blockedByUserId: input.blockedByUserId ?? null,
    blockedAt: input.blockedAt,
    slaDueAt: addWorkingHours(input.blockedAt, input.slaHours ?? 24, input.calendar),
    escalatedAt: null,
    escalationCount: 0,
    unblockedAt: null,
  };
}

/** Who hears about a new blocker. If the dependency owner is on leave, the lead and the backup owner are told. */
export function initialBlockerRecipients(
  incident: BlockerIncident,
  leadId: string | null,
  opts: { onLeave?: ReadonlySet<string>; backupOwnerId?: string | null } = {},
): string[] {
  const out = new Set<string>();
  if (leadId) out.add(leadId);
  const owner = incident.blockedByUserId;
  if (owner) {
    if (opts.onLeave?.has(owner)) {
      if (opts.backupOwnerId) out.add(opts.backupOwnerId);
    } else {
      out.add(owner);
    }
  }
  return [...out];
}

export interface EscalationPolicy {
  repeatEveryWorkingHours?: number;
  maxEscalations?: number;
  calendar: WorkingCalendar;
}

/** Open incidents the 15-minute scanner must escalate now. Closed incidents never match. */
export function incidentsToEscalate(
  incidents: readonly BlockerIncident[],
  now: Date,
  policy: EscalationPolicy,
): BlockerIncident[] {
  return incidents.filter((i) => {
    if (i.unblockedAt) return false;
    if (i.escalatedAt === null) return now >= i.slaDueAt;
    if (!policy.repeatEveryWorkingHours) return false;
    if (i.escalationCount >= (policy.maxEscalations ?? 3)) return false;
    return now >= addWorkingHours(i.escalatedAt, policy.repeatEveryWorkingHours, policy.calendar);
  });
}

export function markEscalated(i: BlockerIncident, at: Date): BlockerIncident {
  return { ...i, escalatedAt: at, escalationCount: i.escalationCount + 1 };
}

/** Unblocked, archived or deleted: the incident closes and any pending escalation is cancelled. */
export function closeIncident(i: BlockerIncident, at: Date): BlockerIncident {
  return i.unblockedAt ? i : { ...i, unblockedAt: at };
}
