import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as repo from '../../../src/features/business-settings/business-settings.repository';
import { prisma } from '../../../src/database/prisma';
import type { ITXClient } from '../../../src/database/transaction';
import type { BusinessSettingsUpdatePayload } from '../../../src/features/business-settings/business-settings.types';

vi.mock('../../../src/database/prisma', () => ({
  prisma: {
    businessSettings: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

describe('Business Settings Repository', () => {
  let mockTx: ITXClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx = {
      $executeRawUnsafe: vi.fn(),
      businessSettings: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    } as unknown as ITXClient;
  });

  describe('acquireSingletonLock', () => {
    it('executes the advisory lock query', async () => {
      await repo.acquireSingletonLock(mockTx);
      expect(mockTx.$executeRawUnsafe).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(1001)');
    });
  });

  describe('getBusinessSettings', () => {
    it('uses the provided transaction client', async () => {
      await repo.getBusinessSettings(mockTx);
      expect(mockTx.businessSettings.findUnique).toHaveBeenCalledWith({
        where: { singletonKey: 'DEFAULT' },
      });
    });

    it('uses prisma if no transaction client is provided', async () => {
      await repo.getBusinessSettings();
      expect(prisma.businessSettings.findUnique).toHaveBeenCalledWith({
        where: { singletonKey: 'DEFAULT' },
      });
    });
  });

  describe('createBusinessSettings', () => {
    it('creates settings with DEFAULT singleton key', async () => {
      const payload = {
        legalName: 'Test',
      } as unknown as BusinessSettingsUpdatePayload;
      await repo.createBusinessSettings(payload, mockTx);
      expect(mockTx.businessSettings.create).toHaveBeenCalledWith({
        data: {
          singletonKey: 'DEFAULT',
          ...payload,
        },
      });
    });
  });

  describe('updateBusinessSettings', () => {
    it('updates settings by id', async () => {
      const payload = {
        legalName: 'Test',
      } as unknown as BusinessSettingsUpdatePayload;
      await repo.updateBusinessSettings('test-id', payload, mockTx);
      expect(mockTx.businessSettings.update).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: payload,
      });
    });
  });

  describe('createBusinessSettingsAuditLog', () => {
    it('creates audit log with correct data', async () => {
      const data = {
        action: 'TEST_ACTION',
        actorUserId: 'user-1',
        entityType: 'TEST_ENTITY',
        entityId: 'entity-1',
        metadata: { changedFields: ['field1'] },
        ipAddress: '127.0.0.1',
        userAgent: 'agent',
        requestId: 'req-1',
      };

      await repo.createBusinessSettingsAuditLog(data, mockTx);

      expect(mockTx.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: data.action,
          actorUserId: data.actorUserId,
          entityType: data.entityType,
          entityId: data.entityId,
          metadata: data.metadata,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          requestId: data.requestId,
        },
      });
    });
  });
});
