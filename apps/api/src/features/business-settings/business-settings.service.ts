import { NotFoundError } from '../../errors/application.error';
import { runInTransaction } from '../../database/transaction';
import * as repo from './business-settings.repository';
import { BusinessSettingsDto, BusinessSettingsUpdatePayload } from './business-settings.types';

export const getBusinessSettings = async (): Promise<BusinessSettingsDto> => {
  const settings = await repo.getBusinessSettings();
  if (!settings) {
    throw new NotFoundError('Business settings are not configured');
  }
  return settings;
};

export const updateBusinessSettings = async (params: {
  payload: BusinessSettingsUpdatePayload;
  actorUserId: string;
  requestId: string;
  ipAddress: string;
  userAgent: string;
}): Promise<{ settings: BusinessSettingsDto; created: boolean }> => {
  return await runInTransaction(async (tx) => {
    // 1. Acquire transaction-scoped advisory lock for the singleton
    await repo.acquireSingletonLock(tx);

    // 2. Fetch existing settings (within lock)
    const existingSettings = await repo.getBusinessSettings(tx);

    if (!existingSettings) {
      // Create new settings
      const settings = await repo.createBusinessSettings(params.payload, tx);

      await repo.createBusinessSettingsAuditLog(
        {
          action: 'BUSINESS_SETTINGS_CREATED',
          actorUserId: params.actorUserId,
          entityType: 'BUSINESS_SETTINGS',
          entityId: settings.id,
          metadata: {},
          ipAddress: params.ipAddress.substring(0, 64),
          userAgent: params.userAgent.substring(0, 500),
          requestId: params.requestId,
        },
        tx,
      );

      return { settings, created: true };
    }

    // 3. Compute changed fields
    const changedFields: string[] = [];
    const keysToCheck: (keyof BusinessSettingsUpdatePayload)[] = [
      'legalName',
      'displayName',
      'gstin',
      'pan',
      'addressLine1',
      'addressLine2',
      'city',
      'state',
      'stateCode',
      'postalCode',
      'country',
      'email',
      'phone',
      'logoStorageKey',
      'invoicePrefix',
      'defaultDueDays',
      'bankAccountName',
      'bankAccountNumber',
      'bankName',
      'bankIfsc',
      'upiId',
    ];

    for (const key of keysToCheck) {
      const existingVal = existingSettings[key] ?? null;
      const newVal = params.payload[key] ?? null;

      // Handle null vs undefined vs empty string normalizations if necessary.
      // Zod schema enforces nulls for optionals, and Prisma returns nulls.
      if (existingVal !== newVal) {
        changedFields.push(key);
      }
    }

    // 4. Same-state no-op logic
    if (changedFields.length === 0) {
      return { settings: existingSettings, created: false };
    }

    // 5. Update settings
    const updatedSettings = await repo.updateBusinessSettings(
      existingSettings.id,
      params.payload,
      tx,
    );

    // 6. Create Audit log
    await repo.createBusinessSettingsAuditLog(
      {
        action: 'BUSINESS_SETTINGS_UPDATED',
        actorUserId: params.actorUserId,
        entityType: 'BUSINESS_SETTINGS',
        entityId: updatedSettings.id,
        metadata: { changedFields },
        ipAddress: params.ipAddress.substring(0, 64),
        userAgent: params.userAgent.substring(0, 500),
        requestId: params.requestId,
      },
      tx,
    );

    return { settings: updatedSettings, created: false };
  });
};
