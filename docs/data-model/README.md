# Vietnamese Payment QR — Data Model Reference

This directory is the source-of-truth reference for every QR format our scanner might encounter. Built from three parallel research passes (May 2026), cross-checked against a 17-fixture real-world corpus.

## Index

| Doc | Scope |
|---|---|
| [`01-napas-vietqr.md`](./01-napas-vietqr.md) | The NAPAS VietQR spec — the format we actively support. Tag-by-tag, sub-tag-by-sub-tag, every service code, account-format conventions, encoding, CRC, edge cases. |
| [`02-other-formats.md`](./02-other-formats.md) | Everything that is *not* NAPAS VietQR — VNPayQR, MoMo (3 variants), ZaloPay, Viettel Money, ShopeePay, defunct GrabPay, foreign QRs (Alipay/WeChat/PromptPay), legacy bank-proprietary, non-payment QRs (WiFi, vCard, etc.). Includes detection decision tree. |
| [`03-corpus.md`](./03-corpus.md) | 17 real CRC-verified QR strings, fully decoded. Each fixture in [`fixtures/`](./fixtures/). The empirical sanity check against the spec docs. |

## What our parser handles correctly today

Confirmed from the corpus:
- Generic TLV walking (tolerant of unknown top-level tags like MoMo's `80`, and non-canonical field order like AirPay's 59/60 before 58)
- Account numbers as alphanumeric strings (corpus shows pure-numeric, `MS00P…`, `99MM…`, `99ZP…`, even pure-alpha `mynamebvh`)
- Static QRs (init=11) carrying tag-62 memos (real, not a quirk to ignore)
- CRC-16/CCITT-FALSE verification (case-insensitive — corpus has lowercase `79db`)
- All 17 corpus fixtures CRC-validate cleanly

## Concrete gaps — punch-list

Ordered by impact for the Wise-handoff use case.

### P0 — silent failure or user-confusing behavior

1. **URL-form QRs throw a confusing TLV parse error.** A user scanning `momo://…`, `https://nhantien.momo.vn/...`, `https://zalopay.vn/qr/…`, or any `https://` payment link gets a "Not a VietQR" error. We should pre-classify *before* TLV parsing and show: "This is a MoMo/ZaloPay/wallet QR. We can't route those through Wise — open the relevant wallet app."
2. **VNPayQR (GUID `A000000775`) throws "missing tag 38".** VNPayQR puts the provider info under tag **26**, not 38. Currently our parser demands tag 38. Should detect tag 26 with the VNPay GUID and reject with: "VNPayQR merchant code — not supported (Wise can't reach VNPay merchant rails)."
3. **MoMo/ZaloPay-via-VietQR is silently treated as a normal bank transfer.** BIN `970454` + account `99MM…`/`99ZP…` is technically a NAPAS-routable QR (BVBank fronts the wallet), but Wise still can't deliver to a wallet from outside Vietnam. We must detect this combination and warn before letting the user proceed: "This is a MoMo/ZaloPay wallet account fronted by BVBank. Wise can deliver, but the wallet recipient may not see it cleanly. Confirm before sending."

### P1 — render quality

4. **Bank row shows full Vietnamese legal name** (`Techcombank (Ngân hàng TMCP Kỹ thương Việt Nam)`). Wise's bank dropdown is keyed by BIC, the long Vietnamese name only adds OCR noise. Render `shortName` only.
5. **Service code `QRIBFTTC` (transfer-to-card)** isn't surfaced anywhere. When present, the "account number" is actually a 16-digit card number — Wise can pay accounts but not cards. Should warn: "This QR points to a card, not an account. Wise can only deliver to bank accounts."

### P2 — robustness / nice-to-have

6. **Foreign QRs on Vietnamese soil** (Alipay+, WeChat, PromptPay encountered by tourists). Detect by GUID/AID and show "Not a Vietnamese payment QR" rather than a generic parse error.
7. **Tag 62 sub-fields beyond `08`.** Memos in the wild use 62.01 (Bill Number), 62.05 (Reference Label), 62.06 (Customer Label — EVN uses this), 62.07 (Terminal Label) — not just 62.08 (Purpose). Current parser only surfaces 62.08 as `additionalData.purpose`. Should expose all sub-fields generically.
8. **VNPay merchant QRs in tag 26** with reverse-DNS GUIDs (`vn.airpay.www`) — out of scope to route, but worth identifying cleanly so we don't lie about what we saw.
9. **EVN-style padding fields** (`03='00'`, `07='00'`) — harmless, but if we ever surface "all fields" to the user, filter sentinel values.

### Not-fixing (deliberate non-goals)

- Holder-name auto-population: confirmed not in any QR. Always a NAPAS-network lookup. Out of reach for a static SPA without a backend.
- Tag 64 (language template, multi-language merchant name): EMVCo feature, never seen in VN corpus. Skip.
- Sloppy/wrong-CRC tolerance: we already report `crcValid: false` rather than throwing. UI doesn't currently surface it — should add a subtle warning when false.

## Recommended next code change

A single dispatcher function in front of `parseVietQR` that runs in this order:

```
classify(input):
  if input matches /^[a-z]+:\/\// or /^https?:\/\//
    return { kind: "url", host, message: "wallet/payment URL — not supported" }
  if not /^[0-9]/ or length < 30
    return { kind: "non-payment", message: "Doesn't look like a payment QR" }
  // it's TLV-shaped
  walk = tlvWalk(input)
  if walk.has(tag 26 with GUID A000000775)
    return { kind: "vnpayqr", message: "VNPayQR merchant — not supported" }
  if walk.has(tag 38 with GUID A000000727)
    parsed = parseVietQR(input)
    if parsed.bankBin == "970454" and (account starts "99MM" or "99ZP")
      return { kind: "wallet-via-vietqr", parsed, warn: "wallet" }
    if parsed.serviceCode == "QRIBFTTC"
      return { kind: "vietqr-card", parsed, warn: "card-not-account" }
    return { kind: "vietqr", parsed }
  if walk.has(GUID matching foreign AID list)
    return { kind: "foreign", message: "Not a Vietnamese payment QR" }
  return { kind: "unknown", message: "Unrecognised QR format" }
```

This keeps `parseVietQR` pure (still throws on malformed VietQR, unchanged) and pushes all the format-detection / safety logic into the new dispatcher. UI shows a tailored message per `kind`.
