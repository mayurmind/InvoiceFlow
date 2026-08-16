import { describe, it, expect } from 'vitest';
import { Prisma } from '../../../../src/generated/prisma/client';
import {
  parseMoney,
  parseQuantity,
  parseGstRate,
  roundMoney,
  serializeMoney,
} from '../../../../src/features/invoices/domain/decimal';

describe('Decimal Domain Utilities', () => {
  describe('A. VALID SYNTAX', () => {
    it('accepts valid money syntax', () => {
      expect(serializeMoney(parseMoney('0'))).toBe('0.00');
      expect(serializeMoney(parseMoney('0.00'))).toBe('0.00');
      expect(serializeMoney(parseMoney('1'))).toBe('1.00');
      expect(serializeMoney(parseMoney('1.5'))).toBe('1.50');
      expect(serializeMoney(parseMoney('1.50'))).toBe('1.50');
      expect(serializeMoney(parseMoney('001.00'))).toBe('1.00');
    });

    it('accepts valid quantity syntax', () => {
      expect(parseQuantity('0.125').toString()).toBe('0.125');
      expect(parseQuantity('1').toString()).toBe('1');
    });
  });

  describe('B. INVALID DECIMAL', () => {
    const invalidInputs = [
      '',
      ' ',
      ' 10',
      '10 ',
      '+10',
      '-10',
      '-0',
      '-0.00',
      '.5',
      '10.',
      '1e3',
      '1E3',
      '1,000.00',
      '₹100',
      '0x10',
      'NaN',
      'Infinity',
      '10abc',
    ];

    it.each(invalidInputs)('rejects %s as INVALID_DECIMAL', (input) => {
      expect(() => parseMoney(input)).toThrowError('INVALID_DECIMAL');
      expect(() => parseQuantity(input)).toThrowError('INVALID_DECIMAL');
    });
  });

  describe('C. INVALID SCALE', () => {
    it('rejects money with excessive scale as INVALID_SCALE', () => {
      expect(() => parseMoney('10.000')).toThrowError('INVALID_SCALE');
    });

    it('rejects quantity with excessive scale as INVALID_SCALE', () => {
      expect(() => parseQuantity('1.0000')).toThrowError('INVALID_SCALE');
    });

    it('rejects GST rate with excessive scale as INVALID_SCALE', () => {
      expect(() => parseGstRate('18.000')).toThrowError('INVALID_SCALE');
    });
  });

  describe('D. INPUT RANGE', () => {
    it('accepts exact max money', () => {
      expect(parseMoney('9999999999.99').toString()).toBe('9999999999.99');
    });

    it('rejects money above max as VALUE_OUT_OF_RANGE', () => {
      expect(() => parseMoney('10000000000.00')).toThrowError('VALUE_OUT_OF_RANGE');
    });

    it('accepts exact max quantity', () => {
      expect(parseQuantity('999999999.999').toString()).toBe('999999999.999');
    });

    it('rejects quantity above max as VALUE_OUT_OF_RANGE', () => {
      expect(() => parseQuantity('1000000000.000')).toThrowError('VALUE_OUT_OF_RANGE');
    });

    it('rejects zero quantity as INVALID_QUANTITY', () => {
      expect(() => parseQuantity('0')).toThrowError('INVALID_QUANTITY');
      expect(() => parseQuantity('0.000')).toThrowError('INVALID_QUANTITY');
    });
  });

  describe('E. ROUND_HALF_UP', () => {
    it('rounds midpoint and below exactly according to ROUND_HALF_UP', () => {
      expect(serializeMoney(roundMoney(new Prisma.Decimal('1.004')))).toBe('1.00');
      expect(serializeMoney(roundMoney(new Prisma.Decimal('1.005')))).toBe('1.01');
      expect(serializeMoney(roundMoney(new Prisma.Decimal('1.006')))).toBe('1.01');
      expect(serializeMoney(roundMoney(new Prisma.Decimal('0.004')))).toBe('0.00');
      expect(serializeMoney(roundMoney(new Prisma.Decimal('0.005')))).toBe('0.01');
    });
  });

  describe('F. SERIALIZATION', () => {
    it('serializes exactly to 2 decimal places canonical form', () => {
      expect(serializeMoney(new Prisma.Decimal('0'))).toBe('0.00');
      expect(serializeMoney(new Prisma.Decimal('1'))).toBe('1.00');
      expect(serializeMoney(new Prisma.Decimal('1.5'))).toBe('1.50');
      expect(serializeMoney(new Prisma.Decimal('1.25'))).toBe('1.25');
    });
  });
});
