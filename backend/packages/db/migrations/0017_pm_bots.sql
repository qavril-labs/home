-- 0017: Project management bots (MVP, P1): deadline reminder, blocker and escalation, intake and triage,
-- daily standup, weekly status report. Spec: docs/pm-bots-mvp-spec.md. Catalog: PSA-01 (bots depend on it), PLT-10, PLT-16.
-- project_id and task_id carry no foreign key: the project and task tables arrive with PSA-01.
-- Every table is tenant-owned and protected by row-level security.

CREATE TABLE IF NOT EXISTS bot_configs (
  id          text PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants (id),
  project_id  text NOT NULL,
  bot_type    text NOT NULL CHECK (bot_type IN ('deadline_reminder', 'blocker_escalation', 'intake_triage', 'daily_standup', 'weekly_report')),
  enabled     boolean NOT NULL DEFAULT false,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by  text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, project_id, bot_type)
);

-- The unique key is what stops a double send when a cron job runs twice or two workers race.
CREATE TABLE IF NOT EXISTS bot_delivery_log (
  id              text PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants (id),
  project_id      text,
  idempotency_key text NOT NULL,
  bot_type        text NOT NULL,
  entity_id       text NOT NULL,
  recipient_id    text,
  channel         text NOT NULL,
  status          text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  attempts        integer NOT NULL DEFAULT 0,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS bot_delivery_log_entity_idx ON bot_delivery_log (tenant_id, bot_type, entity_id);
CREATE INDEX IF NOT EXISTS bot_delivery_log_project_idx ON bot_delivery_log (tenant_id, project_id, bot_type, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS bot_dead_letter_queue (
  id          text PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants (id),
  bot_type    text NOT NULL,
  entity_id   text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  error       text NOT NULL,
  attempts    integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blocker_incidents (
  id                 text PRIMARY KEY,
  tenant_id          uuid NOT NULL REFERENCES tenants (id),
  project_id         text,
  task_id            text,
  source             text NOT NULL DEFAULT 'task' CHECK (source IN ('task', 'standup')),
  reported_by        text,
  standup_date       date,
  reason             text NOT NULL CHECK (char_length(btrim(reason)) >= 5),
  blocked_by_user_id text,
  blocked_at         timestamptz NOT NULL,
  sla_due_at         timestamptz NOT NULL,
  escalated_at       timestamptz,
  escalation_count   integer NOT NULL DEFAULT 0,
  unblocked_at       timestamptz,
  CHECK (source <> 'task' OR task_id IS NOT NULL)
);
-- A person's standup blocker opens one incident per project and day, however often they edit the response.
CREATE UNIQUE INDEX IF NOT EXISTS blocker_incidents_standup_uniq ON blocker_incidents (tenant_id, project_id, reported_by, standup_date)
  WHERE source = 'standup';
-- Scanner index: open, not yet escalated incidents ordered by SLA.
CREATE INDEX IF NOT EXISTS blocker_incidents_open_idx ON blocker_incidents (tenant_id, sla_due_at)
  WHERE unblocked_at IS NULL;

CREATE TABLE IF NOT EXISTS triage_suggestions (
  id                    text PRIMARY KEY,
  tenant_id             uuid NOT NULL REFERENCES tenants (id),
  task_id               text NOT NULL,
  suggested_category    text,
  suggested_priority    text,
  suggested_team_id     text,
  duplicate_of_task_id  text,
  confidence            numeric(4, 3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'overridden')),
  resolved_by           text,
  resolved_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS triage_suggestions_task_idx ON triage_suggestions (tenant_id, task_id);

CREATE TABLE IF NOT EXISTS standup_responses (
  id            text PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants (id),
  project_id    text NOT NULL,
  user_id       text NOT NULL,
  standup_date  date NOT NULL,
  yesterday     text NOT NULL DEFAULT '',
  today         text NOT NULL DEFAULT '',
  blockers      text NOT NULL DEFAULT '',
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, project_id, user_id, standup_date)
);

CREATE TABLE IF NOT EXISTS weekly_reports (
  id            text PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants (id),
  project_id    text NOT NULL,
  week_start    date NOT NULL,
  week_end      date NOT NULL,
  summary_json  jsonb NOT NULL,
  health_status text NOT NULL CHECK (health_status IN ('green', 'amber', 'red')),
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent')),
  reminded_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz,
  UNIQUE (tenant_id, project_id, week_start)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bot_configs', 'bot_delivery_log', 'bot_dead_letter_queue', 'blocker_incidents',
                           'triage_suggestions', 'standup_responses', 'weekly_reports']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation_%s ON %I FOR ALL USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)', t, t);
  END LOOP;
END $$;
