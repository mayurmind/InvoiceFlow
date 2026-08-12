import { Router } from 'express';
import { healthRouter } from './health.routes';
import { authRouter } from '../features/auth/auth.routes';
import { usersRouter } from '../features/users/users.routes';

export const apiV1Router = Router();

// Map sub-routers to paths
apiV1Router.use('/health', healthRouter);
apiV1Router.use('/auth', authRouter);
apiV1Router.use('/users', usersRouter);
