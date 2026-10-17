-- Follow Y Square (v1): the Instagram announcements and reels shown under Y Square Community > Follow Y Square.
-- Idempotent and add-only. Admins add posts by their Instagram link; nothing is copied from Instagram.
CREATE TABLE IF NOT EXISTS ys_follow_posts (
  id              text PRIMARY KEY DEFAULT 'fp-' || encode(gen_random_bytes(9), 'hex'),
  platform        text NOT NULL DEFAULT 'instagram',
  kind            text NOT NULL DEFAULT 'reel',
  url             text NOT NULL,
  shortcode       text NOT NULL,
  title           text NOT NULL,
  caption         text,
  cta_label       text,
  cta_url         text,
  pinned          boolean NOT NULL DEFAULT false,
  status          text NOT NULL DEFAULT 'live',
  sort            int NOT NULL DEFAULT 0,
  starts_at       timestamptz,
  ends_at         timestamptz,
  created_by      text,
  created_by_name text,
  updated_by_name text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ys_follow_posts_code_idx ON ys_follow_posts (platform, shortcode);

-- Daily counts per post (and '_page' for visits, '_profile' for Follow button taps). No personal data.
CREATE TABLE IF NOT EXISTS ys_follow_stats (
  post_id text NOT NULL,
  day     date NOT NULL,
  views   int NOT NULL DEFAULT 0,
  opens   int NOT NULL DEFAULT 0,
  clicks  int NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, day)
);

-- Counts each viewer once per post, kind and day: only an md5 of the viewer id, post, kind and date is kept, for two days.
CREATE TABLE IF NOT EXISTS ys_follow_seen (
  k   text PRIMARY KEY,
  day date NOT NULL
);
CREATE INDEX IF NOT EXISTS ys_follow_seen_day_idx ON ys_follow_seen (day);

-- One row of settings for the section.
CREATE TABLE IF NOT EXISTS ys_follow_prefs (
  id              int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  handle          text,
  enabled         boolean NOT NULL DEFAULT true,
  hide_under13    boolean NOT NULL DEFAULT true,
  intro           text,
  updated_by_name text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
INSERT INTO ys_follow_prefs (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
