import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as service from '../../../src/features/business-settings/business-settings.service';
import * as repo from '../../../src/features/business-settings/business-settings.repository';
import type { ITXClient } from '../../../src/database/transaction';
import { NotFoundError } from '../../../src/errors/application.error';
import { BusinessSettingsDto } from '../../../src/features/business-settings/business-settings.types';

vi.mock('../../../src/features/business-settings/business-settings.repository');
vi.mock('../../../src/database/transaction', () => ({
  runInTransaction: vi.fn(async <T>(cb: (tx: ITXClient) => Promise<T>): Promise<T> =>
    cb({} as unknown as ITXClient),
  ),
}));

describe('Business Settings Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSettings: BusinessSettingsDto = {
    id: 'test-id',
    legalName: 'Test Legal Name',
    displayName: 'Test Display Name',
    gstin: null,
    pan: null,
    addressLine1: 'Line 1',
    addressLine2: null,
    city: 'City',
    state: 'State',
    stateCode: '07',
    postalCode: '110001',
    country: 'India',
    email: null,
    phone: null,
    logoStorageKey: null,
    invoicePrefix: 'INV',
    defaultDueDays: 30,
    bankAccountName: null,
    bankAccountNumber: null,
    bankName: null,
    bankIfsc: null,
    upiId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('getBusinessSettings', () => {
    it('returns settings if found', async () => {
      vi.mocked(repo.getBusinessSettings).mockResolvedValue(mockSettings);
      const result = await service.getBusinessSettings();
      expect(result).toEqual(mockSettings);
    });

    it('throws NotFoundError if not found', async () => {
      vi.mocked(repo.getBusinessSettings).mockResolvedValue(null);
      await expect(service.getBusinessSettings()).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateBusinessSettings', () => {
    const params = {
      payload: { ...mockSettings, legalName: 'New Legal Name' },
      actorUserId: 'actor-1',
      requestId: 'req-1',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    };

    it('creates settings if none exist', async () => {
      vi.mocked(repo.getBusinessSettings).mockResolvedValue(null);
      vi.mocked(repo.createBusinessSettings).mockResolvedValue(mockSettings);

      const result = await service.updateBusinessSettings(params);

      expect(result.created).toBe(true);
      expect(repo.createBusinessSettings).toHaveBeenCalled();
      expect(repo.createBusinessSettingsAuditLog).toHaveBeenCalled();
    });

    it('updates settings if they exist and are different', async () => {
      vi.mocked(repo.getBusinessSettings).mockResolvedValue(mockSettings);
      vi.mocked(repo.updateBusinessSettings).mockResolvedValue({
        ...mockSettings,
        legalName: 'New Legal Name',
      });

      const result = await service.updateBusinessSettings(params);

      expect(result.created).toBe(false);
      expect(repo.updateBusinessSettings).toHaveBeenCalled();
      expect(repo.createBusinessSettingsAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { changedFields: ['legalName'] },
        }),
        expect.anything(),
      );
    });

    it('does not update if settings are identical', async () => {
      vi.mocked(repo.getBusinessSettings).mockResolvedValue(mockSettings);

      const result = await service.updateBusinessSettings({
        ...params,
        payload: mockSettings,
      });

      expect(result.created).toBe(false);
      expect(repo.updateBusinessSettings).not.toHaveBeenCalled();
      expect(repo.createBusinessSettingsAuditLog).not.toHaveBeenCalled();
    });
  });
});
