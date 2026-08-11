import { Request, Response, NextFunction } from 'express';
import {
  login,
  refreshSession,
  logoutSession,
  logoutAllSessions,
  generateCsrfForSession,
} from './auth.service';
import { createAuthCookie, getCookieName, clearAuthCookie } from './cookies';

import { extractCsrfToken } from './csrf.middleware';
import { UnauthorizedError } from '../../errors/application.error';

export const loginHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const result = await login(email, password, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.id,
    });

    const accessCookie = createAuthCookie('access', result.accessToken);
    const refreshCookie = createAuthCookie('refresh', result.rawRefreshToken);

    res.cookie(accessCookie.name, accessCookie.value, accessCookie.options);
    res.cookie(refreshCookie.name, refreshCookie.value, refreshCookie.options);

    res.status(200).json({ user: result.user });
  } catch (error) {
    next(error);
  }
};

export const meHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // req.auth is guaranteed by authenticateRequest middleware
    res.status(200).json({ user: req.auth!.user });
  } catch (error) {
    next(error);
  }
};

export const csrfHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cookieName = getCookieName('refresh');
    const refreshToken = req.cookies?.[cookieName];

    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new UnauthorizedError();
    }

    const token = await generateCsrfForSession(refreshToken);
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ csrfToken: token });
  } catch (error) {
    next(error);
  }
};

export const refreshHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cookieName = getCookieName('refresh');
    const refreshToken = req.cookies?.[cookieName];

    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new UnauthorizedError();
    }

    const csrfToken = extractCsrfToken(req);

    const result = await refreshSession(refreshToken, csrfToken, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.id,
    });

    const accessCookie = createAuthCookie('access', result.accessToken);
    const refreshCookie = createAuthCookie(
      'refresh',
      result.rawRefreshToken,
      result.remainingRefreshMs,
    );

    res.cookie(accessCookie.name, accessCookie.value, accessCookie.options);
    res.cookie(refreshCookie.name, refreshCookie.value, refreshCookie.options);

    res.status(200).json({ user: result.user });
  } catch (error) {
    next(error);
  }
};

export const logoutHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.auth && req.auth.sessionId && req.auth.user) {
      await logoutSession(req.auth.sessionId, req.auth.user.id, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      });
    }

    const accessCookie = clearAuthCookie('access');
    const refreshCookie = clearAuthCookie('refresh');

    res.cookie(accessCookie.name, accessCookie.value, accessCookie.options);
    res.cookie(refreshCookie.name, refreshCookie.value, refreshCookie.options);

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const logoutAllHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.auth && req.auth.user) {
      await logoutAllSessions(req.auth.user.id, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      });
    }

    const accessCookie = clearAuthCookie('access');
    const refreshCookie = clearAuthCookie('refresh');

    res.cookie(accessCookie.name, accessCookie.value, accessCookie.options);
    res.cookie(refreshCookie.name, refreshCookie.value, refreshCookie.options);

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
