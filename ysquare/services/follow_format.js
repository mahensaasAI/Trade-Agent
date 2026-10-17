// Y Square - Follow Y Square: the page's usual {success, data|error} reply for each action.
var r = $('Route Follow Request').first().json, f = ($input.first() || {}).json || {};
function ok(data) { return [{ json: { success: true, data: data } }]; }
function no(code, message) { return [{ json: { success: false, error: { code: code, message: message } } }]; }
if (f.error) return no('ERROR', 'That did not work just now. Please try again.');
var a = r.action;
if (a === 'follow.list' || a === 'follow.admin_list') return ok(f.d || {});
if (a === 'follow.hit') return ok({ counted: Number(f.counted || 0) });
if (a === 'follow.save') {
  if (Number(f.saved || 0) < 1) return no('DUPLICATE', (r.params || [])[13] ? 'That post was not found, or another post already uses that Instagram link.' : 'That Instagram post is already on the page.');
  return ok({ id: f.id });
}
if (a === 'follow.toggle') return f.post ? ok({ post: f.post }) : no('NOT_FOUND', 'That post could not be found.');
if (a === 'follow.order') return ok({ moved: Number(f.moved || 0) });
if (a === 'follow.delete') return Number(f.deleted || 0) > 0 ? ok({ deleted: 1, title: f.title }) : no('NOT_FOUND', 'That post was already removed.');
if (a === 'follow.prefs') return f.prefs ? ok({ prefs: f.prefs }) : no('ERROR', 'The settings could not be saved. Please try again.');
return no('ERROR', 'Something went wrong. Please try again.');
