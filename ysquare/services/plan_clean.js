// Y Square - My Plan: checks the AI's answer. Only well-formed items come back; the page turns date + time into the
// person's own time zone and shows them for approval before anything is saved.
var raw = String(($input.first().json || {}).text || '');
if (!raw.trim()) return [{ json: { success: false, error: { code: 'AI_BUSY', message: 'The planner is busy right now. Please try again in a minute.' } } }];
var m = raw.replace(/```(?:json)?/gi, '').match(/\{[\s\S]*\}/);
var out = { items: [], question: null };
try { out = JSON.parse(m ? m[0] : '{}'); } catch (e) { out = { items: [], question: null }; }
var KINDS = ['meal', 'workout', 'study', 'event', 'task', 'other'], REPEATS = ['daily', 'weekdays', 'weekly'];
function s(v, n) { return v == null ? '' : String(v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
function hm(v) { v = s(v, 5); return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null; }
function day(v) { v = s(v, 10); return /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + 'T12:00:00Z')) ? v : null; }
var items = (Array.isArray(out.items) ? out.items : []).slice(0, 40).map(function (x) {
  x = x || {};
  var repeat = REPEATS.indexOf(x.repeat) >= 0 ? x.repeat : null;
  var days = repeat === 'weekly' && Array.isArray(x.days) ? x.days.map(Number).filter(function (d, i, a) { return d >= 0 && d <= 6 && a.indexOf(d) === i; }) : null;
  return { title: s(x.title, 60), kind: KINDS.indexOf(x.kind) >= 0 ? x.kind : 'other', date: day(x.date), start: hm(x.start), end: hm(x.end),
    repeat: repeat, days: days && days.length ? days : null, until: repeat ? day(x.until) : null, notes: s(x.notes, 300) || null };
}).filter(function (x) { return x.title && x.date; });
var question = !items.length && out.question ? s(out.question, 200) : null;
var reply = items.length || question ? { success: true, data: { items: items, question: question } }
  : { success: false, error: { code: 'NOTHING_FOUND', message: 'We could not find anything to add. Try one or two sentences, for example "Gym on Monday, Wednesday and Friday at 5pm".' } };
return [{ json: reply }];
