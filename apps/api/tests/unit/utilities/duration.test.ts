import { describe, it, expect } from 'vitest';
import { parseDurationToMs } from '../../../src/utilities/duration';

describe('parseDurationToMs', () => {
  it('parses valid seconds', () => {
    expect(parseDurationToMs('30s')).toBe(30 * 1000);
  });

  it('parses valid minutes', () => {
    expect(parseDurationToMs('15m')).toBe(15 * 60 * 1000);
  });

  it('parses valid hours', () => {
    expect(parseDurationToMs('2h')).toBe(2 * 60 * 60 * 1000);
  });

  it('parses valid days', () => {
    expect(parseDurationToMs('7d')).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('rejects 0', () => {
    expect(() => parseDurationToMs('0s')).toThrow('Invalid duration format');
    expect(() => parseDurationToMs('0m')).toThrow('Invalid duration format');
  });

  it('rejects negative values', () => {
    expect(() => parseDurationToMs('-1m')).toThrow('Invalid duration format');
  });

  it('rejects unitless values', () => {
    expect(() => parseDurationToMs('15')).toThrow('Invalid duration format');
  });

  it('rejects decimals', () => {
    expect(() => parseDurationToMs('1.5m')).toThrow('Invalid duration format');
  });

  it('rejects unknown units', () => {
    expect(() => parseDurationToMs('15w')).toThrow('Invalid duration format');
    expect(() => parseDurationToMs('15z')).toThrow('Invalid duration format');
  });

  it('rejects whitespace variants', () => {
    expect(() => parseDurationToMs(' 15m')).toThrow('Invalid duration format');
    expect(() => parseDurationToMs('15m ')).toThrow('Invalid duration format');
    expect(() => parseDurationToMs('15 m')).toThrow('Invalid duration format');
  });

  it('rejects empty strings', () => {
    expect(() => parseDurationToMs('')).toThrow('Invalid duration format');
  });

  it('rejects non-safe-integer results', () => {
    // This value is syntactically valid but exceeds Number.MAX_SAFE_INTEGER when converted
    expect(() => parseDurationToMs('9007199254740992m')).toThrow(
      'Duration value exceeds safe integer limits',
    );
  });
});
