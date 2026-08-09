import { describe, it, expect, vi } from 'vitest';
import { generateCsrfToken, verifyCsrfToken } from '../../../src/features/auth/csrf';

vi.mock('../../../src/config/env', () => ({
  env: {
    CSRF_SECRET: 'test-csrf-secret-min-32-chars-long-here',
  },
}));

describe('CSRF Primitives', () => {
  it('generates a token in two parts', () => {
    const token = generateCsrfToken('session-123');
    expect(token).toContain('.');
    const parts = token.split('.');
    expect(parts.length).toBe(2);
  });

  it('verifies a valid token for the same session', () => {
    const sessionId = 'session-123';
    const token = generateCsrfToken(sessionId);
    const isValid = verifyCsrfToken(sessionId, token);
    expect(isValid).toBe(true);
  });

  it('rejects a token for a different session', () => {
    const token = generateCsrfToken('session-123');
    const isValid = verifyCsrfToken('session-456', token);
    expect(isValid).toBe(false);
  });

  it('rejects a modified token', () => {
    const sessionId = 'session-123';
    const token = generateCsrfToken(sessionId);
    const parts = token.split('.');
    const modifiedToken = `${parts[0]}1.${parts[1]}`;
    const isValid = verifyCsrfToken(sessionId, modifiedToken);
    expect(isValid).toBe(false);
  });

  it('returns false instead of throwing for malformed attacker-controlled input', () => {
    const sessionId = 'session-123';
    const token = generateCsrfToken(sessionId);
    const parts = token.split('.');

    // Malform the HMAC part by providing a string that is a valid base64url but decodes to a different length
    const malformedHmac = 'a'.repeat(50);
    const modifiedToken = `${parts[0]}.${malformedHmac}`;

    expect(() => verifyCsrfToken(sessionId, modifiedToken)).not.toThrow();
    const isValid = verifyCsrfToken(sessionId, modifiedToken);
    expect(isValid).toBe(false);
  });
});
