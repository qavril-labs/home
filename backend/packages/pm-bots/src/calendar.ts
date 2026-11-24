/** Working calendar (MDM-05 shape). Offsets are fixed minutes from UTC; DST is not modelled here. */
export interface WorkingCalendar {
  tzOffsetMinutes: number;
  /** 0 = Sunday ... 6 = Saturday. */
  workDays: readonly number[];
  startMinute: number;
  endMinute: number;
  /** Local dates, YYYY-MM-DD. */
  holidays: ReadonlySet<string>;
}

export const MON_FRI_ALL_DAY: WorkingCalendar = {
  tzOffsetMinutes: 0,
  workDays: [1, 2, 3, 4, 5],
  startMinute: 0,
  endMinute: 1440,
  holidays: new Set(),
};

const MIN = 60_000;
const DAY = 86_400_000;

function localMs(at: Date, cal: WorkingCalendar): number {
  return at.getTime() + cal.tzOffsetMinutes * MIN;
}
function fromLocal(ms: number, cal: WorkingCalendar): Date {
  return new Date(ms - cal.tzOffsetMinutes * MIN);
}
function localDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
function startOfDay(ms: number): number {
  return ms - (((ms % DAY) + DAY) % DAY);
}
export function isWorkingDay(date: string, cal: WorkingCalendar): boolean {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return cal.workDays.includes(dow) && !cal.holidays.has(date);
}

export function isWithinWorkingHours(at: Date, cal: WorkingCalendar): boolean {
  const l = localMs(at, cal);
  const minute = Math.floor((l - startOfDay(l)) / MIN);
  return isWorkingDay(localDate(l), cal) && minute >= cal.startMinute && minute < cal.endMinute;
}

/** The instant itself if it is inside working hours, otherwise the start of the next working window. */
export function nextWorkingInstant(from: Date, cal: WorkingCalendar): Date {
  if (isWithinWorkingHours(from, cal)) return from;
  const l = localMs(from, cal);
  let day = startOfDay(l);
  const minute = (l - day) / MIN;
  if (!(isWorkingDay(localDate(day), cal) && minute < cal.startMinute)) day += DAY;
  for (let i = 0; i < 3660; i++, day += DAY) {
    if (isWorkingDay(localDate(day), cal)) return fromLocal(day + cal.startMinute * MIN, cal);
  }
  throw new Error("calendar has no working day within ten years");
}

/** Adds working hours, skipping weekends, holidays and time outside the daily window. */
export function addWorkingHours(from: Date, hours: number, cal: WorkingCalendar): Date {
  let remaining = hours * 60;
  let cursor = localMs(from, cal);
  for (let i = 0; i < 3660; i++) {
    const day = startOfDay(cursor);
    if (isWorkingDay(localDate(day), cal)) {
      const segStart = Math.max(cursor, day + cal.startMinute * MIN);
      const segEnd = day + cal.endMinute * MIN;
      if (segStart < segEnd) {
        const available = (segEnd - segStart) / MIN;
        if (remaining <= available) return fromLocal(segStart + remaining * MIN, cal);
        remaining -= available;
      }
    }
    cursor = day + DAY;
  }
  throw new Error("calendar has no working time within ten years");
}
