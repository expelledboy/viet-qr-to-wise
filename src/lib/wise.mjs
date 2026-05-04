// Wise deep-link builder.
//
// Uses /transferFlow rather than /send#/ because /transferFlow is in
// Wise's apple-app-site-association universal-links list (and the
// equivalent Android intent-filter), so iOS/Android open the Wise app
// directly. On desktop or without the app installed, the browser
// follows the documented 301 to /send/ with query params preserved.

/**
 * @param {{ amount?: number }} [opts]
 * @returns {string}
 */
export function buildWiseSendUrl(opts = {}) {
  const { amount } = opts;
  const params = new URLSearchParams({ targetCurrency: "VND" });
  if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) {
    params.set("amount", String(Math.round(amount)));
    params.set("fixedTarget", "true");
  }
  return `https://wise.com/transferFlow?${params.toString()}`;
}
