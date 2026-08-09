import { env } from '../../config/env';
import { CookieOptions } from './auth.types';

export const parseTimeToMs = (time: string): number => {
  if (time.endsWith('m')) return parseInt(time, 10) * 60 * 1000;
  if (time.endsWith('d')) return parseInt(time, 10) * 24 * 60 * 60 * 1000;
  return parseInt(time, 10);
};

export const getCookieName = (name: 'access' | 'refresh'): string => {
  const prefix = env.NODE_ENV === 'production' ? '__Host-invoiceflow-' : 'invoiceflow-';
  return `${prefix}${name}`;
};

export const createAuthCookie = (type: 'access' | 'refresh', value: string): CookieOptions => {
  const maxAgeMs = parseTimeToMs(type === 'access' ? env.ACCESS_TOKEN_TTL : env.REFRESH_TOKEN_TTL);
  const isProd = env.NODE_ENV === 'production';

  return {
    name: getCookieName(type),
    value,
    options: {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeMs,
    },
  };
};

export const clearAuthCookie = (type: 'access' | 'refresh'): CookieOptions => {
  const isProd = env.NODE_ENV === 'production';
  return {
    name: getCookieName(type),
    value: '',
    options: {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    },
  };
};
