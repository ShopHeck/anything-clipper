-- Baseline app schema. Matches the table shape the original prototype
-- assumed (it shipped with no migrations at all), so this is a no-op on
-- databases that already have the tables and bootstraps fresh ones.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL DEFAULT 'Untitled Project',
  file_name TEXT,
  file_url TEXT,
  total_duration DOUBLE PRECISION,
  viral_score INTEGER,
  word_count INTEGER,
  clip_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'uploading',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Segment/clip ids are client-generated ("t1", "clip-0") and only unique
-- within a project, hence the composite primary keys.
CREATE TABLE IF NOT EXISTS transcript_segments (
  id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  start_time DOUBLE PRECISION NOT NULL,
  end_time DOUBLE PRECISION NOT NULL,
  segment_text TEXT NOT NULL,
  is_highlight BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  viral_score INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, id)
);

CREATE TABLE IF NOT EXISTS clips (
  id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  hook TEXT,
  score INTEGER,
  platforms TEXT[] DEFAULT '{}',
  start_time DOUBLE PRECISION NOT NULL DEFAULT 0,
  end_time DOUBLE PRECISION NOT NULL DEFAULT 0,
  duration_label TEXT,
  reason TEXT,
  thumbnail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, id)
);

CREATE TABLE IF NOT EXISTS publish_jobs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clip_id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  caption TEXT,
  hashtags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  platform_url TEXT,
  error_msg TEXT,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_connections (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  platform TEXT NOT NULL,
  username TEXT,
  avatar_url TEXT,
  followers_count INTEGER DEFAULT 0,
  access_token TEXT,
  refresh_token TEXT,
  open_id TEXT,
  expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
