import type { StatusType } from "../../types";

export interface MappedStatus {
  status: StatusType;
  label: string;
}

export function mapHrmStatus(rawState: string): MappedStatus {
  const s = rawState.toLowerCase();

  if (
    [
      "active",
      "approved",
      "open",
      "filled",
      "hired",
      "accepted",
      "posted",
      "paid",
      "closed",
      "filed",
      "present",
      "completed",
      "cleared",
      "valid",
      "within_band",
      "ready",
    ].includes(s)
  ) {
    return { status: "good", label: formatStateLabel(s) };
  }

  if (
    [
      "submitted",
      "pending",
      "pending_approval",
      "interviewing",
      "shortlisted",
      "offer_stage",
      "sent",
      "calculated",
      "verified",
      "notice",
      "clearance",
      "fnf_calculated",
      "fnf_approved",
      "due",
      "initiated",
      "needs_you",
    ].includes(s)
  ) {
    return { status: "act", label: formatStateLabel(s) };
  }

  if (
    [
      "blocked",
      "partial",
      "outside_band",
      "overdue",
      "expired",
      "expiring_soon",
      "late",
      "exception",
      "rejected",
      "declined",
      "suspended",
      "no_show",
      "absent",
      "half_day",
      "frozen",
    ].includes(s)
  ) {
    return { status: "watch", label: formatStateLabel(s) };
  }

  return { status: "idle", label: formatStateLabel(s) };
}

function formatStateLabel(state: string): string {
  return state
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
