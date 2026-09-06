/** Regression guard: the Billing payment dialog must bind REAL API helpers
 * (guards against the "fetchPayment is not defined" class of crash). */
const fs = require("fs");
const path = require("path");
const page = fs.readFileSync(path.join(__dirname, "..", "frontend/src/pages/account/BillingPage.jsx"), "utf8");
const api = fs.readFileSync(path.join(__dirname, "..", "frontend/src/lib/portalApi.js"), "utf8");
const required = ["fetchPayment", "submitPaymentReference", "fetchBlobUrl", "fetchDialUri", "startMpesaPush", "refreshPayment"];
let failed = 0;
for (const name of required) {
  const imported = new RegExp("\\b" + name + "\\b").test(page);
  const exported = new RegExp("export const " + name + "\\b|export const " + name + " =").test(api);
  if (!imported || !exported) {
    failed += 1;
    console.log(`FAIL ${name}: imported=${imported} exported=${exported}`);
  } else console.log(`PASS ${name}: imported + exported`);
}
if (failed) { console.error(`\n${failed} missing binding(s).`); process.exit(1); }
console.log("\nPayment UI bindings OK — no undefined-identifier crashes.");
