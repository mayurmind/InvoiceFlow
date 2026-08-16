import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientsRepository } from '../../../src/features/clients/clients.repository';
import { prisma } from '../../../src/database/prisma';
import type { ITXClient } from '../../../src/database/transaction';
import { Prisma } from '../../../src/generated/prisma/client';

vi.mock('../../../src/database/prisma', () => ({
  prisma: {
    client: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

describe('ClientsRepository', () => {
  const mockTx = {
    client: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $queryRaw: vi.fn(),
  } as unknown as ITXClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listClients & countClients', () => {
    it('should build where clause for active status', async () => {
      await ClientsRepository.listClients({ page: 1, limit: 10, status: 'active' });
      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isArchived: false },
          skip: 0,
          take: 10,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
      );
    });

    it('should build where clause for archived status', async () => {
      await ClientsRepository.listClients({ page: 2, limit: 10, status: 'archived' });
      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isArchived: true },
          skip: 10,
          take: 10,
        }),
      );
    });

    it('should build where clause for all status (no isArchived filter)', async () => {
      await ClientsRepository.listClients({ page: 1, limit: 10, status: 'all' });
      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });

    it('should apply stateCode filter', async () => {
      await ClientsRepository.listClients({
        page: 1,
        limit: 10,
        status: 'active',
        stateCode: '27',
      });
      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isArchived: false, stateCode: '27' },
        }),
      );
    });

    it('should build search OR conditions', async () => {
      await ClientsRepository.listClients({ page: 1, limit: 10, status: 'active', search: 'test' });
      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isArchived: false,
            OR: [
              { name: { contains: 'test', mode: 'insensitive' } },
              { email: { contains: 'test', mode: 'insensitive' } },
              { phone: { contains: 'test', mode: 'insensitive' } },
              { gstin: { contains: 'test', mode: 'insensitive' } },
              { pan: { contains: 'test', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('should count clients with built where clause', async () => {
      await ClientsRepository.countClients({
        page: 1,
        limit: 10,
        status: 'active',
        stateCode: '27',
      });
      expect(prisma.client.count).toHaveBeenCalledWith({
        where: { isArchived: false, stateCode: '27' },
      });
    });
  });

  describe('createClient', () => {
    it('should write only the client record (no audit)', async () => {
      const payload = {
        name: 'Test',
      } as unknown as import('../../../src/features/clients/clients.types').ClientCreatePayload;

      vi.mocked(mockTx.client.create).mockResolvedValue({
        id: 'uuid',
      } as unknown as import('../../../src/generated/prisma/client').Client);

      await ClientsRepository.createClient(payload, 'actor', mockTx);

      expect(mockTx.client.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ createdByUserId: 'actor' }),
      });
      expect(mockTx.auditLog.create).not.toHaveBeenCalled();
    });
  });

  describe('updateClient', () => {
    it('should write only the client record (no audit)', async () => {
      const payload = {
        name: 'Test 2',
      } as unknown as import('../../../src/features/clients/clients.types').ClientUpdatePayload;

      await ClientsRepository.updateClient('uuid', payload, mockTx);

      expect(mockTx.client.update).toHaveBeenCalledWith({ where: { id: 'uuid' }, data: payload });
      expect(mockTx.auditLog.create).not.toHaveBeenCalled();
    });
  });

  describe('lockClientForLifecycle', () => {
    it('should acquire row lock using parameterized query', async () => {
      await ClientsRepository.lockClientForLifecycle('test-uuid', mockTx);
      expect(mockTx.$queryRaw).toHaveBeenCalled();

      const queryCall = vi.mocked(mockTx.$queryRaw).mock.calls[0];
      // It's a tagged template literal, so we check if the string contains the expected SQL
      const fullQuery = JSON.stringify(queryCall);
      expect(fullQuery).toContain('SELECT \\"id\\"');
      expect(fullQuery).toContain('FOR UPDATE');
    });
  });

  describe('archiveClient', () => {
    it('should update isArchived to true and set archivedAt', async () => {
      const date = new Date();
      await ClientsRepository.archiveClient('uuid', date, mockTx);
      expect(mockTx.client.update).toHaveBeenCalledWith({
        where: { id: 'uuid' },
        data: { isArchived: true, archivedAt: date },
      });
    });
  });

  describe('restoreClient', () => {
    it('should update isArchived to false and clear archivedAt', async () => {
      await ClientsRepository.restoreClient('uuid', mockTx);
      expect(mockTx.client.update).toHaveBeenCalledWith({
        where: { id: 'uuid' },
        data: { isArchived: false, archivedAt: null },
      });
    });
  });

  describe('createClientAuditLog', () => {
    it('should write CLIENT_CREATED audit with Prisma.JsonNull metadata', async () => {
      await ClientsRepository.createClientAuditLog(
        {
          actorUserId: 'actor',
          action: 'CLIENT_CREATED',
          entityId: 'uuid',
          requestId: 'req-1',
          ipAddress: '127.0.0.1',
          userAgent: 'test',
          metadata: Prisma.JsonNull,
        },
        mockTx,
      );

      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorUserId: 'actor',
            action: 'CLIENT_CREATED',
            entityType: 'CLIENT',
            entityId: 'uuid',
          }),
        }),
      );
    });

    it('should write CLIENT_UPDATED audit with changedFields metadata', async () => {
      await ClientsRepository.createClientAuditLog(
        {
          actorUserId: 'actor',
          action: 'CLIENT_UPDATED',
          entityId: 'uuid',
          requestId: 'req-1',
          ipAddress: '127.0.0.1',
          userAgent: 'test',
          metadata: { changedFields: ['name'] },
        },
        mockTx,
      );

      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'CLIENT_UPDATED',
            metadata: { changedFields: ['name'] },
          }),
        }),
      );
    });

    it('should write CLIENT_ARCHIVED audit', async () => {
      await ClientsRepository.createClientAuditLog(
        {
          actorUserId: 'actor',
          action: 'CLIENT_ARCHIVED',
          entityId: 'uuid',
          requestId: 'req-1',
          ipAddress: '127.0.0.1',
          userAgent: 'test',
          metadata: {},
        },
        mockTx,
      );

      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'CLIENT_ARCHIVED',
            metadata: {},
          }),
        }),
      );
    });

    it('should write CLIENT_RESTORED audit', async () => {
      await ClientsRepository.createClientAuditLog(
        {
          actorUserId: 'actor',
          action: 'CLIENT_RESTORED',
          entityId: 'uuid',
          requestId: 'req-1',
          ipAddress: '127.0.0.1',
          userAgent: 'test',
          metadata: {},
        },
        mockTx,
      );

      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'CLIENT_RESTORED',
            metadata: {},
          }),
        }),
      );
    });
  });
});
