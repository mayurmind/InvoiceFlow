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
      console.error(error);
      next(error);
    }
  }

  static async listInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth || !req.auth.user) {
        throw new UnauthorizedError('Authentication required');
      }
      const unknownQuery: unknown = req.query;
      const query = unknownQuery as InvoiceListQuery;
      const response = await InvoicesService.listInvoices(query);
      res.json(response);
    } catch (error) {
      console.error(error);
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
      console.error(error);
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
      console.error(error);
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
      console.error(error);
      next(error);
    }
  }

  static async cancelInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth || !req.auth.user) {
        throw new UnauthorizedError('Authentication required');
      }
      const { invoiceId } = req.params;
      const { reason } = req.body as { reason: string };

      const invoice = await InvoicesService.cancelInvoice(req.auth.user.id, invoiceId, reason, {
        requestId: req.id as string,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      });

      res.json(invoice);
    } catch (error) {
      console.error(error);
      next(error);
    }
  }

  static async downloadInvoicePdf(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth || !req.auth.user) {
        throw new UnauthorizedError('Authentication required');
      }
      const { invoiceId } = req.params;

      // Dynamic import or regular import - usually top level, but for now we'll assume InvoicePdfService is imported at top
      const { InvoicePdfService } = await import('./pdf/invoice-pdf.service');
      const { buffer, filename } = await InvoicePdfService.generateInvoicePdf(invoiceId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Cache-Control', 'private, no-store');

      res.status(200).send(buffer);
    } catch (error) {
      console.error(error);
      next(error);
    }
  }

  static async sendInvoiceEmail(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth || !req.auth.user) {
        throw new UnauthorizedError('Authentication required');
      }
      const { invoiceId } = req.params;
      const { InvoiceEmailService } = await import('./email/invoice-email.service');
      const service = new InvoiceEmailService();

      const result = await service.sendInvoiceEmail(invoiceId, {
        actorUserId: req.auth.user.id,
        requestId: req.id as string,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      });

      res.status(result.status).json(result.delivery);
    } catch (error) {
      console.error(error);
      next(error);
    }
  }

  static async resendInvoiceEmail(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth || !req.auth.user) {
        throw new UnauthorizedError('Authentication required');
      }
      const { invoiceId } = req.params;
      const { InvoiceEmailService } = await import('./email/invoice-email.service');
      const service = new InvoiceEmailService();

      const result = await service.resendInvoiceEmail(invoiceId, {
        actorUserId: req.auth.user.id,
        requestId: req.id as string,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      });

      res.status(result.status).json(result.delivery);
    } catch (error) {
      console.error(error);
      next(error);
    }
  }

  static async listInvoiceEmailDeliveries(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth || !req.auth.user) {
        throw new UnauthorizedError('Authentication required');
      }
      const { invoiceId } = req.params;
      const { InvoiceEmailService } = await import('./email/invoice-email.service');
      const service = new InvoiceEmailService();

      const deliveries = await service.listInvoiceEmailDeliveries(invoiceId);

      res.status(200).json(deliveries);
    } catch (error) {
      console.error(error);
      next(error);
    }
  }
}
