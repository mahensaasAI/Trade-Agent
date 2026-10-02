-- My Plan (v1): one personal calendar per member - meals, workouts, study, tasks - with reminders.
-- Idempotent and add-only. Times are stored as timestamptz; tz is the IANA zone the item was made in, so a repeating
-- item keeps its local time (7am stays 7am across daylight-saving changes).
CREATE TABLE IF NOT EXISTS ys_plan_items (
  id           text PRIMARY KEY DEFAULT 'pl-' || encode(gen_random_bytes(9), 'hex'),
  owner_id     text NOT NULL,
  kind         text NOT NULL DEFAULT 'other',
  title        text NOT NULL,
  notes        text,
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz,
  all_day      boolean NOT NULL DEFAULT false,
  tz           text NOT NULL DEFAULT 'UTC',
  repeat       text,
  repeat_days  int[],
  repeat_until date,
  remind_min   int,
  source       text NOT NULL DEFAULT 'manual',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ys_plan_items_owner_idx ON ys_plan_items (owner_id, starts_at);
CREATE INDEX IF NOT EXISTS ys_plan_items_repeat_idx ON ys_plan_items (repeat) WHERE repeat IS NOT NULL;

-- One row per reminder already sent, so a reminder goes out once per occurrence.
CREATE TABLE IF NOT EXISTS ys_plan_sent (
  item_id   text NOT NULL,
  occurs_at timestamptz NOT NULL,
  sent_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, occurs_at)
);

-- Per-member settings: the morning email, the calendar link and the daily AI-parse allowance.
CREATE TABLE IF NOT EXISTS ys_plan_prefs (
  owner_id    text PRIMARY KEY,
  digest      boolean NOT NULL DEFAULT true,
  tz          text,
  last_digest date,
  feed_token  text UNIQUE,
  parse_day   date,
  parse_n     int NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Every occurrence of every plan item between p_from and p_to (repeating items expanded in their own time zone).
CREATE OR REPLACE FUNCTION ys_plan_occ(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (item_id text, owner_id text, occurs_at timestamptz, title text, kind text, remind_min int, tz text, all_day boolean, notes text)
LANGUAGE sql STABLE AS $f$
  SELECT i.id, i.owner_id, i.starts_at, i.title, i.kind, i.remind_min, i.tz, i.all_day, i.notes
  FROM ys_plan_items i
  WHERE i.repeat IS NULL AND i.starts_at >= p_from AND i.starts_at < p_to
  UNION ALL
  SELECT i.id, i.owner_id, o.at, i.title, i.kind, i.remind_min, i.tz, i.all_day, i.notes
  FROM ys_plan_items i
  CROSS JOIN LATERAL (
    SELECT d::date AS day, ((d::date + (i.starts_at AT TIME ZONE i.tz)::time) AT TIME ZONE i.tz) AS at
    FROM generate_series(((p_from AT TIME ZONE i.tz)::date - 1)::timestamp, ((p_to AT TIME ZONE i.tz)::date + 1)::timestamp, interval '1 day') d
  ) o
  WHERE i.repeat IS NOT NULL
    AND o.day >= (i.starts_at AT TIME ZONE i.tz)::date
    AND (i.repeat_until IS NULL OR o.day <= i.repeat_until)
    AND (i.repeat = 'daily'
      OR (i.repeat = 'weekdays' AND extract(isodow FROM o.day) BETWEEN 1 AND 5)
      OR (i.repeat = 'weekly' AND extract(dow FROM o.day)::int = ANY (coalesce(i.repeat_days, ARRAY[extract(dow FROM (i.starts_at AT TIME ZONE i.tz))::int]))))
    AND o.at >= p_from AND o.at < p_to
$f$;
