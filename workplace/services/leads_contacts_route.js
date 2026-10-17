// WorkPlace Leads Contacts API (/svc/leads): adding contacts to the lead pipeline by hand or from My Buddy, and sending
// a lead's email from the signed-in person's own OraDayForce mailbox (Microsoft 365). The caller was already checked
// the same way as the Collaboration API (wp_team_sessions, refreshed from WorkPlace bootstrap every 2 hours).
// mode 'sql' runs one parameterised statement; mode 'mail' goes to the Microsoft send step; errors answer at once.
const req = $('Leads Request').first().json;
const b = req.body || {};
const p = b.payload || {};
const me = $input.first().json || {};
const action = String(b.action || '');
const out = o => [{ json: Object.assign({ action: action, mode: 'sql', sql: 'SELECT 1 AS ok', params: [], status: 200, error: null, me: me }, o) }];
const fail = (status, code, message) => out({ mode: 'fail', status: status, error: { code: code, message: message } });
if (!me.user_id) return fail(401, 'INVALID_SESSION', 'Your WorkPlace session has expired. Please sign in again.');
const by = String(me.name || me.email || 'WorkPlace');
const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const long = (v, n) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n);
const EMAIL = /^[A-Za-z0-9._%+'-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
const STAGES = ['new', 'contacted', 'meeting', 'proposal', 'won', 'lost'];
// Free mail providers say nothing about the company, so they never become the company name or website.
const FREE = ['gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'zoho.com', 'yandex.com', 'mail.com', 'comcast.net', 'att.net', 'sbcglobal.net', 'verizon.net'];

if (action === 'leads.add') {
  const email = txt(p.email, 200).toLowerCase();
  if (email && !EMAIL.test(email)) return fail(400, 'BAD_EMAIL', 'That email address does not look right.');
  const phone = txt(p.phone, 40);
  if (phone && !/^[+(]?[0-9][0-9 ().\-ext+#]{5,38}$/i.test(phone)) return fail(400, 'BAD_PHONE', 'That phone number does not look right.');
  const name = txt(p.contact_name, 120), role = txt(p.contact_role, 120);
  const domain = email ? email.split('@')[1] : '';
  let website = txt(p.website, 200).replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
  if (website && !/^[a-z0-9.-]{3,190}\.[a-z]{2,24}$/.test(website)) return fail(400, 'BAD_WEBSITE', 'That website does not look right.');
  if (!website && domain && FREE.indexOf(domain) < 0) website = domain;
  let company = txt(p.company, 160);
  if (!company && website) { const w = website.replace(/^www\./, '').split('.')[0]; company = w.charAt(0).toUpperCase() + w.slice(1); }
  if (!company) company = name;
  if (!company) return fail(400, 'MISSING', 'Add at least a name or a company, with an email or phone number.');
  if (!email && !phone) return fail(400, 'MISSING', 'Add an email address or a phone number so the team can reach them.');
  const st = STAGES.indexOf(String(p.status || 'new')) >= 0 ? String(p.status || 'new') : 'new';
  const notes = txt(p.notes, 2000), where = txt(p.via, 40) === 'buddy' ? 'Added from My Buddy' : 'Added in Pipeline';
  return out({ sql: "WITH opt AS (SELECT 1 FROM wp_lead_optout WHERE value <> '' AND value IN (lower($4), lower($1), lower($6)) LIMIT 1), " +
    "dup AS (SELECT id FROM wp_leads WHERE $4 <> '' AND lower(email) = lower($4) AND status <> 'dismissed' ORDER BY id LIMIT 1), " +
    "upd AS (UPDATE wp_leads l SET contact_name = coalesce(l.contact_name, NULLIF($2, '')), contact_role = coalesce(l.contact_role, NULLIF($3, '')), phone = coalesce(l.phone, NULLIF($5, '')), notes = CASE WHEN $8 <> '' THEN trim(coalesce(l.notes, '') || ' ' || $8) ELSE l.notes END, last_action_at = now() FROM dup WHERE l.id = dup.id AND NOT EXISTS (SELECT 1 FROM opt) RETURNING l.id), " +
    "ins AS (INSERT INTO wp_leads (dedupe_key, signal, source, company, contact_name, contact_role, email, phone, website, location, notes, status, owner, score, last_action_at) SELECT 'manual:' || md5(lower($1) || '|' || lower($4) || '|' || $5 || '|' || lower($2)), 'Added', 'Added by ' || $9, $1, NULLIF($2, ''), NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''), NULLIF($8, ''), $10, $9, 0, now() WHERE NOT EXISTS (SELECT 1 FROM opt) AND NOT EXISTS (SELECT 1 FROM dup) ON CONFLICT (dedupe_key) DO UPDATE SET last_seen = now() RETURNING id), " +
    "act AS (INSERT INTO wp_lead_activity (lead_id, kind, outcome, by_name) SELECT id, 'note', $11, $9 FROM ins UNION ALL SELECT id, 'note', 'Contact details added', $9 FROM upd RETURNING 1) " +
    "SELECT (SELECT id FROM ins) AS id, (SELECT id FROM upd) AS dup_id, EXISTS (SELECT 1 FROM opt) AS blocked",
    params: [company, name, role, email, phone, website, txt(p.location, 120), notes, by, st, where] });
}
if (action === 'leads.mailstatus') return out({ mode: 'mail', check: true, sql: "SELECT coalesce(json_object_agg(key, value), '{}'::json) AS cfg FROM wp_sso_config", params: [] });
if (action === 'leads.send') {
  const leadId = String(p.id || '');
  if (!/^[0-9]{1,12}$/.test(leadId)) return fail(400, 'BAD_REQUEST', 'A lead id is required.');
  const to = txt(p.to, 200).toLowerCase();
  if (!EMAIL.test(to)) return fail(400, 'BAD_EMAIL', 'Add a valid email address in the To box.');
  const subject = txt(p.subject, 200), body = long(p.body, 20000);
  if (!subject) return fail(400, 'MISSING', 'Add a subject.');
  if (body.length < 10) return fail(400, 'MISSING', 'Write the message first.');
  const from = String(me.email || '').toLowerCase();
  if (!EMAIL.test(from)) return fail(400, 'NO_MAILBOX', 'Your WorkPlace account has no email address to send from.');
  return out({ mode: 'mail', check: false, leadId: leadId, to: to, subject: subject, body: body, from: from,
    sql: "SELECT coalesce((SELECT json_object_agg(key, value) FROM wp_sso_config), '{}'::json) AS cfg, " +
      "(SELECT row_to_json(x) FROM (SELECT id, company, status, lower(coalesce(website, '')) AS website FROM wp_leads WHERE id = $1::bigint) x) AS lead, " +
      "EXISTS (SELECT 1 FROM wp_lead_optout o WHERE o.value IN (lower($2), split_part(lower($2), '@', 2)) OR o.value IN (SELECT lower(company) FROM wp_leads WHERE id = $1::bigint UNION SELECT lower(coalesce(website, '')) FROM wp_leads WHERE id = $1::bigint)) AS blocked, " +
      "(SELECT count(*) FROM wp_lead_activity WHERE kind = 'email' AND by_name = $3 AND outcome LIKE 'Sent from WorkPlace%' AND at > now() - interval '1 day')::int AS sent_today",
    params: [leadId, to, by] });
}
return fail(400, 'UNKNOWN_ACTION', 'Unknown action.');
