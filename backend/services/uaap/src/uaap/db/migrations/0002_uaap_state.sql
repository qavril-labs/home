-- Durable runtime state: run checkpoints, approval-engine records, idempotency results.
-- One table, keyed by (tenant, kind, key), under the same row-level security as every UAAP table.
CREATE TABLE uaap.state (
  tenant_id  text NOT NULL,
  kind       text NOT NULL CHECK (kind IN ('checkpoint', 'approval', 'idempotency')),
  key        text NOT NULL,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, kind, key)
);
CREATE INDEX state_kind_updated ON uaap.state (tenant_id, kind, updated_at DESC);

ALTER TABLE uaap.state ENABLE ROW LEVEL SECURITY;
ALTER TABLE uaap.state FORCE ROW LEVEL SECURITY;
CREATE POLICY state_tenant ON uaap.state
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE ON uaap.state TO uaap_app;

-- One row per agent reply, for metrics that survive restarts. No message text, only counters.
CREATE TABLE uaap.agent_metric_events (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at               timestamptz NOT NULL DEFAULT now(),
  tenant_id        text NOT NULL,
  agent_id         text NOT NULL,
  kind             text NOT NULL CHECK (kind IN ('request', 'approval')),
  status           text NOT NULL,
  latency_ms       integer NOT NULL DEFAULT 0,
  error_code       text,
  guardrail_events text[] NOT NULL DEFAULT '{}',
  tool_calls       integer NOT NULL DEFAULT 0,
  model_calls      integer NOT NULL DEFAULT 0
);
CREATE INDEX agent_metric_events_agent_at ON uaap.agent_metric_events (agent_id, at DESC);

ALTER TABLE uaap.agent_metric_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE uaap.agent_metric_events FORCE ROW LEVEL SECURITY;
CREATE POLICY metric_events_tenant ON uaap.agent_metric_events
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT INSERT ON uaap.agent_metric_events TO uaap_app;
-- Only the table owner (inside the SECURITY DEFINER summary below) may read across tenants.
CREATE POLICY metric_events_owner_read ON uaap.agent_metric_events FOR SELECT
  USING (current_user = (SELECT pg_get_userbyid(relowner) FROM pg_class
                         WHERE oid = 'uaap.agent_metric_events'::regclass));

-- The admin console needs totals across tenants. This function returns aggregates only (no tenant
-- ids, no row data) and runs as the owner, so the service role never reads other tenants' rows.
CREATE FUNCTION uaap.agent_metrics_summary(p_since timestamptz)
RETURNS TABLE (
  agent_id text, requests bigint, tenants bigint, statuses jsonb, errors jsonb, guardrail_events jsonb,
  approvals jsonb, tool_calls bigint, model_calls bigint, p50_ms integer, p95_ms integer, max_ms integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, uaap AS $$
  WITH req AS (
    SELECT * FROM uaap.agent_metric_events WHERE kind = 'request' AND at >= p_since
  ), appr AS (
    SELECT agent_id, jsonb_object_agg(status, n) AS approvals FROM (
      SELECT agent_id, status, count(*) AS n FROM uaap.agent_metric_events
      WHERE kind = 'approval' AND at >= p_since GROUP BY agent_id, status) a
    GROUP BY agent_id
  ), st AS (
    SELECT agent_id, jsonb_object_agg(status, n) AS statuses FROM (
      SELECT agent_id, status, count(*) AS n FROM req GROUP BY agent_id, status) s GROUP BY agent_id
  ), er AS (
    SELECT agent_id, jsonb_object_agg(error_code, n) AS errors FROM (
      SELECT agent_id, error_code, count(*) AS n FROM req WHERE error_code IS NOT NULL
      GROUP BY agent_id, error_code) e GROUP BY agent_id
  ), gr AS (
    SELECT agent_id, jsonb_object_agg(g, n) AS guardrail_events FROM (
      SELECT agent_id, g, count(*) AS n FROM req, unnest(guardrail_events) AS g GROUP BY agent_id, g) x
    GROUP BY agent_id
  ), base AS (
    SELECT agent_id, count(*) AS requests, count(DISTINCT tenant_id) AS tenants,
      sum(tool_calls) AS tool_calls, sum(model_calls) AS model_calls,
      percentile_disc(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50_ms,
      percentile_disc(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_ms,
      max(latency_ms) AS max_ms
    FROM req GROUP BY agent_id
  )
  SELECT b.agent_id, b.requests, b.tenants, coalesce(st.statuses, '{}'), coalesce(er.errors, '{}'),
    coalesce(gr.guardrail_events, '{}'), coalesce(appr.approvals, '{}'), b.tool_calls, b.model_calls,
    b.p50_ms, b.p95_ms, b.max_ms
  FROM base b
  LEFT JOIN st USING (agent_id) LEFT JOIN er USING (agent_id)
  LEFT JOIN gr USING (agent_id) LEFT JOIN appr USING (agent_id);
$$;
REVOKE ALL ON FUNCTION uaap.agent_metrics_summary(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION uaap.agent_metrics_summary(timestamptz) TO uaap_app;
