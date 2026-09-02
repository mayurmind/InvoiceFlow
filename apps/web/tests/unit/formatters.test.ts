import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, formatPercentage } from '@/lib/formatters';

describe('Formatters', () => {
  describe('formatCurrency', () => {
    it('formats numbers and decimal strings as INR', () => {
      expect(formatCurrency('1000')).toContain('1,000.00');
      expect(formatCurrency(25000.5)).toContain('25,000.50');
      expect(formatCurrency('0.00')).toContain('0.00');
      expect(formatCurrency(null)).toContain('0.00');
    });
  });

  describe('formatDate', () => {
    it('formats ISO dates accurately', () => {
      expect(formatDate('2026-03-15')).toMatch(/15\s+Mar\s+2026/);
      expect(formatDate(null)).toBe('—');
    });
  });

  describe('formatPercentage', () => {
    it('formats tax rates with percent symbol', () => {
      expect(formatPercentage('18.00')).toBe('18%');
      expect(formatPercentage(5)).toBe('5%');
      expect(formatPercentage(null)).toBe('0%');
    });
  });
});
