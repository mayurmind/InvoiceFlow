import { describe, it, expect } from 'vitest';
import {
  validateSafeTestDatabaseUrl,
  resolveRuntimeDatabaseUrl,
} from '../../../src/config/database-url';

describe('Database URL Safety', () => {
  describe('SAFE CASES', () => {
    it('TEST-01: postgresql:// with localhost:5432/invoiceflow_test passes', () => {
      const url = 'postgresql://test:test@localhost:5432/invoiceflow_test';
      expect(validateSafeTestDatabaseUrl(url)).toBe(url);
    });

    it('TEST-02: postgres:// with localhost:5432/invoiceflow_test passes', () => {
      const url = 'postgres://test:test@localhost:5432/invoiceflow_test';
      expect(validateSafeTestDatabaseUrl(url)).toBe(url);
    });

    it('TEST-03: 127.0.0.1:5432/invoiceflow_test passes', () => {
      const url = 'postgresql://test:test@127.0.0.1:5432/invoiceflow_test';
      expect(validateSafeTestDatabaseUrl(url)).toBe(url);
    });
  });

  describe('ENVIRONMENT SELECTION', () => {
    const defaultDatabaseUrl = 'postgresql://runtime:runtime@production.example.com:5432/db';
    const safeTestUrl = 'postgresql://test:test@localhost:5432/invoiceflow_test';

    it('TEST-04: development returns DATABASE_URL unchanged', () => {
      expect(
        resolveRuntimeDatabaseUrl({
          nodeEnv: 'development',
          databaseUrl: defaultDatabaseUrl,
          testDatabaseUrl: safeTestUrl,
        }),
      ).toBe(defaultDatabaseUrl);
    });

    it('TEST-05: production returns DATABASE_URL unchanged', () => {
      expect(
        resolveRuntimeDatabaseUrl({
          nodeEnv: 'production',
          databaseUrl: defaultDatabaseUrl,
          testDatabaseUrl: safeTestUrl,
        }),
      ).toBe(defaultDatabaseUrl);
    });

    it('TEST-06: test mode selects TEST_DATABASE_URL instead of DATABASE_URL', () => {
      expect(
        resolveRuntimeDatabaseUrl({
          nodeEnv: 'test',
          databaseUrl: defaultDatabaseUrl,
          testDatabaseUrl: safeTestUrl,
        }),
      ).toBe(safeTestUrl);
    });

    it('TEST-07: test mode can receive an unsafe/remote-looking DATABASE_URL while still selecting the safe TEST_DATABASE_URL', () => {
      expect(
        resolveRuntimeDatabaseUrl({
          nodeEnv: 'test',
          databaseUrl: 'postgresql://evil:evil@hack.example.com:5432/prod',
          testDatabaseUrl: safeTestUrl,
        }),
      ).toBe(safeTestUrl);
    });
  });

  describe('MISSING / MALFORMED', () => {
    const defaultDatabaseUrl = 'postgresql://runtime:runtime@production.example.com:5432/db';

    it('TEST-08: missing TEST_DATABASE_URL in test mode fails', () => {
      expect(() =>
        resolveRuntimeDatabaseUrl({
          nodeEnv: 'test',
          databaseUrl: defaultDatabaseUrl,
        }),
      ).toThrow('TEST_DATABASE_URL is required when NODE_ENV=test.');
    });

    it('TEST-09: empty TEST_DATABASE_URL fails', () => {
      expect(() => validateSafeTestDatabaseUrl('')).toThrow(
        'TEST_DATABASE_URL is missing or empty.',
      );
    });

    it('TEST-10: malformed URL fails', () => {
      expect(() => validateSafeTestDatabaseUrl('not-a-url')).toThrow(
        'TEST_DATABASE_URL is invalid.',
      );
    });

    it('TEST-11: non-PostgreSQL protocol fails', () => {
      expect(() =>
        validateSafeTestDatabaseUrl('mysql://test:test@localhost:5432/invoiceflow_test'),
      ).toThrow('TEST_DATABASE_URL must use postgresql: or postgres: protocol.');
    });
  });

  describe('TARGET SAFETY', () => {
    it('TEST-12: Supabase direct host rejected', () => {
      expect(() =>
        validateSafeTestDatabaseUrl(
          'postgresql://test:test@db.example.supabase.co:5432/invoiceflow_test',
        ),
      ).toThrow('TEST_DATABASE_URL must target localhost or 127.0.0.1.');
    });

    it('TEST-13: Supabase pooler/remote hostname rejected', () => {
      expect(() =>
        validateSafeTestDatabaseUrl(
          'postgresql://test:test@aws-0-region.pooler.supabase.com:5432/invoiceflow_test',
        ),
      ).toThrow('TEST_DATABASE_URL must target localhost or 127.0.0.1.');
    });

    it('TEST-14: invoiceflow_dev database rejected', () => {
      expect(() =>
        validateSafeTestDatabaseUrl('postgresql://test:test@localhost:5432/invoiceflow_dev'),
      ).toThrow('TEST_DATABASE_URL must target /invoiceflow_test database.');
    });

    it('TEST-15: postgres database rejected', () => {
      expect(() =>
        validateSafeTestDatabaseUrl('postgresql://test:test@localhost:5432/postgres'),
      ).toThrow('TEST_DATABASE_URL must target /invoiceflow_test database.');
    });

    it('TEST-16: wrong database name rejected', () => {
      expect(() =>
        validateSafeTestDatabaseUrl('postgresql://test:test@localhost:5432/other'),
      ).toThrow('TEST_DATABASE_URL must target /invoiceflow_test database.');
    });

    it('TEST-17: wrong port rejected', () => {
      expect(() =>
        validateSafeTestDatabaseUrl('postgresql://test:test@localhost:6543/invoiceflow_test'),
      ).toThrow('TEST_DATABASE_URL must target port 5432.');
    });

    it('TEST-18: remote/public IP rejected', () => {
      expect(() =>
        validateSafeTestDatabaseUrl('postgresql://test:test@8.8.8.8:5432/invoiceflow_test'),
      ).toThrow('TEST_DATABASE_URL must target localhost or 127.0.0.1.');
    });

    it('TEST-19: query parameters rejected', () => {
      expect(() =>
        validateSafeTestDatabaseUrl(
          'postgresql://test:test@localhost:5432/invoiceflow_test?sslmode=require',
        ),
      ).toThrow('TEST_DATABASE_URL cannot contain query parameters.');
    });

    it('TEST-20: URL fragment rejected', () => {
      expect(() =>
        validateSafeTestDatabaseUrl(
          'postgresql://test:test@localhost:5432/invoiceflow_test#fragment',
        ),
      ).toThrow('TEST_DATABASE_URL cannot contain a fragment.');
    });
  });

  describe('SECRET REDACTION', () => {
    it('TEST-21: thrown error message does not contain the test password', () => {
      const secret = 'DO_NOT_LEAK_P2_6_SECRET';
      const unsafeUrl = `postgresql://user:${secret}@db.example.supabase.co:5432/invoiceflow_test`;

      try {
        validateSafeTestDatabaseUrl(unsafeUrl);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const msg = (error as Error).message;
        expect(msg).not.toContain(secret);
      }
    });

    it('TEST-22: thrown error message does not contain the full TEST_DATABASE_URL', () => {
      const secret = 'DO_NOT_LEAK_P2_6_SECRET';
      const unsafeUrl = `postgresql://user:${secret}@db.example.supabase.co:5432/invoiceflow_test`;

      try {
        validateSafeTestDatabaseUrl(unsafeUrl);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const msg = (error as Error).message;
        expect(msg).not.toContain(unsafeUrl);
      }
    });
  });
});
