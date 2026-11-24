# Project Management Bots — Exhaustive System & MVP (P1) Specification

> **Purpose:** Complete, production-grade specification for **Antigravity (Frontend)** and **Claude Code (Backend)** to design, build, integrate, and test the **5 MVP (P1) Project Management Bots**.
> **Scope:** Deadline Reminder, Blocker & Escalation, Intake & Triage, Daily Standup, Weekly Status Report.

---

## 1. System Architecture & Core Infrastructure

### 1.1 Execution Model
- **Event-Driven Consumers:** Subscribe to domain events via the Transactional Outbox (`PLT-06`).
- **Scheduled Jobs:** Cron-based scanners with distributed locking (Redis/Postgres advisory lock) to prevent duplicate runs across worker replicas.
- **Notification Delivery:** Routed through `PLT-10` (In-App, Email, Slack/Teams webhook, Push) with per-user channel preferences.
- **Working Calendars:** All SLA and reminder schedules respect `MDM-05` (Working Days, Holidays, User Timezones).

### 1.2 Tenant Isolation & Security
- Every table includes `tenant_id` enforced by PostgreSQL Row-Level Security (RLS).
- Bot jobs must set the tenant context before querying or emitting events.
- **RBAC Permissions:**
  - `pm.bots.configure`: Enable/disable bots, edit thresholds, schedules, and channels (Project Admin / PM).
  - `pm.bots.override`: Accept/reject triage suggestions, approve/edit weekly report drafts (PM / Lead).
  - `pm.bots.view_logs`: View bot delivery & audit logs (PM / Admin).

### 1.3 Idempotency, Retries & Dead-Letter Queue (DLQ)
- **Idempotency Key Format:** `bot:{bot_type}:{tenant_id}:{entity_id}:{window_or_event_key}`
- **Retry Policy:** Exponential backoff (30s, 2m, 10m, 1h) up to 4 attempts for transient failures (network, webhook 5xx, LLM timeout).
- **DLQ:** After 4 failed attempts, move job to `bot_dead_letter_queue`, emit an alert to `PLT-22` (Observability), and surface a non-blocking warning in Bot Settings.

### 1.4 Observability & Audit Trail
- Every bot action writes to `PLT-16` (Audit Trail) with `actor_type = "bot"`, `bot_type`, `entity_id`, and `metadata`.
- **Key Metrics:** `bot_jobs_executed_total`, `bot_notifications_sent_total`, `bot_failures_total`, `bot_execution_duration_ms`, `triage_override_rate`.

---

## 2. Shared Data Models (Backend Reference)

| Table | Key Columns | Purpose |
|---|---|---|
| `bot_configs` | `id`, `tenant_id`, `project_id`, `bot_type`, `enabled`, `config_json`, `updated_by`, `updated_at` | Per-project bot settings & thresholds. |
| `bot_delivery_log` | `id`, `tenant_id`, `idempotency_key` (UNIQUE), `bot_type`, `entity_id`, `recipient_id`, `channel`, `status`, `sent_at` | Prevents duplicate notifications; tracks delivery. |
| `blocker_incidents` | `id`, `tenant_id`, `task_id`, `reason`, `blocked_by_user_id`, `blocked_at`, `sla_due_at`, `escalated_at`, `unblocked_at` | Tracks blocker lifecycle & SLA timers. |
| `triage_suggestions` | `id`, `tenant_id`, `task_id`, `suggested_category`, `suggested_priority`, `suggested_team_id`, `duplicate_of_task_id`, `confidence`, `status` (`pending`/`accepted`/`overridden`) | Stores AI/rule triage proposals for human review. |
| `standup_responses` | `id`, `tenant_id`, `project_id`, `user_id`, `standup_date`, `yesterday`, `today`, `blockers`, `submitted_at` | Stores daily async check-ins (UNIQUE on `project_id, user_id, standup_date`). |
| `weekly_reports` | `id`, `tenant_id`, `project_id`, `week_start`, `week_end`, `summary_json`, `health_status`, `status` (`draft`/`approved`/`sent`), `sent_at` | Stores generated reports & approval state. |

---

## 3. API & Event Contracts (`contracts/openapi.yaml`)

### 3.1 REST Endpoints
- `GET /api/v1/projects/{projectId}/bots` — List all 5 bots with current `enabled` state and `config_json`.
- `PUT /api/v1/projects/{projectId}/bots/{botType}` — Update bot configuration (requires `pm.bots.configure`).
- `GET /api/v1/projects/{projectId}/bots/{botType}/logs` — Paginated delivery & execution logs.
- `POST /api/v1/tasks/{taskId}/triage/resolve` — Accept or override a `triage_suggestion`.
- `POST /api/v1/projects/{projectId}/standup/respond` — Submit or update today's standup response.
- `POST /api/v1/projects/{projectId}/reports/{reportId}/approve` — Approve and send a `draft` weekly report.

### 3.2 Domain Events
- `task.created` → consumed by **Intake & Triage Bot**
- `task.status_changed` → consumed by **Blocker & Escalation Bot**, **Deadline Reminder Bot**
- `task.due_date_changed` → consumed by **Deadline Reminder Bot**
- `standup.blocker_reported` → consumed by **Blocker & Escalation Bot**

---

## 4. Bot 1: Deadline Reminder Bot

### 4.1 User Flow
1. PM enables **Deadline Reminder Bot** in Project Settings and configures thresholds (default: `48h`, `24h`, `overdue`), quiet hours (e.g., `20:00–08:00`), and channels.
2. User is assigned a task with a `due_date`.
3. At **48h** before `due_date`, if task is open, assignee receives a reminder with task link and quick actions (*Mark Done*, *Request Extension*).
4. At **24h** before `due_date`, if still open, assignee receives a second reminder.
5. At `due_date` expiration, task is marked **Overdue**; both assignee and Project Lead receive an overdue alert.
6. If assignee completes or blocks the task, reminders stop.

### 4.2 Core & Advanced Logic
- **Scan Frequency:** Hourly cron job.
- **Eligibility Filter:** `status NOT IN ('Done', 'Cancelled', 'Blocked') AND due_date IS NOT NULL`.
- **Threshold Windows:**
  - `T_48H`: `now >= due_date - 48h AND now < due_date - 24h`
  - `T_24H`: `now >= due_date - 24h AND now < due_date`
  - `T_OVERDUE`: `now >= due_date`
- **Quiet Hours:** If `now` is outside user's working hours, defer `T_48H` and `T_24H` to next working window start; `T_OVERDUE` sends immediately if `urgent_overdue = true`.
- **Idempotency Key:** `bot:deadline:{tenant_id}:{task_id}:{threshold}:{due_date_iso}`.

### 4.3 Edge Cases
- **Unassigned task:** Skip `T_48H`/`T_24H`; send `T_OVERDUE` to Project Lead only.
- **Due date moved forward:** New `due_date_iso` generates a new idempotency key, allowing fresh reminders.
- **Due date moved into the past:** Immediately trigger `T_OVERDUE` on next scan (once).
- **Task reassigned:** Send `T_24H`/`T_OVERDUE` to new assignee if not already sent for that threshold.
- **Subtasks vs. Parent Tasks:** Parent/Epic tasks with `auto_rollup = true` do not trigger assignee reminders if all child tasks are `Done`.

### 4.4 Test Cases
| ID | Type | Scenario | Expected Result |
|---|---|---|---|
| DR-P1 | Positive | Task due in 47h, status `In Progress`, within working hours | Sends `T_48H` to assignee; writes `bot_delivery_log`. |
| DR-P2 | Positive | Task due in 23h, `T_48H` already sent | Sends `T_24H` only; does not resend `T_48H`. |
| DR-P3 | Positive | Task passes `due_date` while `In Progress` | Sends `T_OVERDUE` to assignee + Project Lead. |
| DR-P4 | Positive | `due_date` extended by 3 days | New `due_date_iso` key allows `T_48H` for new date. |
| DR-N1 | Negative | Task status is `Done` or `Cancelled` | No reminder sent. |
| DR-N2 | Negative | Task status is `Blocked` | Deadline reminder skipped (handled by Blocker Bot). |
| DR-N3 | Negative | Cron runs twice in same hour | Idempotency key blocks duplicate notification. |
| DR-N4 | Negative | Task has `due_date = NULL` | Ignored without error. |
| DR-N5 | Negative | Triggered during user's quiet hours (`22:00`) | Queued for `08:00` next working day. |

---

## 5. Bot 2: Blocker & Escalation Bot

### 5.1 User Flow
1. Assignee sets task status to `Blocked` → UI modal requires `blocker_reason` (min 5 chars) and optional `blocked_by_user_id`.
2. Bot immediately notifies `blocked_by_user_id` (if set) and Project Lead.
3. Bot creates a `blocker_incidents` record and sets `sla_due_at` (default: `24h` working hours).
4. If still `Blocked` at `sla_due_at`, Bot escalates to Team Manager / Escalation Owner.
5. When unblocked, `unblocked_at` is recorded, pending escalation is cancelled, and assignee is notified to resume.

### 5.2 Core & Advanced Logic
- **Trigger:** `task.status_changed` (`new_status == 'Blocked'`) or `standup.blocker_reported`.
- **Working-Hour SLA:** `sla_due_at = add_working_hours(blocked_at, sla_hours, MDM-05)`.
- **Escalation Scanner:** Runs every 15 minutes for `unblocked_at IS NULL AND escalated_at IS NULL AND now >= sla_due_at`.
- **Repeat Escalation (Optional):** If configured, re-escalate every `24h` working hours until unblocked (max 3 times).

### 5.3 Edge Cases
- **Blocked → In Progress → Blocked:** Creates a new `blocker_incidents` row with a fresh SLA timer.
- **No `blocked_by_user_id`:** Notify Project Lead immediately; escalate to Team Manager on SLA breach.
- **Task deleted/archived while `Blocked`:** Auto-close `blocker_incidents` (`unblocked_at = now`); cancel escalation.
- **Dependency owner is on PTO:** Notify Project Lead + backup owner if configured.

### 5.4 Test Cases
| ID | Type | Scenario | Expected Result |
|---|---|---|---|
| BE-P1 | Positive | Task marked `Blocked` with reason & dependency owner | Immediate notification to owner + Lead; `sla_due_at` set. |
| BE-P2 | Positive | Task remains `Blocked` past 24h working SLA | Escalation sent to Team Manager; `escalated_at` populated. |
| BE-P3 | Positive | Task unblocked at hour 8 | `unblocked_at` set; no escalation sent; assignee notified. |
| BE-P4 | Positive | Blocker reported in Daily Standup | Creates `blocker_incidents` and notifies Project Lead. |
| BE-N1 | Negative | Mark `Blocked` with empty or 2-char reason | API returns `400 Bad Request` (`reason` min 5 chars). |
| BE-N2 | Negative | Task archived while `Blocked` | Incident closed; escalation job skips it. |
| BE-N3 | Negative | Weekend falls between `blocked_at` and `now` | Weekend hours excluded from 24h SLA. |

---

## 6. Bot 3: Intake & Triage Bot

### 6.1 User Flow
1. Ticket/task is created via Intake Form, Email, Slack, or Quick-Create.
2. Bot analyzes title, description, and reporter metadata.
3. Bot proposes `category`, `priority`, `team_id`, and checks for duplicate open tasks.
4. If confidence $\ge 0.80$, Bot auto-applies fields; if $< 0.80$, routes to `Needs Triage` queue.
5. PM/Lead sees a triage badge on the task and can **Accept** or **Override** in one click.

### 6.2 Core & Advanced Logic
- **Trigger:** `task.created` where `triage_status = 'untriaged'`.
- **Two-Stage Pipeline:**
  1. **Deterministic Rules:** Keyword/regex & source mapping (e.g., `[Crash]` → `Bug`, `High`).
  2. **Semantic Classifier + Duplicate Search:** Vector/text similarity against open tasks in same `project_id` (`similarity >= 0.85` → `duplicate_of_task_id`).
- **Fallback:** If classifier times out (>5s) or errors, route to `Needs Triage` queue so task creation is never blocked.

### 6.3 Edge Cases
- **Duplicate found:** Never auto-close; link `duplicate_of_task_id` and post comment for human confirmation.
- **Human already set priority/category:** Do not overwrite human-set fields.
- **Cross-tenant isolation:** Duplicate search strictly scoped to `tenant_id` (and `project_id` unless cross-project is enabled).

### 6.4 Test Cases
| ID | Type | Scenario | Expected Result |
|---|---|---|---|
| IT-P1 | Positive | Intake: *"Checkout returns 500 on Visa"* | Classified `Bug`, `High`, routed to Payments team. |
| IT-P2 | Positive | Title matches open task #142 (similarity 0.91) | Linked as potential duplicate of #142; stays open. |
| IT-P3 | Positive | PM clicks "Override" on suggestion | `triage_suggestions.status = 'overridden'`; audit logged. |
| IT-N1 | Negative | Task created with explicit `priority = Low` | Bot does not overwrite `priority`. |
| IT-N2 | Negative | Classifier service times out | Task created and routed to `Needs Triage` fallback. |
| IT-N3 | Negative | Vague title *"Help"*, empty description | Confidence < 0.80 → tagged `Needs Triage`. |

---

## 7. Bot 4: Daily Standup Bot

### 7.1 User Flow
1. PM configures schedule (e.g., `09:30` project timezone, Mon–Fri), cutoff (`45m`), and target channel.
2. At `09:30`, Bot sends each active member a prompt pre-filled with their yesterday's completed tasks and today's assigned tasks.
3. Member submits *Yesterday*, *Today*, *Blockers* (or clicks *No blockers, on track*).
4. At `10:15` (cutoff), Bot compiles all responses into one digest and posts to the project channel.
5. Any *Blockers* entry emits `standup.blocker_reported` to the Blocker Bot.

### 7.2 Core & Advanced Logic
- **Skip Rules:** Skip members on approved PTO/leave (`MDM-05`) or with 0 active tasks.
- **Upsert Semantics:** `UNIQUE(project_id, user_id, standup_date)` allows members to edit their submission before or after cutoff.
- **Late Submissions:** Updates the existing digest message/thread rather than posting a duplicate digest.

### 7.3 Edge Cases
- **Company Holiday:** Skip both prompt and digest jobs.
- **Zero responses at cutoff:** Post *"No standup updates submitted today"* instead of an empty table.
- **Member in multiple projects:** Prompt grouped or scoped per project so updates don't leak across projects.

### 7.4 Test Cases
| ID | Type | Scenario | Expected Result |
|---|---|---|---|
| DS-P1 | Positive | 4 members submit before cutoff | Single compiled digest posted at cutoff. |
| DS-P2 | Positive | Member enters blocker text | `standup.blocker_reported` emitted; Blocker Bot triggered. |
| DS-P3 | Positive | Member submits after cutoff | Digest thread updated with late entry. |
| DS-N1 | Negative | Member is on approved PTO | Member not prompted; shown as `On Leave` in digest. |
| DS-N2 | Negative | Scheduled day is a company holiday | Standup skipped. |
| DS-N3 | Negative | Member submits twice on same day | Record updated; no duplicate row in digest. |

---

## 8. Bot 5: Weekly Status Report Bot

### 8.1 User Flow
1. PM enables Weekly Status Report (e.g., Friday `16:00`), selects recipients (channel + emails), and chooses `Auto-send` or `Draft for PM review`.
2. At scheduled time, Bot queries `[now - 7d, now]` for `project_id`:
   - Completed tasks, New tasks, In Progress, Overdue count, Active Blockers, Milestone %.
3. Bot computes Project Health (`Green` / `Amber` / `Red`).
4. If `Draft for PM review` is on, PM receives a preview to approve/edit; otherwise Bot publishes immediately.

### 8.2 Core & Advanced Logic
- **Data Integrity:** All counts and percentages come strictly from live DB queries—never estimated.
- **Health Formula:**
  - `Green`: `overdue_pct < 10% AND active_blockers == 0`
  - `Amber`: `overdue_pct BETWEEN 10% AND 25% OR active_blockers BETWEEN 1 AND 2`
  - `Red`: `overdue_pct > 25% OR active_blockers >= 3`
- **Idempotency Key:** `bot:weekly_report:{tenant_id}:{project_id}:{week_start_iso}`.

### 8.3 Edge Cases
- **Zero activity in past 7 days:** Still generate report with `0 completed` and current open/overdue counts.
- **PM ignores draft for 24h:** Send one reminder to PM; never auto-send an unapproved draft.
- **Project archived mid-week:** Cancel scheduled report.

### 8.4 Test Cases
| ID | Type | Scenario | Expected Result |
|---|---|---|---|
| WS-P1 | Positive | 12 done, 2 overdue (5%), 0 blockers | Report generated with `Green` health and exact counts. |
| WS-P2 | Positive | `Draft for PM review` enabled | `weekly_reports.status = 'draft'`; sent to PM only. |
| WS-P3 | Positive | PM clicks Approve on draft | `status = 'sent'`; published to all configured recipients. |
| WS-N1 | Negative | Project is `Archived` | Report job skipped. |
| WS-N2 | Negative | Duplicate trigger for same week | Idempotency key prevents duplicate report. |
| WS-N3 | Negative | Draft unapproved after 24h | Reminder sent to PM; not auto-published. |

---

## 9. Coordination Checklist (Claude Code ↔ Antigravity)

1. **Claude Code (Backend):**
   - Create migrations for `bot_configs`, `bot_delivery_log`, `blocker_incidents`, `triage_suggestions`, `standup_responses`, `weekly_reports` with RLS.
   - Add endpoints & schemas to `contracts/openapi.yaml`.
   - Implement outbox consumers, cron jobs, and unit/integration tests covering all `*-P*` and `*-N*` cases.
2. **Antigravity (Frontend):**
   - Generate client from `contracts/openapi.yaml`.
   - Build Project Settings → Bots tab, Blocker Reason modal, Triage suggestion badges, Standup check-in drawer, and Weekly Report preview/approval UI.
   - Add E2E tests (`frontend/e2e/`) and verify 375px/1280px light/dark screenshots.
