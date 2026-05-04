// Bank BIN lookup with manual override support.
// Pure module; types live in ./banks.d.ts.

import banksRaw from "../data/banks.json" with { type: "json" };
import overridesRaw from "../data/bin-overrides.json" with { type: "json" };

/** @typedef {import("./banks").BankRecord} BankRecord */
/** @typedef {import("./banks").BankLookupResult} BankLookupResult */

/** @type {BankRecord[]} */
const banks = /** @type {BankRecord[]} */ (banksRaw);

/** @type {Record<string, string>} */
const overrides = {};
for (const [k, v] of Object.entries(/** @type {Record<string, unknown>} */ (overridesRaw))) {
  if (k.startsWith("_")) continue;
  if (typeof v === "string") overrides[k] = v;
}

/** @type {Map<string, BankRecord>} */
const byBin = new Map();
for (const b of banks) byBin.set(b.bin, b);

/**
 * @param {string} bin
 * @returns {BankLookupResult | null}
 */
export function lookupBin(bin) {
  const rec = byBin.get(bin);
  if (!rec) return null;

  if (rec.bic) {
    return { ...rec, bicSource: "vietqr" };
  }
  const override = overrides[bin];
  if (override) {
    return {
      ...rec,
      bic: override,
      wiseSupported: true,
      bicSource: "override",
    };
  }
  return { ...rec, bicSource: "none" };
}
