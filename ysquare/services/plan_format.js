// Y Square - My Plan: turns the database result into the page's usual {success, data|error} reply.
var r = $('Route Plan').first().json, rows = $input.all().map(function (i) { return i.json || {}; }), f = rows[0] || {};
function ok(d) { return [{ json: { success: true, data: d } }]; }
function no(code, m) { return [{ json: { success: false, error: { code: code, message: m } } }]; }
if (f.error) return no('ERROR', 'We could not save that right now. Please try again.');
if (r.action === 'plan.list') return ok({ items: f.items || [], prefs: f.prefs || { digest: true, feedToken: null } });
if (r.action === 'plan.save' || r.action === 'plan.save_many') {
  var ids = rows.filter(function (x) { return x.id; }).map(function (x) { return x.id; });
  if (!ids.length) return r.params.length > 2 ? no('NOT_FOUND', 'That item could not be found.') : no('LIMIT', 'My Plan holds up to 1000 items. Delete some old ones first.');
  return ok({ saved: ids.length, ids: ids });
}
if (r.action === 'plan.delete') return ok({ deleted: Number(f.deleted || 0) });
if (r.action === 'plan.prefs') return ok({ digest: f.digest !== false });
if (r.action === 'plan.feed') return ok({ feedToken: f.feed_token || null });
return no('ERROR', 'Something went wrong. Please try again.');
