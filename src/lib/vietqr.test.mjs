// Tests for ./vietqr.mjs — uses node:test, no npm deps.
// Run: node --test src/lib/vietqr.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVietQR, crc16ccittFalse, VietQRParseError } from "./vietqr.mjs";

/**
 * Build an EMVCo TLV segment.
 * @param {string} tag 2 digits
 * @param {string} value
 */
function tlv(tag, value) {
  const len = value.length.toString().padStart(2, "0");
  return `${tag}${len}${value}`;
}

/**
 * Build a complete VietQR string (without CRC), then append CRC tag 6304XXXX.
 * @param {string} body everything before "6304"
 */
function withCrc(body) {
  const toCheck = body + "6304";
  return toCheck + crc16ccittFalse(toCheck);
}

const CANONICAL =
  "00020101021238570010A00000072701270006970436011308810004580860208QRIBFTTA53037045802VN6304C06F";

test("crc16ccittFalse known vector 123456789 -> 29B1", () => {
  assert.equal(crc16ccittFalse("123456789"), "29B1");
});

test("happy path: canonical Vietcombank QR", () => {
  const r = parseVietQR(CANONICAL);
  assert.equal(r.raw, CANONICAL);
  assert.equal(r.payloadFormat, "01");
  assert.equal(r.initiationMethod, "dynamic");
  assert.equal(r.merchantAccount.guid, "A000000727");
  assert.equal(r.merchantAccount.bankBin, "970436");
  assert.equal(r.merchantAccount.accountNumber, "0881000458086");
  assert.equal(r.merchantAccount.serviceCode, "QRIBFTTA");
  assert.equal(r.currency, "704");
  assert.equal(r.countryCode, "VN");
  assert.equal(r.amount, undefined);
  assert.equal(r.crc, "C06F");
  assert.equal(r.crcValid, true);
});

test("static initiation method (010211)", () => {
  // Build a minimal static QR
  const merch01 = tlv("00", "970436") + tlv("01", "1234567");
  const merch = tlv("00", "A000000727") + tlv("01", merch01) + tlv("02", "QRIBFTTA");
  const body =
    tlv("00", "01") +
    tlv("01", "11") +
    tlv("38", merch) +
    tlv("53", "704") +
    tlv("58", "VN");
  const qr = withCrc(body);
  const r = parseVietQR(qr);
  assert.equal(r.initiationMethod, "static");
  assert.equal(r.crcValid, true);
});

test("dynamic with amount 150000 (VND integer)", () => {
  const merch01 = tlv("00", "970436") + tlv("01", "1234567");
  const merch = tlv("00", "A000000727") + tlv("01", merch01) + tlv("02", "QRIBFTTA");
  const body =
    tlv("00", "01") +
    tlv("01", "12") +
    tlv("38", merch) +
    tlv("53", "704") +
    tlv("54", "150000") +
    tlv("58", "VN");
  const qr = withCrc(body);
  const r = parseVietQR(qr);
  assert.equal(r.amount, 150000);
  assert.equal(typeof r.amount, "number");
  assert.equal(r.crcValid, true);
});

test("memo via tag 62.08", () => {
  const merch01 = tlv("00", "970436") + tlv("01", "1234567");
  const merch = tlv("00", "A000000727") + tlv("01", merch01) + tlv("02", "QRIBFTTA");
  const additional = tlv("08", "Lunch");
  const body =
    tlv("00", "01") +
    tlv("01", "12") +
    tlv("38", merch) +
    tlv("53", "704") +
    tlv("58", "VN") +
    tlv("62", additional);
  const qr = withCrc(body);
  const r = parseVietQR(qr);
  assert.ok(r.additionalData);
  assert.equal(r.additionalData.purpose, "Lunch");
  assert.equal(r.additionalData["08"], "Lunch");
  assert.equal(r.crcValid, true);
});

test("service code QRIBFTTC (transfer-to-card)", () => {
  const merch01 = tlv("00", "970436") + tlv("01", "9704123412341234");
  const merch = tlv("00", "A000000727") + tlv("01", merch01) + tlv("02", "QRIBFTTC");
  const body =
    tlv("00", "01") +
    tlv("01", "11") +
    tlv("38", merch) +
    tlv("53", "704") +
    tlv("58", "VN");
  const qr = withCrc(body);
  const r = parseVietQR(qr);
  assert.equal(r.merchantAccount.serviceCode, "QRIBFTTC");
  assert.equal(r.merchantAccount.accountNumber, "9704123412341234");
  assert.equal(r.crcValid, true);
});

test("CRC mismatch: tampered char yields crcValid=false (no throw)", () => {
  // Flip the last digit of the account number portion
  const tampered = CANONICAL.replace("0881000458086", "0881000458087");
  assert.notEqual(tampered, CANONICAL);
  const r = parseVietQR(tampered);
  assert.equal(r.crcValid, false);
  // It should still parse the rest:
  assert.equal(r.merchantAccount.accountNumber, "0881000458087");
  assert.equal(r.crc, "C06F");
});

test("malformed: truncated string throws VietQRParseError", () => {
  assert.throws(() => parseVietQR("0002010102"), VietQRParseError);
});

test("malformed: non-digit length throws VietQRParseError", () => {
  // Tag 00 with length "XX"
  assert.throws(() => parseVietQR("00XX01"), VietQRParseError);
});

test("malformed: missing tag 38 throws VietQRParseError", () => {
  const body =
    tlv("00", "01") + tlv("01", "11") + tlv("53", "704") + tlv("58", "VN");
  const qr = withCrc(body);
  assert.throws(() => parseVietQR(qr), VietQRParseError);
});
