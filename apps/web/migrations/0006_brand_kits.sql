-- Brand kits: per-user reusable branding applied at render time (logo
-- watermark + caption highlight color).
CREATE TABLE IF NOT EXISTS brand_kits (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'My Brand',
  logo_url TEXT,
  logo_position TEXT NOT NULL DEFAULT 'br', -- tl | tr | bl | br
  caption_color TEXT,                        -- #RRGGBB highlight override
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_brand_kits_user ON brand_kits (user_id, created_at DESC);
