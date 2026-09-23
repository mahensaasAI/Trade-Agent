// Generates dist/workflows/volunteer_links.sdk.js - the "Y Square - Volunteer Links (Dallas)" workflow.
// It keeps the volunteer board's curated listings pointing at live pages: every week it re-checks each
// link, falls back to the next candidate when one dies, refreshes the blurb from the page itself and
// upserts the rows into ys_volunteer. Edit volunteer/dallas.json to change what is listed.
const fs = require("fs");
const path = require("path");
const R = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const J = (v) => JSON.stringify(v);

const catalog = R("volunteer/dallas.json");
const body = R("volunteer/refresh.js").replace("__CATALOG__", catalog);
if (body.indexOf("__CATALOG__") >= 0) throw new Error("catalog placeholder not replaced");

const NOTE = "## Volunteer links - Dallas\nKeeps the volunteer board's own listings alive without anyone editing them.\n\nEvery Monday (and on demand from Refresh Now) Resolve Links walks volunteer/dallas.json, requests each candidate URL, keeps the first one that still answers, and refreshes the description from that page's own meta description. A site that only blocks datacentre traffic (403, 429 and friends) counts as live. If every candidate for a listing is dead the row is soft-removed with removed_at so it drops off the page instead of sending students to a 404.\n\nRows are written as id vol-dallas-<key>, created_by system, status approved, so they show on #/volunteer next to the community submissions. The same list is mirrored into settings.organization.volunteerOpportunities, which is what signed-out visitors see. Add a city by copying volunteer/dallas.json and adding a second catalogue.";

const out = `import { workflow, node, trigger, sticky, expr, newCredential } from '@n8n/workflow-sdk';

const weekly = trigger({ type: 'n8n-nodes-base.scheduleTrigger', version: 1.3, config: { name: 'Weekly', parameters: { rule: { interval: [{ field: 'weeks', weeksInterval: 1, triggerAtDay: [1], triggerAtHour: 13, triggerAtMinute: 20 }] } }, position: [0, -140] }, output: [{}] });
const manual = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Refresh Now', position: [0, 60] }, output: [{}] });
const resolveLinks = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Resolve Links', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${J(body)} }, position: [256, -40] }, output: [{ sql: 'INSERT INTO ys_volunteer ...', checked: 6, liveCount: 6, dead: [], report: [{ key: 'temple', live: true, link: 'https://www.dallashanuman.org/volunteer' }] }] });
const upsert = node({ type: 'n8n-nodes-base.postgres', version: 2.6, config: { name: 'Upsert Listings', parameters: { operation: 'executeQuery', query: expr('{{ $json.sql }}') }, credentials: { postgres: newCredential('Postgres account') }, alwaysOutputData: true, onError: 'continueRegularOutput', position: [512, -40] }, output: [{ success: true }] });
const summary = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Summary', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${J("var r = $('Resolve Links').first().json;\nreturn [{ json: { city: r.city, checked: r.checked, live: r.liveCount, dead: r.dead, report: r.report, at: new Date().toISOString() } }];\n")} }, position: [768, -40] }, output: [{ checked: 6, live: 6, dead: [] }] });
const note = sticky(${J(NOTE)}, { position: [0, -420], width: 640, height: 250, color: 4 });

export default workflow('ysquare-volunteer-links', 'Y Square - Volunteer Links (Dallas)')
  .add(weekly).to(resolveLinks)
  .add(manual).to(resolveLinks)
  .add(resolveLinks).to(upsert).to(summary);
`;
fs.mkdirSync(path.join(__dirname, "..", "dist", "workflows"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "..", "dist", "workflows", "volunteer_links.sdk.js"), out);
console.log("dist/workflows/volunteer_links.sdk.js", out.length, "bytes");
