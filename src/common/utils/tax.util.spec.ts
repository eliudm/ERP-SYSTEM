import { extractTax, addTax, computeLineTax } from './tax.util';

describe('tax.util', () => {
  describe('extractTax', () => {
    it('extracts VAT from a tax-inclusive amount', () => {
      expect(extractTax(200, 0.16)).toEqual({ tax: 27.59, net: 172.41 });
    });

    it('returns zero tax for a zero rate', () => {
      expect(extractTax(50, 0)).toEqual({ tax: 0, net: 50 });
    });

    it('keeps net + tax exactly equal to the gross amount', () => {
      const { tax, net } = extractTax(200, 0.1);
      expect(net + tax).toBeCloseTo(200, 2);
    });
  });

  describe('addTax', () => {
    it('adds VAT on top of a tax-exclusive amount', () => {
      expect(addTax(200, 0.1)).toEqual({ tax: 20, gross: 220 });
    });

    it('returns zero tax for a zero rate', () => {
      expect(addTax(50, 0)).toEqual({ tax: 0, gross: 50 });
    });
  });

  describe('computeLineTax', () => {
    it('extracts tax when isInclusive is true', () => {
      expect(computeLineTax(200, 0.16, true)).toEqual({
        taxAmount: 27.59,
        net: 172.41,
        gross: 200,
      });
    });

    it('adds tax on top when isInclusive is false', () => {
      expect(computeLineTax(200, 0.1, false)).toEqual({
        taxAmount: 20,
        net: 200,
        gross: 220,
      });
    });
  });
});
