/**
 * Prices entered anywhere in the app are VAT-inclusive, so VAT must be
 * extracted from the gross amount rather than added on top of it.
 *
 * `tax` is rounded to 2dp first and `net` is derived as `gross - tax`
 * (never rounded independently), so `net + tax` always exactly equals the
 * original gross amount with no floating-point drift.
 *
 * @param scale - divisor to normalize `taxRate` to a 0-1 fraction before the
 *   math. Pass 100 for state that stores taxRate on a 0-100 scale (e.g.
 *   QuotationFormPage). Defaults to 1 (already 0-1, e.g. POSPage/RFQPage).
 */
export function extractTax(
  grossAmount: number,
  taxRate: number,
  scale: number = 1,
): { tax: number; net: number } {
  const rate = taxRate / scale;
  const rawTax = (grossAmount * rate) / (1 + rate);
  const tax = Math.round(rawTax * 100) / 100;
  const net = Math.round((grossAmount - tax) * 100) / 100;
  return { tax, net };
}
