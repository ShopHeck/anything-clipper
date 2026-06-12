-- Lightweight collaboration: a project owner can share a project with
-- teammates by email. Roles: 'viewer' (read + export) or 'editor' (also
-- edit). Ownership stays on projects.user_id; shares are additive grants.
CREATE TABLE IF NOT EXISTS project_shares (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  shared_with_email TEXT NOT NULL,
  shared_with_user_id TEXT,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One share per (project, invitee email).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_project_share
  ON project_shares (project_id, shared_with_email);
CREATE INDEX IF NOT EXISTS idx_shares_email ON project_shares (lower(shared_with_email));
CREATE INDEX IF NOT EXISTS idx_shares_user ON project_shares (shared_with_user_id);
