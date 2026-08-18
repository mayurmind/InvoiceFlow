import { describe, it, expect } from 'vitest';
import { assertCleanPreSuiteCounts } from './../../database/global-setup';

describe('Global Setup Contamination Guard', () => {
  const CORE_TABLES = ['users', 'clients', 'invoices'];

  it('passes when all counts are zero', () => {
    const counts = { users: 0, clients: 0, invoices: 0 };
    expect(() => assertCleanPreSuiteCounts(counts, CORE_TABLES)).not.toThrow();
  });

  it('throws with one contaminated table', () => {
    const counts = { users: 0, clients: 3, invoices: 0 };
    expect(() => assertCleanPreSuiteCounts(counts, CORE_TABLES)).toThrowError(
      /PRE-SUITE DATABASE CONTAMINATION/,
    );
    expect(() => assertCleanPreSuiteCounts(counts, CORE_TABLES)).toThrowError(
      /Table 'clients' contains 3 unexpected persistent rows/,
    );
  });

  it('throws with multiple contaminated tables with useful diagnostics', () => {
    const counts = { users: 1, clients: 0, invoices: 5 };
    try {
      assertCleanPreSuiteCounts(counts, CORE_TABLES);
      expect.fail('Should have thrown');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error);
      const e = error as Error;
      expect(e.message).toContain("Table 'users' contains 1 unexpected persistent rows.");
      expect(e.message).toContain("Table 'invoices' contains 5 unexpected persistent rows.");
      expect(e.message).not.toContain("Table 'clients'");
    }
  });

  it('does not treat zero values as contamination', () => {
    const counts = { users: 0, clients: 0, invoices: 0, extra: 0 };
    expect(() => assertCleanPreSuiteCounts(counts, CORE_TABLES)).not.toThrow();
  });
});
