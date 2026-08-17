import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../errors/application.error';
import { InvoicesService } from './invoices.service';
import { InvoiceCreatePayload } from './invoices.types';

export class InvoicesController {
  static async createInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth || !req.auth.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const payload = req.body as InvoiceCreatePayload;

      const invoice = await InvoicesService.createInvoice(req.auth.user.id, payload, {
        requestId: req.id as string,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      });

      res.status(201).json(invoice);
    } catch (error) {
      next(error);
    }
  }
}
