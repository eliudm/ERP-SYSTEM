/**
 * Prices entered anywhere in the system are VAT-inclusive, so VAT must be
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

/**
 * Adds VAT on top of a tax-exclusive (net) amount. Used for purchases where
 * the supplier quotes a price that does NOT already include VAT, unlike the
 * system-wide default of treating entered prices as VAT-inclusive.
 */
export function addTax(
  netAmount: number,
  taxRate: number,
): { tax: number; gross: number } {
  const tax = Math.round(netAmount * taxRate * 100) / 100;
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
): { taxAmount: number; net: number; gross: number } {
  if (isInclusive) {
    const { tax, net } = extractTax(amount, taxRate);
    return { taxAmount: tax, net, gross: amount };
  }
  const { tax, gross } = addTax(amount, taxRate);
  return { taxAmount: tax, net: amount, gross };
}
