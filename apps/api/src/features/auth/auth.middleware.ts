import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../errors/application.error';
import { getCookieName } from './cookies';
import { verifyAccessToken } from './tokens';
import { getSessionById, getUserById, mapUserToSanitized } from './auth.repository';

export const authenticateRequest = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const cookieName = getCookieName('access');
    const token = req.cookies?.[cookieName];

    if (!token) {
      throw new UnauthorizedError();
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new UnauthorizedError();
    }

    const session = await getSessionById(payload.sid);
    if (!session) {
      throw new UnauthorizedError();
    }
    if (session.userId !== payload.sub) {
      throw new UnauthorizedError();
    }
    if (session.revokedAt !== null) {
      throw new UnauthorizedError();
    }
    if (session.rotatedAt !== null || session.replacedBySessionId !== null) {
      throw new UnauthorizedError();
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError();
    }

    const user = await getUserById(session.userId);
    if (!user) {
      throw new UnauthorizedError();
    }
    if (user.isActive !== true) {
      throw new UnauthorizedError();
    }
    if (payload.role !== user.role) {
      throw new UnauthorizedError();
    }

    req.auth = {
      sessionId: session.id,
      user: mapUserToSanitized(user),
    };

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else {
      next(error);
    }
  }
};
