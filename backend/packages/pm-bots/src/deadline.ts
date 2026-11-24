import { isWithinWorkingHours, nextWorkingInstant, type WorkingCalendar } from "./calendar";
import { keys } from "./keys";

export type Threshold = "T_48H" | "T_24H" | "T_OVERDUE";

export interface DeadlineTask {
  id: string;
  tenantId: string;
  status: string;
  dueDate: Date | null;
  assigneeId: string | null;
  leadId: string | null;
  /** Parent task that rolls up from its children. */
  autoRollup?: boolean;
  allChildrenDone?: boolean;
}

export interface DeadlineContext {
  now: Date;
  calendar: WorkingCalendar;
  /** Idempotency keys already recorded in bot_delivery_log. */
  alreadySent: ReadonlySet<string>;
  urgentOverdue?: boolean;
}

export interface ReminderAction {
  threshold: Threshold;
  recipients: string[];
  key: string;
  /** Equal to now when due immediately; later when deferred out of quiet hours. */
  sendAt: Date;
}

const HOUR = 3_600_000;
const INACTIVE = new Set(["done", "cancelled", "blocked"]);

export function currentThreshold(due: Date, now: Date): Threshold | null {
  const t = now.getTime();
  const d = due.getTime();
  if (t >= d) return "T_OVERDUE";
  if (t >= d - 24 * HOUR) return "T_24H";
  if (t >= d - 48 * HOUR) return "T_48H";
  return null;
}

/** Pure decision for one task. The caller still claims the key in bot_delivery_log before sending. */
export function decideDeadlineReminder(task: DeadlineTask, ctx: DeadlineContext): ReminderAction | null {
  if (!task.dueDate || INACTIVE.has(task.status.toLowerCase())) return null;
  if (task.autoRollup && task.allChildrenDone) return null;
  const threshold = currentThreshold(task.dueDate, ctx.now);
  if (!threshold) return null;

  const overdue = threshold === "T_OVERDUE";
  if (!overdue && !task.assigneeId) return null;
  const recipients = overdue
    ? [...new Set([task.assigneeId, task.leadId].filter((x): x is string => !!x))]
    : [task.assigneeId!];
  if (recipients.length === 0) return null;

  const key = keys.deadline(task.tenantId, task.id, threshold, task.dueDate.toISOString());
  if (ctx.alreadySent.has(key)) return null;

  const immediate = overdue && ctx.urgentOverdue === true;
  const sendAt =
    immediate || isWithinWorkingHours(ctx.now, ctx.calendar) ? ctx.now : nextWorkingInstant(ctx.now, ctx.calendar);
  return { threshold, recipients, key, sendAt };
}
