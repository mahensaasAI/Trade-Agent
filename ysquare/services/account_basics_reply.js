// Y Square - Account Basics: what the page may use to fill in forms for the signed-in person (Athlete Edge profile).
// Same session check as Y Square Services (md5 of the bearer token in ys_sessions, not expired, account active).
// Only the person's own name and month and year of birth go back; nothing else from the account.
var j = $('Me Request').first().json, row = ($('Load Account').first() || {}).json || {};
var hdr = j.headers || {}, auth = String(hdr.authorization || hdr.Authorization || '').trim();
function deny(code, message) { return [{ json: { reply: { success: false, error: { code: code, message: message } } } }]; }
if (!/^bearer\s+\S+$/i.test(auth)) return deny('SIGN_IN', 'Sign in first.');
if (!row.id) return deny('INVALID_SESSION', 'Your session is no longer valid or has expired. Please sign in again.');
if (row.active === false) return deny('ACCOUNT_DISABLED', 'This account has been deactivated.');
var name = String(row.name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
var by = Number(row.birth_year), bm = Number(row.birth_month);
var y = new Date().getUTCFullYear();
return [{ json: { reply: { success: true, data: {
  name: name,
  firstName: name.split(' ')[0] || '',
  birthYear: by >= 1900 && by <= y ? by : null,
  birthMonth: bm >= 1 && bm <= 12 ? bm : null
} } } }];
