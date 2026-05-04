# 02 — Other Vietnamese (and look-alike) Payment QR Formats

> Scope: everything a Vietnamese consumer might point a camera at that is **not** a NAPAS VietQR
> bank-account payload (GUID `A000000727`, covered in `01-napas-vietqr.md`).
>
> Goal of this document: give the scanner SPA enough information to (a) identify a payload, (b) decide
> whether Wise can settle it, and (c) fail fast with a useful message when it can't.
>
> Wise's hard constraint, restated: **Wise pays Vietnamese bank accounts only — no wallets, no cash
> pickup, no e-money instruments.** See [9].

---

## 0. TL;DR Format Map

| # | Format | Detection signal | Carries | Settlement rail | Wise-payable? |
|---|--------|------------------|---------|-----------------|---------------|
| 1 | **VNPayQR (merchant)** | EMVCo TLV, sub-tag `00` of tag `38` = `A000000775` | Merchant ID, store, terminal, amount | VNPAY acquirer (card/wallet network) | **No** — not a bank IBAN/account; routes via VNPAY merchant gateway |
| 2 | **MoMo — multi-function (VietQR-wrapped)** | EMVCo TLV, NAPAS GUID `A000000727`, BIN `970454` (BVBank), account starts `99MM…` | Wallet alias on BVBank rails | NAPAS-247 to a BVBank virtual account | **Technically yes (to BVBank acc.), but semantically a wallet top-up** — flag as wallet |
| 3 | **MoMo — proprietary deep link** | URL starts `momo://` or host `payment.momo.vn` / `nhantien.momo.vn` | Wallet user, optional amount/order | MoMo internal ledger | **No** |
| 4 | **ZaloPay — multi-function (VietQR-wrapped)** | NAPAS GUID, BIN `970454`, account starts `99ZP…` | Wallet alias on BVBank rails | NAPAS-247 to BVBank virtual account | **Same as MoMo wrapped — flag as wallet** |
| 5 | **ZaloPay — proprietary URL** | Host `gateway.zalopay.vn/openinapp?order=…` (also sb-/stg-/qc- variants), or `sbqrpay.zalopay.vn/zod/…` | Base64-JSON order blob | ZaloPay internal ledger | **No** |
| 6 | **Viettel Money** | Mostly emits standard NAPAS VietQR (BIN `970436` for VTBank-issued, or its own BIN — but consumer QR is VietQR-shaped). Wallet QRs use Viettel-internal URL. | Bank-account proxy or wallet ID | NAPAS-247 if VietQR; internal otherwise | **VietQR variant: yes. Wallet variant: no.** |
| 7 | **VNPAY Wallet (consumer)** | Distinct from VNPayQR-merchant; deep links via VNPAY app | Wallet ID | VNPAY internal | **No** |
| 8 | **ShopeePay (ex-AirPay)** | EMVCo MPM, ShopeePay-specific merchant template; or app-to-app redirect URL | Merchant ID | ShopeePay acquirer | **No** |
| 9 | **GrabPay / Moca VN** | n/a — service terminated 2023-07-01 | — | — | **Defunct — show "wallet no longer in service" hint if URL host matches** |
| 10 | **Alipay+ / WeChat Pay / Kakao Pay** (foreign) | Alipay PID prefixes (e.g., `https://qr.alipay.com/`), WeChat `wxp://` URI, etc. | Foreign merchant/user | Foreign network | **No — out of scope; show "non-Vietnamese payment QR" message** |
| 11 | **Bank-proprietary pre-VietQR (legacy stickers, 2018-21)** | Often non-EMVCo; bank-app-specific URL or opaque ID | Bank account | Bank-internal | **Probably no — unparseable in the general case; suggest user request a new VietQR sticker** |
| 12 | **Non-payment QRs** (`WIFI:`, `BEGIN:VCARD`, `bitcoin:`, `mailto:`, plain URL) | Well-known prefixes | n/a | n/a | **Fail-fast with "this isn't a payment QR"** |

---

## 1. VNPayQR (GUID `A000000775`)

### 1.1 Identifier
- Container: EMVCo Merchant Presented Mode (MPM) TLV string starting `000201…` and ending with CRC tag `6304XXXX`.
- Discriminator: in the Merchant Account Information template at tag `38` (or sometimes `26`), sub-tag `00` (GUID) equals **`A000000775`**. See [1], [2].

### 1.2 Structure
EMVCo MPM, identical wire shape to NAPAS VietQR but with VNPAY's GUID inside the MAI template.

| Tag | Field | Notes |
|-----|-------|-------|
| 00 | Payload Format Indicator | `01` |
| 01 | Point of Initiation | `11` (static) or `12` (dynamic) |
| 38 | Merchant Account Info (VNPAY) | Sub-`00` = `A000000775`; sub-`01` = merchant ID; sub-`02` = terminal/store |
| 52 | Merchant Category Code | optional |
| 53 | Currency | `704` (VND) |
| 54 | Amount | optional (omit for static) |
| 58 | Country | `VN` |
| 59 | Merchant name | |
| 60 | Merchant city | |
| 62 | Additional data | bill no., reference, store label, terminal label, purpose |
| 63 | CRC | CRC-16/CCITT-FALSE over everything up to and including `6304` |

### 1.3 Payment data carried
Merchant identity + optional amount/reference. **No bank account number.** The funds are routed via the VNPAY merchant acquirer to whatever settlement account the merchant configured with VNPAY.

### 1.4 Settlement rail
VNPAY proprietary acquirer (cards, VNPAY wallet, NAPAS-247 are payer-side options). The QR does **not** by itself disclose a bank account that an external sender (Wise) could push funds to.

### 1.5 Open-source parsers
- [`xuannghia/vietnam-qr-pay`](https://github.com/xuannghia/vietnam-qr-pay) — handles VNPayQR via `QRPay.initVNPayQR()`; provider enum value `VNPAY`. See [4].
- [`hunghg255/vn-qr-pay`](https://github.com/hunghg255/vn-qr-pay) — fork/port. See [13].
- [`mvallim/emv-qrcode`](https://github.com/mvallim/emv-qrcode) — generic EMVCo MPM TLV.

### 1.6 Real example (from `vietnam-qr-pay` README, sanitized)
```
00020101021126280010A0000007750110010531314453037045408210900005802VN5910CELLPHONES62600312CPSHN ONLINE0517021908061613127850705ONLHN0810CellphoneS63047685
```
Decoded highlights: GUID `A000000775`, merchant `0105313144`, name `CELLPHONES`, currency `704`, amount `2109.00`, country `VN`. See [4].

### 1.7 Verdict
**Parseable, NOT payable via Wise.** Detect → show: "This is a VNPayQR merchant code. Wise cannot pay merchant gateways. Ask the merchant for a VietQR with their bank account, or pay in-app with VNPAY/cards."

---

## 2. MoMo

MoMo uses **two unrelated wire formats**.

### 2.1 Variant A — Multi-function VietQR wrapper (recommended modern flavor)

Issued via MoMo's "QR đa năng" (multi-function QR) program in cooperation with NAPAS / BVBank.

- **Identifier**: a *valid NAPAS VietQR* (GUID `A000000727`) where:
  - `consumer.bankBin == "970454"` (BVBank / Ban Viet Commercial Bank), AND
  - `consumer.bankNumber` starts with **`99MM`** (e.g. `99MM24011M34875080`).
  - Often also: tag `80` (unreserved field) carries the last 3 digits of the recipient's phone number.
  - Reference field (`62.05`) often = `MOMOW2W` + a tail of the account number.
- **Source**: explicit in [`vietnam-qr-pay`](https://github.com/xuannghia/vietnam-qr-pay) helper code. See [4].

| Sub-field | Value (example) |
|-----------|-----------------|
| Bank BIN | `970454` (BVBank) |
| Account | `99MM24011M34875080` |
| Tag 80 | `046` (last 3 of phone) |
| Tag 62.05 (Reference) | `MOMOW2W34875080` |

**Settlement rail:** technically a NAPAS-247 transfer to a BVBank virtual account that MoMo controls — i.e., the funds *do* flow through the inter-bank network and *can* be initiated by any VietQR-aware bank/PSP. From Wise's perspective, however, the recipient is "BVBank account `99MM…`" which is a wallet alias, not a personal IBAN.

**Wise-payable?**
- Mechanically: probably yes — Wise initiates a NAPAS-247 push to BIN `970454` account `99MM…`.
- Operationally: this is risky. Wise's compliance generally treats wallets as not supported [9] and the `99MM…` account is not in the recipient's name in any conventional sense. **Recommendation: treat as "wallet — not supported"** in the SPA.

### 2.2 Variant B — Proprietary deep-link URL

Forms observed in the wild:

| Form | Purpose | Notes |
|------|---------|-------|
| `momo://?action=payWithAppToken&amount=…&orderId=…&signature=…` | App-to-app payment | Documented by MoMo developer portal. See [5]. |
| `momo://?action=link&…` | Wallet-link onboarding | [5] |
| `https://payment.momo.vn/<id>` | Receive-money / payment links | January 2024 launch. [10] |
| `https://nhantien.momo.vn/<id>` | Personal "nhận tiền" (receive money) page | [community report]; brand exists, exact host varies by region/version |

**Identifier** for the SPA: scheme `momo:` OR host endsWith `.momo.vn`.

**Carries**: opaque MoMo user/merchant ID; sometimes amount/desc/signature query-string.

**Settlement rail**: MoMo's internal ledger only. No external interop.

**Wise-payable?** **No.** Hard fail.

### 2.3 Variant C — Legacy proprietary EMVCo template (rare)

Some old static QRs use a proprietary MAI template under tag `26`/`80` with a MoMo-specific GUID and a phone-suffix payload. Mostly superseded by Variant A. Treat as Variant B if seen.

---

## 3. ZaloPay

### 3.1 Variant A — Multi-function VietQR wrapper
Same mechanism as MoMo Variant A, but account prefix is **`99ZP`**.

| Sub-field | Value (example) |
|-----------|-----------------|
| Bank BIN | `970454` (BVBank) |
| Account | `99ZP24009M07248267` |

Source: `vietnam-qr-pay` README/code. See [4].

**Wise verdict: same as MoMo — flag as wallet.**

### 3.2 Variant B — Proprietary URL

ZaloPay's own developer docs describe these gateway URL forms (see [6]):

| Environment | Host |
|-------------|------|
| Sandbox | `https://sbgateway.zalopay.vn/openinapp?order=<base64>` |
| Staging | `https://stggateway.zalopay.vn/openinapp?order=<base64>` |
| QC | `https://qcgateway.zalopay.vn/openinapp?order=<base64>` |
| Production | `https://gateway.zalopay.vn/openinapp?order=<base64>` |
| ZOD (on-delivery) | `https://sbqrpay.zalopay.vn/zod/<token>` |

The `order=` query parameter is base64(URL-encoded JSON). The JSON payload is capped at 2 KB. See [6].

**Identifier** for SPA: host endsWith `.zalopay.vn`.

**Wise verdict: not payable.**

### 3.3 Variant C — `https://zalopay.vn/qr/<id>` short-link

[community report] — short link form sometimes printed on physical stickers; resolves to Variant B. Treat identically.

---

## 4. Viettel Money / ViettelPay

Per Viettel Money's official site ([7], [8]): Viettel Money supports the **VietQR standard** for both
issuing and accepting transfers. In practice:

- Most Viettel Money consumer QRs in the wild are plain NAPAS VietQR payloads — see `01-napas-vietqr.md`.
- The Viettel-Money-hosted bank in NAPAS's directory is BIN **`970436`** [unverified — varies by source; Viettel's own listing in [12] (`vietqr.co/banks`) is the practical reference]. Some sources reference **`971005`** for "Viettel Money" as a wallet code.
- A purely-wallet variant exists for in-app interactions (Viettel app-to-app), typically via a Viettel-Money internal URL. Not commonly printed on physical signage.

**Wise-payable?**
- VietQR variant: yes (subject to BIN being supported by Wise's NAPAS partner).
- Wallet/internal-URL variant: no.

---

## 5. VNPAY Wallet vs VNPayQR Merchant

These are distinct products from the same company:

| Product | What the QR is | Detection |
|---------|----------------|-----------|
| **VNPayQR (merchant)** | EMVCo MPM with GUID `A000000775` — merchant payment | See section 1 |
| **VNPAY Wallet (consumer)** | An app-internal balance; QRs are deep links into the VNPAY app | host `*.vnpay.vn` URL or `vnpay://` scheme [unverified] |

The merchant scheme (section 1) is the only VNPAY artifact you'll usually see at point-of-sale.
The wallet QR is rarely surfaced as a printable code; it's usually an in-app collect-money flow.

**Wise verdict (both):** not payable via Wise.

---

## 6. ShopeePay (formerly AirPay)

History: AirPay (Sea Group) rebranded to ShopeePay in Vietnam circa 2020 [11].

QR formats (per ShopeePay developer docs [11]):

- **Merchant Presented Mode (MPM)** — EMVCo TLV with a ShopeePay-specific merchant template. Distinct provider GUID; not publicly enumerated in NAPAS docs.
- **Customer Presented Mode (CPM)** — short-lived barcode/QR generated in-app, scanned by the merchant's POS.
- **App-to-App Redirection** — deep link such as `shopeepay://…` [unverified exact scheme].

**Identifier for SPA**: if EMVCo and the GUID at MAI sub-`00` matches a ShopeePay-published value (consult [11] for current value — not stable enough to hard-code), or URL host contains `shopeepay`.

**Wise verdict: not payable.**

---

## 7. GrabPay Vietnam / Moca

Grab terminated its Vietnam e-wallet (Moca) on **2023-07-01** [14]. Any `grab://`, `*.grab.com/pay/*`,
or Moca-branded sticker still in the wild is **defunct**.

**SPA behavior:** if the host or scheme matches Grab/Moca → message: "GrabPay/Moca was discontinued in Vietnam in July 2023. Ask the recipient for a VietQR or a different wallet."

---

## 8. Foreign QRs (Alipay, WeChat Pay, Kakao Pay, UPI, PromptPay, …)

These are **out of scope to pay** but worth detecting so we don't mis-classify them as broken Vietnamese codes.

| Network | Detection signal |
|---------|------------------|
| Alipay (CN) | URL `https://qr.alipay.com/...`, or EMVCo with GUID containing `Alipay` (e.g., `D156000014`) [unverified GUID] |
| Alipay+ | Multi-scheme codes with prefixes per Alipay+ code rules; see [15] |
| WeChat Pay | URI `wxp://f2f0...`, or URL `https://payapp.weixin.qq.com/...` [unverified exact form] |
| Kakao Pay | URL host `qr.kakaopay.com` [unverified] |
| UPI (India) | URI `upi://pay?pa=...&pn=...` |
| PromptPay (Thailand) | EMVCo TLV with GUID `A000000677010111` (or `010112`) under tag `29`/`30` [unverified — confirm against Thai BoT spec] |
| SGQR (Singapore) | EMVCo TLV with multiple MAI templates (PayNow, NETS, etc.) |

**SPA verdict for all of these:** parseable enough to identify and reject with: "This looks like a foreign payment QR (Alipay/WeChat/etc.). Wise cannot pay these from Vietnam-VND flows."

---

## 9. Bank-proprietary QRs predating VietQR (2018-2021)

Before NAPAS unified the spec, every major bank's mobile app had its own QR scheme:

| Bank | Legacy form | Notes |
|------|-------------|-------|
| Vietcombank | VCB Digibank in-app QR — opaque token, only readable inside Vietcombank's app | [unverified — pre-VietQR variant largely replaced by VietQR-compliant codes by 2022] |
| Techcombank | F@st Mobile QR with proprietary payload | [community report] |
| BIDV | BIDV SmartBanking proprietary QR | [community report] |
| MB Bank | MB QR Pay legacy | [community report] |

By 2022 all major banks have migrated to VietQR ([3]), and stickers in circulation are overwhelmingly
NAPAS VietQR. Legacy proprietary stickers can **occasionally** still be found on small merchants.

**SPA behavior:** if the payload is EMVCo-shaped but has no recognized GUID, OR is non-EMVCo with no
known URL scheme, classify as `unknown-legacy` and tell the user "This QR appears to be an older,
bank-specific format. Please ask the merchant for an updated VietQR sticker."

---

## 10. Non-payment / look-alike QRs

| Prefix / pattern | Type | Action |
|------------------|------|--------|
| `WIFI:` | Wi-Fi config | "This is a Wi-Fi configuration QR." |
| `BEGIN:VCARD` | Contact card | "This is a contact card." |
| `bitcoin:` `ethereum:` `lightning:` | Crypto URI | "This is a cryptocurrency address." |
| `mailto:` `tel:` `sms:` | Communication | "This is a contact link." |
| `geo:` | Geo-coordinate | — |
| `otpauth://` | TOTP secret | "This is a 2FA setup QR — do not share." |
| `http(s)://` (no known PSP host) | Generic URL | "This is a regular link, not a payment QR." |
| EMVCo-shaped but CRC fails | Corrupt | "QR is damaged; please rescan." |

---

## 11. Wallet → Wise reachability matrix

Wise's published support for VND ([9]) is unambiguous:

> **"Wise only delivers to bank accounts in Vietnam — no cash pickup, no mobile wallets. Just bank
> accounts."** — Wise Help Centre, *Guide to VND transfers*. [9]

Therefore:

| Recipient artifact | Reachable via Wise? | Why |
|--------------------|---------------------|-----|
| Personal/business bank account at a NAPAS-247 member bank | **Yes** | Direct VietQR-style transfer |
| MoMo / ZaloPay / ShopeePay / VNPAY-Wallet user | **No** | Wise has no wallet rails to Vietnam |
| BVBank account `99MM…` / `99ZP…` (wallet-aliased) | **Mechanically possible, semantically a wallet** | Recommend: classify as wallet, refuse |
| VNPAY merchant gateway code | **No** | No bank-account information in the payload |
| Foreign payment networks | **No** | Not VND-bank rails |

---

## 12. Cross-format ambiguity & disambiguation

Several edge cases:

1. **VietQR with BIN `970454` and `99MM…` account.** EMVCo-valid VietQR (GUID `A000000727`) — but the
   account prefix marks it as a MoMo wallet alias. **Resolution order: check NAPAS GUID first, then
   inspect BIN+account prefix to upgrade classification to "MoMo-wallet-via-VietQR".**

2. **EMVCo payload with a GUID we don't recognize.** Could be a foreign network, a VNPAY variant we
   missed, or a legacy bank scheme. **Resolution: classify as `unknown-emvco`, surface the GUID for
   debugging.**

3. **A URL that *also* contains an EMVCo string in a query parameter.** Treat the outer URL as the
   primary classifier (deep links override embedded TLVs).

4. **CRC-valid EMVCo with no GUID at all** (only tag 26 with raw merchant text). Almost certainly a
   non-Vietnamese or pre-EMVCo-1.1 payload. Classify as `unknown-emvco`.

5. **VietQR-compliant QR whose BIN is a wallet** (e.g., the `971005` Viettel-Money entry per [12]).
   Treat as wallet, not as a personal bank account, even though the wire format is VietQR.

---

## 13. Detection decision tree (pseudocode)

```text
function classify(raw: string) -> Classification {

    # ---- 1. Strip whitespace ----
    s = raw.trim()

    # ---- 2. Non-payment short-circuits ----
    if s.startsWith("WIFI:")            return NonPayment("wifi")
    if s.startsWith("BEGIN:VCARD")      return NonPayment("vcard")
    if s.startsWith("BEGIN:VEVENT")     return NonPayment("ical")
    if s.startsWith("otpauth://")       return NonPayment("totp-secret")
    if s.matches("^(bitcoin|ethereum|lightning|monero):")
                                        return NonPayment("crypto")
    if s.matches("^(mailto|tel|sms|geo):")
                                        return NonPayment("contact")

    # ---- 3. Known wallet/PSP URL schemes (proprietary) ----
    if s.startsWith("momo://")          return Wallet("momo", payable=false)
    if s.startsWith("shopeepay://")     return Wallet("shopeepay", payable=false)
    if s.startsWith("upi://")           return Foreign("india-upi")
    if s.startsWith("wxp://") || host_in(s, "weixin.qq.com")
                                        return Foreign("wechatpay")

    if is_url(s) {
        host = url_host(s).lower()
        if host.endsWith(".momo.vn")        return Wallet("momo", payable=false)
        if host.endsWith(".zalopay.vn")     return Wallet("zalopay", payable=false)
        if host.contains("shopeepay")       return Wallet("shopeepay", payable=false)
        if host.contains("vnpay.vn")        return Wallet("vnpay-wallet", payable=false)
        if host.endsWith("alipay.com")      return Foreign("alipay")
        if host.endsWith("kakaopay.com")    return Foreign("kakaopay")
        if host.contains("grab.com") || host.contains("moca")
                                            return Defunct("grabpay-vn-2023")
        return NonPayment("generic-url")
    }

    # ---- 4. EMVCo MPM TLV (must start "000201" and end "6304XXXX") ----
    tlv = try_parse_emv_tlv(s)
    if tlv == null                      return Unknown("not-emvco")

    if !crc_ok(tlv)                     return Corrupt("emvco-crc-fail")

    # ---- 5. Find Merchant Account Information template + GUID ----
    (mai_tag, guid, mai_subfields) = find_mai_with_guid(tlv)   # tags 26..51

    switch guid {
      case "A000000727":                # NAPAS VietQR
          bin     = mai_subfields["00"].subfield("00")  # nested
          account = mai_subfields["00"].subfield("01")
          # MoMo / ZaloPay multi-function detector:
          if bin == "970454" && account.startsWith("99MM")
                                        return WalletViaVietQR("momo", bin, account)
          if bin == "970454" && account.startsWith("99ZP")
                                        return WalletViaVietQR("zalopay", bin, account)
          # Other BVBank wallet aliases — be conservative:
          if bin == "970454" && account.startsWith("99")
                                        return WalletViaVietQR("unknown-99", bin, account)
          # Wallet BINs:
          if bin in WALLET_BINS         return WalletViaVietQR(WALLET_BINS[bin], bin, account)
          return BankAccount(bin, account, payable=true)   # see 01-napas-vietqr.md

      case "A000000775":                return VNPayMerchant(payable=false)

      case _ if guid.startsWith("A000000677"):
                                        return Foreign("promptpay-th")
      case _:                           return UnknownEmvco(guid)
    }
}
```

Where `WALLET_BINS` is a small lookup table (e.g., `{"971005": "viettel-money"}` — confirm against
[12]).

The two-stage check (NAPAS GUID first, then `BIN + 99XX` prefix) resolves the cross-format ambiguity
described in §12.1.

---

## 14. SPA UX recommendations (cheat-sheet)

| Classification | Suggested user message |
|----------------|------------------------|
| `BankAccount` (NAPAS, non-wallet BIN) | "Vietnamese bank account detected — proceed to Wise." |
| `WalletViaVietQR("momo"/"zalopay")` | "This is a MoMo/ZaloPay wallet QR (wrapped as VietQR). Wise can't deliver to wallets — ask for the recipient's bank account." |
| `Wallet(*, payable=false)` (proprietary URL) | "This is a wallet-only QR for {name}. Wise can't pay wallets — ask for a bank account or VietQR." |
| `VNPayMerchant` | "This is a VNPAY merchant QR. Wise can't pay merchant gateways. Ask the merchant for a VietQR or pay in-app." |
| `Foreign(*)` | "This is a foreign payment QR ({network}). Wise's Vietnam service can't pay it." |
| `Defunct("grabpay-vn-2023")` | "GrabPay/Moca shut down in Vietnam in July 2023." |
| `NonPayment(*)` | "This isn't a payment QR — it's a {type}." |
| `Corrupt` | "QR is damaged; please rescan." |
| `UnknownEmvco(guid)` / `Unknown` | "We don't recognize this payment format (GUID `{guid}`). Please try a VietQR." |

---

## Sources

1. EMVCo, *Merchant-Presented QR Code Specification v1.1* — https://mvallim.github.io/emv-qrcode/docs/EMVCo-Merchant-Presented-QR-Specification-v1-1.pdf
2. EMVCo, *Merchant-Presented QR Codes (overview)* — https://www.emvco.com/processes/merchant-presented-qr-codes/
3. NAPAS / VietQR portal — https://vietqr.net/
4. xuannghia/vietnam-qr-pay (open-source TS encoder/decoder; documents VNPayQR + MoMo `99MM` + ZaloPay `99ZP` wrappers) — https://github.com/xuannghia/vietnam-qr-pay
5. MoMo Developers — Scan Dynamic QR Code overview — https://developers.momo.vn/v3/docs/voucher-distribution/api-document/voucher-redemption/voucher-redemption-dynamicqr/
6. ZaloPay Developer Docs — POS Dynamic QR API — https://docs.zalopay.vn/v2/docs/qrcode/api.html
7. Viettel Money × VietQR announcement — https://viettelmoney.vn/viettel-money-x-vietqr-mua-ban-moi-noi/
8. Viettel Money — QR scan guide — https://viettelmoney.vn/quet-ma-qr/
9. Wise Help Centre — *Guide to VND transfers* — https://wise.com/help/articles/2932336/guide-to-vnd-transfers
10. MoMo — *QR Nhận Tiền Đa Năng* (multi-app receive) — https://www.momo.vn/qr-da-nang
11. ShopeePay Product / Merchant-Presented Mode docs — https://product.shopeepay.com/integration/api/merchant-presented-mode/
12. VietQR.co banks directory (BIN/wallet listings) — https://vietqr.co/banks
13. hunghg255/vn-qr-pay (alternative parser) — https://github.com/hunghg255/vn-qr-pay
14. DealStreetAsia — *Grab to terminate Moca e-wallet services in Vietnam* — https://www.dealstreetasia.com/stories/grab-terminates-ewallet-services-vietnam-398270
15. Alipay+ Code Rules — https://docs.alipayplus.com/alipayplus/alipayplus/integration_cashier_mpp/identify_code?pageVersion=3
16. Antom — *Most popular payment methods in Vietnam* — https://knowledge.antom.com/most-popular-payment-methods-in-vietnam
17. Antom — *A merchant's guide to MoMoPay and payments in Vietnam* — https://knowledge.antom.com/a-merchants-guide-to-momopay-vietnam
18. mvallim/emv-qrcode (Java EMVCo TLV reference impl) — https://github.com/mvallim/emv-qrcode
19. Wise — *Top payment methods in Vietnam* — https://wise.com/us/blog/lp-payment-methods-in-vietnam
20. VNPAY Merchant app listing — https://play.google.com/store/apps/details?id=com.vnpay.merchant
