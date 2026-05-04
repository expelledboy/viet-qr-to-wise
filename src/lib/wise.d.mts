// TypeScript declarations for ./wise.mjs.

export interface BuildWiseSendUrlOptions {
  amount?: number;
}

/**
 * Build a Wise send-money deep link with VND as target currency.
 * If amount (integer VND) is provided, it is fixed as the target amount.
 */
export function buildWiseSendUrl(opts?: BuildWiseSendUrlOptions): string;
