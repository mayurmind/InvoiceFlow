import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import crypto from 'node:crypto';
import { RateLimitError } from '../../errors/application.error';
import { Request } from 'express';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const clientIp = req.ip;
    if (!clientIp) {
      throw new Error('Client IP unavailable');
    }

    const normalizedIp = ipKeyGenerator(clientIp, 56);
    const normalizedEmail = typeof req.body?.email === 'string' ? req.body.email : '';

    return crypto.createHash('sha256').update(`${normalizedIp}:${normalizedEmail}`).digest('hex');
  },
  handler: (_req, _res, next) => {
    next(new RateLimitError());
  },
});
