import { Request, Response, NextFunction } from 'express';
import { auditListQuerySchema } from './audit.schemas';
import { AuditService } from './audit.service';
import { ValidationError } from '../../errors/application.error';
import { ZodError } from 'zod';

export class AuditController {
  static async listAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const parsedQuery = auditListQuerySchema.parse(req.query);
      const result = await AuditService.listAuditLogs(parsedQuery);
      res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ValidationError('Invalid query parameters', error.errors));
      } else {
        next(error);
      }
    }
  }
}
