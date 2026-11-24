import { isWorkingDay, type WorkingCalendar } from "./calendar";

export interface StandupResponse {
  projectId: string;
  userId: string;
  standupDate: string;
  yesterday: string;
  today: string;
  blockers: string;
  submittedAt: Date;
}
export interface Member {
  userId: string;
  name: string;
  activeTasks: number;
}

/** Holiday or non-working day: both the prompt job and the digest job are skipped. */
export function shouldRunStandup(date: string, cal: WorkingCalendar): boolean {
  return isWorkingDay(date, cal);
}

/** Members to prompt: not on leave and with at least one active task. */
export function promptTargets(members: readonly Member[], onLeave: ReadonlySet<string>): Member[] {
  return members.filter((m) => !onLeave.has(m.userId) && m.activeTasks > 0);
}

const NO_BLOCKER = /^\s*(|none|no blockers?|no blockers?,? on track|n\/a|-)\s*$/i;
export function hasBlocker(text: string): boolean {
  return !NO_BLOCKER.test(text);
}

export interface SubmitResult {
  responses: StandupResponse[];
  /** Emit standup.blocker_reported when set. */
  blockerEvent: { projectId: string; userId: string; standupDate: string; text: string } | null;
  late: boolean;
}

/** Upsert keyed on (project, user, date): editing never adds a second row. */
export function submitStandup(
  existing: readonly StandupResponse[],
  input: StandupResponse,
  cutoff: Date,
): SubmitResult {
  const rest = existing.filter(
    (r) => !(r.projectId === input.projectId && r.userId === input.userId && r.standupDate === input.standupDate),
  );
  return {
    responses: [...rest, input],
    blockerEvent: hasBlocker(input.blockers)
      ? { projectId: input.projectId, userId: input.userId, standupDate: input.standupDate, text: input.blockers.trim() }
      : null,
    late: input.submittedAt > cutoff,
  };
}

export function buildDigest(args: {
  projectId: string;
  date: string;
  members: readonly Member[];
  responses: readonly StandupResponse[];
  onLeave: ReadonlySet<string>;
}): { empty: boolean; text: string; onLeave: string[]; missing: string[] } {
  const mine = args.responses.filter((r) => r.projectId === args.projectId && r.standupDate === args.date);
  const name = (id: string) => args.members.find((m) => m.userId === id)?.name ?? id;
  const leave = args.members.filter((m) => args.onLeave.has(m.userId)).map((m) => m.name);
  if (mine.length === 0) {
    return { empty: true, text: "No standup updates submitted today", onLeave: leave, missing: [] };
  }
  const lines = mine.map(
    (r) =>
      `${name(r.userId)}: yesterday ${r.yesterday || "-"}; today ${r.today || "-"}; blockers ${hasBlocker(r.blockers) ? r.blockers.trim() : "none"}`,
  );
  for (const n of leave) lines.push(`${n}: On Leave`);
  const answered = new Set(mine.map((r) => r.userId));
  const missing = args.members
    .filter((m) => !answered.has(m.userId) && !args.onLeave.has(m.userId))
    .map((m) => m.name);
  return { empty: false, text: lines.join("\n"), onLeave: leave, missing };
}
