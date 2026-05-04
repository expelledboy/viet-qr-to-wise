// Wise deep-link builder.

/**
 * @param {{ amount?: number }} [opts]
 * @returns {string}
 */
export function buildWiseSendUrl(opts = {}) {
  const { amount } = opts;
  let url = "https://wise.com/send#/?targetCurrency=VND";
  if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) {
    url += `&amount=${Math.round(amount)}&fixedTarget=true`;
  }
  return url;
}
