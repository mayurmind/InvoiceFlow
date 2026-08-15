import { describe, it, expect } from 'vitest';
import { updateBusinessSettingsSchema } from '../../../src/features/business-settings/business-settings.schemas';

describe('businessSettingsSchemas', () => {
  const validBasePayload = {
    legalName: 'Test Legal Name',
    displayName: 'Test Display Name',
    addressLine1: 'Test Address 1',
    city: 'Mumbai',
    state: 'Maharashtra',
    stateCode: '27',
    postalCode: '400001',
    country: 'India',
    invoicePrefix: 'INV',
    defaultDueDays: 15,
  };

  it('validates a minimum valid payload', () => {
    const result = updateBusinessSettingsSchema.body.safeParse(validBasePayload);
    expect(result.success).toBe(true);
  });

  it('validates PAN format', () => {
    const result = updateBusinessSettingsSchema.body.safeParse({
      ...validBasePayload,
      pan: 'ABCDE1234F',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid PAN format', () => {
    const result = updateBusinessSettingsSchema.body.safeParse({
      ...validBasePayload,
      pan: 'INVALIDPAN',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown state code', () => {
    const result = updateBusinessSettingsSchema.body.safeParse({
      ...validBasePayload,
      stateCode: '99',
    });
    expect(result.success).toBe(false);
  });

  describe('GSTIN validations', () => {
    it('validates a correct GSTIN matching stateCode', () => {
      const result = updateBusinessSettingsSchema.body.safeParse({
        ...validBasePayload,
        stateCode: '27',
        gstin: '27ABCDE1234F1Z5',
      });
      expect(result.success).toBe(true);
    });

    it('rejects GSTIN not matching stateCode', () => {
      const result = updateBusinessSettingsSchema.body.safeParse({
        ...validBasePayload,
        stateCode: '29', // Karnataka
        gstin: '27ABCDE1234F1Z5', // Starts with 27
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('first two characters must match');
      }
    });

    it('rejects GSTIN with invalid embedded PAN', () => {
      const result = updateBusinessSettingsSchema.body.safeParse({
        ...validBasePayload,
        stateCode: '27',
        gstin: '27INVALIDPAN1Z5',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('embedded PAN is invalid');
      }
    });

    it('validates when GSTIN embedded PAN matches provided PAN', () => {
      const result = updateBusinessSettingsSchema.body.safeParse({
        ...validBasePayload,
        stateCode: '27',
        pan: 'ABCDE1234F',
        gstin: '27ABCDE1234F1Z5',
      });
      expect(result.success).toBe(true);
    });

    it('rejects when GSTIN embedded PAN does not match provided PAN', () => {
      const result = updateBusinessSettingsSchema.body.safeParse({
        ...validBasePayload,
        stateCode: '27',
        pan: 'ZYXWV9876U',
        gstin: '27ABCDE1234F1Z5',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('does not match the provided PAN');
      }
    });
  });

  describe('Other formats', () => {
    it('validates IFSC', () => {
      const result = updateBusinessSettingsSchema.body.safeParse({
        ...validBasePayload,
        bankIfsc: 'HDFC0001234',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid IFSC', () => {
      const result = updateBusinessSettingsSchema.body.safeParse({
        ...validBasePayload,
        bankIfsc: 'HDF0001234',
      });
      expect(result.success).toBe(false);
    });

    it('validates UPI', () => {
      const result = updateBusinessSettingsSchema.body.safeParse({
        ...validBasePayload,
        upiId: 'john.doe@okhdfcbank',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid UPI', () => {
      const result = updateBusinessSettingsSchema.body.safeParse({
        ...validBasePayload,
        upiId: 'notaupi',
      });
      expect(result.success).toBe(false);
    });

    it('validates invoicePrefix', () => {
      const result = updateBusinessSettingsSchema.body.safeParse({
        ...validBasePayload,
        invoicePrefix: 'INV-1',
      });
      expect(result.success).toBe(true);
    });
  });
});
