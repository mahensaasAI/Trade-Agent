-- Y Square Workplace — schema. Every statement is idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS),
-- so the "Y Square — DB Migration" workflow can be re-run at any time. Tables share the ys_ prefix and live in
-- the same Postgres as Neon Logistics (nl_*) and StudyPals.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- People. Guests never get a row here: they are identified by a client-generated guest id (see ys_guests).
CREATE TABLE IF NOT EXISTS ys_users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'member',            -- member | admin
  plan text NOT NULL DEFAULT 'free',              -- free | premium
  plan_expires_at timestamptz,                    -- NULL = no expiry (manual / lifetime); premium is effective while > now()
  plan_source text,                               -- stripe | admin | seed
  initials text,
  password_hash text,                             -- SHA-256(password:email) — NULL for Google-only accounts
  auth_provider text NOT NULL DEFAULT 'email',    -- email | google
  google_sub text UNIQUE,
  avatar_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_login timestamptz
);

-- Login sessions shared by the Services (API) and Agents (chat) workflows. Only md5(token) is stored.
CREATE TABLE IF NOT EXISTS ys_sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL,
  name text, email text, role text, initials text,
  exp timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ys_sessions_exp_idx ON ys_sessions (exp);

-- Free tier without sign-up: the browser keeps a guest id in localStorage and sends it as X-Guest-Id.
CREATE TABLE IF NOT EXISTS ys_guests (
  id text PRIMARY KEY,
  name text,
  first_seen timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  requests int DEFAULT 0,
  converted_user_id text
);

-- Daily message counters (guests and free members are capped; see ys_settings.limits).
CREATE TABLE IF NOT EXISTS ys_usage (
  owner_id text NOT NULL,
  day date NOT NULL DEFAULT current_date,
  messages int NOT NULL DEFAULT 0,
  PRIMARY KEY (owner_id, day)
);

-- Models available to the Model Router. tier decides who may use them (free: everyone, premium: paid members).
CREATE TABLE IF NOT EXISTS ys_models (
  id text PRIMARY KEY,
  provider text NOT NULL,
  label text NOT NULL,
  model_id text NOT NULL,
  tier text NOT NULL DEFAULT 'free',              -- free | premium
  description text,
  enabled boolean DEFAULT true,
  sort int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ys_agent_settings (
  agent_id text PRIMARY KEY,
  default_model text,
  enabled boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  updated_by text
);

CREATE TABLE IF NOT EXISTS ys_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Knowledge passages the agents are grounded on (sports nutrition for Athlete Edge, playbook for Event Planner).
CREATE TABLE IF NOT EXISTS ys_knowledge (
  id text PRIMARY KEY,
  agent_id text NOT NULL,
  title text NOT NULL,
  category text,
  content text NOT NULL,
  tags jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS ys_knowledge_agent_idx ON ys_knowledge (agent_id);

-- Athlete Edge: one profile per person (guest id or user id) so answers fit the sport, age group and diet.
CREATE TABLE IF NOT EXISTS ys_athlete_profiles (
  owner_id text PRIMARY KEY,
  athlete_name text,
  age_group text,                                 -- 8-11 | 12-14 | 15-17 | 18-22
  sport text,
  position text,
  training_days int,
  session_time text,                              -- morning | afternoon | evening
  goals text,
  dietary_notes text,                             -- allergies, vegetarian, halal, etc.
  favourite_foods text,
  updated_at timestamptz DEFAULT now()
);

-- Event Planner: events, people, logistics tasks, information posts and the discussion channel that replaces WhatsApp.
CREATE TABLE IF NOT EXISTS ys_events (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,                      -- 6-char join code shared with participants
  title text NOT NULL,
  type text DEFAULT 'community',                  -- community | sports | school | family | cultural | corporate
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  venue text,
  address text,
  owner_id text NOT NULL,
  owner_name text,
  status text NOT NULL DEFAULT 'planning',        -- planning | live | done | cancelled
  budget numeric,
  currency text DEFAULT 'USD',
  expected_guests int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ys_events_owner_idx ON ys_events (owner_id);

CREATE TABLE IF NOT EXISTS ys_event_members (
  event_id text NOT NULL,
  member_id text NOT NULL,
  name text,
  role text NOT NULL DEFAULT 'guest',             -- organizer | helper | guest
  rsvp text NOT NULL DEFAULT 'pending',           -- yes | no | maybe | pending
  party_size int DEFAULT 1,
  contact text,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (event_id, member_id)
);
CREATE INDEX IF NOT EXISTS ys_event_members_member_idx ON ys_event_members (member_id);

CREATE TABLE IF NOT EXISTS ys_event_tasks (
  id text PRIMARY KEY,
  event_id text NOT NULL,
  title text NOT NULL,
  category text DEFAULT 'logistics',              -- logistics | venue | food | comms | budget | program | other
  assignee text,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'todo',            -- todo | doing | done
  priority text DEFAULT 'normal',                 -- low | normal | high
  notes text,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ys_event_tasks_event_idx ON ys_event_tasks (event_id, status);

CREATE TABLE IF NOT EXISTS ys_event_updates (
  id text PRIMARY KEY,
  event_id text NOT NULL,
  kind text NOT NULL DEFAULT 'announcement',      -- announcement | info | schedule | reminder
  title text NOT NULL,
  body text,
  pinned boolean DEFAULT false,
  author text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ys_event_updates_event_idx ON ys_event_updates (event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ys_event_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  author_id text,
  author text,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ys_event_messages_event_idx ON ys_event_messages (event_id, created_at);

-- Audit and telemetry, same shape as Neon Logistics.
CREATE TABLE IF NOT EXISTS ys_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL,
  actor_type text DEFAULT 'user',
  action text NOT NULL,
  object_type text, object_id text, target text,
  previous_value text, new_value text, icon text,
  at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ys_activity_at_idx ON ys_activity (at DESC);

CREATE TABLE IF NOT EXISTS ys_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text, owner_id text, owner_kind text, provider text, model text, conversation_id text,
  prompt_chars int, output_chars int, status text, error text, duration_ms int,
  at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ys_agent_runs_at_idx ON ys_agent_runs (at DESC);

-- Billing events received from the payment provider webhook (kept for audit; plan changes are applied to ys_users).
CREATE TABLE IF NOT EXISTS ys_billing_events (
  id text PRIMARY KEY,
  provider text NOT NULL DEFAULT 'stripe',
  type text, email text, user_id text, amount numeric, currency text,
  raw jsonb, received_at timestamptz DEFAULT now()
);

-- The single-page app is served from here by the "Y Square UI" workflow.
CREATE TABLE IF NOT EXISTS ys_ui_pages (
  page text PRIMARY KEY,
  html text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
