-- Phase 2: deeper clip analysis. Clips gain the metadata Opus-style tools
-- surface — reframe keyframes, suggested cuts (silences/fillers), keyword
-- highlights, and the language — plus snapped, word-accurate boundaries.
ALTER TABLE clips ADD COLUMN IF NOT EXISTS reframe_keyframes JSONB;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS suggested_cuts JSONB;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS keywords JSONB;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS language TEXT;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS language TEXT;
-- Detected silence/dead-air ranges (seconds) for one-tap "remove silences".
ALTER TABLE projects ADD COLUMN IF NOT EXISTS silences JSONB;
