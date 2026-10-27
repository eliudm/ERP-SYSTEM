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

/**
 * Adds VAT on top of a tax-exclusive (net) amount. Used for purchases where
 * the supplier quotes a price that does NOT already include VAT.
 */
export function addTax(
  netAmount: number,
  taxRate: number,
  scale: number = 1,
): { tax: number; gross: number } {
  const rate = taxRate / scale;
  const tax = Math.round(netAmount * rate * 100) / 100;
  const gross = Math.round((netAmount + tax) * 100) / 100;
  return { tax, gross };
}

/**
 * Picks the extract-vs-add branch for a purchase line based on whether its
 * price was quoted inclusive of VAT or not.
 */
export function computeLineTax(
  amount: number,
  taxRate: number,
  isInclusive: boolean,
  scale: number = 1,
): { taxAmount: number; net: number; gross: number } {
  if (isInclusive) {
    const { tax, net } = extractTax(amount, taxRate, scale);
    return { taxAmount: tax, net, gross: amount };
  }
  const { tax, gross } = addTax(amount, taxRate, scale);
  return { taxAmount: tax, net: amount, gross };
}
