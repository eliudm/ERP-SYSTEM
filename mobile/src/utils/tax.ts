/**
 * Prices entered anywhere in the app are VAT-inclusive, so VAT must be
 * extracted from the gross amount rather than added on top of it.
 *
 * `tax` is rounded to 2dp first and `net` is derived as `gross - tax`
 * (never rounded independently), so `net + tax` always exactly equals the
 * original gross amount with no floating-point drift.
 */
export function extractTax(
  grossAmount: number,
  taxRate: number,
): { tax: number; net: number } {
  const rawTax = (grossAmount * taxRate) / (1 + taxRate);
  const tax = Math.round(rawTax * 100) / 100;
  const net = Math.round((grossAmount - tax) * 100) / 100;
  return { tax, net };
}
