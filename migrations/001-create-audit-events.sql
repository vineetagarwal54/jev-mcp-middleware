CREATE TABLE IF NOT EXISTS audit_events (
  event_id TEXT PRIMARY KEY,
  correlation_id TEXT NOT NULL UNIQUE,
  occurred_at TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  sanitized_arguments_json TEXT,
  validation_status TEXT NOT NULL,
  provider_json TEXT,
  policy_json TEXT NOT NULL,
  upstream_json TEXT NOT NULL,
  total_latency_ms INTEGER NOT NULL,
  config_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL
);
PRAGMA user_version = 1;
