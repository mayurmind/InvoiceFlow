import { NotFoundError } from '../../errors/application.error';
import { Prisma } from '../../generated/prisma/client';
import { runInTransaction } from '../../database/transaction';
import { ClientsRepository } from './clients.repository';
import type {
  ClientCreatePayload,
  ClientListQuery,
  ClientUpdatePayload,
  ClientListResponse,
  ClientResponse,
} from './clients.types';
import { mapClientToResponse } from './clients.types';
import type { Client } from '../../generated/prisma/client';

export class ClientsService {
  static async createClient(
    actorUserId: string,
    payload: ClientCreatePayload,
    auditContext: { requestId: string; ipAddress: string; userAgent: string },
  ): Promise<ClientResponse> {
    const boundIp = auditContext.ipAddress.substring(0, 64);
    const boundUa = auditContext.userAgent.substring(0, 500);

    const client = await runInTransaction(async (tx) => {
      const created = await ClientsRepository.createClient(payload, actorUserId, tx);

      await ClientsRepository.createClientAuditLog(
        {
          actorUserId,
          action: 'CLIENT_CREATED',
          entityId: created.id,
          requestId: auditContext.requestId,
          ipAddress: boundIp,
          userAgent: boundUa,
          metadata: Prisma.NullableJsonNullValueInput.DbNull,
        },
        tx,
      );

      return created;
    });

    return mapClientToResponse(client);
  }

  static async getClientById(clientId: string): Promise<ClientResponse> {
    const client = await ClientsRepository.getClientById(clientId);
    if (!client) {
      throw new NotFoundError('Client not found');
    }
    return mapClientToResponse(client);
  }

  static async updateClient(
    actorUserId: string,
    clientId: string,
    payload: ClientUpdatePayload,
    auditContext: { requestId: string; ipAddress: string; userAgent: string },
  ): Promise<ClientResponse> {
    const boundIp = auditContext.ipAddress.substring(0, 64);
    const boundUa = auditContext.userAgent.substring(0, 500);

    const result = await runInTransaction(async (tx) => {
      const existingClient = await ClientsRepository.getClientById(clientId, tx);
      if (!existingClient) {
        throw new NotFoundError('Client not found');
      }

      const changedFields = getChangedFields(existingClient, payload);

      if (changedFields.length === 0) {
        // Same-value PUT: strict no-op — no DB write, no audit
        return existingClient;
      }

      const updatedClient = await ClientsRepository.updateClient(clientId, payload, tx);

      await ClientsRepository.createClientAuditLog(
        {
          actorUserId,
          action: 'CLIENT_UPDATED',
          entityId: clientId,
          requestId: auditContext.requestId,
          ipAddress: boundIp,
          userAgent: boundUa,
          metadata: { changedFields },
        },
        tx,
      );

      return updatedClient;
    });

    return mapClientToResponse(result);
  }

  static async listClients(query: ClientListQuery): Promise<ClientListResponse> {
    const [data, total] = await Promise.all([
      ClientsRepository.listClients(query),
      ClientsRepository.countClients(query),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

    return {
      data: data.map(mapClientToResponse),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1 && totalPages > 0,
      },
    };
  }

  static async archiveClient(
    actorUserId: string,
    clientId: string,
    auditContext: { requestId: string; ipAddress: string; userAgent: string },
  ): Promise<ClientResponse> {
    const boundIp = auditContext.ipAddress.substring(0, 64);
    const boundUa = auditContext.userAgent.substring(0, 500);

    const client = await runInTransaction(async (tx) => {
      await ClientsRepository.lockClientForLifecycle(clientId, tx);
      const existing = await ClientsRepository.getClientById(clientId, tx);

      if (!existing) {
        throw new NotFoundError('Client not found');
      }

      if (existing.isArchived) {
        return existing;
      }

      const archivedAt = new Date();
      const updated = await ClientsRepository.archiveClient(clientId, archivedAt, tx);

      await ClientsRepository.createClientAuditLog(
        {
          actorUserId,
          action: 'CLIENT_ARCHIVED',
          entityId: clientId,
          requestId: auditContext.requestId,
          ipAddress: boundIp,
          userAgent: boundUa,
          metadata: {},
        },
        tx,
      );

      return updated;
    });

    return mapClientToResponse(client);
  }

  static async restoreClient(
    actorUserId: string,
    clientId: string,
    auditContext: { requestId: string; ipAddress: string; userAgent: string },
  ): Promise<ClientResponse> {
    const boundIp = auditContext.ipAddress.substring(0, 64);
    const boundUa = auditContext.userAgent.substring(0, 500);

    const client = await runInTransaction(async (tx) => {
      await ClientsRepository.lockClientForLifecycle(clientId, tx);
      const existing = await ClientsRepository.getClientById(clientId, tx);

      if (!existing) {
        throw new NotFoundError('Client not found');
      }

      if (!existing.isArchived) {
        return existing;
      }

      const updated = await ClientsRepository.restoreClient(clientId, tx);

      await ClientsRepository.createClientAuditLog(
        {
          actorUserId,
          action: 'CLIENT_RESTORED',
          entityId: clientId,
          requestId: auditContext.requestId,
          ipAddress: boundIp,
          userAgent: boundUa,
          metadata: {},
        },
        tx,
      );

      return updated;
    });

    return mapClientToResponse(client);
  }
}

function getChangedFields(existing: Client, payload: ClientUpdatePayload): string[] {
  const changedFields: string[] = [];
  const fieldsToCompare: (keyof ClientUpdatePayload)[] = [
    'name',
    'email',
    'phone',
    'gstin',
    'pan',
    'addressLine1',
    'addressLine2',
    'city',
    'state',
    'stateCode',
    'postalCode',
    'country',
    'notes',
  ];

  for (const field of fieldsToCompare) {
    if (existing[field] !== payload[field]) {
      changedFields.push(field);
    }
  }

  return changedFields;
}
