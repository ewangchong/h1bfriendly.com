CREATE TABLE IF NOT EXISTS chat_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  client_ip text,
  requested_year integer,
  model text,
  success boolean NOT NULL,
  error_code text,
  error_message text,
  latest_user_prompt text NOT NULL,
  answer text,
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_chat_logs_created_at
ON chat_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_logs_success_created_at
ON chat_logs (success, created_at DESC);
