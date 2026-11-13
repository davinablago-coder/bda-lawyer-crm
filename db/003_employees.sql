BEGIN;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS account_audit(id bigserial PRIMARY KEY, actor_id uuid NOT NULL, employee_id text NOT NULL, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO schema_migrations(version) VALUES(3) ON CONFLICT DO NOTHING;
COMMIT;
