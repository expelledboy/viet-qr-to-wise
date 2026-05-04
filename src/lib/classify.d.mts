// TypeScript declarations for ./classify.mjs.

import type { VietQRData } from "./vietqr.d.mts";

export type ClassifyResult =
  | { kind: "vietqr"; parsed: VietQRData }
  | { kind: "vietqr-card"; parsed: VietQRData; notice: string }
  | {
      kind: "wallet-via-vietqr";
      parsed: VietQRData;
      notice: string;
      walletProvider: "MoMo" | "ZaloPay" | "Wallet";
    }
  | { kind: "vnpayqr"; message: string; detail?: string }
  | { kind: "url"; message: string; detail?: string; host?: string }
  | { kind: "foreign"; message: string; detail?: string; aid?: string }
  | { kind: "non-payment"; message: string; detail?: string }
  | { kind: "malformed"; message: string; detail?: string }
  | { kind: "unknown"; message: string; detail?: string };

/**
 * Classify a decoded QR string into one of the supported / rejected kinds.
 * See README in docs/data-model/ for the dispatcher spec.
 */
export function classifyQR(input: string): ClassifyResult;
