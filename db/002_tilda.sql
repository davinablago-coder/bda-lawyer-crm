BEGIN;
-- No payloads or credentials: only delivery IDs needed to make retries safe.
CREATE TABLE IF NOT EXISTS tilda_deliveries (
  submission_id text PRIMARY KEY,
  form_id text NOT NULL,
  lead_id text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations(version) VALUES(2) ON CONFLICT DO NOTHING;
COMMIT;
