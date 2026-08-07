import { Router } from 'express';
import { healthRouter } from './health.routes';

export const apiV1Router = Router();

// Map sub-routers to paths
apiV1Router.use('/health', healthRouter);

// Note: Future business routes (auth, invoices, etc.) will be added here in P2/P3.
