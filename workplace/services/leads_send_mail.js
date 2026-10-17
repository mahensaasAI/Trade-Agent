// WorkPlace Leads Contacts API - Microsoft 365 mail. Uses the OraDayForce WorkPlace app registration (wp_sso_config,
// the same one Microsoft sign-in uses) with an app-only token, and sends as the signed-in person
// (POST /users/{their address}/sendMail), so the email comes from their own mailbox, lands in their Sent Items and
// replies reach them. Needs the Microsoft Graph "Mail.Send" application permission with admin consent; until then
// leads.mailstatus answers ready:false and the page keeps "Open in my mail app".
const plan = $('Route Leads Request').first().json;
const ctx = $input.first().json || {};
const c = ctx.cfg || {};
const LIMIT = 50;
const done = (o) => [{ json: Object.assign({ action: plan.action, me: plan.me, logSql: 'SELECT 1 AS ok', logParams: [] }, o) }];
const no = (status, code, message, extra) => done(Object.assign({ status: status, error: { code: code, message: message } }, extra || {}));
const NOT_ON = 'Sending from WorkPlace is not switched on yet: an administrator needs to grant the OraDayForce WorkPlace app the Microsoft Graph Mail.Send permission. Use Open in my mail app for now.';

async function token() {
  if (!c.tenant_id || !c.client_id || !c.client_secret) return { err: NOT_ON };
  const form = 'client_id=' + encodeURIComponent(c.client_id) + '&client_secret=' + encodeURIComponent(c.client_secret) + '&grant_type=client_credentials&scope=' + encodeURIComponent('https://graph.microsoft.com/.default');
  const r = await this.helpers.httpRequest({ method: 'POST', url: 'https://login.microsoftonline.com/' + encodeURIComponent(c.tenant_id) + '/oauth2/v2.0/token', body: form, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, returnFullResponse: true, ignoreHttpStatusErrors: true, json: true, timeout: 20000 });
  const b = r.body || {};
  if (!b.access_token) return { err: 'Microsoft did not issue a token (' + String(b.error || r.statusCode) + '). ' + NOT_ON };
  let roles = [];
  try { roles = JSON.parse(Buffer.from(String(b.access_token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).roles || []; } catch (e) { roles = []; }
  return { tok: b.access_token, roles: roles };
}

let t;
try { t = await token.call(this); } catch (e) { t = { err: 'Microsoft could not be reached just now. Please try again.' }; }
const ready = !!(t.tok && t.roles.indexOf('Mail.Send') >= 0);
if (plan.check) return done({ status: 200, data: { ready: ready, from: String(plan.me.email || ''), reason: ready ? '' : (t.err || NOT_ON) } });

if (!ctx.lead) return no(404, 'NOT_FOUND', 'That lead could not be found.');
if (ctx.blocked) return no(409, 'DO_NOT_CONTACT', 'This address or company asked not to be contacted, so WorkPlace will not email it.');
if (Number(ctx.sent_today || 0) >= LIMIT) return no(429, 'DAILY_LIMIT', 'You have sent ' + LIMIT + ' emails from WorkPlace in the last 24 hours. Please wait before sending more.');
if (!ready) return no(503, 'MAIL_NOT_READY', t.err || NOT_ON);

const msg = { message: { subject: plan.subject, body: { contentType: 'Text', content: plan.body }, toRecipients: [{ emailAddress: { address: plan.to } }] }, saveToSentItems: true };
let r;
try {
  r = await this.helpers.httpRequest({ method: 'POST', url: 'https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(plan.from) + '/sendMail', body: msg, json: true, headers: { Authorization: 'Bearer ' + t.tok }, returnFullResponse: true, ignoreHttpStatusErrors: true, timeout: 30000 });
} catch (e) { return no(502, 'SEND_FAILED', 'Microsoft could not be reached just now. Nothing was sent. Please try again.'); }
const code = Number(r.statusCode || 0);
if (code !== 202 && code !== 200) {
  const ge = ((r.body || {}).error || {});
  const gc = String(ge.code || '');
  let m = 'Microsoft refused to send it (' + (gc || ('HTTP ' + code)) + '). Nothing was sent.';
  if (code === 403 || /AccessDenied/i.test(gc)) m = NOT_ON;
  else if (code === 404 || /MailboxNotEnabled|ResourceNotFound|ErrorInvalidUser/i.test(gc)) m = 'Your account (' + plan.from + ') has no Microsoft 365 mailbox WorkPlace can send from. Use Open in my mail app instead.';
  return no(502, 'SEND_FAILED', m);
}
// Sent: log it on the lead, move a New lead to Contacted, keep the address if the lead had none.
return done({ status: 200, data: { sent: true, from: plan.from, to: plan.to },
  logSql: "WITH a AS (INSERT INTO wp_lead_activity (lead_id, kind, outcome, body, by_name) SELECT id, 'email', 'Sent from WorkPlace to ' || $2, $3, $4 FROM wp_leads WHERE id = $1::bigint RETURNING lead_id) UPDATE wp_leads SET last_action_at = now(), status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END, email = coalesce(email, $2), owner = coalesce(owner, $4) WHERE id = (SELECT lead_id FROM a) RETURNING id, status, owner, email",
  logParams: [plan.leadId, plan.to, ('From: ' + plan.from + '\nSubject: ' + plan.subject + '\n\n' + plan.body).slice(0, 4000), String(plan.me.name || plan.me.email || 'WorkPlace')] });
