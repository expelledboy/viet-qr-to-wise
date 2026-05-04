// QR classifier — wraps parseVietQR with format detection and safety checks.
// Pure functions, no dependencies. See ./classify.d.mts for types.

import { parseVietQR, VietQRParseError } from "./vietqr.mjs";

const NAPAS_GUID = "A000000727";
const VNPAY_GUID = "A000000775";

/** Foreign AID lookup. Keys are uppercased GUIDs (or recognizable prefixes). */
const FOREIGN_AIDS = [
  { aid: "A000000777", name: "Alipay" },
  { aid: "A000000744", name: "WeChat Pay" },
  { aid: "A000000677010111", name: "PromptPay (Thailand)" },
  { aid: "A0000005241010", name: "UPI (India)" },
];

const WALLET_HOSTS = [
  { host: "nhantien.momo.vn", provider: "MoMo" },
  { host: "payment.momo.vn", provider: "MoMo" },
  { host: "zalopay.vn", provider: "ZaloPay" },
  { host: "qr.zalopay.vn", provider: "ZaloPay" },
];

const URL_SCHEME_RE = /^[a-z][a-z0-9+.\-]*:\/\//i;

/**
 * Tolerant shallow TLV walk. Stops on any malformed segment and returns
 * whatever it parsed successfully so far.
 * @param {string} input
 * @returns {Array<{tag: string, value: string}>}
 */
function shallowTlv(input) {
  const out = [];
  let i = 0;
  while (i + 4 <= input.length) {
    const tag = input.slice(i, i + 2);
    const lenStr = input.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lenStr)) break;
    const len = parseInt(lenStr, 10);
    const valStart = i + 4;
    const valEnd = valStart + len;
    if (valEnd > input.length) break;
    out.push({ tag, value: input.slice(valStart, valEnd) });
    i = valEnd;
  }
  return out;
}

/**
 * Extract the GUID (sub-tag 00) from a nested TLV value, if present.
 * @param {string} value
 * @returns {string}
 */
function extractGuid(value) {
  const inner = shallowTlv(value);
  for (const { tag, value: v } of inner) {
    if (tag === "00") return v;
  }
  return "";
}

/**
 * @param {string} guid
 * @returns {{ aid: string, name: string } | null}
 */
function matchForeignAid(guid) {
  if (!guid) return null;
  const upper = guid.toUpperCase();
  for (const f of FOREIGN_AIDS) {
    if (upper === f.aid.toUpperCase() || upper.startsWith(f.aid.toUpperCase())) {
      return f;
    }
  }
  return null;
}

/**
 * @param {string} input
 * @returns {import("./classify.d.mts").ClassifyResult}
 */
export function classifyQR(input) {
  const text = typeof input === "string" ? input.trim() : "";

  // 1. URL detection
  if (URL_SCHEME_RE.test(text)) {
    let host = "";
    try {
      host = new URL(text).host.toLowerCase();
    } catch {
      // momo://abc — URL constructor accepts it but host may be empty.
      const m = text.match(/^[a-z][a-z0-9+.\-]*:\/\/([^/?#]*)/i);
      if (m) host = m[1].toLowerCase();
    }
    const wallet = WALLET_HOSTS.find((w) => host === w.host || host.endsWith("." + w.host));
    const schemeMatch = text.match(/^([a-z][a-z0-9+.\-]*):/i);
    const scheme = schemeMatch ? schemeMatch[1].toLowerCase() : "";
    if (wallet) {
      return {
        kind: "url",
        host,
        message: `This is a ${wallet.provider} payment link. Wise can't route to ${wallet.provider} — open the ${wallet.provider} app to pay.`,
        detail: text.slice(0, 200),
      };
    }
    if (scheme === "momo") {
      return {
        kind: "url",
        host,
        message: "This is a MoMo payment link. Wise can't route to MoMo — open the MoMo app to pay.",
        detail: text.slice(0, 200),
      };
    }
    if (scheme === "zalopay") {
      return {
        kind: "url",
        host,
        message: "This is a ZaloPay payment link. Wise can't route to ZaloPay — open the ZaloPay app to pay.",
        detail: text.slice(0, 200),
      };
    }
    return {
      kind: "url",
      host,
      message: "URL-form payment link not supported. Open the link in the relevant wallet or browser.",
      detail: text.slice(0, 200),
    };
  }

  // 2. Non-payment shape check
  if (text.length < 30 || !/^\d/.test(text) || !text.startsWith("00")) {
    return {
      kind: "non-payment",
      message: "This doesn't look like a payment QR.",
      detail: text.length > 80 ? text.slice(0, 80) + "…" : text,
    };
  }

  // 3. Shallow TLV walk
  const top = shallowTlv(text);
  if (top.length === 0) {
    return {
      kind: "non-payment",
      message: "This doesn't look like a payment QR.",
      detail: text.slice(0, 80),
    };
  }

  /** @type {Record<string, string>} */
  const byTag = {};
  for (const { tag, value } of top) {
    if (byTag[tag] === undefined) byTag[tag] = value;
  }

  // 4. VNPayQR — tag 26 with GUID A000000775
  if (byTag["26"] !== undefined && extractGuid(byTag["26"]).toUpperCase() === VNPAY_GUID) {
    return {
      kind: "vnpayqr",
      message: "VNPayQR merchant code — not supported. Wise can't reach VNPay merchant rails.",
      detail: "Detected VNPay GUID A000000775 in tag 26.",
    };
  }

  // 5. NAPAS VietQR — tag 38 with GUID A000000727
  if (byTag["38"] !== undefined && extractGuid(byTag["38"]).toUpperCase() === NAPAS_GUID) {
    let parsed;
    try {
      parsed = parseVietQR(text);
    } catch (err) {
      const msg = err instanceof VietQRParseError ? err.message : String(err);
      return {
        kind: "malformed",
        message: "This looks like a VietQR but couldn't be parsed.",
        detail: msg,
      };
    }

    const bin = parsed.merchantAccount.bankBin;
    const account = parsed.merchantAccount.accountNumber;
    const service = parsed.merchantAccount.serviceCode;

    if (bin === "970454" && (account.startsWith("99MM") || account.startsWith("99ZP"))) {
      const provider = account.startsWith("99MM") ? "MoMo" : "ZaloPay";
      return {
        kind: "wallet-via-vietqr",
        parsed,
        walletProvider: provider,
        notice: `This is a ${provider} wallet account fronted by BVBank. Wise will deliver to BVBank, but the recipient may need to claim funds in their ${provider} wallet. Confirm before sending.`,
      };
    }

    if (service === "QRIBFTTC") {
      return {
        kind: "vietqr-card",
        parsed,
        notice: "This QR points to a card, not a bank account. Wise can only deliver to bank accounts — confirm with the recipient.",
      };
    }

    return { kind: "vietqr", parsed };
  }

  // 6. Foreign AID detection — check all top-level tags for a recognizable GUID.
  for (const { tag, value } of top) {
    if (tag === "26" || tag === "27" || tag === "28" || tag === "29" ||
        tag === "30" || tag === "31" || tag === "51") {
      const guid = extractGuid(value);
      const foreign = matchForeignAid(guid);
      if (foreign) {
        return {
          kind: "foreign",
          aid: guid,
          message: `Not a Vietnamese payment QR — looks like ${foreign.name}.`,
          detail: `Detected AID ${guid} in tag ${tag}.`,
        };
      }
    }
  }

  // 7. Default unknown
  return {
    kind: "unknown",
    message: "Unrecognised payment QR format.",
    detail: text.slice(0, 80),
  };
}
