import { describe, expect, it } from "vitest";
import {
  InMemoryDeliveryLog,
  MON_FRI_ALL_DAY,
  addWorkingHours,
  approveReport,
  buildDigest,
  buildWeeklyCounts,
  closeIncident,
  computeHealth,
  decideDeadlineReminder,
  draftReminderDue,
  incidentsToEscalate,
  initialBlockerRecipients,
  keys,
  markReportSent,
  markEscalated,
  nextRetryDelayMs,
  openBlockerIncident,
  promptTargets,
  shouldRunStandup,
  submitStandup,
  triageTask,
  type DeadlineTask,
  type StandupResponse,
  type WorkingCalendar,
} from "../src";

const T = "tenant-1";
const H = 3_600_000;
const office: WorkingCalendar = { ...MON_FRI_ALL_DAY, startMinute: 8 * 60, endMinute: 20 * 60 };
// 2026-11-24 is a Tuesday.
const noon = new Date("2026-11-24T12:00:00Z");
const task = (over: Partial<DeadlineTask> = {}): DeadlineTask => ({
  id: "t1", tenantId: T, status: "In Progress", dueDate: new Date(noon.getTime() + 47 * H),
  assigneeId: "alice", leadId: "lead", ...over,
});
const ctx = (now = noon, alreadySent = new Set<string>()) => ({ now, calendar: office, alreadySent });

describe("Deadline Reminder (DR)", () => {
  it("DR-P1 sends T_48H to the assignee within working hours", () => {
    const a = decideDeadlineReminder(task(), ctx())!;
    expect(a.threshold).toBe("T_48H");
    expect(a.recipients).toEqual(["alice"]);
    expect(a.sendAt).toEqual(noon);
  });
  it("DR-P2 at 23h sends T_24H only, not T_48H again", () => {
    const t = task({ dueDate: new Date(noon.getTime() + 23 * H) });
    const sent48 = keys.deadline(T, "t1", "T_48H", t.dueDate!.toISOString());
    expect(decideDeadlineReminder(t, ctx(noon, new Set([sent48])))!.threshold).toBe("T_24H");
  });
  it("DR-P3 overdue goes to assignee and lead", () => {
    const a = decideDeadlineReminder(task({ dueDate: new Date(noon.getTime() - H) }), ctx())!;
    expect(a.threshold).toBe("T_OVERDUE");
    expect(a.recipients.sort()).toEqual(["alice", "lead"]);
  });
  it("DR-P4 a moved due date gets a fresh key", () => {
    const old = task();
    const sent = new Set([keys.deadline(T, "t1", "T_48H", old.dueDate!.toISOString())]);
    expect(decideDeadlineReminder(old, ctx(noon, sent))).toBeNull();
    const moved = task({ dueDate: new Date(old.dueDate!.getTime() + 1 * H) });
    expect(decideDeadlineReminder(moved, ctx(noon, sent))).not.toBeNull();
  });
  it("DR-N1/N2/N4 done, cancelled, blocked and no due date are ignored", () => {
    for (const status of ["Done", "Cancelled", "Blocked"]) expect(decideDeadlineReminder(task({ status }), ctx())).toBeNull();
    expect(decideDeadlineReminder(task({ dueDate: null }), ctx())).toBeNull();
  });
  it("DR-N3 a second run in the same hour is blocked by the delivery log", () => {
    const log = new InMemoryDeliveryLog();
    const a = decideDeadlineReminder(task(), ctx())!;
    expect(log.claim(T, a.key)).toBe(true);
    expect(log.claim(T, a.key)).toBe(false);
  });
  it("DR-N5 quiet hours at 22:00 defer to 08:00 next working day", () => {
    const a = decideDeadlineReminder(task(), ctx(new Date("2026-11-24T22:00:00Z")))!;
    expect(a.sendAt.toISOString()).toBe("2026-11-25T08:00:00.000Z");
  });
  it("edge: unassigned tasks only alert the lead when overdue; rolled-up parents are skipped", () => {
    expect(decideDeadlineReminder(task({ assigneeId: null }), ctx())).toBeNull();
    const o = decideDeadlineReminder(task({ assigneeId: null, dueDate: new Date(noon.getTime() - H) }), ctx())!;
    expect(o.recipients).toEqual(["lead"]);
    expect(decideDeadlineReminder(task({ autoRollup: true, allChildrenDone: true }), ctx())).toBeNull();
  });
  it("edge: urgent overdue ignores quiet hours", () => {
    const now = new Date("2026-11-24T22:00:00Z");
    const a = decideDeadlineReminder(task({ dueDate: new Date(now.getTime() - H) }), { ...ctx(now), urgentOverdue: true })!;
    expect(a.sendAt).toEqual(now);
  });
});

describe("Blocker & Escalation (BE)", () => {
  const open = (blockedAt = noon, extra = {}) =>
    openBlockerIncident({ id: "i1", tenantId: T, taskId: "t1", reason: "Waiting on API keys", blockedByUserId: "bob", blockedAt, calendar: MON_FRI_ALL_DAY, ...extra });
  it("BE-P1 notifies owner and lead and sets the SLA", () => {
    const i = open();
    expect(initialBlockerRecipients(i, "lead").sort()).toEqual(["bob", "lead"]);
    expect(i.slaDueAt.toISOString()).toBe("2026-11-25T12:00:00.000Z");
  });
  it("BE-P2 escalates once after the SLA", () => {
    const i = open();
    const p = { calendar: MON_FRI_ALL_DAY };
    expect(incidentsToEscalate([i], new Date(i.slaDueAt.getTime() - 1), p)).toHaveLength(0);
    expect(incidentsToEscalate([i], i.slaDueAt, p)).toHaveLength(1);
    const e = markEscalated(i, i.slaDueAt);
    expect(e.escalatedAt).not.toBeNull();
    expect(incidentsToEscalate([e], new Date(i.slaDueAt.getTime() + 100 * H), p)).toHaveLength(0);
  });
  it("BE-P3 unblocking at hour 8 cancels escalation", () => {
    const i = closeIncident(open(), new Date(noon.getTime() + 8 * H));
    expect(i.unblockedAt).not.toBeNull();
    expect(incidentsToEscalate([i], new Date(noon.getTime() + 48 * H), { calendar: MON_FRI_ALL_DAY })).toHaveLength(0);
  });
  it("BE-P4 a standup blocker creates an incident like any other", () => {
    expect(open(noon, { id: "i2" }).slaDueAt).toBeInstanceOf(Date);
  });
  it("BE-N1 reasons under 5 characters are rejected with VALIDATION", () => {
    for (const reason of ["", "  ab ", "ab"]) {
      expect(() => open(noon, { reason })).toThrowError(expect.objectContaining({ code: "VALIDATION" }));
    }
  });
  it("BE-N2 archived task closes the incident and the scanner skips it", () => {
    const closed = closeIncident(open(), noon);
    expect(incidentsToEscalate([closed], new Date(noon.getTime() + 99 * H), { calendar: MON_FRI_ALL_DAY })).toHaveLength(0);
  });
  it("BE-N3 weekends are excluded from the SLA", () => {
    // Friday 2026-11-27 12:00 + 24 working hours = Monday 12:00.
    expect(addWorkingHours(new Date("2026-11-27T12:00:00Z"), 24, MON_FRI_ALL_DAY).toISOString()).toBe("2026-11-30T12:00:00.000Z");
  });
  it("edge: owner on leave routes to lead and backup; repeat escalation caps at 3", () => {
    const i = open();
    expect(initialBlockerRecipients(i, "lead", { onLeave: new Set(["bob"]), backupOwnerId: "carol" }).sort()).toEqual(["carol", "lead"]);
    const policy = { calendar: MON_FRI_ALL_DAY, repeatEveryWorkingHours: 24, maxEscalations: 3 };
    const e3 = { ...i, escalatedAt: i.slaDueAt, escalationCount: 3 };
    expect(incidentsToEscalate([e3], new Date(i.slaDueAt.getTime() + 200 * H), policy)).toHaveLength(0);
    const e1 = { ...i, escalatedAt: i.slaDueAt, escalationCount: 1 };
    expect(incidentsToEscalate([e1], new Date(i.slaDueAt.getTime() + 24 * H), policy)).toHaveLength(1);
  });
});

describe("Intake & Triage (IT)", () => {
  const base = { id: "n1", tenantId: T, projectId: "p1" };
  it("IT-P1 classifies a checkout 500 as Bug, High, Payments and auto-applies", async () => {
    const r = await triageTask({ ...base, title: "Checkout returns 500 on Visa" });
    expect(r.proposal).toMatchObject({ category: "Bug", priority: "High", teamId: "payments" });
    expect(r.autoApply).toBe(true);
  });
  it("IT-P2 links a 0.91 duplicate and ignores other tenants, projects and closed tasks", async () => {
    const r = await triageTask({ ...base, title: "Checkout returns 500 on Visa" }, {
      findSimilar: async () => [
        { taskId: "x-other-tenant", tenantId: "t2", projectId: "p1", open: true, similarity: 0.99 },
        { taskId: "x-other-project", tenantId: T, projectId: "p2", open: true, similarity: 0.98 },
        { taskId: "x-closed", tenantId: T, projectId: "p1", open: false, similarity: 0.97 },
        { taskId: "142", tenantId: T, projectId: "p1", open: true, similarity: 0.91 },
      ],
    });
    expect(r.duplicateOfTaskId).toBe("142");
  });
  it("IT-N1 never overwrites a human-set priority", async () => {
    const r = await triageTask({ ...base, title: "Checkout returns 500 on Visa", priority: "Low" });
    expect(r.applied.priority).toBeUndefined();
    expect(r.applied.category).toBe("Bug");
  });
  it("IT-N2 classifier timeout falls back to Needs Triage without throwing", async () => {
    const r = await triageTask({ ...base, title: "Something odd" }, { classify: () => new Promise(() => {}), timeoutMs: 20 });
    expect(r.needsTriage).toBe(true);
    expect(r.fallbackReason).toBe("classifier_timeout");
  });
  it("IT-N3 a vague title goes to Needs Triage", async () => {
    const r = await triageTask({ ...base, title: "Help", description: "" });
    expect(r.needsTriage).toBe(true);
    expect(r.proposal.confidence).toBeLessThan(0.8);
  });
});

describe("Daily Standup (DS)", () => {
  const cutoff = new Date("2026-11-24T10:15:00Z");
  const resp = (userId: string, over: Partial<StandupResponse> = {}): StandupResponse => ({
    projectId: "p1", userId, standupDate: "2026-11-24", yesterday: "y", today: "t", blockers: "", submittedAt: new Date("2026-11-24T09:40:00Z"), ...over,
  });
  const members = ["a", "b", "c", "d"].map((u) => ({ userId: u, name: u.toUpperCase(), activeTasks: 2 }));
  it("DS-P1 four on-time responses make one digest", () => {
    const responses = ["a", "b", "c", "d"].map((u) => resp(u));
    const d = buildDigest({ projectId: "p1", date: "2026-11-24", members, responses, onLeave: new Set() });
    expect(d.empty).toBe(false);
    expect(d.text.split("\n")).toHaveLength(4);
  });
  it("DS-P2 a blocker emits standup.blocker_reported; 'No blockers' does not", () => {
    expect(submitStandup([], resp("a", { blockers: "Waiting on design" }), cutoff).blockerEvent?.text).toBe("Waiting on design");
    expect(submitStandup([], resp("a", { blockers: "No blockers" }), cutoff).blockerEvent).toBeNull();
  });
  it("DS-P3 a late submission is flagged so the digest thread is updated", () => {
    expect(submitStandup([], resp("a", { submittedAt: new Date("2026-11-24T11:00:00Z") }), cutoff).late).toBe(true);
  });
  it("DS-N1 on-leave members are not prompted and show as On Leave", () => {
    expect(promptTargets(members, new Set(["a"])).map((m) => m.userId)).toEqual(["b", "c", "d"]);
    expect(buildDigest({ projectId: "p1", date: "2026-11-24", members, responses: [resp("b")], onLeave: new Set(["a"]) }).text).toContain("A: On Leave");
  });
  it("DS-N2 a company holiday skips the standup", () => {
    const cal = { ...MON_FRI_ALL_DAY, holidays: new Set(["2026-11-24"]) };
    expect(shouldRunStandup("2026-11-24", cal)).toBe(false);
    expect(shouldRunStandup("2026-11-25", cal)).toBe(true);
  });
  it("DS-N3 submitting twice keeps one row", () => {
    const first = submitStandup([], resp("a"), cutoff).responses;
    const second = submitStandup(first, resp("a", { today: "changed" }), cutoff).responses;
    expect(second).toHaveLength(1);
    expect(second[0]?.today).toBe("changed");
  });
  it("edge: zero responses and other projects never leak", () => {
    expect(buildDigest({ projectId: "p1", date: "2026-11-24", members, responses: [], onLeave: new Set() }).text).toBe("No standup updates submitted today");
    expect(buildDigest({ projectId: "p1", date: "2026-11-24", members, responses: [resp("a", { projectId: "p2" })], onLeave: new Set() }).empty).toBe(true);
  });
});

describe("Weekly Status Report (WS)", () => {
  const weekStart = new Date("2026-11-17T00:00:00Z");
  const now = new Date("2026-11-24T00:00:00Z");
  const mk = (n: number, f: (i: number) => Partial<Parameters<typeof buildWeeklyCounts>[0][number]>) =>
    Array.from({ length: n }, (_, i) => ({ id: `${i}`, status: "In Progress", createdAt: new Date("2026-10-01"), completedAt: null, dueDate: null, ...f(i) }));
  it("WS-P1 12 done, 2 of 40 open overdue (5%), no blockers is green with exact counts", () => {
    const tasks = [
      ...mk(12, () => ({ status: "Done", completedAt: new Date("2026-11-20") })),
      ...mk(2, () => ({ dueDate: new Date("2026-11-20") })),
      ...mk(38, () => ({ dueDate: new Date("2026-12-30") })),
    ];
    const c = buildWeeklyCounts(tasks, 0, now, weekStart);
    expect(c).toMatchObject({ completed: 12, overdue: 2, open: 40, overduePct: 5 });
    expect(computeHealth(c.overduePct, c.activeBlockers)).toBe("green");
  });
  it("health thresholds", () => {
    expect(computeHealth(10, 0)).toBe("amber");
    expect(computeHealth(0, 2)).toBe("amber");
    expect(computeHealth(25, 0)).toBe("amber");
    expect(computeHealth(25.1, 0)).toBe("red");
    expect(computeHealth(0, 3)).toBe("red");
  });
  it("edge: zero activity still reports counts", () => {
    expect(buildWeeklyCounts([], 0, now, weekStart)).toMatchObject({ completed: 0, open: 0, overduePct: 0 });
  });
  it("WS-P3 approving a draft queues it for delivery; the delivery job then marks it sent", () => {
    const d = { status: "draft" as const, createdAt: now, remindedAt: null, sentAt: null };
    const approved = approveReport(d);
    expect(approved.status).toBe("approved");
    expect(() => approveReport(approved)).toThrow();
    expect(markReportSent(approved, now)).toMatchObject({ status: "sent", sentAt: now });
    expect(() => markReportSent(d, now)).toThrow();
  });
  it("WS-N2 a duplicate trigger for the same week hits the same key", () => {
    const log = new InMemoryDeliveryLog();
    const k = keys.weeklyReport(T, "p1", "2026-11-23");
    expect(log.claim(T, k)).toBe(true);
    expect(log.claim(T, k)).toBe(false);
  });
  it("WS-N3 reminder after 24h, once, and the draft stays a draft", () => {
    const d = { status: "draft" as const, createdAt: now, remindedAt: null, sentAt: null };
    expect(draftReminderDue(d, new Date(now.getTime() + 23 * H))).toBe(false);
    expect(draftReminderDue(d, new Date(now.getTime() + 24 * H))).toBe(true);
    expect(draftReminderDue({ ...d, remindedAt: now }, new Date(now.getTime() + 48 * H))).toBe(false);
  });
});

describe("retries", () => {
  it("follows 30s, 2m, 10m, 1h then dead-letters", () => {
    expect([0, 1, 2, 3, 4].map(nextRetryDelayMs)).toEqual([30_000, 120_000, 600_000, 3_600_000, "dead_letter"]);
  });
});
