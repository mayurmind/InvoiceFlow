import { Request, Response, NextFunction } from 'express';
import { verifyCsrfToken } from './csrf';
import { ForbiddenError } from '../../errors/application.error';

export const extractCsrfToken = (req: Request): string => {
  let count = 0;
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    if (req.rawHeaders[i].toLowerCase() === 'x-csrf-token') {
      count++;
    }
  }

  if (count !== 1) {
    throw new ForbiddenError();
  }

  const csrfToken = req.headers['x-csrf-token'];
  if (typeof csrfToken !== 'string' || csrfToken.length < 1 || csrfToken.length > 256) {
    throw new ForbiddenError();
  }
  return csrfToken;
};

export const requireCsrfToken = (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (!req.auth || !req.auth.sessionId) {
      throw new ForbiddenError();
    }

    const csrfToken = extractCsrfToken(req);

    const isValid = verifyCsrfToken(req.auth.sessionId, csrfToken);
    if (!isValid) {
      throw new ForbiddenError();
    }

    next();
  } catch (error) {
    next(error);
  }
};
