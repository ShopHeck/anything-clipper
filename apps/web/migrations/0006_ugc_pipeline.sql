-- UGC pipeline: tracks the full flow from product URL scraping through
-- script generation, TTS voiceover, asset gathering, to final video render.
CREATE TABLE IF NOT EXISTS ugc_projects (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  product_url TEXT,
  product_data JSONB,
  script JSONB,
  tts_audio_url TEXT,
  tts_timing JSONB,
  video_assets JSONB,
  render_job_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ugc_projects_user ON ugc_projects (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ugc_projects_status ON ugc_projects (status, created_at);
