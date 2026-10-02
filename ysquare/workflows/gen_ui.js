// Assembles ui/index.html + ui/styles.css + ui/app.js into dist/ysquare.html (the page served from ys_ui_pages).
// Usage: node workflows/gen_ui.js
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const html = read("ui/index.html")
  .replace("/*__STYLES__*/", () => read("ui/styles.css").trim())
  .replace("/*__APP__*/", () => read("ui/app.js").trim().replace(/<\/script/gi, "<\\/script"));
fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/ysquare.html"), html);
console.log("dist/ysquare.html", html.length, "bytes");
