import crypto from 'node:crypto';
import { env } from '../../config/env';

export const generateCsrfToken = (sessionId: string): string => {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const hmac = crypto
    .createHmac('sha256', env.CSRF_SECRET)
    .update(`${sessionId}:${rawToken}`)
    .digest('base64url');

  return `${rawToken}.${hmac}`;
};

export const verifyCsrfToken = (sessionId: string, token: string): boolean => {
  if (!token || typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [rawToken, providedHmac] = parts;

  const rawBuffer = Buffer.from(rawToken, 'base64url');
  if (rawBuffer.length !== 32) return false;

  const expectedHmac = crypto
    .createHmac('sha256', env.CSRF_SECRET)
    .update(`${sessionId}:${rawToken}`)
    .digest('base64url');

  const provided = Buffer.from(providedHmac, 'base64url');
  const expected = Buffer.from(expectedHmac, 'base64url');

  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(provided, expected);
};
