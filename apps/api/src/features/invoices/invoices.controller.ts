import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../errors/application.error';
import { InvoicesService } from './invoices.service';
import { InvoiceCreatePayload, InvoiceUpdatePayload, InvoiceListQuery } from './invoices.types';

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

  static async listInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth || !req.auth.user) {
        throw new UnauthorizedError('Authentication required');
      }
      const query = req.query as unknown as InvoiceListQuery;
      const response = await InvoicesService.listInvoices(query);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  static async getInvoiceById(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth || !req.auth.user) {
        throw new UnauthorizedError('Authentication required');
      }
      const { invoiceId } = req.params;
      const invoice = await InvoicesService.getInvoiceById(invoiceId);
      res.json(invoice);
    } catch (error) {
      next(error);
    }
  }

  static async updateInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth || !req.auth.user) {
        throw new UnauthorizedError('Authentication required');
      }
      const { invoiceId } = req.params;
      const payload = req.body as InvoiceUpdatePayload;

      const invoice = await InvoicesService.updateInvoice(req.auth.user.id, invoiceId, payload, {
        requestId: req.id as string,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      });

      res.json(invoice);
    } catch (error) {
      next(error);
    }
  }

  static async issueInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth || !req.auth.user) {
        throw new UnauthorizedError('Authentication required');
      }
      const { invoiceId } = req.params;

      const invoice = await InvoicesService.issueInvoice(req.auth.user.id, invoiceId, {
        requestId: req.id as string,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      });

      res.json(invoice);
    } catch (error) {
      next(error);
    }
  }
}
