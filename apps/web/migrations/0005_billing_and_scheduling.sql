-- Phase 4: plans/credits, scheduling, and publish analytics.

-- One row per user; absent row = free plan. Stripe fields are nullable so
-- the system works before billing is wired.
CREATE TABLE IF NOT EXISTS user_plans (
  user_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Analytics + scheduling support on publish jobs.
ALTER TABLE publish_jobs ADD COLUMN IF NOT EXISTS views INTEGER;
ALTER TABLE publish_jobs ADD COLUMN IF NOT EXISTS likes INTEGER;
ALTER TABLE publish_jobs ADD COLUMN IF NOT EXISTS comments INTEGER;
ALTER TABLE publish_jobs ADD COLUMN IF NOT EXISTS shares INTEGER;
ALTER TABLE publish_jobs ADD COLUMN IF NOT EXISTS analytics_updated_at TIMESTAMPTZ;

-- Index for the scheduler to find due jobs efficiently.
CREATE INDEX IF NOT EXISTS idx_publish_jobs_scheduled
  ON publish_jobs (status, scheduled_at)
  WHERE status = 'scheduled';
