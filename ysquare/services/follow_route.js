// Y Square - Follow Y Square: the Instagram announcements and reels on Y Square Community > Follow Y Square.
// Anyone can list what is live and count views, plays and taps (each viewer once per post and day); only admins can
// add, edit, pin, hide, reorder and delete posts and change the section's settings. Same session check as Y Square
// Services (md5 of the bearer token in ys_sessions, not expired, account active). Accounts under 13 get nothing back
// while "hide from under-13s" is on. Every statement is ONE parameterised SQL statement.
var j = $('Follow Request').first().json, body = j.body || {}, sess = ($('Load Session').first() || {}).json || {};
var action = String(body.action || ''), p = body.payload || {}, h = j.headers || {};
function deny(code, message) { return [{ json: { mode: 'reply', reply: { success: false, error: { code: code, message: message } } } }]; }
function done(data) { return [{ json: { mode: 'reply', reply: { success: true, data: data } } }]; }
function sql(q, params) { return [{ json: { mode: 'sql', action: action, sql: q, params: params } }]; }
function str(v, n) { return v == null ? '' : String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n); }
function line(v, n) { return str(v, n).replace(/\s+/g, ' '); }
var auth = String(h.authorization || h.Authorization || '').trim(), hasToken = /^bearer\s+\S+$/i.test(auth);
var member = hasToken && !!sess.id && sess.active !== false;
var me = member ? String(sess.id) : '', name = member ? line(sess.name, 80) || 'An admin' : '';
var admin = member && sess.role === 'admin';
// Under 13, counted the conservative way sign-up does: in the birth month the birthday is taken as not reached yet.
var child = false;
if (member) {
  var by = Number(sess.birth_year), bm = Number(sess.birth_month), now = new Date(), y = now.getUTCFullYear(), m = now.getUTCMonth() + 1;
  if (by >= 1900 && by <= y && bm >= 1 && bm <= 12) child = (y - by - (m <= bm ? 1 : 0)) < 13;
}
function needAdmin() {
  if (!hasToken) return deny('SIGN_IN', 'Please sign in first.');
  if (!sess.id) return deny('INVALID_SESSION', 'Your session is no longer valid or has expired. Please sign in again.');
  if (sess.active === false) return deny('ACCOUNT_DISABLED', 'This account has been deactivated.');
  if (!admin) return deny('FORBIDDEN', 'Only admins can change Follow Y Square.');
  return null;
}
var ID_RE = /^fp-[a-f0-9]{18}$/;
// An Instagram post or reel link, cut down to the canonical form; anything else is refused.
function igLink(v) {
  var s = str(v, 400), mm = s.match(/^https?:\/\/(?:www\.|m\.)?instagram\.com\/(?:[A-Za-z0-9._]{1,30}\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,40})\/?(?:[?#].*)?$/i);
  if (!mm) return null;
  var path = mm[1].toLowerCase() === 'p' ? 'p' : 'reel';
  return { url: 'https://www.instagram.com/' + path + '/' + mm[2] + '/', code: mm[2], kind: path === 'p' ? 'announcement' : 'reel' };
}
function when(v) { if (v == null || v === '') return ''; var d = new Date(v); return typeof v === 'string' && v.length <= 40 && !isNaN(d.getTime()) ? d.toISOString() : null; }
// A call-to-action may only lead to a page of Y Square itself.
function cta(v) { var s = str(v, 200); if (!s) return ''; if (/^#\/[a-z0-9][a-z0-9/_-]{0,60}$/i.test(s)) return s; if (/^https:\/\/(www\.)?ysquareai\.com(\/[A-Za-z0-9/_#?=&.-]*)?$/.test(s)) return s; return null; }

if (action === 'follow.list') {
  return sql("WITH pr AS (SELECT * FROM ys_follow_prefs WHERE id = 1) SELECT json_build_object('admin', $1::boolean, 'prefs', (SELECT json_build_object('handle', handle, 'enabled', enabled, 'intro', intro) FROM pr), 'hidden', ($2::boolean AND coalesce((SELECT hide_under13 FROM pr), true)), 'posts', CASE WHEN ($2::boolean AND coalesce((SELECT hide_under13 FROM pr), true)) OR NOT ($1::boolean OR coalesce((SELECT enabled FROM pr), true)) THEN '[]'::json ELSE (SELECT coalesce(json_agg(x ORDER BY x.pinned DESC, x.sort, x.created_at DESC), '[]'::json) FROM (SELECT id, kind, url, shortcode, title, caption, cta_label, cta_url, pinned, sort, created_at, starts_at, ends_at FROM ys_follow_posts WHERE status = 'live' AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()) ORDER BY pinned DESC, sort, created_at DESC LIMIT 60) x) END) AS d", [admin, child]);
}
if (action === 'follow.hit') {
  var kind = ['view', 'open', 'click', 'follow'].indexOf(p.kind) >= 0 ? p.kind : '';
  if (!kind) return deny('INVALID', 'Unknown count.');
  var ids = kind === 'follow' ? ['_profile'] : (Array.isArray(p.ids) ? p.ids : []).map(function (x) { return String(x); }).filter(function (x, i, a) { return (ID_RE.test(x) || x === '_page') && a.indexOf(x) === i; }).slice(0, 40);
  if (!ids.length || child) return done({ counted: 0 });
  var g = String(h['x-guest-id'] || h['X-Guest-Id'] || '').trim().toLowerCase();
  var ip = String(h['x-real-ip'] || '').trim();
  var viewer = me || (/^guest-[a-z0-9]{12,40}$/.test(g) ? g : (ip ? 'ip:' + ip : 'anon'));
  return sql("WITH k AS (SELECT DISTINCT unnest($2::text[]) AS pid), ok AS (SELECT k.pid FROM k WHERE k.pid IN ('_page', '_profile') OR EXISTS (SELECT 1 FROM ys_follow_posts p WHERE p.id = k.pid)), cl AS (DELETE FROM ys_follow_seen WHERE day < current_date - 1 RETURNING 1), seen AS (INSERT INTO ys_follow_seen (k, day) SELECT md5($1 || ':' || ok.pid || ':' || $3 || ':' || current_date::text), current_date FROM ok ON CONFLICT (k) DO NOTHING RETURNING k), up AS (INSERT INTO ys_follow_stats (post_id, day, views, opens, clicks) SELECT ok.pid, current_date, CASE WHEN $3 = 'view' THEN 1 ELSE 0 END, CASE WHEN $3 = 'open' THEN 1 ELSE 0 END, CASE WHEN $3 IN ('click', 'follow') THEN 1 ELSE 0 END FROM ok WHERE md5($1 || ':' || ok.pid || ':' || $3 || ':' || current_date::text) IN (SELECT k FROM seen) ON CONFLICT (post_id, day) DO UPDATE SET views = ys_follow_stats.views + EXCLUDED.views, opens = ys_follow_stats.opens + EXCLUDED.opens, clicks = ys_follow_stats.clicks + EXCLUDED.clicks RETURNING post_id) SELECT (SELECT count(*) FROM up) AS counted", [viewer, ids, kind]);
}
var no = needAdmin();
if (no) return no;
if (action === 'follow.admin_list') {
  return sql("SELECT json_build_object('prefs', (SELECT json_build_object('handle', handle, 'enabled', enabled, 'hideUnder13', hide_under13, 'intro', intro, 'updatedBy', updated_by_name, 'updatedAt', updated_at) FROM ys_follow_prefs WHERE id = 1), 'posts', (SELECT coalesce(json_agg(x ORDER BY x.pinned DESC, x.sort, x.created_at DESC), '[]'::json) FROM (SELECT p.id, p.kind, p.url, p.shortcode, p.title, p.caption, p.cta_label, p.cta_url, p.pinned, p.status, p.sort, p.starts_at, p.ends_at, p.created_by_name, p.updated_by_name, p.created_at, p.updated_at, (SELECT json_build_object('v7', coalesce(sum(s.views) FILTER (WHERE s.day > current_date - 7), 0), 'o7', coalesce(sum(s.opens) FILTER (WHERE s.day > current_date - 7), 0), 'c7', coalesce(sum(s.clicks) FILTER (WHERE s.day > current_date - 7), 0), 'v30', coalesce(sum(s.views) FILTER (WHERE s.day > current_date - 30), 0), 'o30', coalesce(sum(s.opens) FILTER (WHERE s.day > current_date - 30), 0), 'c30', coalesce(sum(s.clicks) FILTER (WHERE s.day > current_date - 30), 0), 'v', coalesce(sum(s.views), 0), 'o', coalesce(sum(s.opens), 0), 'c', coalesce(sum(s.clicks), 0)) FROM ys_follow_stats s WHERE s.post_id = p.id) AS stats FROM ys_follow_posts p) x), 'site', json_build_object('visits7', (SELECT coalesce(sum(views), 0) FROM ys_follow_stats WHERE post_id = '_page' AND day > current_date - 7), 'visits30', (SELECT coalesce(sum(views), 0) FROM ys_follow_stats WHERE post_id = '_page' AND day > current_date - 30), 'follows7', (SELECT coalesce(sum(clicks), 0) FROM ys_follow_stats WHERE post_id = '_profile' AND day > current_date - 7), 'follows30', (SELECT coalesce(sum(clicks), 0) FROM ys_follow_stats WHERE post_id = '_profile' AND day > current_date - 30), 'plays30', (SELECT coalesce(sum(opens), 0) FROM ys_follow_stats WHERE post_id LIKE 'fp-%' AND day > current_date - 30), 'days', (SELECT json_agg(json_build_object('day', d.day, 'visits', coalesce(a.views, 0), 'plays', coalesce(b.opens, 0), 'follows', coalesce(c.clicks, 0)) ORDER BY d.day) FROM (SELECT g::date AS day FROM generate_series(current_date - 29, current_date, interval '1 day') g) d LEFT JOIN ys_follow_stats a ON a.post_id = '_page' AND a.day = d.day LEFT JOIN (SELECT day, sum(opens) AS opens FROM ys_follow_stats WHERE post_id LIKE 'fp-%' GROUP BY day) b ON b.day = d.day LEFT JOIN ys_follow_stats c ON c.post_id = '_profile' AND c.day = d.day))) AS d", [me]);
}
if (action === 'follow.save') {
  var x = p.post || {}, link = igLink(x.url);
  if (!link) return deny('INVALID', 'Paste the link of an Instagram post or reel, for example https://www.instagram.com/reel/ABC123xyz/.');
  var kind2 = ['reel', 'announcement'].indexOf(x.kind) >= 0 ? x.kind : link.kind;
  var title = line(x.title, 100);
  if (title.length < 2) return deny('INVALID', 'Give it a short title.');
  var caption = str(x.caption, 600), ctaLabel = line(x.ctaLabel, 30), ctaUrl = cta(x.ctaUrl);
  if (ctaUrl === null) return deny('INVALID', 'The button can only lead to a Y Square page, for example #/startups.');
  if (!!ctaLabel !== !!ctaUrl) return deny('INVALID', 'Give the button both a label and a page, or leave both empty.');
  var st = when(x.startsAt), en = when(x.endsAt);
  if (st === null || en === null) return deny('INVALID', 'Please check the show from / until dates.');
  if (st && en && new Date(en).getTime() <= new Date(st).getTime()) return deny('INVALID', '"Show until" has to be after "Show from".');
  var status = x.status === 'hidden' ? 'hidden' : 'live', pinned = x.pinned === true;
  var id = str(x.id, 40);
  var base = [me, kind2, link.url, link.code, title, caption, ctaLabel, ctaUrl, pinned, status, st, en, name];
  if (id) {
    if (!ID_RE.test(id)) return deny('NOT_FOUND', 'That post could not be found.');
    return sql("WITH up AS (UPDATE ys_follow_posts SET kind = $2, url = $3, shortcode = $4, title = $5, caption = NULLIF($6, ''), cta_label = NULLIF($7, ''), cta_url = NULLIF($8, ''), pinned = $9::boolean, status = $10, starts_at = NULLIF($11, '')::timestamptz, ends_at = NULLIF($12, '')::timestamptz, updated_by_name = $13, updated_at = now() WHERE id = $14 AND NOT EXISTS (SELECT 1 FROM ys_follow_posts o WHERE o.platform = 'instagram' AND o.shortcode = $4 AND o.id <> $14) RETURNING id, title), a AS (INSERT INTO ys_activity (actor, actor_type, action, object_type, object_id, target, icon) SELECT $13, 'user', 'edited a Follow Y Square post', 'follow_post', up.id, up.title, 'insta' FROM up RETURNING id) SELECT (SELECT id FROM up) AS id, (SELECT count(*) FROM up) AS saved", base.concat([id]));
  }
  return sql("WITH ins AS (INSERT INTO ys_follow_posts (kind, url, shortcode, title, caption, cta_label, cta_url, pinned, status, starts_at, ends_at, sort, created_by, created_by_name, updated_by_name) SELECT $2, $3, $4, $5, NULLIF($6, ''), NULLIF($7, ''), NULLIF($8, ''), $9::boolean, $10, NULLIF($11, '')::timestamptz, NULLIF($12, '')::timestamptz, coalesce((SELECT min(sort) FROM ys_follow_posts), 0) - 1, $1, $13, $13 ON CONFLICT (platform, shortcode) DO NOTHING RETURNING id, title), a AS (INSERT INTO ys_activity (actor, actor_type, action, object_type, object_id, target, icon) SELECT $13, 'user', 'added to Follow Y Square', 'follow_post', ins.id, ins.title, 'insta' FROM ins RETURNING id) SELECT (SELECT id FROM ins) AS id, (SELECT count(*) FROM ins) AS saved", base);
}
if (action === 'follow.toggle') {
  var tid = str(p.id, 40);
  if (!ID_RE.test(tid)) return deny('NOT_FOUND', 'That post could not be found.');
  var pin = typeof p.pinned === 'boolean' ? p.pinned : null, stt = p.status === 'live' || p.status === 'hidden' ? p.status : null;
  if (pin === null && stt === null) return deny('INVALID', 'Nothing to change.');
  var what = pin === true ? 'pinned a Follow Y Square post' : pin === false ? 'unpinned a Follow Y Square post' : stt === 'hidden' ? 'hid a Follow Y Square post' : 'showed a Follow Y Square post';
  return sql("WITH up AS (UPDATE ys_follow_posts SET pinned = coalesce($3::boolean, pinned), status = coalesce($4::text, status), updated_by_name = $1, updated_at = now() WHERE id = $2 RETURNING id, title, pinned, status), a AS (INSERT INTO ys_activity (actor, actor_type, action, object_type, object_id, target, icon) SELECT $1, 'user', $5, 'follow_post', up.id, up.title, 'insta' FROM up RETURNING id) SELECT (SELECT row_to_json(up) FROM up) AS post", [name, tid, pin, stt, what]);
}
if (action === 'follow.order') {
  var order = (Array.isArray(p.ids) ? p.ids : []).map(String).filter(function (x, i, a) { return ID_RE.test(x) && a.indexOf(x) === i; }).slice(0, 300);
  if (!order.length) return deny('INVALID', 'Nothing to reorder.');
  return sql("WITH up AS (UPDATE ys_follow_posts p SET sort = o.ord::int, updated_at = now() FROM unnest($1::text[]) WITH ORDINALITY AS o(id, ord) WHERE p.id = o.id RETURNING p.id) SELECT count(*) AS moved FROM up", [order]);
}
if (action === 'follow.delete') {
  var did = str(p.id, 40);
  if (!ID_RE.test(did)) return deny('NOT_FOUND', 'That post could not be found.');
  return sql("WITH d AS (DELETE FROM ys_follow_posts WHERE id = $2 RETURNING id, title), s AS (DELETE FROM ys_follow_stats WHERE post_id IN (SELECT id FROM d) RETURNING 1), a AS (INSERT INTO ys_activity (actor, actor_type, action, object_type, object_id, target, icon) SELECT $1, 'user', 'removed from Follow Y Square', 'follow_post', d.id, d.title, 'insta' FROM d RETURNING id) SELECT (SELECT count(*) FROM d) AS deleted, (SELECT title FROM d) AS title", [name, did]);
}
if (action === 'follow.prefs') {
  var hd = str(p.handle, 120).replace(/^@/, '');
  var hm = hd.match(/^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#].*)?$/i);
  if (hm) hd = hm[1];
  if (hd && !/^[A-Za-z0-9._]{1,30}$/.test(hd)) return deny('INVALID', 'That does not look like an Instagram username.');
  return sql("WITH up AS (INSERT INTO ys_follow_prefs (id, handle, enabled, hide_under13, intro, updated_by_name, updated_at) VALUES (1, NULLIF($2, ''), $3::boolean, $4::boolean, NULLIF($5, ''), $1, now()) ON CONFLICT (id) DO UPDATE SET handle = EXCLUDED.handle, enabled = EXCLUDED.enabled, hide_under13 = EXCLUDED.hide_under13, intro = EXCLUDED.intro, updated_by_name = EXCLUDED.updated_by_name, updated_at = now() RETURNING handle, enabled, hide_under13, intro), a AS (INSERT INTO ys_activity (actor, actor_type, action, object_type, target, icon) SELECT $1, 'user', 'updated Follow Y Square settings', 'follow_settings', coalesce('@' || up.handle, ''), 'insta' FROM up RETURNING id) SELECT (SELECT json_build_object('handle', handle, 'enabled', enabled, 'hideUnder13', hide_under13, 'intro', intro) FROM up) AS prefs", [name, hd, p.enabled !== false, p.hideUnder13 !== false, str(p.intro, 300)]);
}
return deny('UNKNOWN_ACTION', 'Something went wrong. Please reload the page and try again.');
