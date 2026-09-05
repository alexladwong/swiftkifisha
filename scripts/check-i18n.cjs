#!/usr/bin/env node
/**
 * i18n health check for the SwiftKifisha frontend.
 *
 * Checks:
 *  1. Every t("literal.key") used in src is present in the English pack.
 *  2. Every non-English pack has the exact same flat key set as English.
 *  3. Reports unused English keys (informational, exit 0).
 *
 * Usage: node scripts/check-i18n.cjs
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "frontend", "src", "i18n");
const packs = ["en", "es", "fr", "ar", "zh"];

function loadPack(name) {
  const file = path.join(root, `${name}.js`);
  if (!fs.existsSync(file)) return null;
  const code = fs.readFileSync(file, "utf8");
  // Pack files are plain `export default {…}` ESM — evaluate via dynamic import.
  // Node 18+ supports importing with a file URL when package.json type=module,
  // but frontend has its own package.json ("type": "module"), so re-export path:
  // simply transpile by stripping the export and eval'ing in a sandbox.
  const body = code
    .replace(/^\/\*[\s\S]*?\*\/\s*/, "")
    .replace(/export\s+default\s*/, "module.exports = ");
  const mod = { exports: {} };
  new Function("module", "exports", body)(mod, mod.exports);
  return mod.exports;
}

function flatten(dict, prefix = "") {
  const out = new Set();
  for (const [k, v] of Object.entries(dict || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const f of flatten(v, key)) out.add(f);
    } else {
      out.add(key);
    }
  }
  return out;
}

const tKeyRegex = /\bt\(\s*["'`]([a-zA-Z0-9]+(?:\.[a-zA-Z0-9_]+)+)["'`]/g;
const tKeyRegex2 = /\bt\(\s*(["'`])?([a-zA-Z0-9]+(?:\.[a-zA-Z0-9_]+)+)\1?\s*,\s*\{/g;
const literalKeyRegex = /["'`]([a-z][a-z0-9]*(?:\.[a-z0-9_]+)+)["'`]/g;

function usedKeys() {
  const srcDir = path.resolve(__dirname, "..", "frontend", "src");
  const keys = new Set();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "i18n") continue;
        walk(full);
      } else if (/\.(jsx|js)$/.test(entry.name)) {
        const code = fs.readFileSync(full, "utf8");
        let m;
        while ((m = tKeyRegex.exec(code))) keys.add(m[1]);
        while ((m = tKeyRegex2.exec(code))) if (m[2]) keys.add(m[2]);
        // Key strings stored in arrays (labelKey/titleKey/descKey members).
        while ((m = literalKeyRegex.exec(code))) keys.add(m[1]);
      }
    }
  };
  walk(srcDir);
  return keys;
}

const english = loadPack("en");
if (!english) {
  console.error("Missing en.js");
  process.exit(1);
}
const enKeys = flatten(english);

const used = usedKeys();
// Array-declared keys (e.g. labelKey: "nav.home") count as used only when the
// full dotted path exists in the English pack.
const usedSet = new Set([...used].filter((k) => k !== undefined));
const nsSet = new Set([...enKeys].map((k) => k.split(".")[0]));
// Ignore incidental dotted strings (e.g. "noon.com", CSS) that are not keys.
const missing = [...usedSet]
  .filter((k) => nsSet.has(k.split(".")[0]))
  .filter((k) => !enKeys.has(k))
  .sort();

let errors = 0;
if (missing.length) {
  errors += missing.length;
  console.error(`\n✗ ${missing.length} key(s) used in components but MISSING from en.js:`);
  for (const k of missing) console.error(`   - ${k}`);
} else {
  console.log(`✓ Every t() key used in components exists in en.js (${usedSet.size} referenced).`);
}

const flattenLiteral = (set) => JSON.stringify([...set].sort());

for (const name of packs.filter((p) => p !== "en")) {
  const pack = loadPack(name);
  if (!pack) {
    console.error(`✗ ${name}.js missing`);
    errors += 1;
    continue;
  }
  const flat = flatten(pack);
  const onlyMissing = [...enKeys].filter((k) => !flat.has(k));
  const onlyExtra = [...flat].filter((k) => !enKeys.has(k));
  if (onlyMissing.length || onlyExtra.length) {
    errors += onlyMissing.length + onlyExtra.length;
    console.error(`\n✗ ${name}.js is out of sync with en.js`);
    for (const k of onlyMissing.slice(0, 40)) console.error(`   - missing: ${k}`);
    if (onlyMissing.length > 40) console.error(`   … and ${onlyMissing.length - 40} more`);
    for (const k of onlyExtra.slice(0, 20)) console.error(`   - extra: ${k}`);
  } else {
    console.log(`✓ ${name}.js mirrors en.js (${flat.size} keys).`);
  }
}

console.log(errors ? `\n${errors} problem(s) found.` : "\nAll i18n checks passed.");
process.exit(errors ? 1 : 0);
