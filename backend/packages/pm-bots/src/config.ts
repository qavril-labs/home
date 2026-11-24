export const BOT_TYPES = [
  "deadline_reminder",
  "blocker_escalation",
  "intake_triage",
  "daily_standup",
  "weekly_report",
] as const;
export type BotType = (typeof BOT_TYPES)[number];

export function isBotType(value: string): value is BotType {
  return (BOT_TYPES as readonly string[]).includes(value);
}

/** What a bot uses until a project edits it. Matches the defaults in docs/pm-bots-mvp-spec.md. */
export function defaultBotConfig(botType: BotType): Record<string, unknown> {
  switch (botType) {
    case "deadline_reminder":
      return { thresholds: ["48h", "24h", "overdue"], quietHours: { from: "20:00", to: "08:00" }, channels: ["in_app", "email"], urgentOverdue: false };
    case "blocker_escalation":
      return { slaHours: 24, escalationOwnerId: null, repeatEveryWorkingHours: null, maxEscalations: 3, channels: ["in_app", "email"] };
    case "intake_triage":
      return { autoApplyConfidence: 0.8, crossProject: false };
    case "daily_standup":
      return { time: "09:30", timezoneOffsetMinutes: 0, days: [1, 2, 3, 4, 5], cutoffMinutes: 45, channel: "in_app" };
    case "weekly_report":
      return { day: 5, time: "16:00", recipients: { channels: [], emails: [] }, mode: "draft" };
  }
}
