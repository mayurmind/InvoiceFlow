import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

/**
 * Validates req.body, req.query, or req.params against a Zod schema.
 * Replaces request properties with their parsed/sanitized equivalents.
 * Fails via the global error handler if validation fails.
 */
export const validateRequest =
  (schema: { body?: AnyZodObject; query?: AnyZodObject; params?: AnyZodObject }) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(error);
      } else {
        next(error);
      }
    }
  };
