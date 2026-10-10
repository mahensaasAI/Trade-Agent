// Y Square - My Plan: writes the 7am "Your plan today" email for each person who has something planned today.
// Nothing is sent to accounts under 13 (the query leaves them out) or when the day is empty.
function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
var COLORS = { meal: '#16a34a', workout: '#ea580c', study: '#2563eb', event: '#7c3aed', task: '#0891b2', other: '#64748b' };
var LABELS = { meal: 'Meal', workout: 'Workout', study: 'Study', event: 'Event', task: 'Task', other: 'Plan' };
return $input.all().map(function (it) { return it.json; }).filter(function (r) { return r.id && r.email && Array.isArray(r.items) && r.items.length; }).map(function (r) {
  var first = String(r.name || '').trim().split(/\s+/)[0] || 'there';
  var rows = r.items.slice(0, 30).map(function (i) {
    var c = COLORS[i.kind] || COLORS.other;
    return '<tr><td style="padding:10px 12px 10px 0;white-space:nowrap;color:#475569;font-size:14px;vertical-align:top">' + esc(i.time) + '</td>' +
      '<td style="padding:10px 0;border-left:3px solid ' + c + ';padding-left:12px"><div style="font-size:15px;font-weight:600;color:#0f172a">' + esc(i.title) + '</div>' +
      '<div style="font-size:12px;color:' + c + ';font-weight:600">' + esc(LABELS[i.kind] || 'Plan') + '</div>' +
      (i.notes ? '<div style="font-size:13px;color:#64748b;margin-top:2px">' + esc(i.notes) + '</div>' : '') + '</td></tr>';
  }).join('');
  var html = '<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">' +
    '<div style="font-size:13px;font-weight:700;letter-spacing:.4px;color:#4f46e5;text-transform:uppercase">Y Square - My Plan</div>' +
    '<h1 style="font-size:22px;margin:8px 0 4px">Good morning, ' + esc(first) + '!</h1>' +
    '<p style="margin:0 0 16px;color:#475569">Here is your plan for ' + esc(r.day_label) + '.</p>' +
    '<table role="presentation" style="border-collapse:collapse;width:100%">' + rows + '</table>' +
    '<p style="margin:22px 0"><a href="https://ysquareai.com/#/plan" style="background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;display:inline-block">Open My Plan</a></p>' +
    '<p style="font-size:12px;color:#94a3b8;margin:0">You get this email because you have items in My Plan on Y Square. To stop it, open My Plan, choose Settings and turn off the morning email.</p></div>';
  return { json: { id: r.id, day: r.day, email: r.email, subject: 'Your plan for ' + r.day_label, html: html } };
});
