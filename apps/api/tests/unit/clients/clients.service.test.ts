import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientsService } from '../../../src/features/clients/clients.service';
import { ClientsRepository } from '../../../src/features/clients/clients.repository';
import * as TransactionModule from '../../../src/database/transaction';
import { NotFoundError } from '../../../src/errors/application.error';
import type { ITXClient } from '../../../src/database/transaction';

vi.mock('../../../src/features/clients/clients.repository');
vi.mock('../../../src/database/transaction');

describe('ClientsService', () => {
  const actorUserId = 'actor-123';
  const clientId = 'client-123';
  const auditContext = { requestId: 'req-1', ipAddress: '127.0.0.1', userAgent: 'test-agent' };

  const validPayload = {
    name: 'Test Client',
    email: 'client@example.com',
    phone: '1234567890',
    gstin: '27AADCB2230M1Z2',
    pan: 'AADCB2230M',
    addressLine1: 'Line 1',
    addressLine2: null,
    city: 'Mumbai',
    state: 'Maharashtra',
    stateCode: '27',
    postalCode: '400001',
    country: 'India',
    notes: null,
  };

  const dbClient = {
    ...validPayload,
    id: clientId,
    createdByUserId: actorUserId,
    isArchived: false,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTx = {} as ITXClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(TransactionModule.runInTransaction).mockImplementation(async (cb) => cb(mockTx));
    // Default: audit log creation succeeds
    vi.mocked(ClientsRepository.createClientAuditLog).mockResolvedValue(
      {} as import('../../../src/generated/prisma/client').AuditLog,
    );
  });

  describe('createClient', () => {
    it('should create client and audit in same transaction, omitting createdByUserId', async () => {
      vi.mocked(ClientsRepository.createClient).mockResolvedValue(
        dbClient as unknown as import('../../../src/generated/prisma/client').Client,
      );

      const result = await ClientsService.createClient(actorUserId, validPayload, auditContext);

      expect(TransactionModule.runInTransaction).toHaveBeenCalled();
      expect(ClientsRepository.createClient).toHaveBeenCalledWith(
        validPayload,
        actorUserId,
        mockTx,
      );
      expect(ClientsRepository.createClientAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId,
          action: 'CLIENT_CREATED',
          entityId: clientId,
        }),
        mockTx,
      );

      expect(result).not.toHaveProperty('createdByUserId');
      expect(result.id).toBe(clientId);
    });

    it('should rollback when audit creation fails', async () => {
      vi.mocked(ClientsRepository.createClient).mockResolvedValue(
        dbClient as unknown as import('../../../src/generated/prisma/client').Client,
      );
      vi.mocked(ClientsRepository.createClientAuditLog).mockRejectedValue(
        new Error('audit failure'),
      );
      // runInTransaction propagates the error
      vi.mocked(TransactionModule.runInTransaction).mockImplementation(async (cb) => {
        return cb(mockTx);
      });

      await expect(
        ClientsService.createClient(actorUserId, validPayload, auditContext),
      ).rejects.toThrow('audit failure');
    });

    it('should truncate ipAddress to 64 chars and userAgent to 500 chars', async () => {
      vi.mocked(ClientsRepository.createClient).mockResolvedValue(
        dbClient as unknown as import('../../../src/generated/prisma/client').Client,
      );

      const longAudit = {
        requestId: 'req-1',
        ipAddress: 'x'.repeat(200),
        userAgent: 'y'.repeat(1000),
      };

      await ClientsService.createClient(actorUserId, validPayload, longAudit);

      expect(ClientsRepository.createClientAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: 'x'.repeat(64),
          userAgent: 'y'.repeat(500),
        }),
        mockTx,
      );
    });
  });

  describe('getClientById', () => {
    it('should return client if found', async () => {
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue(
        dbClient as unknown as import('../../../src/generated/prisma/client').Client,
      );

      const result = await ClientsService.getClientById(clientId);
      expect(ClientsRepository.getClientById).toHaveBeenCalledWith(clientId);
      expect(result.id).toBe(clientId);
      expect(result).not.toHaveProperty('createdByUserId');
    });

    it('should throw NotFoundError if not found', async () => {
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue(null);
      await expect(ClientsService.getClientById(clientId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateClient', () => {
    it('should throw NotFoundError if client does not exist', async () => {
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue(null);
      await expect(
        ClientsService.updateClient(actorUserId, clientId, validPayload, auditContext),
      ).rejects.toThrow(NotFoundError);
    });

    it('should load existing client inside transaction', async () => {
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue(
        dbClient as unknown as import('../../../src/generated/prisma/client').Client,
      );
      const payload = { ...validPayload, name: 'New Name' };
      const updatedDbClient = { ...dbClient, name: 'New Name' };
      vi.mocked(ClientsRepository.updateClient).mockResolvedValue(
        updatedDbClient as unknown as import('../../../src/generated/prisma/client').Client,
      );

      await ClientsService.updateClient(actorUserId, clientId, payload, auditContext);

      // getClientById must be called with the tx (inside transaction)
      expect(ClientsRepository.getClientById).toHaveBeenCalledWith(clientId, mockTx);
    });

    it('should execute update when fields have changed', async () => {
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue(
        dbClient as unknown as import('../../../src/generated/prisma/client').Client,
      );

      const payload = { ...validPayload, name: 'New Name' };
      const updatedDbClient = { ...dbClient, name: 'New Name' };
      vi.mocked(ClientsRepository.updateClient).mockResolvedValue(
        updatedDbClient as unknown as import('../../../src/generated/prisma/client').Client,
      );

      const result = await ClientsService.updateClient(
        actorUserId,
        clientId,
        payload,
        auditContext,
      );

      expect(ClientsRepository.updateClient).toHaveBeenCalledWith(clientId, payload, mockTx);
      expect(ClientsRepository.createClientAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CLIENT_UPDATED',
          entityId: clientId,
          metadata: { changedFields: ['name'] },
        }),
        mockTx,
      );
      expect(result.name).toBe('New Name');
    });

    it('should perform same-value PUT as a no-op (no update, no audit)', async () => {
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue(
        dbClient as unknown as import('../../../src/generated/prisma/client').Client,
      );

      const result = await ClientsService.updateClient(
        actorUserId,
        clientId,
        validPayload,
        auditContext,
      );

      expect(ClientsRepository.updateClient).not.toHaveBeenCalled();
      expect(ClientsRepository.createClientAuditLog).not.toHaveBeenCalled();
      expect(result.id).toBe(clientId);
    });
  });

  describe('listClients', () => {
    it('should orchestrate list query and calculate pagination metadata', async () => {
      vi.mocked(ClientsRepository.listClients).mockResolvedValue([
        dbClient,
      ] as unknown as import('../../../src/generated/prisma/client').Client[]);
      vi.mocked(ClientsRepository.countClients).mockResolvedValue(1);

      const query = {
        page: 1,
        limit: 20,
        status: 'active',
      } as unknown as import('../../../src/features/clients/clients.types').ClientListQuery;
      const result = await ClientsService.listClients(query);

      expect(ClientsRepository.listClients).toHaveBeenCalledWith(query);
      expect(ClientsRepository.countClients).toHaveBeenCalledWith(query);

      expect(result.data.length).toBe(1);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it('should handle total = 0 gracefully', async () => {
      vi.mocked(ClientsRepository.listClients).mockResolvedValue([]);
      vi.mocked(ClientsRepository.countClients).mockResolvedValue(0);

      const query = {
        page: 1,
        limit: 20,
        status: 'active',
      } as unknown as import('../../../src/features/clients/clients.types').ClientListQuery;
      const result = await ClientsService.listClients(query);

      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });
  });

  describe('archiveClient', () => {
    it('should throw NotFoundError if client does not exist', async () => {
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue(null);
      await expect(
        ClientsService.archiveClient(actorUserId, clientId, auditContext),
      ).rejects.toThrow(NotFoundError);
      expect(ClientsRepository.lockClientForLifecycle).toHaveBeenCalledWith(clientId, mockTx);
    });

    it('should perform same-state no-op if already archived (no update, no audit)', async () => {
      const archivedDbClient = { ...dbClient, isArchived: true, archivedAt: new Date() };
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue(
        archivedDbClient as unknown as import('../../../src/generated/prisma/client').Client,
      );

      const result = await ClientsService.archiveClient(actorUserId, clientId, auditContext);

      expect(ClientsRepository.archiveClient).not.toHaveBeenCalled();
      expect(ClientsRepository.createClientAuditLog).not.toHaveBeenCalled();
      expect(result.isArchived).toBe(true);
    });

    it('should archive client and create audit if active', async () => {
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue(
        dbClient as unknown as import('../../../src/generated/prisma/client').Client,
      );

      const archivedDate = new Date();
      const updatedDbClient = { ...dbClient, isArchived: true, archivedAt: archivedDate };
      vi.mocked(ClientsRepository.archiveClient).mockResolvedValue(
        updatedDbClient as unknown as import('../../../src/generated/prisma/client').Client,
      );

      const result = await ClientsService.archiveClient(actorUserId, clientId, auditContext);

      expect(ClientsRepository.lockClientForLifecycle).toHaveBeenCalledWith(clientId, mockTx);
      expect(ClientsRepository.archiveClient).toHaveBeenCalledWith(
        clientId,
        expect.any(Date),
        mockTx,
      );
      expect(ClientsRepository.createClientAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId,
          action: 'CLIENT_ARCHIVED',
          entityId: clientId,
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          metadata: {},
        }),
        mockTx,
      );
      expect(result.isArchived).toBe(true);
    });

    it('should rollback if audit creation fails', async () => {
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue(
        dbClient as unknown as import('../../../src/generated/prisma/client').Client,
      );
      vi.mocked(ClientsRepository.createClientAuditLog).mockRejectedValue(
        new Error('audit failure'),
      );

      await expect(
        ClientsService.archiveClient(actorUserId, clientId, auditContext),
      ).rejects.toThrow('audit failure');
    });
  });

  describe('restoreClient', () => {
    it('should throw NotFoundError if client does not exist', async () => {
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue(null);
      await expect(
        ClientsService.restoreClient(actorUserId, clientId, auditContext),
      ).rejects.toThrow(NotFoundError);
      expect(ClientsRepository.lockClientForLifecycle).toHaveBeenCalledWith(clientId, mockTx);
    });

    it('should perform same-state no-op if already active (no update, no audit)', async () => {
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue(
        dbClient as unknown as import('../../../src/generated/prisma/client').Client, // active by default
      );

      const result = await ClientsService.restoreClient(actorUserId, clientId, auditContext);

      expect(ClientsRepository.restoreClient).not.toHaveBeenCalled();
      expect(ClientsRepository.createClientAuditLog).not.toHaveBeenCalled();
      expect(result.isArchived).toBe(false);
    });

    it('should restore client and create audit if archived', async () => {
      const archivedDbClient = { ...dbClient, isArchived: true, archivedAt: new Date() };
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue(
        archivedDbClient as unknown as import('../../../src/generated/prisma/client').Client,
      );

      const restoredDbClient = { ...dbClient, isArchived: false, archivedAt: null };
      vi.mocked(ClientsRepository.restoreClient).mockResolvedValue(
        restoredDbClient as unknown as import('../../../src/generated/prisma/client').Client,
      );

      const result = await ClientsService.restoreClient(actorUserId, clientId, auditContext);

      expect(ClientsRepository.lockClientForLifecycle).toHaveBeenCalledWith(clientId, mockTx);
      expect(ClientsRepository.restoreClient).toHaveBeenCalledWith(clientId, mockTx);
      expect(ClientsRepository.createClientAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId,
          action: 'CLIENT_RESTORED',
          entityId: clientId,
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          metadata: {},
        }),
        mockTx,
      );
      expect(result.isArchived).toBe(false);
    });

    it('should rollback if audit creation fails', async () => {
      const archivedDbClient = { ...dbClient, isArchived: true, archivedAt: new Date() };
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue(
        archivedDbClient as unknown as import('../../../src/generated/prisma/client').Client,
      );
      vi.mocked(ClientsRepository.createClientAuditLog).mockRejectedValue(
        new Error('audit failure'),
      );

      await expect(
        ClientsService.restoreClient(actorUserId, clientId, auditContext),
      ).rejects.toThrow('audit failure');
    });
  });
});
