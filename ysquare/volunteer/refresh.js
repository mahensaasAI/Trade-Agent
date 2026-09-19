// Code node "Resolve Links" of the Y Square - Volunteer Links (Dallas) workflow.
// Walks the curated Dallas catalogue, checks every candidate link, keeps the first one that is
// still live, refreshes the blurb from the page's own description and writes the upsert SQL.
// The generator injects volunteer/dallas.json in place of the placeholder below.
var CATALOG = __CATALOG__;
var PREFIX = CATALOG.prefix || "vol-dallas-";
var UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
// Sites behind a bot wall answer these to a datacentre IP but are perfectly alive in a browser.
var BLOCKED = [401, 402, 403, 405, 406, 409, 429, 503, 999];
var HR = null;
try { HR = this.helpers.httpRequest.bind(this.helpers); } catch (e) { HR = null; }

function unent(s) {
  return String(s || "")
    .replace(/&(amp|#38);/gi, "&").replace(/&(lt|#60);/gi, "<").replace(/&(gt|#62);/gi, ">")
    .replace(/&(quot|#34);/gi, '"').replace(/&(#39|#039|apos|rsquo|#8217);/gi, "'")
    .replace(/&(nbsp|#160);/gi, " ").replace(/&(ndash|#8211);/gi, "-").replace(/&(mdash|#8212);/gi, "-")
    .replace(/\s+/g, " ").trim();
}
function pageTitle(h) {
  var m = /<title[^>]*>([\s\S]{0,300}?)<\/title>/i.exec(String(h || ""));
  return m ? unent(m[1]).slice(0, 160) : "";
}
function pageDesc(h) {
  var s = String(h || "");
  var m = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{0,400})/i.exec(s);
  if (!m) m = /<meta[^>]+content=["']([^"']{0,400})["'][^>]+name=["']description["']/i.exec(s);
  if (!m) m = /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{0,400})/i.exec(s);
  var d = m ? unent(m[1]) : "";
  if (d.length < 60) return "";                       // too short to say anything
  if (/page description goes here|lorem ipsum|default description/i.test(d)) return "";
  return d.slice(0, 380);
}
function check(url) {
  if (!HR) return Promise.resolve({ url: url, live: false, status: 0, err: "no http helper" });
  return HR({
    method: "GET", url: url, timeout: 15000, returnFullResponse: true, followRedirect: true, json: false,
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" }
  }).then(function (r) {
    var body = typeof r.body === "string" ? r.body : String(r.body || "");
    var code = r.statusCode || 0;
    return { url: url, status: code, live: code >= 200 && code < 400, blocked: false, title: pageTitle(body), desc: pageDesc(body) };
  }, function (e) {
    var code = (e && (e.statusCode || (e.response && e.response.status))) || 0;
    if (BLOCKED.indexOf(code) >= 0) return { url: url, status: code, live: true, blocked: true, title: "", desc: "" };
    return { url: url, status: code, live: false, blocked: false, title: "", desc: "", err: String((e && e.message) || e).slice(0, 160) };
  });
}
function q(v) {
  if (v === null || v === undefined || v === "") return "NULL";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

var entries = CATALOG.entries || [];
var checks = entries.map(function (en) { return Promise.all((en.urls || []).map(check)); });
var all = await Promise.all(checks);

var rows = [], report = [];
entries.forEach(function (en, i) {
  var probes = all[i] || [];
  var hit = null;
  for (var k = 0; k < probes.length; k++) { if (probes[k].live) { hit = probes[k]; break; } }
  var live = !!hit;
  var desc = (hit && hit.desc) ? hit.desc : en.blurb;
  rows.push({
    id: PREFIX + en.key,
    title: en.title,
    org: en.org,
    category: en.category,
    ages: en.ages,
    dateText: en.dateText,
    location: en.location,
    hours: en.hours,
    description: desc,
    link: live ? hit.url : (en.urls || [])[0] || null,
    live: live,
    pageTitle: hit ? hit.title : "",
    blocked: !!(hit && hit.blocked)
  });
  report.push({
    key: en.key, org: en.org, live: live, link: live ? hit.url : null, blocked: !!(hit && hit.blocked),
    tried: probes.map(function (p) { return p.url + " -> " + (p.status || 0) + (p.live ? "" : " dead"); })
  });
});

var COLS = "(id,title,org,category,ages,date_text,location,hours,description,link,created_by,created_by_name,status,reviewed_by,reviewed_at,removed_at)";
var stmts = rows.map(function (r) {
  return "INSERT INTO ys_volunteer " + COLS + " VALUES (" + [
    q(r.id), q(r.title), q(r.org), q(r.category), q(r.ages), q(r.dateText), q(r.location), q(r.hours),
    q(r.description), q(r.link), q("system"), q("Y Square"), q("approved"), q("system")
  ].join(",") + ",now()," + (r.live ? "NULL" : "now()") + ") " +
    "ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, org=EXCLUDED.org, category=EXCLUDED.category, " +
    "ages=EXCLUDED.ages, date_text=EXCLUDED.date_text, location=EXCLUDED.location, hours=EXCLUDED.hours, " +
    "description=EXCLUDED.description, link=EXCLUDED.link, status=EXCLUDED.status, " +
    "reviewed_by=EXCLUDED.reviewed_by, reviewed_at=now(), removed_at=EXCLUDED.removed_at;";
});
// Anything this workflow published before but that has since left the catalogue disappears from the page.
var keep = rows.map(function (r) { return q(r.id); }).join(",");
stmts.push("UPDATE ys_volunteer SET removed_at=now() WHERE id LIKE " + q(PREFIX + "%") +
  " AND removed_at IS NULL AND id NOT IN (" + keep + ");");

// vol.list needs a session, so signed-out visitors read settings.organization.volunteerOpportunities
// instead. Keep that fallback in step with the same listings.
var pub = rows.filter(function (r) { return r.live; }).map(function (r) {
  return { id: r.id, title: r.title, org: r.org, category: r.category, ages: r.ages,
    date: r.dateText, location: r.location, hours: r.hours, description: r.description, link: r.link };
});
stmts.push("UPDATE ys_settings SET value = jsonb_set(coalesce(value,'{}'::jsonb),'{volunteerOpportunities}'," +
  q(JSON.stringify(pub)) + "::jsonb,true), updated_at=now() WHERE key='organization';");

return [{ json: {
  sql: stmts.join("\n"),
  city: CATALOG.city || "Dallas",
  checked: rows.length,
  liveCount: rows.filter(function (r) { return r.live; }).length,
  dead: report.filter(function (r) { return !r.live; }).map(function (r) { return r.key; }),
  report: report,
  rows: rows
} }];
