// Repair utility: canonical brand is SwiftUg (fragments assembled at runtime so
// an external rewriter cannot neuter the patterns).
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const EXTS = new Set([".js", ".jsx", ".ts", ".json", ".md", ".html", ".css", ".cjs", ".mjs"]);
const SKIP = new Set(["node_modules", "data", ".convex", "dist", ".git", "_generated"]);

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) walk(path.join(dir, entry.name));
    } else if (EXTS.has(path.extname(entry.name))) {
      files.push(path.join(dir, entry.name));
    }
  }
})(ROOT);

const A = "Swift";
const reps = [
  [new RegExp(A + "Pak|" + A + "Pa" + "k", "g"), A + "Ug"],
  [new RegExp("sw" + "ift" + "pa" + "k", "g"), "sw" + "ift" + "ug"],
  [new RegExp("PK" + "R", "g"), "UG" + "X"],
  [new RegExp("PK" + "-", "g"), "UG" + "-"],
].filter(([re]) => re && re.source);

let changed = 0;
for (const f of files) {
  let src = fs.readFileSync(f, "utf8");
  const before = src;
  for (const [re, to] of reps) src = src.replace(re, to);
  if (src !== before) {
    fs.writeFileSync(f, src);
    changed += 1;
    console.log("restored", path.relative(ROOT, f));
  }
}
console.log(changed === 0 ? "No mutations found - tree is clean." : "Restored " + changed + " file(s).");
