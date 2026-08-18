import { getFinancialYear } from '../../../src/features/invoices/utils/financial-year.util';

describe('financial-year.util', () => {
  describe('getFinancialYear', () => {
    it('returns 25-26 for 2026-03-31', () => {
      expect(getFinancialYear(new Date(Date.UTC(2026, 2, 31)))).toBe('25-26');
    });

    it('returns 26-27 for 2026-04-01', () => {
      expect(getFinancialYear(new Date(Date.UTC(2026, 3, 1)))).toBe('26-27');
    });

    it('returns 26-27 for 2027-03-31', () => {
      expect(getFinancialYear(new Date(Date.UTC(2027, 2, 31)))).toBe('26-27');
    });

    it('returns 27-28 for 2027-04-01', () => {
      expect(getFinancialYear(new Date(Date.UTC(2027, 3, 1)))).toBe('27-28');
    });

    it('returns 27-28 for 2028-02-29 (leap year)', () => {
      expect(getFinancialYear(new Date(Date.UTC(2028, 1, 29)))).toBe('27-28');
    });

    it('returns 26-27 for 2026-12-31', () => {
      expect(getFinancialYear(new Date(Date.UTC(2026, 11, 31)))).toBe('26-27');
    });

    it('returns 25-26 for 2026-01-01', () => {
      expect(getFinancialYear(new Date(Date.UTC(2026, 0, 1)))).toBe('25-26');
    });
  });
});
