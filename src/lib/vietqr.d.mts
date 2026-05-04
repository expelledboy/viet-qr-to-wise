// TypeScript declarations for ./vietqr.mjs (the runtime source of truth).

export interface VietQRData {
  raw: string;
  payloadFormat: string; // "01"
  initiationMethod: "static" | "dynamic";
  merchantAccount: {
    guid: string; // "A000000727"
    bankBin: string; // "970436"
    accountNumber: string;
    serviceCode: "QRIBFTTA" | "QRIBFTTC" | string;
  };
  currency: string; // "704"
  amount?: number; // VND, integer when currency 704
  countryCode?: string; // "VN"
  merchantName?: string;
  merchantCity?: string;
  additionalData?: {
    purpose?: string; // memo, sub-tag 08
    [key: string]: string | undefined;
  };
  crc: string; // "CD60"
  crcValid: boolean;
}

export class VietQRParseError extends Error {
  constructor(message: string, position?: number);
  readonly position?: number;
}

/**
 * Parse a VietQR / EMVCo MPM string into structured data.
 * Throws VietQRParseError on malformed input.
 * Returns crcValid=false (rather than throwing) when CRC mismatches.
 */
export function parseVietQR(input: string): VietQRData;

/**
 * CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF, no reflect, no xorout).
 * Returns 4-char uppercase hex.
 */
export function crc16ccittFalse(input: string): string;
