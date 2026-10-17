// Parse-checks every Code node body and the app so a broken file never reaches n8n.
const fs = require("fs"); const path = require("path"); const root = path.join(__dirname, "..");
let ok = true;
for (const f of ["services/route_request.js","services/format_response.js","agents/prepare_chat.js","agents/build_prompt.js","agents/format_reply.js","ui/app.js"]) {
  try { new Function("$","$input", fs.readFileSync(path.join(root, f), "utf8")); console.log("OK  ", f); } catch (e) { ok = false; console.log("FAIL", f, e.message); }
}
process.exit(ok ? 0 : 1);
