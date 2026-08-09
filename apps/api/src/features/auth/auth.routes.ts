import { Router } from 'express';
import cookieParser from 'cookie-parser';
import { validateRequest } from '../../middleware/validation.middleware';
import { loginSchema } from './auth.schemas';
import { loginLimiter } from './login-rate-limit.middleware';
import { originGuard } from './origin.middleware';
import { authenticateRequest } from './auth.middleware';
import { loginHandler, meHandler } from './auth.controller';

export const authRouter = Router();

authRouter.use(cookieParser());

authRouter.post('/login', originGuard, validateRequest(loginSchema), loginLimiter, loginHandler);

authRouter.get('/me', authenticateRequest, meHandler);
