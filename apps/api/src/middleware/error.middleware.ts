import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, NotFoundError } from '../errors/application.error';
import { logger } from '../utilities/logger';

/**
 * Handle unhandled routes (404 Not Found)
 */
export const notFoundMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
};

/**
 * Global terminal error handling middleware
 */
export const globalErrorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) => {
  // 1. Zod Validation Errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.format(),
        requestId: req.id,
      },
    });
    return;
  }

  // 2. Known Application Errors (AppError subclasses)
  if (err instanceof AppError) {
    if (!err.isOperational) {
      // Log unexpected issues (programmer errors masked as AppErrors)
      logger.error({ err, requestId: req.id }, 'Non-operational AppError caught');
    }
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId: req.id,
      },
    });
    return;
  }

  // 3. Unknown/Unexpected Errors
  // Log the raw error stack internally
  logger.error(
    { err, requestId: req.id, method: req.method, path: req.path },
    'Unhandled internal server error',
  );

  // Return a generic safe 500 without leaking stack traces
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal error occurred',
      requestId: req.id,
    },
  });
};
