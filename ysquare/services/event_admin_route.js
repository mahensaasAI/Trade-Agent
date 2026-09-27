// Y Square - Event Admin: removing events. Admins can list every event and delete any of them (people create events
// they never use); an event's organisers - signed in, or the guest who made it on this browser - can delete their own
// from the event's Edit window. Same caller checks as Y Square Services: a session token (md5 in ys_sessions, not
// expired, account active) or, without one, the X-Guest-Id header.
var j = $('Event Request').first().json, body = j.body || {}, sess = ($('Load Session').first() || {}).json || {};
var action = String(body.action || ''), p = body.payload || {}, h = j.headers || {};
function deny(code, message) { return [{ json: { mode: 'deny', reply: { success: false, error: { code: code, message: message } } } }]; }
function sql(q, params) { return [{ json: { mode: 'sql', action: action, sql: q, params: params } }]; }
var auth = String(h.authorization || '').trim(), me = '', name = '', admin = false;
if (/^bearer\s+\S+$/i.test(auth)) {
  if (!sess.id) return deny('INVALID_SESSION', 'Your session is no longer valid or has expired. Please sign in again.');
  if (sess.active === false) return deny('ACCOUNT_DISABLED', 'This account has been deactivated.');
  me = sess.id; name = String(sess.name || 'The organiser'); admin = sess.role === 'admin';
} else {
  var g = String(h['x-guest-id'] || '').trim();
  if (!/^guest-[a-z0-9]{12,40}$/i.test(g)) return deny('SIGN_IN', 'Please sign in first.');
  me = g.toLowerCase(); name = 'The organiser';
}
if (action === 'events.admin_list') {
  if (!admin) return deny('FORBIDDEN', 'Only admins can see every event.');
  return sql("SELECT coalesce(json_agg(x ORDER BY x.created_at DESC), '[]'::json) AS events FROM (SELECT e.id, e.code, e.title, e.type, e.status, e.owner_id, e.owner_name, e.starts_at, e.created_at, e.updated_at, (e.owner_id LIKE 'guest-%') AS guest_owner, (SELECT count(*) FROM ys_event_members m WHERE m.event_id = e.id) AS members, (SELECT count(*) FROM ys_event_members m WHERE m.event_id = e.id AND m.rsvp = 'yes') AS going, (SELECT count(*) FROM ys_event_tasks t WHERE t.event_id = e.id) AS tasks, (SELECT count(*) FROM ys_event_updates u WHERE u.event_id = e.id) AS updates, (SELECT count(*) FROM ys_event_messages c WHERE c.event_id = e.id) AS messages FROM ys_events e ORDER BY e.created_at DESC LIMIT 500) x", []);
}
if (action === 'events.delete') {
  var id = String(p.eventId || '').trim();
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(id)) return deny('NOT_FOUND', 'That event could not be found.');
  var note = admin ? 'An admin removed this event.' : sess.id ? String(name).slice(0, 60) + ' (organiser) removed this event.' : 'The organiser removed this event.';
  return sql("WITH ev AS (SELECT e.id, e.title FROM ys_events e WHERE e.id = $2 AND ($3::boolean OR e.owner_id = $1 OR EXISTS (SELECT 1 FROM ys_event_members m WHERE m.event_id = e.id AND m.member_id = $1 AND m.role = 'organizer'))), mem AS (SELECT DISTINCT m.member_id FROM ys_event_members m WHERE m.event_id IN (SELECT id FROM ev) AND m.member_id <> $1 AND m.member_id NOT LIKE 'guest-%'), n AS (INSERT INTO ys_notifications (recipient_id, kind, title, body, link, actor_name) SELECT mem.member_id, 'event_removed', 'Event removed: ' || ev.title, $4, '#/events', $5 FROM mem, ev RETURNING 1), d1 AS (DELETE FROM ys_event_tasks WHERE event_id IN (SELECT id FROM ev) RETURNING 1), d2 AS (DELETE FROM ys_event_updates WHERE event_id IN (SELECT id FROM ev) RETURNING 1), d3 AS (DELETE FROM ys_event_messages WHERE event_id IN (SELECT id FROM ev) RETURNING 1), d4 AS (DELETE FROM ys_event_members WHERE event_id IN (SELECT id FROM ev) RETURNING 1), d5 AS (DELETE FROM ys_notifications WHERE link = '#/events/' || $2 AND EXISTS (SELECT 1 FROM ev) RETURNING 1), d6 AS (DELETE FROM ys_events WHERE id IN (SELECT id FROM ev) RETURNING id, title) SELECT (SELECT count(*) FROM d6) AS deleted, (SELECT title FROM d6) AS title, (SELECT count(*) FROM n) AS notified, (SELECT count(*) FROM d1) AS tasks, (SELECT count(*) FROM d4) AS members", [me, id, admin, note, admin ? 'Admin' : String(name).slice(0, 60)]);
}
return deny('UNKNOWN_ACTION', 'Something went wrong. Please reload the page and try again.');
