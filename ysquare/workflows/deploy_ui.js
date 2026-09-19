// Publishes dist/ysquare.html to the running Y Square UI workflow (stored in ys_ui_pages, served at GET /webhook/Y2Workplace).
// Usage: YSQUARE_DEPLOY_KEY=... node workflows/deploy_ui.js [https://n8n-neonai.duckdns.org/webhook/Y2Workplace]
const fs = require("fs");
const path = require("path");
const key = process.env.YSQUARE_DEPLOY_KEY;
if (!key) { console.error("Set YSQUARE_DEPLOY_KEY (the key whose SHA-256 is stored in workflows/keys.sha256.json)."); process.exit(1); }
const base = (process.argv[2] || process.env.YSQUARE_BASE || "https://n8n-neonai.duckdns.org/webhook/Y2Workplace").replace(/\/$/, "");
const html = fs.readFileSync(path.join(__dirname, "..", "dist/ysquare.html"), "utf8");
fetch(base + "/deploy-ui", { method: "POST", headers: { "Content-Type": "application/json", "X-Deploy-Key": key }, body: JSON.stringify({ page: "ysquare", html, by: "deploy_ui.js" }) })
  .then(async (r) => { const j = await r.json().catch(() => ({})); console.log(r.status, JSON.stringify(j)); if (!r.ok || !j.success) process.exit(1); })
  .catch((e) => { console.error(e.message); process.exit(1); });
