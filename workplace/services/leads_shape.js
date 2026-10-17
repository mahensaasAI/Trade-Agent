// WorkPlace Leads Contacts API - the page's usual {success, data | error} answer for every path.
const plan = $('Route Leads Request').first().json;
const reply = (status, body) => [{ json: { status: status, body: body } }];
const bad = (status, code, message) => reply(status, { success: false, error: { code: code, message: message } });
if (plan.mode === 'fail') return bad(plan.status, plan.error.code, plan.error.message);
const r = $input.first().json || {};
if (plan.mode === 'mail') {
  const m = $('Send Mail').first().json || {};
  if (m.error) return bad(m.status || 500, m.error.code, m.error.message);
  const data = Object.assign({}, m.data || {});
  if (!plan.check) {
    if (r.error || !r.id) return reply(200, { success: true, data: Object.assign(data, { logged: false }) });
    data.lead = { id: r.id, status: r.status, owner: r.owner, email: r.email };
    data.logged = true;
  }
  return reply(200, { success: true, data: data });
}
if (r.error) return bad(500, 'DB_ERROR', 'That could not be saved just now. Please try again.');
if (plan.action === 'leads.add') {
  if (r.blocked) return bad(409, 'DO_NOT_CONTACT', 'This contact or company asked not to be contacted, so it was not added.');
  if (r.id) return reply(200, { success: true, data: { id: String(r.id), added: true } });
  if (r.dup_id) return reply(200, { success: true, data: { id: String(r.dup_id), duplicate: true } });
  return bad(500, 'NOT_SAVED', 'The contact could not be added. Please try again.');
}
return reply(200, { success: true, data: r });
