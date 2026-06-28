-- UGC avatar + b-roll pipeline.
-- Adds support for HeyGen talking-avatar generation and AI image-to-video
-- product b-roll, plus persisted generation options so worker-driven
-- processing can reproduce the same settings the user picked at create time.
ALTER TABLE ugc_projects ADD COLUMN IF NOT EXISTS avatar_id TEXT;
ALTER TABLE ugc_projects ADD COLUMN IF NOT EXISTS avatar_video_url TEXT;
ALTER TABLE ugc_projects ADD COLUMN IF NOT EXISTS broll_assets JSONB;
-- Generation options: { voice, templateStyle, captionTemplate, avatarId, useAvatar, useBroll }
ALTER TABLE ugc_projects ADD COLUMN IF NOT EXISTS options JSONB;
