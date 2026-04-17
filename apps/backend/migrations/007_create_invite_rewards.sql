-- Invite rewards tracking table
CREATE TABLE IF NOT EXISTS invite_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  invite_count int NOT NULL DEFAULT 0,
  rewards_granted jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_rewards_user_id
  ON invite_rewards (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_rewards_referral_code
  ON invite_rewards (referral_code);
