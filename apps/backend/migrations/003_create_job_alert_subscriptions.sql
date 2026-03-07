CREATE TABLE IF NOT EXISTS job_alert_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  email text NOT NULL,
  keywords text,
  state text,
  title text,
  frequency text NOT NULL DEFAULT 'weekly',
  active boolean NOT NULL DEFAULT true,
  source_page text,
  last_sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_job_alert_subscriptions_created_at
ON job_alert_subscriptions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_alert_subscriptions_active_created_at
ON job_alert_subscriptions (active, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_alert_subscriptions_unique
ON job_alert_subscriptions (
  lower(email),
  coalesce(lower(keywords), ''),
  coalesce(upper(state), ''),
  coalesce(lower(title), ''),
  frequency
);
