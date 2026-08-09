import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  validatePasswordPolicy,
} from '../../../src/features/auth/password';

describe('Password Primitives', () => {
  describe('validatePasswordPolicy', () => {
    it('throws if password is too short', () => {
      expect(() => validatePasswordPolicy('short123')).toThrow(/15 characters/);
    });

    it('throws if password is too long', () => {
      const longPassword = 'a'.repeat(129);
      expect(() => validatePasswordPolicy(longPassword)).toThrow(/128 characters/);
    });

    it('allows valid passwords with spaces and unicode', () => {
      expect(() => validatePasswordPolicy('this is a valid phrase ✨')).not.toThrow();
    });
  });

  describe('Hashing and Verification', () => {
    it('hashes and verifies a correct password', async () => {
      const password = 'this is a secure password';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);

      const isValid = await verifyPassword(hash, password);
      expect(isValid).toBe(true);
    });

    it('rejects an incorrect password', async () => {
      const hash = await hashPassword('correct password phrase');
      const isValid = await verifyPassword(hash, 'wrong password phrase');
      expect(isValid).toBe(false);
    });

    it('generates different hashes for the same password due to salting', async () => {
      const password = 'consistent password phrase';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      expect(hash1).not.toBe(hash2);
    });
  });
});
