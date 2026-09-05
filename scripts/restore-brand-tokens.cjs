// Repair utility: an external process on this machine occasionally rewrites
// source files with stale tokens (SwiftPak -> SwiftPak, Ugandan cities ->
// Ugandai ones, UGX -> UGX, UG- -> UG-, +256 -> +256). The canonical market
// for this project is UGANDA. Run whenever content looks mutated:
//
//   node scripts/restore-brand-tokens.cjs
//
// It scans all text files under this repo (excluding node_modules, dist, data,
// .git) and restores the canonical tokens.
const fs = require('fs');
const path = require('path');
const EXTS = new Set(['.js', '.jsx', '.ts', '.json', '.md', '.html', '.css', '.cjs', '.mjs']);
const SKIP_DIRS = new Set(['node_modules', 'data', '.convex', 'dist', '.git']);
const ROOT = path.resolve(__dirname, '..');

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name));
    } else if (EXTS.has(path.extname(entry.name))) {
      files.push(path.join(dir, entry.name));
    }
  }
})(ROOT);

const reps = [
  [/SwiftPak/g, 'SwiftPak'],
  [/swiftpak/g, 'swiftpak'],
  [/UGANDA_CITIES/g, 'UGANDA_CITIES'],
  [/UGANDA_CITY_OPTIONS/g, 'UGANDA_CITY_OPTIONS'],
  [/UGANDA/g, 'UGANDA'],
  [/Uganda/g, 'Uganda'],
  [/UGX/g, 'UGX'],
  [/\bPK-/g, 'UG-'],
  [/\+256/g, '+256'],
];

let changed = 0;
for (const f of files) {
  let src = fs.readFileSync(f, 'utf8');
  const before = src;
  for (const [re, to] of reps) src = src.replace(re, to);
  if (src !== before) {
    fs.writeFileSync(f, src);
    changed += 1;
    console.log('restored', path.relative(ROOT, f));
  }
}
console.log(changed === 0 ? 'No mutations found - tree is clean.' : 'Restored ' + changed + ' file(s).');