import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createAuthCookie,
  clearAuthCookie,
  parseTimeToMs,
} from '../../../src/features/auth/cookies';
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

  it('parseTimeToMs converts correctly', () => {
    expect(parseTimeToMs('15m')).toBe(15 * 60 * 1000);
    expect(parseTimeToMs('7d')).toBe(7 * 24 * 60 * 60 * 1000);
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
});
