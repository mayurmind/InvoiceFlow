import { Router } from 'express';
import cookieParser from 'cookie-parser';
import { validateRequest } from '../../middleware/validation.middleware';
import { loginSchema } from './auth.schemas';
import { loginLimiter } from './login-rate-limit.middleware';
import { originGuard } from './origin.middleware';
import { authenticateRequest } from './auth.middleware';
import { requireCsrfToken } from './csrf.middleware';
import {
  loginHandler,
  meHandler,
  csrfHandler,
  refreshHandler,
  logoutHandler,
  logoutAllHandler,
} from './auth.controller';

export const authRouter = Router();

authRouter.use(cookieParser());

authRouter.post('/login', originGuard, validateRequest(loginSchema), loginLimiter, loginHandler);

authRouter.get('/me', authenticateRequest, meHandler);

authRouter.get('/csrf', originGuard, csrfHandler);

authRouter.post('/refresh', originGuard, refreshHandler);

authRouter.post('/logout', originGuard, authenticateRequest, requireCsrfToken, logoutHandler);

authRouter.post(
  '/logout-all',
  originGuard,
  authenticateRequest,
  requireCsrfToken,
  logoutAllHandler,
);
