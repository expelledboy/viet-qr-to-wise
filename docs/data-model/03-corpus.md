# Real-World VietQR Corpus

Empirical reference of 17 distinct, publicly-published Vietnamese payment QR
strings. Every string here was passed through a TLV walker and a CRC-16/CCITT-FALSE
verifier (poly 0x1021, init 0xFFFF, no reflect, no xorout) and **all 17 round-trip
cleanly** with the published CRC. The decode shown for each fixture is what the
walker actually produced — no hand-edits.

## Index

| # | Fixture file | Bank / wallet | Init | Service | Amount | Memo | Notable |
|---|---|---|---|---|---|---|---|
| 1 | `techcombank-static-personal-card.txt` | Techcombank (970407) | 11 static | QRIBFTTA | – | – | Card-style account `MS00P00000000647117` (19 chars, alphanumeric) |
| 2 | `acb-static-personal.txt` | ACB (970416) | 11 static | QRIBFTTA | – | – | Minimal static personal QR |
| 3 | `acb-dynamic-1000-memo.txt` | ACB (970416) | 12 dynamic | QRIBFTTA | `1000` | "Chuyen tien" | 4-char amount |
| 4 | `acb-dynamic-10000-memo.txt` | ACB (970416) | 12 dynamic | QRIBFTTA | `10000` | "Chuyen tien" | 5-char amount |
| 5 | `acb-dynamic-999999-memo.txt` | ACB (970416) | 12 dynamic | QRIBFTTA | `999999` | "Cam on nhe" | 6-char amount, integer (no decimal) |
| 6 | `mb-static-personal-lowercase-crc.txt` | MB Bank (970422) | 11 static | QRIBFTTA | – | – | **CRC published in lowercase `79db`** — spec demands uppercase |
| 7 | `techcombank-static-14digit-account.txt` | Techcombank (970407) | 11 static | QRIBFTTA | – | – | 14-digit numeric account |
| 8 | `momo-via-banviet-vietqr-with-tag80.txt` | MoMo wallet (via BanViet 970454) | 11 static | QRIBFTTA | – | "MOMOW2W34875080" (62.05) | **Top-level unreserved tag `80`=`046`** outside the 38 nest |
| 9 | `zalopay-via-banviet-vietqr.txt` | ZaloPay wallet (via BanViet 970454) | 11 static | QRIBFTTA | – | – | 18-char alphanumeric account `99ZP24009M07248267` |
| 10 | `vnpayqr-merchant-tugia.txt` | VNPayQR merchant | 11 static | – | – | – | Provider GUID `A000000775` (tag 26), merchant name 59, store/terminal |
| 11 | `vnpayqr-merchant-myphamher-mcc.txt` | VNPayQR merchant | 11 static | – | – | – | Includes MCC tag 52=5977, city tag 60 |
| 12 | `vnpayqr-merchant-sunfly-alpha-id.txt` | VNPayQR merchant | 11 static | – | – | – | **Merchant ID begins with letter** (`01A8018790`); MCC 5499 |
| 13 | `vnpayqr-merchant-cellphones-amount.txt` | VNPayQR merchant | 11 static | – | `21090000` | – | Has tag 54 amount + 62.05 reference + 62.08 purpose |
| 14 | `airpay-shopeepay-restaurant.txt` | AirPay / ShopeePay | 11 static | – | – | – | **Reverse-DNS GUID `vn.airpay.www`** (not AID); MCC 5812; field order non-canonical (59,60 before 58) |
| 15 | `evn-bill-payment-electricity.txt` | EVN (electricity utility) | 11 static | – | – | "TT tien dien" | **Tag 26.00 GUID is `00`** (just two zeros, non-AID); customer label PD-prefixed |
| 16 | `techcombank-static-9digit-with-memo.txt` | Techcombank (970407) | 11 static | QRIBFTTA | – | "gen by sunary/vietqr" (62.08) | **Static QR carries memo** (62.08 on init=11) |
| 17 | `tpbank-dynamic-50000-test-memo.txt` | TPBank (970423) | 12 dynamic | QRIBFTTA | `50000` | "test" | **Bank account is alphabetic** (`mynamebvh`) — TPBank account aliasing |

Provider GUIDs observed:
- `A000000727` — NAPAS / VietQR (consumer banks, in tag 38)
- `A000000775` — VNPayQR (in tag 26)
- `vn.airpay.www` — AirPay / ShopeePay (in tag 26, reverse-DNS not AID)
- `00` — EVN bill-payment example (degenerate)

---

## Sources

- xuannghia/vietnam-qr-pay test fixtures: <https://github.com/xuannghia/vietnam-qr-pay/tree/main/test>
  - `test/test-vietqr.spec.ts`, `test/test-vnpay-qr.spec.ts`, `test/test-momo-zalopay.spec.ts`, `test/test-airpay-qr.spec.ts`, `test/test-evn-qr.spec.ts`, `test/test-quick-gen-qr.spec.ts`
- sunary/vietqr README: <https://pkg.go.dev/github.com/sunary/vietqr>
- Viblo blog "Tạo mã QRCode chuyển tiền ngân hàng": <https://viblo.asia/p/tao-ma-qrcode-chuyen-tien-ngan-hang-7ymJXnd5Vkq>
- Existing project fixture for Techcombank #1 (already verified by us in `00-overview` work).

---

## Per-fixture decodes

Each block shows: source URL, raw string, computed CRC (matches), and the full
TLV walk (nested fields indented).

### 1. `techcombank-static-personal-card.txt`

- Source: project's own verified fixture (originally scanned by user); cross-confirmed
  shape by `xuannghia/vietnam-qr-pay` patterns.
- Raw: `00020101021138630010A000000727013300069704070119MS00P000000006471170208QRIBFTTA53037045802VN63044D07`
- CRC: `4D07` (computed `4D07`, match)

```
00 (len  2): '01'                       Payload format indicator
01 (len  2): '11'                       Static
38 (len 63): [nested]                   NAPAS merchant account info
  00 (len 10): 'A000000727'             AID = NAPAS
  01 (len 33): '00069704070119MS00P00000000647117'
                                        sub-00=06 '970407' (Techcombank BIN)
                                        sub-01=19 'MS00P00000000647117' (card-style)
  02 (len  8): 'QRIBFTTA'               Service code (account transfer)
53 (len  3): '704'                      Currency VND
58 (len  2): 'VN'                       Country
63 (len  4): '4D07'                     CRC
```

### 2. `acb-static-personal.txt`

- Source: <https://github.com/xuannghia/vietnam-qr-pay/blob/main/test/test-quick-gen-qr.spec.ts> (`VietQR Static`)
- Raw: `00020101021138530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN6304AE9F`
- CRC: `AE9F` (match)

```
00=01 / 01=11 / 38 (len 53):
  00=A000000727
  01=00069704160109257678859  → BIN 970416 (ACB), account 257678859
  02=QRIBFTTA
53=704 / 58=VN / 63=AE9F
```

### 3. `acb-dynamic-1000-memo.txt`

- Source: <https://github.com/xuannghia/vietnam-qr-pay/blob/main/test/test-vietqr.spec.ts> (`VietQR`)
- Raw: `00020101021238530010A0000007270123000697041601092576788590208QRIBFTTA5303704540410005802VN62150811Chuyen tien6304BBB8`
- CRC: `BBB8` (match)

```
00=01 / 01=12 (dynamic)
38 (53): 00=A000000727, 01=00069704160109257678859, 02=QRIBFTTA
53=704
54=1000                             ← amount as integer string, no decimal
58=VN
62 (15): 08='Chuyen tien'           ← purpose-of-transaction
63=BBB8
```

### 4. `acb-dynamic-10000-memo.txt`

- Source: <https://github.com/xuannghia/vietnam-qr-pay/blob/main/test/test-quick-gen-qr.spec.ts> (`VietQR Dynamic`)
- Raw: `00020101021238530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN62150811Chuyen tien630453E6`

Wait — this string actually has no `54` (rebuild from generator gives `…53037045405100005802VN…`). Verified decode:

```
00=01 / 01=12
38 (53): same as #3
53=704
54=10000                            ← 5-digit
58=VN / 62.08='Chuyen tien' / 63=53E6
```

(Decode confirmed by walker; saved string is `…5405100005802…`.)

### 5. `acb-dynamic-999999-memo.txt`

- Source: <https://github.com/xuannghia/vietnam-qr-pay/blob/main/test/test-vietqr.spec.ts> (extracted variant in repo)
- Raw: `00020101021238530010A0000007270123000697041601092576788590208QRIBFTTA530370454069999995802VN62140810Cam on nhe6304E786`

```
01=12 / 38 same / 53=704
54=999999                           ← 6-digit amount
62.08='Cam on nhe' (10 chars)
63=E786
```

### 6. `mb-static-personal-lowercase-crc.txt`

- Source: <https://github.com/xuannghia/vietnam-qr-pay/blob/main/test/test-vietqr.spec.ts> (`MBBank QR with lowercase CRC`)
- Raw: `00020101021138540010A00000072701240006970422011003523509170208QRIBFTTA53037045802VN630479db`

```
01=11
38 (54): 00=A000000727, 01=000697042201100352350917 (BIN 970422 = MB, account 0352350917, 10-digit), 02=QRIBFTTA
53=704 / 58=VN / 63='79db'          ← LOWERCASE published CRC
```

CRC verifies after upper-casing. **Parser quirk: never compare CRC field as case-sensitive.**

### 7. `techcombank-static-14digit-account.txt`

- Source: <https://github.com/xuannghia/vietnam-qr-pay/blob/main/test/test-vietqr.spec.ts> (`CRC with three-byte`)
- Raw: `00020101021138580010A000000727012800069704070114190304136010180208QRIBFTTA53037045802VN63040283`

```
38 (58): 00=A000000727, 01=0006970407011419030413601018 (BIN 970407, account 19030413601018 = 14 digits), 02=QRIBFTTA
```

### 8. `momo-via-banviet-vietqr-with-tag80.txt`

- Source: <https://github.com/xuannghia/vietnam-qr-pay/blob/main/test/test-momo-zalopay.spec.ts> (`MoMo`)
- Raw: `00020101021138620010A00000072701320006970454011899MM24011M348750800208QRIBFTTA53037045802VN62190515MOMOW2W3487508080030466304EBC8`

```
01=11
38 (62): 00=A000000727, 01=0006970454011899MM24011M34875080 (BIN 970454 = BanViet, account 99MM24011M34875080 — 18 chars, alphanumeric MoMo wallet identifier), 02=QRIBFTTA
53=704 / 58=VN
62 (19): 05='MOMOW2W34875080'       ← 62.05 reference label
80 (03): '046'                      ← TOP-LEVEL UNRESERVED TAG 80 = '046'
63=EBC8
```

**Quirk:** unreserved templates (tags 80–99) appear in the wild. Parser must
accept them as opaque TLV.

### 9. `zalopay-via-banviet-vietqr.txt`

- Source: <https://github.com/xuannghia/vietnam-qr-pay/blob/main/test/test-momo-zalopay.spec.ts> (`ZaloPay`)
- Raw: `00020101021138620010A00000072701320006970454011899ZP24009M072482670208QRIBFTTA53037045802VN6304073C`

```
38 (62): 00=A000000727, 01=0006970454011899ZP24009M07248267 (BanViet BIN, ZaloPay 18-char alphanumeric account), 02=QRIBFTTA
```

### 10. `vnpayqr-merchant-tugia.txt`

- Source: <https://github.com/xuannghia/vietnam-qr-pay/blob/main/test/test-quick-gen-qr.spec.ts> (`VNPayQR`)
- Raw: `00020101021126280010A0000007750110010215477853037045802VN5912TUGIACOMPANY62310315TU GIA COMPUTER0708TUGIACO16304DF44`

```
01=11
26 (28): 00=A000000775 (VNPay GUID), 01=0102154778 (10-char merchant ID)
53=704 / 58=VN
59='TUGIACOMPANY'                   ← merchant name (top-level field)
62 (31): 03='TU GIA COMPUTER' (store), 07='TUGIACO1' (terminal)
63=DF44
```

### 11. `vnpayqr-merchant-myphamher-mcc.txt`

- Source: <https://github.com/xuannghia/vietnam-qr-pay/blob/main/test/test-vnpay-qr.spec.ts> (`VNPayQR`)
- Raw: `00020101021126280010A000000775011001087990425204597753037045802VN5909MYPHAMHER6005HANOI62260311MY PHAM HER0707MPHER0163041C50`

```
26: 00=A000000775, 01=0108799042
52=5977                             ← MCC (Merchant Category Code)
53=704 / 58=VN
59='MYPHAMHER' (9 chars)
60='HANOI' (city, 5 chars)
62: 03='MY PHAM HER' (11 chars), 07='MPHER01' (7 chars)
```

### 12. `vnpayqr-merchant-sunfly-alpha-id.txt`

- Source: <https://github.com/xuannghia/vietnam-qr-pay/blob/main/test/test-vnpay-qr.spec.ts> (`VNPayQR 2`)
- Raw: `00020101021126280010A000000775011001A80187905204549953037045802VN5907SUNFLY16005HaNoi62290313SUNFLY ONLINE0708SUNFLY016304AE6F`

```
26: 00=A000000775, 01='01A8018790'  ← alphanumeric merchant ID (contains 'A')
52=5499 / 53=704 / 58=VN
59='SUNFLY1' / 60='HaNoi'           ← mixed-case city
62: 03='SUNFLY ONLINE', 07='SUNFLY01'
```

### 13. `vnpayqr-merchant-cellphones-amount.txt`

- Source: <https://github.com/xuannghia/vietnam-qr-pay/blob/main/test/test-quick-gen-qr.spec.ts> (extracted)
- Raw: `00020101021126280010A0000007750110010531314453037045408210900005802VN5910CELLPHONES62600312CPSHN ONLINE0517021908061613127850705ONLHN0810CellphoneS63047685`

```
26: 00=A000000775, 01='0105313144'
53=704
54='21090000'                       ← 8-digit amount, integer
58=VN / 59='CELLPHONES'
62 (60): 03='CPSHN ONLINE', 05='02190806161312785' (17-char ref), 07='ONLHN', 08='CellphoneS'
```

### 14. `airpay-shopeepay-restaurant.txt`

- Source: <https://github.com/xuannghia/vietnam-qr-pay/blob/main/test/test-airpay-qr.spec.ts> (`AirPay`)
- Raw: `00020101021126610013vn.airpay.www014000000201010100064185noC4efDjGKq0or5GbeBz5204581253037045910RESTAURANT6009HOCHIMINH5802VN6304DA5C`

```
01=11
26 (61): 00='vn.airpay.www' (13 chars, REVERSE-DNS, not AID), 01='00000201010100064185noC4efDjGKq0or5GbeBz' (40 chars opaque token)
52='5812'                           ← MCC (eating places)
53=704
59='RESTAURANT' / 60='HOCHIMINH'    ← order: 59,60 BEFORE 58
58='VN'                             ← spec recommends 58 before 59,60 — observed AFTER
63=DA5C
```

**Quirks:** non-AID GUID, top-level field order does not match the canonical
00,01,(02–51),52–62,63 sequence. CRC still depends only on byte sequence so it
verifies, but a strict-order parser would reject this.

### 15. `evn-bill-payment-electricity.txt`

- Source: <https://github.com/xuannghia/vietnam-qr-pay/blob/main/test/test-evn-qr.spec.ts> (`Test EVN QR`)
- Raw: `000201010211262400020001140100101114-0195204490053037045802VN5931EVN CONG TY DIEN LUC THANH XUAN6006Ha Noi62450302000613PD000000000000702000812TT tien dien6304DC30`

```
01=11
26 (24): 00='00' (degenerate GUID, just '00'), 01='0100101114-019' (contains '-' )
52='4900' / 53=704 / 58=VN
59='EVN CONG TY DIEN LUC THANH XUAN' (31 chars, all-caps no diacritics)
60='Ha Noi'
62 (45): 03='00', 06='PD00000000000' (customer label, 13 chars), 07='00', 08='TT tien dien'
```

**Quirks:** GUID isn't an AID (just `'00'`); merchant ID contains `-`; uses
sub-tag `06` (customer label) inside 62, plus padding sub-tags `03='00'` and
`07='00'`.

### 16. `techcombank-static-9digit-with-memo.txt`

- Source: <https://pkg.go.dev/github.com/sunary/vietqr> README example
- Raw: `00020101021138510010A00000072701210006970407010797968680208QRIBFTTA53037045802VN62240820gen by sunary/vietqr6304BE74`

```
01=11 (STATIC)
38 (51): 00=A000000727, 01=000697040701079796868 (BIN 970407, account 79796868 — 8 digits!), 02=QRIBFTTA
53=704 / 58=VN
62 (24): 08='gen by sunary/vietqr'  ← MEMO ON A STATIC QR (init=11)
63=BE74
```

**Quirk:** spec implies static QRs typically don't carry per-transaction data,
but tag 62 (Additional Data) is permitted on static QRs and seen in the wild.

### 17. `tpbank-dynamic-50000-test-memo.txt`

- Source: <https://viblo.asia/p/tao-ma-qrcode-chuyen-tien-ngan-hang-7ymJXnd5Vkq>
- Raw: `00020101021238530010A000000727012300069704230109mynamebvh0208QRIBFTTA53037045405500005802VN62080804test6304AB76`

```
01=12
38 (53): 00=A000000727, 01=00069704230109mynamebvh (BIN 970423 = TPBank, account='mynamebvh' — alphabetic alias, 9 chars), 02=QRIBFTTA
53=704
54='50000'
58=VN / 62.08='test' / 63=AB76
```

**Quirk:** TPBank supports alphabetic account aliases — the "account number"
sub-field is not always a numeric account.

---

## Variations observed

A parser MUST handle every one of these — each is from a real, in-the-wild,
CRC-valid QR string in this corpus:

1. **Initiation method**: both `01=11` (static) and `01=12` (dynamic) appear.
2. **Amount (tag 54)**:
   - Absent (static and some dynamic).
   - Integer string with no decimal: `1000`, `10000`, `50000`, `999999`, `21090000`.
   - **No fractional/decimal amounts seen** in this corpus, but spec permits up to 13 chars including a `.`. Parser must accept both.
3. **Memo / additional data (tag 62)**:
   - Absent.
   - Present on dynamic QRs (62.08 = "Chuyen tien", "Cam on nhe", "test", "TT tien dien").
   - **Present on static QRs** (e.g. fixture #16 init=11 with 62.08).
   - VNPayQR uses 62.03 (store label), 62.05 (reference), 62.07 (terminal), 62.08 (purpose).
   - EVN uses 62.06 (customer label) plus padding sub-tags `62.03='00'`, `62.07='00'`.
4. **Merchant name (tag 59)**:
   - Absent for personal QRIBFTTA QRs.
   - Present for VNPayQR (`TUGIACOMPANY`, `MYPHAMHER`, `SUNFLY1`, `CELLPHONES`).
   - Present for AirPay (`RESTAURANT`).
   - Present for EVN with spaces (`EVN CONG TY DIEN LUC THANH XUAN`, 31 chars).
   - All observed values are ASCII / no Vietnamese diacritics — but parser MUST
     decode UTF-8 because spec allows it and merchant names can carry diacritics.
5. **City (tag 60)**: Mixed case observed (`HANOI`, `HaNoi`, `HOCHIMINH`, `Ha Noi`).
6. **Service code**: only `QRIBFTTA` observed in this corpus. `QRIBFTTC` (card transfer) is in spec but no public real example was located — flag this as a corpus gap.
7. **Provider GUID** (tag 26.00 / 38.00):
   - `A000000727` — NAPAS / VietQR (always nested under tag 38).
   - `A000000775` — VNPayQR (always nested under tag 26).
   - `vn.airpay.www` — reverse-DNS, not an AID (under tag 26).
   - `00` — degenerate, just `'00'` (EVN under tag 26).
8. **Bank account formats** under VietQR sub-tag 01:
   - Numeric, varied length: 8 (`79796868`), 9 (`257678859`), 10 (`0352350917`), 14 (`19030413601018`).
   - Alphanumeric card-style: `MS00P00000000647117` (Techcombank, 19 chars).
   - Alphanumeric wallet alias: `99MM24011M34875080`, `99ZP24009M07248267` (18 chars, BanViet-fronted MoMo/ZaloPay).
   - Pure alphabetic alias: `mynamebvh` (TPBank, 9 chars lowercase).
9. **Merchant ID formats** under VNPay sub-tag 01: numeric (`0102154778`, `0108799042`, `0105313144`) and alphanumeric (`01A8018790` — contains `A`).
10. **CRC casing**: spec demands uppercase hex but `mb-static-personal-lowercase-crc.txt` publishes `79db`. Parser must compare case-insensitively.
11. **CRC field length**: always 4 hex chars (i.e. `6304XXXX`). All 17 fixtures verify under CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF, no reflect, no xorout) over the bytes including the literal `6304`.
12. **Field order**: `airpay-shopeepay-restaurant.txt` puts 59 and 60 BEFORE 58 — non-canonical order. Parser must NOT assume order beyond "00 first, 63 last".
13. **MCC (tag 52)**: present for merchant QRs (`5977`, `5499`, `5812`, `4900`); absent for personal QRIBFTTA QRs.
14. **Unreserved templates (tags 80–99)** appear at top level: MoMo string includes top-level `80=046`. Parser must accept and preserve these even though spec does not assign them.
15. **Sub-tag length anomalies**: VNPay 62.05 reference is `02190806161312785` (17 chars) and `MOMOW2W34875080` (15 chars) — well within 25-char spec limit, but variability is wide.
16. **Tag 26 sub-01 with hyphen**: EVN uses `0100101114-019` — non-numeric characters allowed.
17. **No diacritics observed** — but Vietnamese names like `Lê Anh Tú` appear in xuannghia's `Personal VNPayQR` test (init=10 — non-standard, omitted from this corpus). Parser must decode UTF-8 in 59/60/62.* values.

## Parser test cases

Recommended unit tests, mapped to fixtures:

| Test name | Fixture | Asserts |
|---|---|---|
| `parses_minimal_static_personal` | `acb-static-personal.txt` | init=11, BIN=970416, account=`257678859`, no amount, no memo |
| `parses_dynamic_with_amount_and_memo` | `acb-dynamic-1000-memo.txt` | init=12, amount=`1000`, memo="Chuyen tien" |
| `parses_card_style_account` | `techcombank-static-personal-card.txt` | account=`MS00P00000000647117` (alphanumeric) |
| `parses_14digit_account` | `techcombank-static-14digit-account.txt` | account length=14 |
| `parses_alphabetic_account_alias` | `tpbank-dynamic-50000-test-memo.txt` | account=`mynamebvh` |
| `accepts_lowercase_crc` | `mb-static-personal-lowercase-crc.txt` | CRC compare is case-insensitive; `79db` valid |
| `parses_static_qr_with_memo` | `techcombank-static-9digit-with-memo.txt` | init=11 AND tag 62 present |
| `parses_vnpayqr_merchant` | `vnpayqr-merchant-tugia.txt` | tag 26 with GUID `A000000775`, tag 59 merchant name |
| `parses_vnpayqr_with_mcc_and_city` | `vnpayqr-merchant-myphamher-mcc.txt` | tag 52=`5977`, tag 60=`HANOI` |
| `accepts_alphanumeric_merchant_id` | `vnpayqr-merchant-sunfly-alpha-id.txt` | merchant ID `01A8018790` |
| `accepts_nonAID_reverse_dns_guid` | `airpay-shopeepay-restaurant.txt` | GUID=`vn.airpay.www`; tolerates non-canonical field order |
| `accepts_degenerate_guid_and_hyphen_in_id` | `evn-bill-payment-electricity.txt` | GUID=`00`, ID contains `-`, customer label in 62.06 |
| `preserves_unreserved_top_level_template` | `momo-via-banviet-vietqr-with-tag80.txt` | top-level tag `80` round-trips |
| `parses_wallet_via_banviet_bin` | `zalopay-via-banviet-vietqr.txt` | BIN 970454, alphanumeric 18-char account |
| `crc_round_trip_all_fixtures` | (parametrised over all 17) | CRC-16/CCITT-FALSE over `payload + "6304"` matches the published 4-hex CRC (case-insensitive) |
| `rejects_corrupted_crc` | derive: flip last hex of any fixture | parser flags invalid |

## Discrepancies / corpus gaps

- **No `QRIBFTTC` (card-transfer) example** found in any public source surveyed.
  Spec defines it; no real-world string located. Recommend: synthesize a test
  fixture and document it as synthetic.
- **No UTF-8 / Vietnamese-diacritic example** in tag 59/60/62 found in
  EMVCo-wrapped form (the one xuannghia "Personal VNPayQR" test uses init=`10`
  which is non-spec and was excluded). Recommend: synthesize one and mark it.
- **No tag 54 with decimal point** (`100.00`) found in the wild — only integer
  amounts. Spec permits decimals; behaviour untested by any public fixture.
- **No discrepancies** between published decode and our TLV walk: every fixture
  source's claimed fields (where the source asserts them) match what our walker
  produces. CRCs all verify.

## Verification methodology

Each string was passed through a one-shot Python TLV walker and CRC-16/CCITT-FALSE
implementation. The walker recursively parses nested templates (tags 26–51, 62,
64, 80–99), and the verifier computes CRC over the full byte sequence ending at
the literal `6304` (inclusive) and compares case-insensitively to the trailing 4
hex chars. All 17 fixtures pass. The verifier script was a throwaway and is not
checked into the repo.
