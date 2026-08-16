import { describe, it, expect } from 'vitest';
import {
  createClientSchema,
  clientListQuerySchema,
  clientIdParamSchema,
  clientLifecycleBodySchema,
} from '../../../src/features/clients/clients.schemas';

/** Type-safe property omitter — avoids unused destructuring warnings. */
function omit<T extends object, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) delete (result as Record<string, unknown>)[key as string];
  return result as Omit<T, K>;
}

describe('Clients Schemas', () => {
  const validPayload = {
    name: 'Test Client',
    email: 'client@example.com',
    phone: '1234567890',
    gstin: '27AADCB2230M1Z2',
    pan: 'AADCB2230M',
    addressLine1: 'Line 1',
    addressLine2: null,
    city: 'Mumbai',
    state: 'Maharashtra',
    stateCode: '27',
    postalCode: '400001',
    country: 'India' as const,
    notes: 'Test notes',
  };

  describe('createClientSchema / updateClientSchema', () => {
    it('should validate a valid payload and canonicalize state name', () => {
      const result = createClientSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.state).toBe('Maharashtra');
      }
    });

    it('should reject unknown fields', () => {
      const result = createClientSchema.safeParse({
        ...validPayload,
        unknownField: 'value',
      });
      expect(result.success).toBe(false);
    });

    it('should reject server-controlled fields', () => {
      const fields = [
        'id',
        'createdByUserId',
        'isArchived',
        'archivedAt',
        'createdAt',
        'updatedAt',
      ];
      fields.forEach((field) => {
        const payload = { ...validPayload } as Record<string, unknown>;
        payload[field] = 'value';
        const result = createClientSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });
    });

    it('should accept missing optional fields and normalize them to null', () => {
      const requiredOnly = omit(
        validPayload,
        'email',
        'phone',
        'gstin',
        'pan',
        'addressLine2',
        'notes',
      );
      const result = createClientSchema.safeParse(requiredOnly);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBeNull();
        expect(result.data.phone).toBeNull();
        expect(result.data.gstin).toBeNull();
        expect(result.data.pan).toBeNull();
        expect(result.data.addressLine2).toBeNull();
        expect(result.data.notes).toBeNull();
      }
    });

    it('should reject missing state', () => {
      const withoutState = omit(validPayload, 'state');
      const result = createClientSchema.safeParse(withoutState);
      expect(result.success).toBe(false);
    });

    it('should reject state/stateCode mismatch', () => {
      const result = createClientSchema.safeParse({
        ...validPayload,
        state: 'Karnataka', // does not match stateCode 27 (Maharashtra)
        stateCode: '27',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid stateCode', () => {
      const result = createClientSchema.safeParse({ ...validPayload, stateCode: '99' });
      expect(result.success).toBe(false);
    });

    it('should reject missing country', () => {
      const withoutCountry = omit(validPayload, 'country');
      const result = createClientSchema.safeParse(withoutCountry);
      expect(result.success).toBe(false);
    });

    it('should reject country other than India', () => {
      const result = createClientSchema.safeParse({ ...validPayload, country: 'USA' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid PAN format', () => {
      const result = createClientSchema.safeParse({ ...validPayload, pan: 'INVALIDPAN' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid GSTIN length', () => {
      const result = createClientSchema.safeParse({ ...validPayload, gstin: '27AADCB2230M1Z' });
      expect(result.success).toBe(false);
    });

    it('should reject GSTIN if embedded PAN is invalid', () => {
      const result = createClientSchema.safeParse({ ...validPayload, gstin: '27INVALID23M1Z2' });
      expect(result.success).toBe(false);
    });

    it('should reject GSTIN if state prefix does not match stateCode', () => {
      const result = createClientSchema.safeParse({
        ...validPayload,
        state: 'Maharashtra',
        stateCode: '27',
        gstin: '29AADCB2230M1Z2',
      });
      expect(result.success).toBe(false);
    });

    it('should reject GSTIN if embedded PAN does not match supplied PAN', () => {
      const result = createClientSchema.safeParse({ ...validPayload, pan: 'ABCDE1234F' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid PIN code', () => {
      const result = createClientSchema.safeParse({ ...validPayload, postalCode: '000001' });
      expect(result.success).toBe(false);
    });

    it('should normalize email to lowercase and trim', () => {
      const result = createClientSchema.safeParse({ ...validPayload, email: ' TEST@EXAMPLE.COM ' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
      }
    });

    it('should normalize PAN and GSTIN to uppercase', () => {
      const result = createClientSchema.safeParse({
        ...validPayload,
        pan: 'aadcb2230m',
        gstin: '27aadcb2230m1z2',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pan).toBe('AADCB2230M');
        expect(result.data.gstin).toBe('27AADCB2230M1Z2');
      }
    });

    it('should reject notes exceeding 5000 chars', () => {
      const result = createClientSchema.safeParse({ ...validPayload, notes: 'a'.repeat(5001) });
      expect(result.success).toBe(false);
    });

    it('should accept valid state/stateCode pairs for different states', () => {
      const result = createClientSchema.safeParse({
        ...validPayload,
        state: 'Karnataka',
        stateCode: '29',
        gstin: null,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.state).toBe('Karnataka');
        expect(result.data.stateCode).toBe('29');
      }
    });
  });

  describe('clientListQuerySchema', () => {
    it('should parse valid query and provide defaults', () => {
      const result = clientListQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.status).toBe('active');
      }
    });

    it('should reject page < 1', () => {
      const result = clientListQuerySchema.safeParse({ page: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject limit > 100', () => {
      const result = clientListQuerySchema.safeParse({ limit: 101 });
      expect(result.success).toBe(false);
    });

    it('should parse status active, archived, all', () => {
      ['active', 'archived', 'all'].forEach((status) => {
        const result = clientListQuerySchema.safeParse({ status });
        expect(result.success).toBe(true);
      });

      const invalid = clientListQuerySchema.safeParse({ status: 'invalid' });
      expect(invalid.success).toBe(false);
    });

    it('should validate stateCode', () => {
      const valid = clientListQuerySchema.safeParse({ stateCode: '27' });
      expect(valid.success).toBe(true);

      const invalid = clientListQuerySchema.safeParse({ stateCode: '99' });
      expect(invalid.success).toBe(false);
    });
  });

  describe('clientIdParamSchema', () => {
    it('should validate valid UUID', () => {
      const result = clientIdParamSchema.safeParse({
        clientId: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = clientIdParamSchema.safeParse({ clientId: 'invalid' });
      expect(result.success).toBe(false);
    });
  });

  describe('clientLifecycleBodySchema', () => {
    it('should accept no body', () => {
      const result = clientLifecycleBodySchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });

    it('should accept empty object', () => {
      const result = clientLifecycleBodySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject unexpected fields', () => {
      const result = clientLifecycleBodySchema.safeParse({ unexpected: true });
      expect(result.success).toBe(false);
    });
  });
});
