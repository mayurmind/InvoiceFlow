import { Prisma } from '../../../generated/prisma/client';
import { InvoiceCalculationError } from './types';

const REGEX_MONEY = /^\d+(?:\.\d{1,2})?$/;
const REGEX_QUANTITY = /^\d+(?:\.\d{1,3})?$/;

// General check first to differentiate INVALID_DECIMAL from INVALID_SCALE
const REGEX_GENERAL_DECIMAL = /^\d+(?:\.\d+)?$/;

const MAX_MONEY = new Prisma.Decimal('9999999999.99');
const MAX_QUANTITY = new Prisma.Decimal('999999999.999');

/**
 * Validates generic unsigned decimal syntax.
 */
function isLexicallyValidDecimal(value: string): boolean {
  if (!value || value.trim() !== value || value.includes('e') || value.includes('E')) {
    return false;
  }
  return REGEX_GENERAL_DECIMAL.test(value);
}

export function parseMoney(value: string): Prisma.Decimal {
  if (!isLexicallyValidDecimal(value)) {
    throw new InvoiceCalculationError('INVALID_DECIMAL', `Invalid decimal syntax: ${value}`);
  }

  if (!REGEX_MONEY.test(value)) {
    throw new InvoiceCalculationError(
      'INVALID_SCALE',
      `Excessive decimal scale for money: ${value}`,
    );
  }

  const parsed = new Prisma.Decimal(value);

  // Unsigned regex guarantees no negative zero inputs, but we check ranges anyway
  assertMoneyRange(parsed);

  return parsed;
}

export function parseQuantity(value: string): Prisma.Decimal {
  if (!isLexicallyValidDecimal(value)) {
    throw new InvoiceCalculationError('INVALID_DECIMAL', `Invalid decimal syntax: ${value}`);
  }

  if (!REGEX_QUANTITY.test(value)) {
    throw new InvoiceCalculationError(
      'INVALID_SCALE',
      `Excessive decimal scale for quantity: ${value}`,
    );
  }

  const parsed = new Prisma.Decimal(value);

  if (parsed.isZero()) {
    throw new InvoiceCalculationError('INVALID_QUANTITY', `Quantity must be greater than zero`);
  }

  if (parsed.greaterThan(MAX_QUANTITY)) {
    throw new InvoiceCalculationError('VALUE_OUT_OF_RANGE', `Quantity exceeds maximum limit`);
  }

  return parsed;
}

export function parseGstRate(value: string): Prisma.Decimal {
  if (!isLexicallyValidDecimal(value)) {
    throw new InvoiceCalculationError('INVALID_DECIMAL', `Invalid decimal syntax: ${value}`);
  }

  if (!REGEX_MONEY.test(value)) {
    throw new InvoiceCalculationError(
      'INVALID_SCALE',
      `Excessive decimal scale for GST rate: ${value}`,
    );
  }

  const parsed = new Prisma.Decimal(value);
  assertMoneyRange(parsed);
  return parsed;
}

export function assertMoneyRange(value: Prisma.Decimal): void {
  if (value.greaterThan(MAX_MONEY)) {
    throw new InvoiceCalculationError('VALUE_OUT_OF_RANGE', `Value exceeds maximum limit`);
  }
}

export function assertDerivedMoneyRange(value: Prisma.Decimal): void {
  if (value.greaterThan(MAX_MONEY)) {
    throw new InvoiceCalculationError(
      'CALCULATION_OVERFLOW',
      `Derived value exceeds maximum limit`,
    );
  }
}

export function roundMoney(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function serializeMoney(value: Prisma.Decimal): string {
  // Prisma.Decimal handles this perfectly without emitting -0.00 if we constructed it safely.
  // toFixed(2) is used purely for formatting to 2 decimal places.
  return value.toFixed(2);
}
