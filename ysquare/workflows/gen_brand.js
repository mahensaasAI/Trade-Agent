// Generates brand/ - the Y Square logo mark, lockups and share cards.
// The lettering is converted to outlines from Liberation Sans Bold, so nothing depends on a font
// being installed. Run: npm run gen:brand  (then export PNGs with a browser, see brand/README.md).
const { execFileSync } = require("child_process");
const path = require("path");
execFileSync("python3", [path.join(__dirname, "gen_brand.py")], { stdio: "inherit" });
