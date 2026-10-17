// Y Square - My Plan: the instructions for turning a sentence, or a plan an agent wrote, into calendar items.
// The person sees every item before anything is saved.
var r = $('Route Plan').first().json;
var hint = r.source === 'athlete'
  ? 'The text is a meal and/or workout plan written by the Athlete Edge coach. Do not ask questions: when a time is missing use breakfast 07:30, morning snack 10:00, lunch 12:30, afternoon snack 16:00, dinner 18:30, workouts 17:00. A plan labelled Day 1..Day 7 or Monday..Sunday starts on the next matching day and repeats weekly on those days for 4 weeks unless the text says otherwise.'
  : r.source === 'studypals'
  ? 'The text is a study plan written by the StudyPals tutor. Do not ask questions: when a time is missing use 19:00 for 45 minutes. Sessions spread over days start today or tomorrow; a schedule that repeats keeps its days for 4 weeks unless the text says otherwise.'
  : 'The text is what the person typed or said. If it is a single event and the day or the time is missing, set "question" to one short question asking only for what is missing and return no items. Recurring habits without a time may use a sensible time.';
var prompt = [
  'You turn plans into calendar entries for a student planner app. Today is ' + (r.weekday ? r.weekday + ' ' : '') + r.today + ' and the person\'s time zone is ' + r.tz + '.',
  hint,
  'Return ONLY a JSON object, no other text: {"items":[{"title":"short title, max 60 characters","kind":"meal|workout|study|event|task|other","date":"YYYY-MM-DD (first occurrence, today or later)","start":"HH:MM 24-hour or null for an all-day item","end":"HH:MM or null","repeat":null|"daily"|"weekdays"|"weekly","days":[weekday numbers, Sunday=0, only for weekly],"until":"YYYY-MM-DD or null","notes":"short detail from the text or null"}],"question":null}',
  'Rules: at most 40 items; one item per meal, workout or study session; merge a repeating pattern into ONE item with repeat and days instead of listing each date; keep the titles and details from the text and do not add advice, foods, exercises or amounts that are not in it; ignore anything that is not something to put on a calendar.',
  'Text:',
  '"""',
  r.text,
  '"""'
].join('\n');
return [{ json: { prompt: prompt } }];
