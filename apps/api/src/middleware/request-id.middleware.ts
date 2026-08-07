import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4, validate as validateUuid } from 'uuid';

export const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * Ensures every request has a valid UUID correlation ID.
 * If provided and valid, trusts the incoming ID. Otherwise, generates a new one.
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  let reqId = req.header(REQUEST_ID_HEADER);

  // Validate incoming ID to prevent log injection or non-UUID payloads
  if (!reqId || !validateUuid(reqId)) {
    reqId = uuidv4();
  }

  // Attach to request object for downstream use
  req.id = reqId;

  // Set the response header
  res.setHeader(REQUEST_ID_HEADER, reqId);

  next();
};

// Extend Express Request interface to include `id`
declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}
