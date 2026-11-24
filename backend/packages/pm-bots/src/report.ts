export type Health = "green" | "amber" | "red";

export interface ReportTask {
  id: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  dueDate: Date | null;
}
export interface ReportCounts {
  completed: number;
  created: number;
  inProgress: number;
  open: number;
  overdue: number;
  activeBlockers: number;
  overduePct: number;
}

/** Green: overdue < 10% and no blockers. Red: overdue > 25% or 3+ blockers. Anything else is amber. */
export function computeHealth(overduePct: number, activeBlockers: number): Health {
  if (overduePct > 25 || activeBlockers >= 3) return "red";
  if (overduePct >= 10 || activeBlockers >= 1) return "amber";
  return "green";
}

/** Every figure is counted from the rows given, never estimated. Percent is rounded to one decimal. */
export function buildWeeklyCounts(tasks: readonly ReportTask[], activeBlockers: number, now: Date, weekStart: Date): ReportCounts {
  const isDone = (t: ReportTask) => ["done", "cancelled"].includes(t.status.toLowerCase());
  const open = tasks.filter((t) => !isDone(t));
  const overdue = open.filter((t) => t.dueDate !== null && t.dueDate <= now).length;
  const overduePct = open.length === 0 ? 0 : Math.round((overdue / open.length) * 1000) / 10;
  return {
    completed: tasks.filter((t) => t.completedAt && t.completedAt >= weekStart && t.completedAt <= now).length,
    created: tasks.filter((t) => t.createdAt >= weekStart && t.createdAt <= now).length,
    inProgress: open.filter((t) => t.status.toLowerCase() === "in progress").length,
    open: open.length,
    overdue,
    activeBlockers,
    overduePct,
  };
}

export type ReportStatus = "draft" | "approved" | "sent";
export interface WeeklyReport {
  status: ReportStatus;
  createdAt: Date;
  remindedAt: Date | null;
  sentAt: Date | null;
}

export function approveReport(r: WeeklyReport, at: Date): WeeklyReport {
  if (r.status !== "draft") throw new Error("only a draft report can be approved");
  return { ...r, status: "sent", sentAt: at };
}

/** One reminder after 24h of silence. An unapproved draft is never auto-sent. */
export function draftReminderDue(r: WeeklyReport, now: Date): boolean {
  return r.status === "draft" && r.remindedAt === null && now.getTime() - r.createdAt.getTime() >= 24 * 3_600_000;
}

/** Monday start of the week containing the date, for the idempotency key. */
export function weekStartIso(d: Date): string {
  const day = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)).toISOString().slice(0, 10);
}
