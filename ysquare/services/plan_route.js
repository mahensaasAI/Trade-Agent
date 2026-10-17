// Y Square - My Plan: checks who is calling (the same session check as Y Square Services: md5 of the bearer token in
// ys_sessions, not expired, account active) and turns each action into ONE parameterised SQL statement.
// mode: 'sql' (run it), 'parse' (sentence or agent plan -> AI -> items for the person to check), 'deny' (reply now).
var j = $('Plan Request').first().json, body = j.body || {}, sess = ($('Load Session').first() || {}).json || {};
var action = String(body.action || ''), p = body.payload || {};
function deny(code, message) { return [{ json: { mode: 'deny', reply: { success: false, error: { code: code, message: message } } } }]; }
var hdr = j.headers || {}, auth = String(hdr.authorization || hdr.Authorization || '').trim();
if (!/^bearer\s+\S+$/i.test(auth)) return deny('SIGN_IN', 'Sign in to use My Plan.');
if (!sess.id) return deny('INVALID_SESSION', 'Your session is no longer valid or has expired. Please sign in again.');
if (sess.active === false) return deny('ACCOUNT_DISABLED', 'This account has been deactivated.');
var me = sess.id;

var KINDS = ['meal', 'workout', 'study', 'event', 'task', 'other'];
var REPEATS = ['daily', 'weekdays', 'weekly'];
var REMINDS = [0, 5, 10, 15, 30, 60, 120, 1440];
var SOURCES = ['manual', 'sentence', 'athlete', 'studypals'];
function str(v, n) { return v == null ? '' : String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n); }
function isoOk(v) { var d = new Date(v); return typeof v === 'string' && v.length <= 40 && !isNaN(d.getTime()) ? d : null; }
function tzOk(v) { v = str(v, 60); return /^[A-Za-z]+(?:\/[A-Za-z0-9_+\-]+){0,2}$/.test(v) || v === 'UTC' ? v : 'UTC'; }
// One plan item from the page, checked field by field. Returns [row] or [null, message].
function item(x) {
  x = x || {};
  var title = str(x.title, 120).replace(/\s+/g, ' ');
  if (!title) return [null, 'Please give it a title.'];
  var kind = KINDS.indexOf(x.kind) >= 0 ? x.kind : 'other';
  var s = isoOk(x.startsAt), e = x.endsAt ? isoOk(x.endsAt) : null;
  if (!s) return [null, 'Please choose a date and time.'];
  var now = Date.now();
  if (s.getTime() < now - 730 * 864e5 || s.getTime() > now + 1095 * 864e5) return [null, 'Please choose a date within the next three years.'];
  if (x.endsAt && (!e || e.getTime() < s.getTime())) return [null, 'The end time has to be after the start.'];
  var repeat = REPEATS.indexOf(x.repeat) >= 0 ? x.repeat : null;
  var days = null;
  if (repeat === 'weekly') {
    days = (Array.isArray(x.repeatDays) ? x.repeatDays : []).map(Number).filter(function (d, i, a) { return d >= 0 && d <= 6 && Math.floor(d) === d && a.indexOf(d) === i; }).sort();
    if (!days.length) days = null;
  }
  var until = repeat && /^\d{4}-\d{2}-\d{2}$/.test(String(x.repeatUntil || '')) ? String(x.repeatUntil) : null;
  if (until && new Date(until + 'T23:59:59Z').getTime() < s.getTime() - 864e5) return [null, 'The last day has to be after the first one.'];
  var remind = x.remindMin === null || x.remindMin === undefined || x.remindMin === '' ? null : Number(x.remindMin);
  if (remind !== null && REMINDS.indexOf(remind) < 0) remind = 15;
  return [{ kind: kind, title: title, notes: str(x.notes, 500) || null, starts_at: s.toISOString(), ends_at: e ? e.toISOString() : null,
    all_day: x.allDay === true, tz: tzOk(x.tz), repeat: repeat, repeat_days: days, repeat_until: until, remind_min: remind,
    source: SOURCES.indexOf(x.source) >= 0 ? x.source : 'manual' }];
}
var COLS = "kind text, title text, notes text, starts_at timestamptz, ends_at timestamptz, all_day boolean, tz text, repeat text, repeat_days int[], repeat_until date, remind_min int, source text";
var TZ = "CASE WHEN x.tz IN (SELECT name FROM pg_timezone_names) THEN x.tz ELSE 'UTC' END";
function sql(q, params) { return [{ json: { mode: 'sql', action: action, sql: q, params: params } }]; }

if (action === 'plan.list') {
  return sql("SELECT (SELECT coalesce(json_agg(x ORDER BY x.starts_at), '[]'::json) FROM (SELECT id, kind, title, notes, starts_at, ends_at, all_day, tz, repeat, repeat_days, repeat_until, remind_min, source FROM ys_plan_items WHERE owner_id = $1 AND (repeat IS NOT NULL OR starts_at > now() - interval '35 days') ORDER BY starts_at LIMIT 800) x) AS items, (SELECT json_build_object('digest', digest, 'feedToken', feed_token) FROM ys_plan_prefs WHERE owner_id = $1) AS prefs", [me]);
}
if (action === 'plan.save' || action === 'plan.save_many') {
  var list = action === 'plan.save' ? [p.item] : (Array.isArray(p.items) ? p.items : []);
  if (!list.length || list.length > 60) return deny('INVALID', 'Nothing to save.');
  var rows = [];
  for (var i = 0; i < list.length; i++) { var r = item(list[i]); if (!r[0]) return deny('INVALID', r[1]); rows.push(r[0]); }
  var id = action === 'plan.save' ? str(p.item && p.item.id, 40) : '';
  if (id) {
    if (!/^pl-[a-f0-9]{18}$/.test(id)) return deny('INVALID', 'That item could not be found.');
    return sql("UPDATE ys_plan_items i SET kind = x.kind, title = x.title, notes = x.notes, starts_at = x.starts_at, ends_at = x.ends_at, all_day = coalesce(x.all_day, false), tz = " + TZ + ", repeat = x.repeat, repeat_days = x.repeat_days, repeat_until = x.repeat_until, remind_min = x.remind_min, updated_at = now() FROM json_to_recordset($2::json) AS x(" + COLS + ") WHERE i.id = $3 AND i.owner_id = $1 RETURNING i.id", [me, JSON.stringify(rows), id]);
  }
  return sql("WITH n AS (SELECT count(*) AS c FROM ys_plan_items WHERE owner_id = $1) INSERT INTO ys_plan_items (owner_id, kind, title, notes, starts_at, ends_at, all_day, tz, repeat, repeat_days, repeat_until, remind_min, source) SELECT $1, x.kind, x.title, x.notes, x.starts_at, x.ends_at, coalesce(x.all_day, false), " + TZ + ", x.repeat, x.repeat_days, x.repeat_until, x.remind_min, x.source FROM json_to_recordset($2::json) AS x(" + COLS + "), n WHERE n.c + json_array_length($2::json) <= 1000 RETURNING id", [me, JSON.stringify(rows)]);
}
if (action === 'plan.delete') {
  var did = str(p.id, 40);
  if (!/^pl-[a-f0-9]{18}$/.test(did)) return deny('INVALID', 'That item could not be found.');
  return sql("WITH d AS (DELETE FROM ys_plan_items WHERE id = $2 AND owner_id = $1 RETURNING id), s AS (DELETE FROM ys_plan_sent WHERE item_id IN (SELECT id FROM d) RETURNING 1) SELECT (SELECT count(*) FROM d) AS deleted", [me, did]);
}
if (action === 'plan.prefs') {
  return sql("INSERT INTO ys_plan_prefs (owner_id, digest, tz) VALUES ($1, $2, CASE WHEN $3 IN (SELECT name FROM pg_timezone_names) THEN $3 ELSE NULL END) ON CONFLICT (owner_id) DO UPDATE SET digest = EXCLUDED.digest, tz = coalesce(EXCLUDED.tz, ys_plan_prefs.tz), updated_at = now() RETURNING digest", [me, p.digest !== false, tzOk(p.tz)]);
}
if (action === 'plan.feed') {
  return sql("INSERT INTO ys_plan_prefs (owner_id, feed_token) VALUES ($1, encode(gen_random_bytes(18), 'hex')) ON CONFLICT (owner_id) DO UPDATE SET feed_token = CASE WHEN $2 OR ys_plan_prefs.feed_token IS NULL THEN encode(gen_random_bytes(18), 'hex') ELSE ys_plan_prefs.feed_token END, updated_at = now() RETURNING feed_token", [me, p.reset === true]);
}
if (action === 'plan.parse') {
  var text = str(p.text, 6000);
  if (text.length < 3) return deny('INVALID', 'Tell us what to add, for example "Study maths every weekday at 7pm".');
  var today = /^\d{4}-\d{2}-\d{2}$/.test(String(p.today || '')) ? String(p.today) : new Date().toISOString().slice(0, 10);
  var src = ['sentence', 'athlete', 'studypals'].indexOf(p.source) >= 0 ? p.source : 'sentence';
  return [{ json: { mode: 'parse', action: action, ownerId: me, text: text, today: today, weekday: str(p.weekday, 12) || '', tz: tzOk(p.tz), source: src } }];
}
return deny('UNKNOWN_ACTION', 'Something went wrong. Please reload the page and try again.');
