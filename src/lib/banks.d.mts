// TypeScript declarations for ./banks.mjs.

export interface BankRecord {
  bin: string;
  code: string;
  shortName: string;
  name: string;
  bic: string | null;
  wiseSupported: boolean;
}

export type BicSource = "vietqr" | "override" | "none";

export interface BankLookupResult extends BankRecord {
  bicSource: BicSource;
}

/**
 * Look up a bank by 6-digit BIN. Returns null when BIN is unknown.
 * If the bank has no native BIC but an override exists, the override BIC
 * is substituted and `bicSource` is set to "override". Override BICs are
 * trusted to be in Wise's supported list.
 */
export function lookupBin(bin: string): BankLookupResult | null;
