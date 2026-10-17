// Y Square - My Plan: the private calendar feed (iCalendar) that Google Calendar, Apple Calendar or Outlook
// subscribe to. It carries the person's plan items (repeating ones as RRULEs, in their own time zone, with a
// reminder) and the group events they are going to.
var r = $input.first().json || {};
if (!r.owner_id) return [{ json: { found: false } }];
function esc(v) { return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
function fold(line) { var out = [], s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); } out.push(s); return out.join('\r\n'); }
var DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
var now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Y Square//My Plan//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
  'X-WR-CALNAME:Y Square - My Plan', 'X-PUBLISHED-TTL:PT1H', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H'];
(r.items || []).forEach(function (i) {
  L.push('BEGIN:VEVENT', 'UID:' + i.id + '@ysquareai.com', 'DTSTAMP:' + (i.stamp || now));
  if (i.all_day) L.push('DTSTART;VALUE=DATE:' + i.local_day);
  else { L.push('DTSTART;TZID=' + i.tz + ':' + i.local_start, 'DTEND;TZID=' + i.tz + ':' + i.local_end); }
  if (i.repeat) {
    var rule = i.repeat === 'daily' ? 'FREQ=DAILY' : i.repeat === 'weekdays' ? 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
      : 'FREQ=WEEKLY' + (Array.isArray(i.repeat_days) && i.repeat_days.length ? ';BYDAY=' + i.repeat_days.map(function (d) { return DAYS[d]; }).join(',') : '');
    if (i.repeat_until) rule += ';UNTIL=' + String(i.repeat_until).replace(/-/g, '') + 'T235959Z';
    L.push('RRULE:' + rule);
  }
  L.push('SUMMARY:' + esc(i.title), 'CATEGORIES:' + esc(i.kind));
  if (i.notes) L.push('DESCRIPTION:' + esc(i.notes));
  if (i.remind_min !== null && i.remind_min !== undefined) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(i.title), 'TRIGGER:-PT' + Number(i.remind_min) + 'M', 'END:VALARM');
  L.push('END:VEVENT');
});
(r.events || []).forEach(function (e) {
  L.push('BEGIN:VEVENT', 'UID:' + e.id + '@events.ysquareai.com', 'DTSTAMP:' + now, 'DTSTART:' + e.s, 'DTEND:' + e.e, 'SUMMARY:' + esc(e.title));
  if (e.venue) L.push('LOCATION:' + esc(e.venue));
  L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(e.title), 'TRIGGER:-PT60M', 'END:VALARM', 'END:VEVENT');
});
L.push('END:VCALENDAR');
return [{ json: { found: true, ics: L.map(fold).join('\r\n') + '\r\n' } }];
