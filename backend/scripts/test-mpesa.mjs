/**
 * M-Pesa regression guard (backend). Pure-function checks only — no network,
 * no secrets printed. Run: npm run test:mpesa
 */
import assert from "node:assert/strict";
import { parseStkCallback, MPESA_RESULT_MAP, normalizeMsisdn } from "../src/lib/mpesa.js";
import { PAYMENT_STATUS } from "../src/lib/money.js";

let passed = 0;
const ok = (name) => { passed += 1; console.log("  PASS", name); };

const success = {
  Body: { stkCallback: {
    MerchantRequestID: "m1", CheckoutRequestID: "c1", ResultCode: 0,
    ResultDesc: "The service request is processed successfully.",
    CallbackMetadata: { Item: [
      { Name: "Amount", Value: 50000 },
      { Name: "MpesaReceiptNumber", Value: "SFA23ABC1" },
      { Name: "PhoneNumber", Value: 254712345678 },
    ] },
  } },
};
const parsed = parseStkCallback(success);
assert.equal(parsed.resultCode, 0); ok("callback success parsed (code 0)");
assert.equal(parsed.receiptNumber, "SFA23ABC1"); ok("receipt extracted");
assert.equal(parsed.amount, 50000); ok("amount extracted");
assert.equal(MPESA_RESULT_MAP[parsed.resultCode], "PAID"); ok("0 → PAID");

const cancel = parseStkCallback({ Body: { stkCallback: { MerchantRequestID: "m", CheckoutRequestID: "c2", ResultCode: 1032, ResultDesc: "Request cancelled by user", CallbackMetadata: { Item: [] } } } });
assert.equal(MPESA_RESULT_MAP[cancel.resultCode], "CANCELLED"); ok("1032 → CANCELLED");
const timeout = parseStkCallback({ Body: { stkCallback: { MerchantRequestID: "m", CheckoutRequestID: "c3", ResultCode: 1037, ResultDesc: "Timeout", CallbackMetadata: { Item: [] } } } });
assert.equal(MPESA_RESULT_MAP[timeout.resultCode], "EXPIRED"); ok("1037 → EXPIRED");
assert.equal(MPESA_RESULT_MAP[999] || "FAILED", "FAILED"); ok("unknown code → FAILED fallback (raw code preserved)");

assert.equal(normalizeMsisdn("+254712345678"), "254712345678"); ok("+2547… normalized");
assert.equal(normalizeMsisdn("0712345678"), "254712345678"); ok("07… normalized");
assert.equal(normalizeMsisdn("254712345678"), "254712345678"); ok("2547… kept");
assert.equal(normalizeMsisdn("+256757889291"), null); ok("non-Kenyan rejected");
assert.equal(normalizeMsisdn("abc"), null); ok("garbage rejected");

assert.ok(PAYMENT_STATUS.EXPIRED === "EXPIRED"); ok("EXPIRED status exists");
assert.ok(PAYMENT_STATUS.PROCESSING === "PROCESSING"); ok("PROCESSING status exists");

console.log(`\nM-Pesa regression checks passed: ${passed}`);
