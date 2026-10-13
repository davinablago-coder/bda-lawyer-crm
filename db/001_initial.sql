BEGIN;
CREATE TABLE IF NOT EXISTS schema_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
-- Transitional aggregate preserves the prototype's domain model. Commands lock this row.
CREATE TABLE IF NOT EXISTS crm_workspace(id integer PRIMARY KEY CHECK(id=1), revision integer NOT NULL DEFAULT 0, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS accounts(id uuid PRIMARY KEY, employee_id text UNIQUE NOT NULL, email text UNIQUE NOT NULL, password_hash text NOT NULL, active boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS sessions(token_hash text PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS login_attempts(key text PRIMARY KEY, count integer NOT NULL, reset_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS command_receipts(account_id uuid NOT NULL REFERENCES accounts(id), request_id uuid NOT NULL, result jsonb, PRIMARY KEY(account_id,request_id));
INSERT INTO schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
COMMIT;
