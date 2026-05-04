# Appeal to Wise: Add Native VietQR Support

> An open letter from a Wise customer who built a workaround so they could
> stop manually re-typing Vietnamese bank details into the Wise recipient
> form. Posted as the README of [`expelledboy/viet-qr-to-wise`](https://github.com/expelledboy/viet-qr-to-wise) so the asks are reproducible.

## TL;DR

**Wise's mobile QR scanner already supports 4 EMVCo MPM rails (PayNow, Pix, QR Ph, PromptPay). VietQR is structurally identical, just with a different scheme AID.** It is the standard QR format on every café table, restaurant menu, and merchant sticker in Vietnam. Adding it costs Wise marginal engineering — same dispatcher, same parsing path, plus a small BIN→BIC table for the ~50 NAPAS member banks.

We built [`viet-qr-to-wise`](https://expelledboy.github.io/viet-qr-to-wise/) as a workaround. It works, but the UX is meaningfully worse than what Wise could ship natively, for reasons explained below.

## The opportunity

Wise launched VND payouts to Vietnamese bank accounts and recently expanded coverage. Vietnam is ~100M people, ~85% smartphone penetration, and the NAPAS 247 instant-payment network is *the* domestic rail — every bank app interoperates over it via VietQR. NAPAS reported VietQR transaction volume crossed 100M/month in 2024.

Foreign visitors and the Vietnamese diaspora are a real Wise audience here. Right now, the canonical "tourist sends VND home" / "remote worker pays a contractor" flow is:

1. Recipient sends a VietQR image over WhatsApp/Zalo
2. Wise user opens Wise → "Send" → "Add new recipient"
3. **Manually re-types** bank, BIC, account number, holder name from the image into Wise's form
4. Confirms transfer

Step 3 is friction Wise has already eliminated for Thailand (PromptPay), Brazil (Pix), Singapore (PayNow), and the Philippines (QR Ph). Vietnam is conspicuously absent.

## Why the gap exists (we believe)

The technical evidence — from Wise's own [`apple-app-site-association`](https://wise.com/.well-known/apple-app-site-association), the help center's [QR scanning article](https://wise.com/help/articles/7cYlC8lKqbgjNNmlXyYtFL/how-can-i-pay-with-a-qr-code), and inspection of Wise's [public bundle](https://wise.com/static-assets/app/_next/static/chunks/78227-edf1821542adaff9.js) — suggests Wise's scanner dispatches by scheme AID inside the EMVCo MPM payload (e.g. PromptPay's `A000000677010111`, Pix's `br.gov.bcb.pix`). VietQR uses NAPAS's AID `A000000727`. It is not in the dispatch table. There is no generic EMVCo passthrough.

This is a small, tractable engineering scope, not a regulatory or rails problem. Wise already moves money to Vietnamese bank accounts via the existing VND payout product (verified via `https://api.wise.com/v1/account-requirements?source=USD&target=VND`).

## What we built, and why it isn't enough

[`viet-qr-to-wise`](https://github.com/expelledboy/viet-qr-to-wise) is a static SPA on GitHub Pages that:

1. Scans a VietQR with the device camera (BarcodeDetector with jsQR fallback)
2. Decodes the EMVCo MPM TLV — every legitimate field: BIN, account, service code, optional amount, optional memo
3. Looks up the BIN in our hand-maintained 65-bank table (40 auto-mapped to Wise's BIC dropdown via vietqr.io ↔ Wise account-requirements cross-reference; ~13 more recovered via manual override)
4. Renders an OCR-optimised PNG of the recipient details with English labels
5. Opens `https://wise.com/transferFlow?targetCurrency=VND&amount=N&fixedTarget=true` (universal link → mobile app)
6. The user manually uploads the PNG into Wise's "Upload screenshot" recipient flow, or copy-pastes individual fields

It works. We use it. But:

- **OCR round-trips are imperfect.** Wise's OCR claims 98.4% on chat-shared screenshots; we see lower against synthetic images, with the BIC most often misread.
- **Recipient holder name is not in any VietQR.** It's resolved by Vietnamese bank apps via NAPAS's IBFT name-inquiry, which is bank-to-bank and inaccessible from a third-party static SPA. We make the user type it (cached in `localStorage`, but still: first-send friction).
- **Wallet QRs (MoMo via BIN 970454, account `99MM…`) require warning the user manually** — Wise won't deliver to a wallet, but our SPA can only flag, not prevent.
- **The BIN→BIC table needs maintenance** by a third party (us) when NAPAS adds a member.
- **Five extra taps and a context switch** versus what a native scanner would deliver.

A native Wise implementation eliminates all of this.

## Concrete ask

Add VietQR to the scanner dispatcher, paralleling the existing rails:

| Existing rail | AID / Identifier | What Wise needs to add for VietQR |
|---|---|---|
| PromptPay (TH) | `A000000677010111` | — |
| Pix (BR) | `br.gov.bcb.pix` | — |
| PayNow (SG) | EMVCo MPM | — |
| QR Ph (PH) | `com.bsp.qrph` | — |
| **VietQR (VN)** | **`A000000727`** | **One line in the dispatch table** |

Specifically:

1. **Detect AID `A000000727` at tag 38.00**, then walk tag 38.01 sub-tag 00 (BIN, 6 digits) and sub-tag 01 (account, alphanumeric, ≤19 chars). Service code at 38.02 (`QRIBFTTA` for accounts, `QRIBFTTC` for cards).
2. **Map BIN to Wise BIC.** NAPAS publishes the member-bank list; Wise already accepts ~90 Vietnamese BICs in the VND recipient `swiftCode` dropdown. The cross-reference is mechanical — we have a working version we'd be happy to share.
3. **Optionally**, integrate the NAPAS 247 IBFT name-inquiry to auto-fill the recipient holder name (this is the killer feature Vietnamese bank apps have and we cannot replicate). Wise is plausibly already a NAPAS-adjacent participant via the VND payout product.
4. **Detect wallet-fronted accounts** (BIN `970454` + account prefix `99MM` / `99ZP`) and either route correctly or refuse with a clear message, rather than letting the user push money into a delivery dead-end.
5. **Reject VNPayQR** (separate format, GUID `A000000775`, tag 26 not 38) cleanly, the same way Wise rejects unsupported formats today.

If item 3 is out of scope, items 1–2 alone close the gap on every café-table sticker in the country and would already eliminate the workaround.

## Reference material

This repo contains a complete, peer-reviewed reference for the VietQR data model — built specifically to make this appeal concrete:

- [`docs/data-model/01-napas-vietqr.md`](docs/data-model/01-napas-vietqr.md) — full NAPAS MPM spec, every tag, every service code, encoding details, CRC algorithm
- [`docs/data-model/02-other-formats.md`](docs/data-model/02-other-formats.md) — every Vietnamese payment QR variant (VNPayQR, MoMo, ZaloPay, ViettelPay, ShopeePay, legacy bank formats) with detection decision tree
- [`docs/data-model/03-corpus.md`](docs/data-model/03-corpus.md) — 17 real CRC-verified VietQR strings from production stickers, fully decoded, with edge-case quirks documented
- [`docs/data-model/fixtures/`](docs/data-model/fixtures/) — raw QR strings, one per file
- [`src/lib/vietqr.mjs`](src/lib/vietqr.mjs) — MIT-licensed reference parser (10 unit tests, handles the full corpus)
- [`src/lib/classify.mjs`](src/lib/classify.mjs) — dispatcher that handles VietQR + wallet edge cases + non-VietQR rejects with friendly messages

Anything in this repo is yours under MIT. Take the parser. Take the BIN table. Take the corpus as test fixtures. We just want VietQR support in Wise.

## Why this is an appeal, not a feature request

Wise's public feature-request process is geared toward customer-driven small UI tweaks. VietQR support is a *category* of integration — analogous to PromptPay or Pix — and lives at the engineering-roadmap level rather than the product-feedback queue. It's also the kind of change where having a worked-out specification, a published parser, a real-world fixture corpus, and a documented BIN mapping in advance might shave weeks off implementation. That's what this repo is.

## Contact

- GitHub: [@expelledboy](https://github.com/expelledboy)
- Workaround SPA: <https://expelledboy.github.io/viet-qr-to-wise/>
- This appeal: <https://github.com/expelledboy/viet-qr-to-wise/blob/main/APPEAL.md>

If anyone at Wise picks this up — engineering, product, partnerships — we are happy to do a working session, hand over the parser and BIN table, and disappear quietly the moment Wise ships native support.
