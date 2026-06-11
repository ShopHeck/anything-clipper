-- Server-side render pipeline: jobs are created by the API, processed by
-- ffmpeg (inline or by the render worker), and the output MP4 is uploaded
-- to object storage.
CREATE TABLE IF NOT EXISTS render_jobs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  clip_id TEXT,
  spec JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  output_key TEXT,
  output_path TEXT,
  error_msg TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_render_jobs_user ON render_jobs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_render_jobs_status ON render_jobs (status, created_at);

-- Word-level timestamps from transcription power frame-accurate karaoke
-- captions and boundary snapping. [{ text, start, end }, ...] in seconds.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS transcript_words JSONB;
