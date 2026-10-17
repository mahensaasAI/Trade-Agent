-- v44: messages from the Startups page ("I'm interested in the Y Square ecosystem"). Idempotent, add-only.
-- net_key is the daily-salted network key from ys_net_key(); it is only kept for 2 days (for the posting limit).
CREATE TABLE IF NOT EXISTS ys_interest (
  id         bigserial PRIMARY KEY,
  name       text NOT NULL,
  email      text NOT NULL,
  role       text NOT NULL,
  grade      text,
  message    text,
  guest_id   text,
  net_key    text,
  status     text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ys_interest_email_idx ON ys_interest (email, created_at);
CREATE INDEX IF NOT EXISTS ys_interest_net_idx ON ys_interest (net_key, created_at) WHERE net_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ys_interest_created_idx ON ys_interest (created_at);
