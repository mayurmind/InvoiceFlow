import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../../errors/application.error';
import { UserRole } from '../../generated/prisma/client';

export const requireRoles = (...allowedRoles: UserRole[]) => {
  if (allowedRoles.length === 0) {
    throw new Error('requireRoles requires at least one allowed role');
  }

  const allowed = new Set(allowedRoles);

  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth?.user) {
      return next(new UnauthorizedError());
    }

    if (!allowed.has(req.auth.user.role)) {
      return next(new ForbiddenError());
    }

    next();
  };
};
