import { Router, Request, Response } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'InvoiceFlow API is running',
    timestamp: new Date().toISOString(),
  });
});
