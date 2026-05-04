// VietQR / EMVCo MPM TLV parser.
// Source of truth for runtime behavior. TypeScript types live in ./vietqr.d.ts.
// Pure functions, no dependencies.

export class VietQRParseError extends Error {
  /**
   * @param {string} message
   * @param {number} [position]
   */
  constructor(message, position) {
    super(message);
    this.name = "VietQRParseError";
    this.position = position;
  }
}

/**
 * Walk an EMVCo TLV string and yield {tag, value} entries.
 * @param {string} input
 * @param {number} [baseOffset] for error reporting
 * @returns {Array<{tag: string, value: string}>}
 */
function tlvWalk(input, baseOffset = 0) {
  const out = [];
  let i = 0;
  while (i < input.length) {
    if (i + 4 > input.length) {
      throw new VietQRParseError(
        `Truncated TLV header at offset ${baseOffset + i}`,
        baseOffset + i,
      );
    }
    const tag = input.slice(i, i + 2);
    const lenStr = input.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(tag)) {
      throw new VietQRParseError(
        `Non-digit tag "${tag}" at offset ${baseOffset + i}`,
        baseOffset + i,
      );
    }
    if (!/^\d{2}$/.test(lenStr)) {
      throw new VietQRParseError(
        `Non-digit length "${lenStr}" at offset ${baseOffset + i + 2}`,
        baseOffset + i + 2,
      );
    }
    const len = parseInt(lenStr, 10);
    const valStart = i + 4;
    const valEnd = valStart + len;
    if (valEnd > input.length) {
      throw new VietQRParseError(
        `Value for tag ${tag} (length ${len}) exceeds input at offset ${baseOffset + valStart}`,
        baseOffset + valStart,
      );
    }
    out.push({ tag, value: input.slice(valStart, valEnd) });
    i = valEnd;
  }
  return out;
}

/**
 * CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF, no reflect, no xorout).
 * @param {string} input ASCII string
 * @returns {string} 4-char uppercase hex
 */
export function crc16ccittFalse(input) {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= (input.charCodeAt(i) & 0xff) << 8;
    for (let b = 0; b < 8; b++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Parse a VietQR / EMVCo MPM string.
 * @param {string} input
 * @returns {import("./vietqr").VietQRData}
 */
export function parseVietQR(input) {
  if (typeof input !== "string" || input.length === 0) {
    throw new VietQRParseError("Input must be a non-empty string");
  }

  const top = tlvWalk(input);
  /** @type {Record<string, string>} */
  const byTag = {};
  for (const { tag, value } of top) {
    byTag[tag] = value;
  }

  if (byTag["00"] === undefined) {
    throw new VietQRParseError("Missing required tag 00 (payload format)");
  }
  if (byTag["38"] === undefined) {
    throw new VietQRParseError("Missing required tag 38 (merchant account info)");
  }
  if (byTag["63"] === undefined) {
    throw new VietQRParseError("Missing required tag 63 (CRC)");
  }

  // Initiation method
  const initRaw = byTag["01"];
  /** @type {"static" | "dynamic"} */
  let initiationMethod = "static";
  if (initRaw === "12") initiationMethod = "dynamic";
  else if (initRaw === "11" || initRaw === undefined) initiationMethod = "static";
  else initiationMethod = initRaw === "12" ? "dynamic" : "static";

  // Tag 38: nested NAPAS
  const t38 = tlvWalk(byTag["38"]);
  /** @type {Record<string, string>} */
  const m38 = {};
  for (const { tag, value } of t38) m38[tag] = value;

  const guid = m38["00"] ?? "";
  const serviceCode = m38["02"] ?? "";

  // 38.01 nested: bank BIN + account number
  if (m38["01"] === undefined) {
    throw new VietQRParseError("Missing tag 38.01 (beneficiary organization)");
  }
  const t3801 = tlvWalk(m38["01"]);
  /** @type {Record<string, string>} */
  const m3801 = {};
  for (const { tag, value } of t3801) m3801[tag] = value;
  const bankBin = m3801["00"] ?? "";
  const accountNumber = m3801["01"] ?? "";

  // Amount
  /** @type {number | undefined} */
  let amount;
  if (byTag["54"] !== undefined) {
    const n = Number(byTag["54"]);
    if (!Number.isFinite(n) || n < 0) {
      throw new VietQRParseError(`Invalid amount "${byTag["54"]}"`);
    }
    if (byTag["53"] === "704" && /^\d+$/.test(byTag["54"])) {
      amount = Math.round(n);
    } else {
      amount = n;
    }
  }

  // Tag 62: additional data nested
  /** @type {{ purpose?: string, [k: string]: string | undefined } | undefined} */
  let additionalData;
  if (byTag["62"] !== undefined) {
    const t62 = tlvWalk(byTag["62"]);
    additionalData = {};
    for (const { tag, value } of t62) {
      additionalData[tag] = value;
      if (tag === "08") additionalData.purpose = value;
    }
  }

  // CRC validation
  const crc = byTag["63"];
  const marker = "6304";
  const idx = input.lastIndexOf(marker);
  let crcValid = false;
  if (idx !== -1) {
    const toCheck = input.slice(0, idx + 4);
    const expected = crc16ccittFalse(toCheck);
    crcValid = expected.toUpperCase() === crc.toUpperCase();
  }

  return {
    raw: input,
    payloadFormat: byTag["00"],
    initiationMethod,
    merchantAccount: {
      guid,
      bankBin,
      accountNumber,
      serviceCode,
    },
    currency: byTag["53"] ?? "",
    amount,
    countryCode: byTag["58"],
    merchantName: byTag["59"],
    merchantCity: byTag["60"],
    additionalData,
    crc,
    crcValid,
  };
}
