-- Multi-tenant scoping: every owned row carries the better-auth user id,
-- and platform connections become one-per-platform PER USER instead of one
-- global row shared by every account.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE publish_jobs ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE platform_connections ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Publishing must post the trimmed, rendered MP4 — never the raw source.
ALTER TABLE clips ADD COLUMN IF NOT EXISTS rendered_url TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS render_status TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_publish_jobs_user ON publish_jobs (user_id, created_at DESC);

-- Replace the legacy global unique(platform) with unique(user_id, platform).
ALTER TABLE platform_connections DROP CONSTRAINT IF EXISTS platform_connections_platform_key;
DROP INDEX IF EXISTS platform_connections_platform_key;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_connection_user_platform
  ON platform_connections (user_id, platform);

-- Usage ledger: doubles as the cross-instance rate limiter for AI and
-- upload endpoints, and as the metering source for billing later.
CREATE TABLE IF NOT EXISTS usage_events (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  event TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 1,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usage_user_event_time
  ON usage_events (user_id, event, created_at DESC);
