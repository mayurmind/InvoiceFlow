import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';

export const REQUEST_ID_HEADER = 'X-Request-Id';

const uuidSchema = z.string().uuid();

/**
 * Ensures every request has a valid UUID correlation ID.
 * If provided and valid, trusts the incoming ID. Otherwise, generates a new one.
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const parsed = uuidSchema.safeParse(req.header(REQUEST_ID_HEADER));
  const requestId = parsed.success ? parsed.data : randomUUID();

  // Attach to request object for downstream use
  req.id = requestId;

  // Set the response header
  res.setHeader(REQUEST_ID_HEADER, requestId);

  next();
};

// Properly augment Express Request type
declare module 'express-serve-static-core' {
  interface Request {
    id: string;
  }
}
