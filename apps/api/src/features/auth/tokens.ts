import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../../config/env';
import { AccessTokenPayload, RefreshCredential } from './auth.types';

export const generateAccessToken = (payload: Omit<AccessTokenPayload, 'type'>): string => {
  const accessTokenExpiresIn = env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'];

  return jwt.sign({ ...payload, type: 'access' }, env.ACCESS_TOKEN_SECRET, {
    algorithm: 'HS256',
    expiresIn: accessTokenExpiresIn,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
};

const isUserRole = (value: unknown): value is AccessTokenPayload['role'] =>
  value === 'SUPER_ADMIN' || value === 'STAFF' || value === 'VIEWER';

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET, {
    algorithms: ['HS256'],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });

  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('Invalid token payload');
  }

  if (decoded.type !== 'access') {
    throw new Error('Invalid token type');
  }

  if (typeof decoded.sub !== 'string' || !decoded.sub) {
    throw new Error('Missing or invalid sub claim');
  }

  if (typeof decoded.sid !== 'string' || !decoded.sid) {
    throw new Error('Missing or invalid sid claim');
  }

  if (!isUserRole(decoded.role)) {
    throw new Error('Missing or invalid role claim');
  }

  return decoded as AccessTokenPayload;
};

export const generateRefreshCredential = (): RefreshCredential => {
  const raw = crypto.randomBytes(48).toString('base64url');
  const hash = crypto.createHmac('sha256', env.REFRESH_TOKEN_SECRET).update(raw).digest('hex');

  return { raw, hash };
};

export const hashRefreshCredential = (raw: string): string => {
  return crypto.createHmac('sha256', env.REFRESH_TOKEN_SECRET).update(raw).digest('hex');
};
