// Y Square - Startup Jobs feed: turns the ycombinator.com/jobs page into the top 10 listings (one per company, in
// Y Combinator's own order). Only real listings are kept; if the page can't be read the old list stays untouched.
var r = $input.first().json;
var html = String(r.body || r.data || '');
var out = { ok: false, reason: '', jobs: [] };
var m = html.match(/data-page="([^"]*)"/);
if (r.statusCode !== 200 || !m) { out.reason = 'page ' + r.statusCode + (m ? '' : ', no listing data'); return [{ json: out }]; }
function unent(s) {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
var page;
try { page = JSON.parse(unent(m[1])); } catch (e) { out.reason = 'listing data not JSON'; return [{ json: out }]; }
var posts = (page && page.props && page.props.jobPostings) || [];
var YC = 'https://www.ycombinator.com';
function s(v, n) { v = v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); return v.length > n ? v.slice(0, n - 1) + '…' : v; }
function path(v) { v = String(v || ''); return /^\/companies\/[A-Za-z0-9._-]+(\/jobs\/[A-Za-z0-9._-]+)?$/.test(v) ? YC + v : ''; }
var seen = {}, jobs = [];
for (var i = 0; i < posts.length && jobs.length < 10; i++) {
  var p = posts[i] || {};
  var url = path(p.url), company = s(p.companyName, 80), title = s(p.title, 120);
  if (!url || !company || !title || p.isIncomplete) continue;
  var key = company.toLowerCase();
  if (seen[key]) continue;
  seen[key] = 1;
  jobs.push({
    title: title, company: company, batch: s(p.companyBatchName, 12), about: s(p.companyOneLiner, 160),
    location: s(p.location, 80), type: s(p.type, 30), role: s(p.prettyRole || p.roleSpecificType, 40),
    salary: s(p.salaryRange, 40), experience: s(p.minExperience, 40), url: url, companyUrl: path(p.companyUrl)
  });
}
if (jobs.length < 5) { out.reason = 'only ' + jobs.length + ' usable listings'; return [{ json: out }]; }
out.ok = true;
out.feed = { source: 'Y Combinator - Work at a Startup', sourceUrl: YC + '/jobs', fetchedAt: new Date().toISOString(), jobs: jobs };
out.jobs = jobs;
return [{ json: out }];
