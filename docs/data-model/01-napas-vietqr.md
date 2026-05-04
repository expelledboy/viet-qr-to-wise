# NAPAS VietQR — Data Model Reference

**Audience:** parser maintainers for a scanner SPA that must accept every legal VietQR variant in the wild.
**Scope:** the on-the-wire byte format only — the EMVCo Merchant-Presented Mode (MPM) TLV payload that the QR symbol carries. Does not cover NAPAS host-to-host APIs, settlement, or KYC.

VietQR is a thin Vietnamese profile on top of **EMV QR Code Specification for Payment Systems — Merchant-Presented Mode v1.1** (EMVCo, dated November 2020 on the official cover; widely circulated as "v1.1, July 2017" — the substantive content of the table of data objects has not changed since 2017) [1]. NAPAS's domestic spec layers a single Unreserved-Template-style Merchant Account Information block at tag **38** under GUID **`A000000727`**, and reuses the EMVCo root tags unchanged.

---

## 1. Authoritative spec sources

| # | Document | Status | URL |
|---|----------|--------|-----|
| A | EMV QR Code Specification for Payment Systems — Merchant-Presented Mode, v1.1 | Public, EMVCo © 2017 [1] | https://www.emvco.com/emv-technologies/qr-codes/ (PDF mirror: [1]) |
| B | NAPAS *"Quy định Định Dạng QR VietQR trong Dịch vụ NAPAS247"* (TC v1, "QR-Format-TC-v1") | NAPAS internal; circulated to member banks; copies on Studocu and bank engineering wikis [10] | https://www.studocu.vn/vn/document/truong-dai-hoc-mo-ha-noi/tin-dung-va-thanh-toan-quoc-te/qr-format-tc-v1-mo-ta-luong-qr-napas/81376677 |
| C | NAPAS Developer Portal landing | Public; the docs page itself is currently a 404 stub as of May 2026 [4] | https://developer.napas.com.vn/page/docs |
| D | NAPAS Interactive API docs (gateway / refund / inquiry) | Public; covers host APIs, **not** the QR payload TLV | https://developer.napas.com.vn/interactive-docs/ [9] |
| E | NAPAS *"FastFund 247 with VietQR code"* product page | Public marketing | https://en.napas.com.vn/napas-fastfund-247-with-vietqr-code-service-184230612220807776.htm [2] |
| F | NAPAS *"QR code payment Service"* product page | Public marketing | https://en.napas.com.vn/qr-code-payment-service-184230614203711304.htm [3] |
| G | VietQR.io / VietQR.vn integrated documentation | Operated by *Trí Nam* under contract with NAPAS member banks; widely treated as de-facto reference for the BIN list and field semantics | https://api.vietqr.vn/en, https://doc.vietqr.vn [11][12] |
| H | `xuannghia/vietnam-qr-pay` (TypeScript) | Community library, has the most complete machine-readable enumeration of fields, GUIDs and service codes that matches what bank apps actually emit | https://github.com/xuannghia/vietnam-qr-pay [5] |
| I | `thanhtinhpas1/vietqr-parser` (Go) | Community parser | https://github.com/thanhtinhpas1/vietqr-parser [6] |

> The NAPAS PDF (B) is **not** redistributed by NAPAS at a stable URL. The version we cite is "QR-Format-TC v1" — there is no public revision history. `[unverified]` whether a v2 exists internally.

The State Bank of Vietnam regulates the *service* (NAPAS 247 instant transfer, Decision 1928/QĐ-NHNN and the Circular 15/2024/TT-NHNN regime on payment intermediaries) but does **not** publish the byte format; the byte format is owned by NAPAS. `[unverified]` for a public SBV citation of the format itself.

---

## 2. Wire format basics

```
TLV  =  ID(2 numeric chars)  ||  LEN(2 numeric chars, decimal byte count of value)  ||  VALUE
```

Per EMVCo §4.3–4.4: every `ID` is a 2-char decimal `"00".."99"`, every `LEN` is a 2-char decimal `"01".."99"` and equals the **byte count of the value** (note: byte count, not character count — matters once UTF-8 multi-byte characters appear in tag 59 / 62.08) [1].

Encoding: **Byte mode** with an **ECI 26 (UTF-8)** designator whenever any character outside the EMVCo Common Character Set appears (EMVCo §4.12.1). In practice every VietQR generator just emits UTF-8 bytes; consumers must decode as UTF-8.

Payload size: SHOULD NOT exceed 512 bytes (EMVCo §4.1) [1]. Bank-generated VietQRs are typically 100–250 bytes.

Order: tag `00` first, tag `63` (CRC) last. All other root tags may appear in any order. Sub-tags inside templates likewise have no fixed order (EMVCo §4.6) [1].

---

## 3. Complete root tag table (IDs 00–99)

Format codes: **N** = digits only; **ans** = EMVCo "Alphanumeric Special" (printable ASCII subset from EMV Book 4); **S** = String, may be UTF-8. **M** mandatory, **C** conditional, **O** optional. "Max len" is the EMVCo cap in characters/bytes.

| ID | Name | M/C/O | Max | Fmt | EMVCo §[1] | What VN banks actually populate |
|----|------|-------|-----|-----|------------|---------------------------------|
| 00 | Payload Format Indicator | M | 2 | N | 4.7.1 | Always `01` |
| 01 | Point of Initiation Method | C | 2 | N | 4.7.2 | `11`=static, `12`=dynamic. If absent, treat as static (EMVCo allows omission). VN bank apps always emit it. |
| 02–25 | Reserved primitive merchant-account IDs (Visa/MC/Discover/Amex/JCB/UnionPay/EMVCo) | C | 99 | ans | 4.7.10 / Table 4.1 | Never used by VietQR. Visa/MC may appear on co-branded merchant QRs. |
| 26–51 | Merchant Account Information templates (domestic schemes) | C | 99 | S | 4.7.11 / Table 4.2 | **26** is used by **VNPayQR** with GUID `A000000775`. **27–37, 39–51** unused in VN [`unverified`]. |
| **38** | **Merchant Account Information — VietQR template** | C | 99 | S | 4.7.11 (template form) | **The VietQR core block.** GUID `A000000727`. Sub-structure in §4 below. Always present on a VietQR. |
| 52 | Merchant Category Code (MCC, ISO 18245) | O | 4 | N | 4.7.12 | Usually omitted on P2P transfers. Present on some merchant QRs (e.g. `5812` food, `4111` transport). |
| 53 | Transaction Currency (ISO 4217 numeric) | M | 3 | N | 4.7.5 | Always `704` (VND). |
| 54 | Transaction Amount | C | 13 | ans | 4.7.4 | Present on dynamic QRs. See §9 for VND quirks. |
| 55 | Tip or Convenience Indicator | O | 2 | N | 4.7.6 | Effectively never used by VN banks. |
| 56 | Value of Convenience Fee Fixed | C | 13 | ans | 4.7.7 | Idem. |
| 57 | Value of Convenience Fee Percentage | C | 5 | ans | 4.7.8 | Idem. |
| 58 | Country Code (ISO 3166-1 α2) | M | 2 | ans | 4.7.13 | Always `VN`. |
| 59 | Merchant Name | M *(per EMVCo)* | 25 | ans/S | 4.7.14 | NAPAS treats as **optional in P2P transfers**; many bank-app generated transfer QRs omit it or use `"NGUOI NHAN"` / the resolved account-holder name in unaccented Latin. Diacritics: see §6. |
| 60 | Merchant City | M *(per EMVCo)* | 15 | ans/S | 4.7.15 | Often `"HA NOI"`, `"HCM"`, `"TP HO CHI MINH"`; sometimes a literal `"NA"` placeholder in P2P QRs. |
| 61 | Postal Code | O | 10 | ans | 4.7.16 | Almost never present. |
| 62 | Additional Data Field Template | O | 99 | S | 4.8 | Common on dynamic QRs. Sub-structure in §5. |
| 63 | CRC | M | 4 | ans | 4.7.3 | Always last. See §8. |
| 64 | Merchant Information — Language Template | O | 99 | S | 4.9 | Used to provide a Vietnamese-script alternate `59`/`60` (sub-tag `00`=`vi`, `01`=name in Unicode, `02`=city). Rare but legal. |
| 65–79 | RFU for EMVCo | — | 99 | S | 4.10 | Never seen. |
| 80–99 | Unreserved templates (each requires sub-tag `00`=GUID per §4.11) | O | 99 | S | 4.11 | **MoMo** uses `80` to carry a 3-digit phone-suffix value (e.g. `8003046`), with no GUID sub-tag — this technically violates EMVCo §4.11.1.1 but bank apps accept it [5]. |

> **Cardinality:** EMVCo §4.3.1.2 — exactly one occurrence of each ID under the root, and one of each ID inside a given template. Parsers must reject duplicates.

---

## 4. Tag 38 sub-structure (NAPAS / VietQR)

Tag 38 is a Merchant Account Information template per EMVCo §4.7.11. Its first sub-tag (`00`) is the Globally Unique Identifier; the remaining sub-tag IDs are scheme-specific and defined by NAPAS [10][5][6].

| Sub-ID | Name | M/C/O | Max | Fmt | Meaning |
|--------|------|-------|-----|-----|---------|
| 00 | GUID | M | 32 | ans | Always the literal string `A000000727` (NAPAS's RID). 10 chars. |
| 01 | Beneficiary Organization (nested template) | M | 99 | S | Contains the routing target — sub-sub-structure below. |
| 02 | Service Code | M | 10 | ans | One of `QRIBFTTA`, `QRIBFTTC` (see §6). VietQR.io stack treats this as mandatory; some VNPay-style merchant QRs under tag 38 omit it. |

### 4.1 Tag 38 → 01 (nested)

| Sub-sub-ID | Name | M/C/O | Max | Fmt | Meaning |
|------------|------|-------|-----|-----|---------|
| 00 | Acquirer ID / Bank BIN | M | 6 | N | The 6-digit NAPAS BIN of the receiving bank/wallet (e.g. `970436` Vietcombank, `970422` MB Bank, `970454` BVBank). Full BIN list at [11]. |
| 01 | Account / Card / Merchant ID | M | 19 | ans | Beneficiary account number when service is `QRIBFTTA`, card PAN when `QRIBFTTC`, or virtual-merchant-account string when used with merchant programs. See §5. |

> Some library docs flatten this two-level nesting into a single description "tag 38.00=GUID, 38.01=BIN, 38.02=service code". That is wrong-but-it-works-for-static-cases shorthand: the actual structure is `38.00=GUID`, `38.01=<inner-template containing 00=BIN and 01=account>`, `38.02=service`. The incorrect shorthand happens to produce the same byte string only because IDs `00` and `01` collide between levels. Parsers must descend into `38.01` as a TLV, not read it as a flat string [5][6].

### 4.2 Account/card-number formats per beneficiary type (sub-tag 38.01.01)

| Beneficiary type | Length | Format | BIN context | Notes / source |
|------------------|--------|--------|-------------|----------------|
| Standard CASA account | 4–19 | digits, sometimes alphanumeric | Any bank BIN | Per-bank conventions: VCB 13 digits, TCB 14 digits (legacy 19-digit on old e-banking), MB 10–13, BIDV 14, ACB 8–9 (e.g. `257678859` in [5]'s example), VPBank 9–13, Sacombank 12–13. `[community report]` — banks publish lengths in their core-banking docs but not always in machine-readable form. |
| Card number (PAN) | 16 | digits | Any bank BIN | Used **only** when service code is `QRIBFTTC`. Luhn-valid. |
| Phone-as-account alias | typically 10 | digits, leading `0` | Banks like Timo, TPBank | The *resolved* underlying account number is what is carried; VietQR does not carry the alias. Some banks let users encode the phone as the account directly when their core supports it. `[unverified]` |
| Techcombank MerchantOne virtual account | typically `MS` + 8–17 chars | alphanumeric, prefix `MS` | TCB BIN `970407` | Issued per merchant inside Techcombank's MerchantOne/Tpay merchant portal [13]. The `MS` prefix is a TCB convention, not a NAPAS one. Sub-tag length values in the TLV must reflect the actual byte count including the letters. |
| MoMo wallet account | 18 | `99MM` + 14 chars | BVBank BIN `970454` | E.g. `99MM24011M34875080` [5]. MoMo-emitted QRs additionally set `62.05` = `"MOMOW2W" + accountNumber.slice(10)` and an unreserved template `80` containing the 3 last digits of the wallet's phone number [5]. |
| ZaloPay wallet account | 18 | `99ZP` + 14 chars | BVBank BIN `970454` | E.g. `99ZP24009M07248267` [5]. Some ZaloPay QRs add an opaque template at root tag `26` of unknown purpose [5]; safe to ignore. |
| ViettelPay | `[unverified]` | — | MBBank BIN `970422` historically, now its own BIN | ViettelMoney/ViettelPay routes through MB-Bank co-branded BINs. Format details not openly documented. |
| VNPay (merchant QR) | n/a | merchant-id string | n/a — uses **tag 26** with GUID `A000000775`, not tag 38 | VNPayQR is a parallel scheme on the same EMVCo skeleton, not a VietQR variant [5]. |
| Cross-border (CN UnionPay, KR, JP, TH PromptPay inbound) | varies | varies | not under VietQR | NAPAS<->UnionPay cross-border QR (Dec 2025) `[unverified]` whether it reuses tag 38 or a separate template [14]. |

### 4.3 Service codes (sub-tag 38.02)

| Code | Expansion | Meaning | Required account-number form in 38.01.01 |
|------|-----------|---------|------------------------------------------|
| `QRIBFTTA` | QR Inter-Bank Funds Transfer To Account | NAPAS 247 instant credit to a deposit account at the BIN-identified bank | bank account number |
| `QRIBFTTC` | QR Inter-Bank Funds Transfer To Card | NAPAS 247 instant credit to the card account behind a 16-digit PAN | 16-digit PAN |

`QRIBFTTA` is the overwhelmingly common case (>99% of P2P QRs). `QRIBFTTC` exists for users who only know their card number, not their account number — uncommon. No other service codes are defined by VietQR at the time of writing. Both NAPAS marketing pages [2][3] only enumerate these two. `[unverified]` whether internal NAPAS docs reserve additional codes (e.g. `QRPULL`, `QRPUSH`).

> **Do not confuse with `MCC` field 52** — `QRIBFTTA`/`QRIBFTTC` are NAPAS service identifiers and live only inside tag 38.

---

## 5. Tag 62 sub-structure (Additional Data Field Template)

Defined by EMVCo §4.8 / Table 4.3 [1]. All sub-IDs are optional individually but at least one must be present if tag 62 is present.

| Sub-ID | Name | Max | Fmt | EMVCo § | VN usage |
|--------|------|-----|-----|---------|----------|
| 01 | Bill Number | 25 | ans | 4.8 | Bank apps emit this for bill-payment scenarios; rare in P2P. |
| 02 | Mobile Number | 25 | ans | 4.8 | Rare. |
| 03 | Store Label | 25 | ans | 4.8 | VNPayQR merchant codes; some NAPAS POS QRs. |
| 04 | Loyalty Number | 25 | ans | 4.8 | Rare. |
| 05 | Reference Label | 25 | ans | 4.8 | **Most common** — MoMo uses it (`MOMOW2W…`). |
| 06 | Customer Label | 25 | ans | 4.8 | Occasional. |
| 07 | Terminal Label | 25 | ans | 4.8 | VNPayQR sometimes. |
| 08 | **Purpose of Transaction** | 25 | ans | 4.8 | **The "memo / nội dung chuyển tiền" field that bank apps fill** when the user types a transfer note. This is the field the receiving bank prints on the statement. Carries the user-entered memo. |
| 09 | Additional Consumer Data Request | 3 | ans | 4.8 | Combinations of `A`/`M`/`E`. Never seen on VN bank-generated QRs. |
| 10–49 | RFU for EMVCo | 99 | — | 4.8 | — |
| 50–99 | Payment-system-specific templates (each needs `00`=GUID inside) | 99 | S | 4.8 | Not used by NAPAS. |

> EMVCo §4.8.1.2: any sub-tag `01..08` may carry the literal string `"***"` to indicate the consumer's app should prompt for the value at scan time. `[community report]` Vietnamese bank apps do not typically emit `***`; they either fill the value or omit the sub-tag.

> Length cap reality: EMVCo says 25 bytes for `62.08` Purpose. UTF-8 Vietnamese with diacritics is ~2 bytes per accented vowel, so a 25-byte purpose field fits ~12 Vietnamese words. Most banks strip diacritics before placing the memo, sidestepping this (§6).

---

## 6. Character encoding

- **Spec position (EMVCo §4.5.2 / §4.5.3):** `ans` data MUST be from the EMV Common Character Set (printable ASCII subset, no diacritics). `S` data MAY be UTF-8 precomposed Unicode. ECI 26 indicator is required if any non-Common-Character-Set byte appears (§4.12.1.2) [1].
- **NAPAS practice:** NAPAS's own circulars to member banks instruct that account-holder names placed in tag `59` and memos placed in `62.08` be transliterated to **unaccented Latin** before encoding. Multiple bank-app and VietQR generator UIs explicitly reject diacritics on these fields [15].
- **Reality on the wire:** the vast majority of bank-generated VietQRs are pure 7-bit ASCII in tag 59/60/62.08 — no ECI block, no diacritics. A small minority (some merchant POS systems and the Language Template in tag 64) carry UTF-8 bytes. **Parsers should always decode the string fields as UTF-8** (which is a strict superset of 7-bit ASCII) to be safe.
- The `LEN` byte-count rule (§4.4.1.1: "Length shall be equal to the number of characters in the value field") is famously ambiguous when a "character" is a multi-byte UTF-8 codepoint. EMVCo's intent is byte count (Annex B examples confirm); all known VN generators follow byte count. A parser that reads `LEN` chars naïvely will desync on UTF-8 input.

---

## 7. Static (`01`=`11`) vs Dynamic (`01`=`12`) QRs

| Aspect | Static (`11`) | Dynamic (`12`) |
|--------|---------------|----------------|
| Reused | Same QR for many transactions | Fresh QR per transaction |
| Common medium | Printed sticker, MerchantOne placard | In-app "receive money" screen |
| Tag 54 (Amount) | Usually absent → payer enters | Usually present |
| Tag 62.08 (Purpose) | Usually absent | Often present (the memo the sender typed) |
| Tag 62.05 (Reference) | Sometimes (merchant) | Often (MoMo, dynamic merchant) |
| Tag 59 / 60 | Often filled (merchant name) | Often filled with payee name in P2P apps |

The spec does not strictly tie tag 54 to dynamic — a static sticker can carry an amount (e.g. a 50 000 VND parking ticket), and a dynamic QR can omit the amount. The flag is purely about uniqueness/replay semantics.

---

## 8. CRC (tag 63)

- Algorithm: **CRC-16/CCITT-FALSE** per ISO/IEC 13239 (EMVCo §4.7.3.1).
  - Polynomial `0x1021`
  - Init `0xFFFF`
  - **No** input reflection
  - **No** output reflection
  - **No** XOR-out (i.e. xorout `0x0000`)
- Coverage: every byte of the payload up to and including `"6304"` (the ID `63` and the LEN `04` of the CRC field itself), but **excluding** the 4-char hex value that follows.
- Output: 16-bit value, big-endian, encoded as **uppercase 4-char hex ASCII** (per EMVCo Annex B example `"6304A13A"`). Some generators in the wild emit lowercase hex — accept both, normalise on output.
- **CRC-less QRs in the wild:** `[community report]` Some early POS integrations emitted `6304____` placeholders or omitted the CRC entirely. Major bank apps (VCB, TCB, MB, BIDV) reject these; lenient parsers like `xuannghia/vietnam-qr-pay` will still decode. Recommendation: validate CRC, but make validation a warning rather than a hard reject if the only client you serve is the user themselves (so they can salvage a damaged QR by retyping the account/amount).
- **Wrong-CRC QRs in the wild:** `[community report]` Sloppy server-side QR generators occasionally compute the CRC over the wrong byte range (e.g. excluding `"6304"`), producing CRCs that are 4 chars off but consistently wrong. Bank apps generally reject these. Parsers should report exact mismatch.

---

## 9. Amount (tag 54) edge cases

- EMVCo §4.7.4: digits + an optional single `.`; no thousands separator, no currency symbol. `"98.73"`, `"98"`, `"98."` all valid; `"98,73"` and `"3 705"` invalid [1].
- VND has currency exponent 0 (no minor units). VN bank apps emit **integer strings** with no decimal point: `"10000"`, `"500000"`, `"100000000"`. `[community report]` Some third-party generators emit `"10000.00"` or `"10000."`; consumers should accept these and coerce to integer (drop trailing `.0*`).
- Max length is 13 chars → up to `999_999_999_999` units. The NAPAS 247 per-transaction cap is **500 000 000 VND** (9 digits) for retail [2].
- Amount `0` is forbidden by EMVCo §4.7.4.1; a zero-amount static QR must omit tag 54 entirely.
- Leading zeros are not forbidden by the spec but are unusual; tolerate them.

---

## 10. Edge cases and quirks worth coding for

1. **Tag 38 sub-tag 02 sometimes missing.** A handful of generators emit only `38.00` (GUID) and `38.01` (account block), no service code. Default to `QRIBFTTA` if absent.
2. **MoMo's unreserved tag 80 with no GUID** — violates EMVCo §4.11.1.1 (which requires sub-tag `00`=GUID inside any 80–99 template) but bank apps accept it [5]. If you strictly validate sub-templates, whitelist the MoMo shape.
3. **ZaloPay tag 26 carrying opaque payload** — accept and ignore.
4. **Account numbers with letters.** `MS…` (Techcombank MerchantOne), `99MM…`/`99ZP…` (BVBank-routed wallets) — the format type for sub-tag `38.01.01` is `ans`, not `N`. Don't restrict to digits.
5. **Multiple Merchant Account Information blocks.** EMVCo allows several blocks in `02`–`51`. A NAPAS payload could in principle co-publish `38` (NAPAS) + `26` (VNPay) for a single beneficiary; not seen in practice but legal. Pick the one your system can route.
6. **Tag 64 (Language Template).** Almost never present, but if it is, sub-tag `00` is a 2-char ISO 639 code (`vi`, `en`), and `01` is the merchant name in the chosen language's script (often Vietnamese with diacritics in UTF-8). Use this as the display name in preference to tag 59 if your UI supports Vietnamese.
7. **Length-byte vs character-count confusion** — see §6. A common parser bug.
8. **Trailing whitespace / newline.** Some QR-generation toolchains append a newline; trim before TLV parsing.
9. **Amount with a sign or grouping.** Reject these at parse time — they are a sign of a manually-crafted or corrupted QR.
10. **Phone number aliases.** Banks like Timo and TPBank let customers register a phone number as an account alias. The QR carries the *resolved* underlying account number, not the alias. Don't try to validate that 38.01.01 is "phone-shaped".
11. **Cross-border inbound QRs** (Thai PromptPay, Cambodian KHQR, China UnionPay) reuse the EMVCo skeleton but **not** GUID `A000000727`. Detect by GUID, not by assuming tag 38 is always NAPAS.

---

## Sources

1. EMV QR Code Specification for Payment Systems — Merchant-Presented Mode v1.1 (EMVCo, © 2017): https://mvallim.github.io/emv-qrcode/docs/EMVCo-Merchant-Presented-QR-Specification-v1-1.pdf and https://www.emvco.com/emv-technologies/qr-codes/
2. NAPAS — *FastFund 247 with VietQR code Service*: https://en.napas.com.vn/napas-fastfund-247-with-vietqr-code-service-184230612220807776.htm
3. NAPAS — *QR code payment Service*: https://en.napas.com.vn/qr-code-payment-service-184230614203711304.htm
4. NAPAS Developer Portal docs landing (currently a 404 stub): https://developer.napas.com.vn/page/docs
5. `xuannghia/vietnam-qr-pay` (GitHub): https://github.com/xuannghia/vietnam-qr-pay (constants at https://raw.githubusercontent.com/xuannghia/vietnam-qr-pay/master/src/constants/qr-pay.ts)
6. `thanhtinhpas1/vietqr-parser` (GitHub): https://github.com/thanhtinhpas1/vietqr-parser
7. EMVCo overview presentation, Bastien Latgé (W3C 2020): https://www.w3.org/2020/Talks/emvco-qr-20201021.pdf
8. EMVCo — *Merchant-Presented QR Guidance and Examples*: https://www.emvco.com/resources/merchant-presented-qr-guidance-and-examples/
9. NAPAS Interactive API docs (host APIs, not QR payload): https://developer.napas.com.vn/interactive-docs/
10. NAPAS *"Quy định Định Dạng QR VietQR trong Dịch vụ NAPAS247"* (Studocu mirror): https://www.studocu.vn/vn/document/truong-dai-hoc-mo-ha-noi/tin-dung-va-thanh-toan-quoc-te/qr-format-tc-v1-mo-ta-luong-qr-napas/81376677
11. VietQR.io — bank list API: https://www.vietqr.io/en/danh-sach-api/api-danh-sach-ma-ngan-hang/
12. VietQR Integrated Documentation: https://doc.vietqr.vn/vietqr-doc/api-vietqr-callback/api-vietqr-host2host/integrated-document-for-payment-service-vietqr
13. Techcombank — MerchantOne / Tpay Merchant Portal: https://techcombank.com/en/household-and-small-enterprise/small-enterprise/solution-package-for-small-enterprise/merchant-one and https://merchant.techcombank.com/
14. China–Vietnam cross-border QR launch (Dec 2025): https://english.www.gov.cn/news/202512/03/content_WS692f84f2c6d00ca5f9a07e18.html
15. Shopify+VietQR merchant guide noting "no diacritics in account holder name; payment content max 19 chars, no special characters, Vietnamese without diacritics": https://www.cartdna.com/shopify-payment-methods/VietQR
