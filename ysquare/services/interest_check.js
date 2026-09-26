// Y Square - Ecosystem interest: checks a "send us a message" form from the Startups page before it is stored.
// Keeps only what an admin needs to reply. Students under 13 are asked to have a parent or guardian send it.
var j = $input.first().json, b = j.body || {}, hd = j.headers || {};
function s(v, n) { return v == null ? '' : String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n); }
var ROLES = { student: 'Student', parent: 'Parent or guardian', educator: 'Teacher or coach', mentor: 'Mentor, founder or investor', other: 'Other' };
var GRADES = { '6': 'Grade 6', '7': 'Grade 7', '8': 'Grade 8', '9': 'Grade 9', '10': 'Grade 10', '11': 'Grade 11', '12': 'Grade 12' };
var f = {
  name: s(b.name, 80).replace(/\s+/g, ' '),
  email: s(b.email, 200).toLowerCase(),
  role: s(b.role, 20),
  grade: s(b.grade, 4),
  message: s(b.message, 1500),
  guestId: s(hd['x-guest-id'] || b.guestId, 64).replace(/[^A-Za-z0-9_-]/g, ''),
  ip: s(hd['x-real-ip'] || String(hd['x-forwarded-for'] || '').split(',')[0], 45)
};
var err = '';
if (s(b.website, 200)) return [{ json: { valid: false, trap: true, code: 'OK', message: '' } }];
if (!f.name) err = 'Please tell us your name.';
else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) err = 'Please enter an email address we can reply to.';
else if (!ROLES[f.role]) err = 'Please choose who you are.';
else if (f.grade && !GRADES[f.grade]) err = 'Please choose a grade from the list.';
else if (f.role === 'student' && b.over13 !== true) err = 'Students under 13: please ask a parent or guardian to send this message for you.';
f.roleLabel = ROLES[f.role] || '';
f.gradeLabel = GRADES[f.grade] || '';
f.summary = (f.roleLabel + (f.gradeLabel ? ', ' + f.gradeLabel : '') + ' - ' + f.email + (f.message ? ' - ' + f.message : '')).slice(0, 900);
return [{ json: { valid: !err, trap: false, code: err ? 'INVALID' : 'OK', message: err, f: f } }];
