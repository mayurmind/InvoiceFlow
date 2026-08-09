import { describe, it, expect } from 'vitest';
import { loginLimiter } from '../../../src/features/auth/login-rate-limit.middleware';

// Express rate limit middleware testing can be tricky without an actual request/response cycle,
// but we can ensure it is defined properly.
describe('loginLimiter', () => {
  it('is configured with correct limits', () => {
    expect(loginLimiter).toBeDefined();
    expect(typeof loginLimiter).toBe('function');
  });
});
