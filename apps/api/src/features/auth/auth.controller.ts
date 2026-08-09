import { Request, Response, NextFunction } from 'express';
import { login } from './auth.service';
import { createAuthCookie } from './cookies';

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
