import { rateLimit } from 'express-rate-limit';
import { RateLimitError } from '../errors/application.error';

interface RateLimiterOptions {
  windowMs?: number;
  limit?: number;
}

/**
 * Creates a rate limiter middleware with configurable limits.
 * Default is 100 requests per 15 minutes for production baseline.
 */
export const createRateLimiter = ({
  windowMs = 15 * 60 * 1000,
  limit = 100,
}: RateLimiterOptions = {}) => {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new RateLimitError());
    },
  });
};
