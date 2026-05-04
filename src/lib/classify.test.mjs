// Tests for ./classify.mjs — uses node:test, no npm deps.
// Run: node --test src/lib/classify.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { classifyQR } from "./classify.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = resolve(__dirname, "../../docs/data-model/fixtures");

/** @param {string} name */
function fixture(name) {
  return readFileSync(resolve(FIX, name), "utf8").trim();
}

test("clean vietqr: techcombank-static-personal-card", () => {
  const r = classifyQR(fixture("techcombank-static-personal-card.txt"));
  assert.equal(r.kind, "vietqr");
  if (r.kind === "vietqr") {
    assert.equal(r.parsed.merchantAccount.bankBin, "970407");
    assert.equal(r.parsed.crcValid, true);
  }
});

test("clean vietqr: acb-static-personal", () => {
  const r = classifyQR(fixture("acb-static-personal.txt"));
  assert.equal(r.kind, "vietqr");
});

test("clean vietqr: mb-static lowercase CRC still validates", () => {
  const r = classifyQR(fixture("mb-static-personal-lowercase-crc.txt"));
  assert.equal(r.kind, "vietqr");
  if (r.kind === "vietqr") {
    assert.equal(r.parsed.crcValid, true);
  }
});

test("clean vietqr: tpbank-dynamic with amount and memo", () => {
  const r = classifyQR(fixture("tpbank-dynamic-50000-test-memo.txt"));
  assert.equal(r.kind, "vietqr");
  if (r.kind === "vietqr") {
    assert.equal(r.parsed.amount, 50000);
    assert.ok(r.parsed.additionalData);
  }
});

test("wallet-via-vietqr: MoMo via BVBank", () => {
  const r = classifyQR(fixture("momo-via-banviet-vietqr-with-tag80.txt"));
  assert.equal(r.kind, "wallet-via-vietqr");
  if (r.kind === "wallet-via-vietqr") {
    assert.equal(r.walletProvider, "MoMo");
    assert.match(r.notice, /MoMo/);
    assert.equal(r.parsed.merchantAccount.bankBin, "970454");
  }
});

test("wallet-via-vietqr: ZaloPay via BVBank", () => {
  const r = classifyQR(fixture("zalopay-via-banviet-vietqr.txt"));
  assert.equal(r.kind, "wallet-via-vietqr");
  if (r.kind === "wallet-via-vietqr") {
    assert.equal(r.walletProvider, "ZaloPay");
    assert.match(r.notice, /ZaloPay/);
  }
});

test("vnpayqr reject: tugia merchant", () => {
  const r = classifyQR(fixture("vnpayqr-merchant-tugia.txt"));
  assert.equal(r.kind, "vnpayqr");
  if (r.kind === "vnpayqr") assert.match(r.message, /VNPay/i);
});

test("vnpayqr reject: cellphones merchant", () => {
  const r = classifyQR(fixture("vnpayqr-merchant-cellphones-amount.txt"));
  assert.equal(r.kind, "vnpayqr");
});

test("airpay/shopeepay restaurant — foreign or unknown", () => {
  const r = classifyQR(fixture("airpay-shopeepay-restaurant.txt"));
  // airpay GUID is reverse-DNS (vn.airpay.www), not a standard AID — expect unknown.
  assert.ok(r.kind === "foreign" || r.kind === "unknown",
    `expected foreign|unknown, got ${r.kind}`);
});

test("url scheme: momo://abc", () => {
  const r = classifyQR("momo://abc");
  assert.equal(r.kind, "url");
  if (r.kind === "url") assert.match(r.message, /MoMo/);
});

test("url host: https://nhantien.momo.vn/foo", () => {
  const r = classifyQR("https://nhantien.momo.vn/foo");
  assert.equal(r.kind, "url");
  if (r.kind === "url") assert.match(r.message, /MoMo/);
});

test("non-payment: 'hello'", () => {
  const r = classifyQR("hello");
  assert.equal(r.kind, "non-payment");
});

test("malformed: truncated VietQR", () => {
  const r = classifyQR("00020101021238");
  assert.equal(r.kind, "non-payment");
  // Note: too short to even reach NAPAS detection — non-payment is correct.
});

test("malformed: looks like VietQR but parseVietQR throws", () => {
  // Build a string that passes the NAPAS GUID check in tag 38 but parseVietQR
  // will reject (truncated CRC region or missing required tag).
  // Tag 00=01, tag 38 with NAPAS GUID but no nested 38.01.
  const t38 = "0010A000000727";  // GUID only, no 38.01
  const body = "000201" + "38" + t38.length.toString().padStart(2, "0") + t38;
  const r = classifyQR(body);
  // Body is < 30 chars → non-payment OR if long enough, malformed.
  // Let's pad it to exceed 30 chars by adding tags.
  const padded = "000201010211" + "38" + t38.length.toString().padStart(2, "0") + t38 + "5303704" + "5802VN" + "6304ABCD";
  const r2 = classifyQR(padded);
  assert.equal(r2.kind, "malformed");
});
