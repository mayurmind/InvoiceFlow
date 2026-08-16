import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '../../src/database/prisma';
import * as service from '../../src/features/business-settings/business-settings.service';
import { BusinessSettingsUpdatePayload } from '../../src/features/business-settings/business-settings.types';
import { NotFoundError } from '../../src/errors/application.error';
import { randomUUID } from 'crypto';

describe('BusinessSettings Integration', () => {
  let actorUserId: string;

  beforeEach(async () => {
    const [{ current_database }] = await prisma.$queryRaw<Array<{ current_database: string }>>`
      SELECT current_database() AS current_database
    `;
    expect(current_database).toBe('invoiceflow_test');

    await prisma.$executeRaw`TRUNCATE TABLE public."audit_logs" CASCADE`;
    await prisma.businessSettings.deleteMany();

    const user = await prisma.user.create({
      data: {
        email: 'admin@test.local',
        passwordHash: 'hash',
        firstName: 'Test',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
      },
    });
    actorUserId = user.id;
  });

  afterEach(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE public."audit_logs" CASCADE`;
    await prisma.businessSettings.deleteMany();
    if (actorUserId) {
      await prisma.user.delete({ where: { id: actorUserId } });
    }
  });

  const getValidPayload = (): BusinessSettingsUpdatePayload => ({
    legalName: 'Test Legal Name',
    displayName: 'Test Display Name',
    addressLine1: 'Test Address 1',
    city: 'Mumbai',
    state: 'Maharashtra',
    stateCode: '27',
    postalCode: '400001',
    country: 'India',
    invoicePrefix: 'INV',
    defaultDueDays: 15,
  });

  const getMetadata = () => ({
    actorUserId,
    requestId: randomUUID(),
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
  });

  it('throws NotFoundError if not configured', async () => {
    await expect(service.getBusinessSettings()).rejects.toThrow(NotFoundError);
  });

  it('creates singleton and BUSINESS_SETTINGS_CREATED audit if not configured', async () => {
    const payload = getValidPayload();
    const meta = getMetadata();

    const { settings, created } = await service.updateBusinessSettings({
      payload,
      ...meta,
    });

    expect(created).toBe(true);
    expect(settings.legalName).toBe(payload.legalName);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'BUSINESS_SETTINGS_CREATED' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorUserId).toBe(meta.actorUserId);
  });

  it('updates singleton and BUSINESS_SETTINGS_UPDATED audit if configured', async () => {
    const payload = getValidPayload();
    const meta1 = getMetadata();

    // Create
    await service.updateBusinessSettings({ payload, ...meta1 });

    // Update
    const payload2: BusinessSettingsUpdatePayload = {
      ...payload,
      legalName: 'New Legal Name',
    };
    const meta2 = getMetadata();

    const { settings, created } = await service.updateBusinessSettings({
      payload: payload2,
      ...meta2,
    });

    expect(created).toBe(false);
    expect(settings.legalName).toBe('New Legal Name');

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'BUSINESS_SETTINGS_UPDATED' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.metadata).toMatchObject({ changedFields: ['legalName'] });
  });

  it('returns no-op and does not audit if identical', async () => {
    const payload = getValidPayload();
    const meta = getMetadata();

    // Create
    const { settings: initialSettings } = await service.updateBusinessSettings({
      payload,
      ...meta,
    });
    const initialCount = await prisma.auditLog.count();

    // Update with exact same payload
    const { created, settings: finalSettings } = await service.updateBusinessSettings({
      payload,
      ...meta,
    });

    expect(created).toBe(false);
    expect(finalSettings.updatedAt.getTime()).toBe(initialSettings.updatedAt.getTime());

    const finalCount = await prisma.auditLog.count();
    expect(finalCount).toBe(initialCount);
  });

  it('does not log sensitive values in BUSINESS_SETTINGS_UPDATED audit metadata', async () => {
    const payload = getValidPayload();
    const meta = getMetadata();

    await service.updateBusinessSettings({ payload, ...meta });

    const sensitivePayload: BusinessSettingsUpdatePayload = {
      ...payload,
      bankAccountNumber: 'SECRET_BANK_123',
      bankIfsc: 'SECRET_IFSC',
      upiId: 'SECRET_UPI',
    };

    await service.updateBusinessSettings({ payload: sensitivePayload, ...meta });

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'BUSINESS_SETTINGS_UPDATED' },
      orderBy: { createdAt: 'desc' },
    });

    expect(audit).not.toBeNull();
    const metadataStr = JSON.stringify(audit?.metadata);

    expect(audit?.metadata).toMatchObject({
      changedFields: expect.arrayContaining(['bankAccountNumber', 'bankIfsc', 'upiId']),
    });

    expect(metadataStr).not.toContain('SECRET_BANK_123');
    expect(metadataStr).not.toContain('SECRET_IFSC');
    expect(metadataStr).not.toContain('SECRET_UPI');
  });

  it('prevents concurrent configuration via transaction-scoped advisory locks', async () => {
    const payload = getValidPayload();
    const meta = getMetadata();

    // Attempt to create concurrently
    const promises = [
      service.updateBusinessSettings({ payload, ...meta }),
      service.updateBusinessSettings({ payload, ...meta }),
      service.updateBusinessSettings({ payload, ...meta }),
    ];

    const results = await Promise.all(promises);

    // One should have created = true, the others created = false (no-op)
    const createdCount = results.filter((r) => r.created).length;
    expect(createdCount).toBe(1);

    const totalSettings = await prisma.businessSettings.count();
    expect(totalSettings).toBe(1);

    const createdAudits = await prisma.auditLog.count({
      where: { action: 'BUSINESS_SETTINGS_CREATED' },
    });
    expect(createdAudits).toBe(1);
  });

  it('rolls back completely on error', async () => {
    const meta = getMetadata();
    const payload = getValidPayload();

    const badPayload = { ...payload, invoicePrefix: 'TOOLONGPREFIX' };

    await expect(
      service.updateBusinessSettings({ payload: badPayload, ...meta }),
    ).rejects.toThrow();

    const count = await prisma.businessSettings.count();
    expect(count).toBe(0);

    const audits = await prisma.auditLog.count();
    expect(audits).toBe(0);
  });

  it('rolls back completely if audit insertion fails due to FK violation', async () => {
    const meta = getMetadata();
    const payload = getValidPayload();

    // Configure first
    const { settings: initialSettings } = await service.updateBusinessSettings({
      payload,
      ...meta,
    });
    const initialCount = await prisma.auditLog.count();

    // Update with missing actorUserId (to trigger FK on audit log)
    const badMeta = {
      ...meta,
      actorUserId: '00000000-0000-0000-0000-000000000000',
    };

    const updatePayload = { ...payload, legalName: 'SHOULD NOT SAVE' };

    await expect(
      service.updateBusinessSettings({ payload: updatePayload, ...badMeta }),
    ).rejects.toThrow();

    const currentSettings = await prisma.businessSettings.findFirstOrThrow();
    expect(currentSettings.legalName).toBe(initialSettings.legalName);
    expect(currentSettings.updatedAt.getTime()).toBe(initialSettings.updatedAt.getTime());

    const audits = await prisma.auditLog.count();
    expect(audits).toBe(initialCount);
  });
});
