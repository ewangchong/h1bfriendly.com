CREATE TABLE IF NOT EXISTS growth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_name text NOT NULL CHECK (event_name IN ('referral_visit', 'referral_signup', 'referral_plan_generated')),
  referral_code text,
  session_key text,
  source_page text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_ip text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_growth_events_event_name_created_at
  ON growth_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_growth_events_referral_code_created_at
  ON growth_events (referral_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_growth_events_session_key_created_at
  ON growth_events (session_key, created_at DESC);
