import type { Request, Response, NextFunction } from 'express';
import { ClientsService } from './clients.service';
import type { ClientCreatePayload, ClientListQuery, ClientUpdatePayload } from './clients.types';
import { UnauthorizedError } from '../../errors/application.error';

export class ClientsController {
  static async createClient(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.user) throw new UnauthorizedError('Unauthorized');
      const actorUserId = req.auth.user.id;
      const payload = req.body as ClientCreatePayload;
      const auditContext = {
        requestId: req.id as string,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      };

      const client = await ClientsService.createClient(actorUserId, payload, auditContext);
      res.status(201).json(client);
    } catch (error) {
      next(error);
    }
  }

  static async getClientById(req: Request, res: Response, next: NextFunction) {
    try {
      const { clientId } = req.params;
      const client = await ClientsService.getClientById(clientId);
      res.status(200).json(client);
    } catch (error) {
      next(error);
    }
  }

  static async updateClient(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.user) throw new UnauthorizedError('Unauthorized');
      const actorUserId = req.auth.user.id;
      const { clientId } = req.params;
      const payload = req.body as ClientUpdatePayload;
      const auditContext = {
        requestId: req.id as string,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      };

      const client = await ClientsService.updateClient(
        actorUserId,
        clientId,
        payload,
        auditContext,
      );
      res.status(200).json(client);
    } catch (error) {
      next(error);
    }
  }

  static async listClients(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query as unknown as ClientListQuery;
      const result = await ClientsService.listClients(query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
