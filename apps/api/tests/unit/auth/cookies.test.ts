import { describe, it, expect, vi, afterEach } from 'vitest';
import { createAuthCookie, clearAuthCookie } from '../../../src/features/auth/cookies';
import { env } from '../../../src/config/env';

vi.mock('../../../src/config/env', () => ({
  env: {
    ACCESS_TOKEN_TTL: '15m',
    REFRESH_TOKEN_TTL: '7d',
    NODE_ENV: 'development',
  },
}));

describe('Cookie Primitives', () => {
  afterEach(() => {
    env.NODE_ENV = 'development';
  });

  it('createAuthCookie creates development cookies without secure and host prefix', () => {
    const cookie = createAuthCookie('access', 'token-value');
    expect(cookie.name).toBe('invoiceflow-access');
    expect(cookie.value).toBe('token-value');
    expect(cookie.options.secure).toBe(false);
    expect(cookie.options.httpOnly).toBe(true);
    expect(cookie.options.sameSite).toBe('lax');
  });

  it('createAuthCookie creates production cookies with secure and host prefix', () => {
    env.NODE_ENV = 'production';
    const cookie = createAuthCookie('refresh', 'refresh-value');
    expect(cookie.name).toBe('__Host-invoiceflow-refresh');
    expect(cookie.value).toBe('refresh-value');
    expect(cookie.options.secure).toBe(true);
    expect(cookie.options.httpOnly).toBe(true);
    expect(cookie.options.sameSite).toBe('lax');
  });

  it('clearAuthCookie sets maxAge to 0 and empties value', () => {
    const cookie = clearAuthCookie('access');
    expect(cookie.value).toBe('');
    expect(cookie.options.maxAge).toBe(0);
  });

  describe('maxAgeMsOverride', () => {
    it('uses normal defaults if not provided', () => {
      const cookie = createAuthCookie('access', 'token');
      expect(cookie.options.maxAge).toBe(15 * 60 * 1000); // 15m
    });

    it('uses valid override if provided', () => {
      const cookie = createAuthCookie('refresh', 'token', 5000);
      expect(cookie.options.maxAge).toBe(5000);
    });

    it('supports 1ms override', () => {
      const cookie = createAuthCookie('refresh', 'token', 1);
      expect(cookie.options.maxAge).toBe(1);
    });

    it('rejects zero', () => {
      expect(() => createAuthCookie('refresh', 'token', 0)).toThrow('Invalid maxAgeMs override');
    });

    it('rejects negative', () => {
      expect(() => createAuthCookie('refresh', 'token', -5000)).toThrow(
        'Invalid maxAgeMs override',
      );
    });

    it('rejects unsafe integer', () => {
      expect(() => createAuthCookie('refresh', 'token', Number.MAX_SAFE_INTEGER + 1)).toThrow(
        'Invalid maxAgeMs override',
      );
      expect(() => createAuthCookie('refresh', 'token', 5000.5)).toThrow(
        'Invalid maxAgeMs override',
      );
    });
  });
});
