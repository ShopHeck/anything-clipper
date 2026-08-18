-- Persist fight/sponsor clip metadata so analysis survives save/reload.
ALTER TABLE clips ADD COLUMN IF NOT EXISTS moment_type TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS fight_round INTEGER;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS fighter_names JSONB;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS sponsor_friendly BOOLEAN;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS content_mode TEXT;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS content_mode TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS fight_context JSONB;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sponsor_package JSONB;
