import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../database/prisma';
import type { ITXClient } from '../../database/transaction';
import type { ClientCreatePayload, ClientListQuery, ClientUpdatePayload } from './clients.types';

export class ClientsRepository {
  /**
   * Creates a new client within a transaction. Audit is written separately by the service.
   */
  static async createClient(payload: ClientCreatePayload, actorUserId: string, tx: ITXClient) {
    return tx.client.create({
      data: {
        ...payload,
        createdByUserId: actorUserId,
      },
    });
  }

  /**
   * Retrieves a client by ID. Can be used outside or inside a transaction.
   */
  static async getClientById(clientId: string, tx?: ITXClient) {
    const db = tx ?? prisma;
    return db.client.findUnique({
      where: { id: clientId },
    });
  }

  /**
   * Updates an existing client within a transaction. Audit is written separately by the service.
   */
  static async updateClient(clientId: string, payload: ClientUpdatePayload, tx: ITXClient) {
    return tx.client.update({
      where: { id: clientId },
      data: payload,
    });
  }

  /**
   * Creates a CLIENT_CREATED audit log entry within a transaction.
   */
  static async createClientAuditLog(
    data: {
      actorUserId: string;
      action: 'CLIENT_CREATED' | 'CLIENT_UPDATED' | 'CLIENT_ARCHIVED' | 'CLIENT_RESTORED';
      entityId: string;
      requestId: string;
      ipAddress: string;
      userAgent: string;
      metadata: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
    },
    tx: ITXClient,
  ) {
    return tx.auditLog.create({
      data: {
        actorUserId: data.actorUserId,
        action: data.action,
        entityType: 'CLIENT',
        entityId: data.entityId,
        requestId: data.requestId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata,
      },
    });
  }

  /**
   * Lists clients based on search and filters.
   */
  static async listClients(query: ClientListQuery) {
    const where = this.buildWhereClause(query);
    const skip = (query.page - 1) * query.limit;

    return prisma.client.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  /**
   * Counts total clients based on search and filters.
   */
  static async countClients(query: ClientListQuery) {
    const where = this.buildWhereClause(query);
    return prisma.client.count({ where });
  }

  private static buildWhereClause(query: ClientListQuery): Prisma.ClientWhereInput {
    const where: Prisma.ClientWhereInput = {};

    if (query.status === 'active') {
      where.isArchived = false;
    } else if (query.status === 'archived') {
      where.isArchived = true;
    }

    if (query.stateCode) {
      where.stateCode = query.stateCode;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
        { gstin: { contains: query.search, mode: 'insensitive' } },
        { pan: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  /**
   * Acquires a row-level lock on the client for lifecycle transition.
   * Throws if the transaction client is not provided (must be in a tx).
   */
  static async lockClientForLifecycle(clientId: string, tx: ITXClient): Promise<void> {
    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "clients"
      WHERE "id" = ${clientId}::uuid
      FOR UPDATE
    `;
  }

  /**
   * Archives a client.
   */
  static async archiveClient(clientId: string, archivedAt: Date, tx: ITXClient) {
    return tx.client.update({
      where: { id: clientId },
      data: {
        isArchived: true,
        archivedAt,
      },
    });
  }

  /**
   * Restores a client.
   */
  static async restoreClient(clientId: string, tx: ITXClient) {
    return tx.client.update({
      where: { id: clientId },
      data: {
        isArchived: false,
        archivedAt: null,
      },
    });
  }
}
