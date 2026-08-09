import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../errors/application.error';

/**
 * Validates Origin or Referer against allowed CORS origins for sensitive endpoints.
 * Fallback to Referer if Origin is not present.
 */
export const originGuard = (req: Request, _res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  let requestOrigin = '';

  if (origin) {
    requestOrigin = origin;
  } else if (referer) {
    try {
      const url = new URL(referer);
      requestOrigin = url.origin;
    } catch {
      // Invalid referer URL
    }
  }

  if (!requestOrigin) {
    return next(new UnauthorizedError('Missing or malformed Origin/Referer'));
  }

  if (!env.CORS_ALLOWED_ORIGINS.includes(requestOrigin)) {
    return next(new UnauthorizedError('Disallowed Origin/Referer'));
  }

  next();
};
