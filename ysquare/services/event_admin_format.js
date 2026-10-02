// Y Square - Event Admin: the page's usual {success, data|error} reply.
var r = $('Route Event Request').first().json, f = ($input.first() || {}).json || {};
if (f.error) return [{ json: { success: false, error: { code: 'ERROR', message: 'That did not work just now. Please try again.' } } }];
if (r.action === 'events.admin_list') return [{ json: { success: true, data: { events: f.events || [] } } }];
if (Number(f.deleted || 0) < 1) return [{ json: { success: false, error: { code: 'NOT_ALLOWED', message: 'Only the event organiser or an admin can delete this event (or it was already deleted).' } } }];
return [{ json: { success: true, data: { deleted: 1, title: f.title, notified: Number(f.notified || 0) } } }];
