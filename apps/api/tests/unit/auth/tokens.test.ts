import { describe, it, expect, vi } from 'vitest';
import {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshCredential,
  hashRefreshCredential,
} from '../../../src/features/auth/tokens';
import { env } from '../../../src/config/env';
import jwt from 'jsonwebtoken';

vi.mock('../../../src/config/env', () => ({
  env: {
    ACCESS_TOKEN_SECRET: 'test-access-secret-min-32-chars-long-here',
    REFRESH_TOKEN_SECRET: 'test-refresh-secret-min-32-chars-long-here',
    ACCESS_TOKEN_TTL: '15m',
    REFRESH_TOKEN_TTL: '7d',
    JWT_ISSUER: 'invoiceflow-api',
    JWT_AUDIENCE: 'invoiceflow-web',
  },
}));

describe('Tokens Primitives', () => {
  describe('AccessToken', () => {
    it('generates and verifies a valid access token', () => {
      const payload = { sub: 'user-123', sid: 'session-456', role: 'STAFF' };
      const token = generateAccessToken(payload);

      const decoded = verifyAccessToken(token);
      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.sid).toBe(payload.sid);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.type).toBe('access');
      expect(decoded.iss).toBe(env.JWT_ISSUER);
      expect(decoded.aud).toBe(env.JWT_AUDIENCE);
    });

    it('rejects an invalid token', () => {
      expect(() => verifyAccessToken('invalid.token.here')).toThrow();
    });

    it('rejects a token signed with the wrong algorithm', () => {
      const payload = { sub: 'user-123', sid: 'session-456', role: 'STAFF', type: 'access' };
      // Sign with HS512 instead of HS256
      const token = jwt.sign(payload, env.ACCESS_TOKEN_SECRET, {
        algorithm: 'HS512',
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      });

      expect(() => verifyAccessToken(token)).toThrow(/invalid algorithm/i);
    });

    it('rejects a token with a missing sub', () => {
      const payload = { sid: 'session-456', role: 'STAFF', type: 'access' };
      const token = jwt.sign(payload, env.ACCESS_TOKEN_SECRET, {
        algorithm: 'HS256',
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      });

      expect(() => verifyAccessToken(token)).toThrow('Missing or invalid sub claim');
    });

    it('rejects a token with a missing sid', () => {
      const payload = { sub: 'user-123', role: 'STAFF', type: 'access' };
      const token = jwt.sign(payload, env.ACCESS_TOKEN_SECRET, {
        algorithm: 'HS256',
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      });

      expect(() => verifyAccessToken(token)).toThrow('Missing or invalid sid claim');
    });

    it('rejects a token with an invalid role', () => {
      const payload = { sub: 'user-123', sid: 'session-456', role: 'ADMIN', type: 'access' };
      const token = jwt.sign(payload, env.ACCESS_TOKEN_SECRET, {
        algorithm: 'HS256',
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      });

      expect(() => verifyAccessToken(token)).toThrow('Missing or invalid role claim');
    });

    it('rejects a token with a missing role', () => {
      const payload = { sub: 'user-123', sid: 'session-456', type: 'access' };
      const token = jwt.sign(payload, env.ACCESS_TOKEN_SECRET, {
        algorithm: 'HS256',
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      });

      expect(() => verifyAccessToken(token)).toThrow('Missing or invalid role claim');
    });

    it('rejects a token with the wrong type', () => {
      const payload = { sub: 'user-123', sid: 'session-456', role: 'STAFF', type: 'refresh' };
      const token = jwt.sign(payload, env.ACCESS_TOKEN_SECRET, {
        algorithm: 'HS256',
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      });

      expect(() => verifyAccessToken(token)).toThrow('Invalid token type');
    });
  });

  describe('RefreshCredential', () => {
    it('generates raw and hashed refresh credentials', () => {
      const creds = generateRefreshCredential();
      expect(creds.raw).toBeDefined();
      expect(creds.hash).toBeDefined();
      expect(creds.raw).not.toBe(creds.hash);

      const verifiedHash = hashRefreshCredential(creds.raw);
      expect(verifiedHash).toBe(creds.hash);
    });

    it('is deterministic for the same raw credential', () => {
      const raw = 'some-raw-token';
      const hash1 = hashRefreshCredential(raw);
      const hash2 = hashRefreshCredential(raw);
      expect(hash1).toBe(hash2);
    });
  });
});
