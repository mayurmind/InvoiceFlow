import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './utilities/logger';
import { requestIdMiddleware, REQUEST_ID_HEADER } from './middleware/request-id.middleware';
import { apiV1Router } from './routes/api-v1.router';
import { globalErrorMiddleware, notFoundMiddleware } from './middleware/error.middleware';

export const app = express();

// 1. Trust proxy if behind a reverse proxy (useful for rate limiting)
// Keeping default disabled for P1 unless production infrastructure requires it.
// app.set('trust proxy', 1);

// 2. Security Headers
app.use(helmet());

// 3. CORS Configuration
app.use(
  cors({
    origin: env.CORS_ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', REQUEST_ID_HEADER],
    exposedHeaders: [REQUEST_ID_HEADER],
    credentials: true,
  }),
);

// 4. Request ID Generation/Validation
app.use(requestIdMiddleware);

// 5. Structured Request Logging
app.use(
  pinoHttp({
    logger,
    customProps: (req) => {
      // Note: express-pino req is IncomingMessage, we cast to access id
      return {
        requestId: (req as any).id,
      };
    },
    // Don't log requests automatically in test environment to avoid noise
    autoLogging: env.NODE_ENV !== 'test',
  }),
);

// 6. Body Parsing & Request Limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 7. Rate Limiting Foundation
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per `window`
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
});
// Apply global rate limiting to all requests
app.use(limiter);

// 8. Routes
app.use('/api/v1', apiV1Router);

// 9. Not Found Handler
app.use(notFoundMiddleware);

// 10. Global Error Handler
app.use(globalErrorMiddleware);
