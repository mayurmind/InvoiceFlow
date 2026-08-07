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
  let reqId = req.header(REQUEST_ID_HEADER);

  // Validate incoming ID to prevent log injection or non-UUID payloads
  const parsed = uuidSchema.safeParse(reqId);
  if (!parsed.success) {
    reqId = randomUUID();
  } else {
    reqId = parsed.data;
  }

  // Attach to request object for downstream use
  req.id = reqId as string;

  // Set the response header
  res.setHeader(REQUEST_ID_HEADER, req.id);

  next();
};

// Properly augment Express Request type
declare module 'express-serve-static-core' {
  interface Request {
    id: string;
  }
}
