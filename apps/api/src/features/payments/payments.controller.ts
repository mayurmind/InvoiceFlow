import { Request, Response, NextFunction } from 'express';
import { PaymentsService } from './payments.service';

export class PaymentsController {
  static async recordPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const invoiceId = req.params.invoiceId as string;
      const actorUserId = req.auth!.user.id;
      const payload = req.body;

      const auditContext = {
        requestId: req.id,
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || '',
      };

      const payment = await PaymentsService.recordPayment(
        invoiceId,
        actorUserId,
        payload,
        auditContext,
      );

      res.status(201).json(payment);
    } catch (error) {
      next(error);
    }
  }
}
