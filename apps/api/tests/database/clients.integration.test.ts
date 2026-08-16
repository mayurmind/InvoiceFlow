import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { prisma } from '../../src/database/prisma';
import { ClientsService } from '../../src/features/clients/clients.service';

describe('Clients Database Integration', () => {
  let initialClientCount: number;
  let initialAuditCount: number;
  let actorUserId: string;

  beforeAll(async () => {
    // Assert we are connected to the test database
    const dbResult = await prisma.$queryRaw<
      { current_database: string }[]
    >`SELECT current_database()`;
    expect(dbResult[0].current_database).toBe('invoiceflow_test');

    // Capture baseline BEFORE any fixture setup
    initialClientCount = await prisma.client.count();
    initialAuditCount = await prisma.auditLog.count();

    // Use a fixed stable UUID so the test is idempotent across re-runs.
    // The actor user is NOT counted as a test delta — it lives for the duration of this suite.
    actorUserId = 'a0000000-0000-4000-a000-000000000001';

    // Try to create; if already exists from a previous partial run, just reuse it.
    const existing = await prisma.user.findUnique({ where: { id: actorUserId } });
    if (!existing) {
      // Delete any conflicting email record first (idempotent cleanup)
      await prisma.user.deleteMany({ where: { email: 'client-actor@example.com' } });
      await prisma.user.create({
        data: {
          id: actorUserId,
          email: 'client-actor@example.com',
          firstName: 'Client',
          lastName: 'Actor',
          passwordHash: 'dummy',
          role: 'STAFF',
        },
      });
    }
  });

  afterAll(async () => {
    // Delete audit logs attributed to actor (TRUNCATE bypasses append-only row trigger)
    await prisma.$executeRaw`TRUNCATE TABLE public.audit_logs`;
    // Delete any remaining clients created by actor
    await prisma.client.deleteMany({ where: { createdByUserId: actorUserId } });
    // Now delete the actor user
    await prisma.user.deleteMany({ where: { id: actorUserId } });

    // Assert row delta is 0
    const finalClientCount = await prisma.client.count();
    const finalAuditCount = await prisma.auditLog.count();
    expect(finalClientCount).toBe(initialClientCount);
    expect(finalAuditCount).toBe(initialAuditCount);
  });

  describe('Create and Update Client Flow', () => {
    const createdClientIds: string[] = [];

    afterEach(async () => {
      if (createdClientIds.length > 0) {
        // Delete clients first
        await prisma.client.deleteMany({
          where: { id: { in: createdClientIds } },
        });
        // Audit logs are append-only (trigger blocks DELETE); use TRUNCATE which bypasses row triggers
        await prisma.$executeRaw`TRUNCATE TABLE public.audit_logs`;
        createdClientIds.length = 0;
      }
    });

    const basePayload = {
      email: null as string | null,
      phone: null as string | null,
      gstin: null as string | null,
      pan: null as string | null,
      addressLine2: null as string | null,
      notes: null as string | null,
      addressLine1: 'Line 1',
      city: 'Pune',
      state: 'Maharashtra',
      stateCode: '27',
      postalCode: '411001',
      country: 'India',
    };

    const auditContext = { requestId: 'req-db-1', ipAddress: '127.0.0.1', userAgent: 'vitest' };

    it('should atomically create a client and its audit log', async () => {
      const payload = { ...basePayload, name: 'DB Test Client', email: 'db@example.com' };

      const client = await ClientsService.createClient(actorUserId, payload, auditContext);
      createdClientIds.push(client.id);

      // Verify returned data
      expect(client.name).toBe('DB Test Client');
      expect((client as Record<string, unknown>).createdByUserId).toBeUndefined(); // omitted

      // Verify persistence
      const dbClient = await prisma.client.findUnique({ where: { id: client.id } });
      expect(dbClient).not.toBeNull();
      expect(dbClient!.createdByUserId).toBe(actorUserId);

      // Verify CLIENT_CREATED audit
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: client.id, action: 'CLIENT_CREATED' },
      });
      expect(audit).not.toBeNull();
      expect(audit!.actorUserId).toBe(actorUserId);
      expect(audit!.entityType).toBe('CLIENT');
    });

    it('should atomically update a client and log changed fields (no PII in metadata)', async () => {
      const payload = { ...basePayload, name: 'Update Client', email: 'update@example.com' };
      const client = await ClientsService.createClient(actorUserId, payload, {
        ...auditContext,
        requestId: 'req-db-2',
      });
      createdClientIds.push(client.id);

      // Update name and phone
      const updatedPayload = { ...payload, name: 'Updated Name', phone: '11111' };
      const updatedClient = await ClientsService.updateClient(
        actorUserId,
        client.id,
        updatedPayload,
        { ...auditContext, requestId: 'req-db-2u' },
      );

      expect(updatedClient.name).toBe('Updated Name');
      expect(updatedClient.phone).toBe('11111');

      // Verify CLIENT_UPDATED audit
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: client.id, action: 'CLIENT_UPDATED' },
      });
      expect(audit).not.toBeNull();
      const metadata = audit!.metadata as Record<string, unknown>;
      expect(metadata.changedFields).toContain('name');
      expect(metadata.changedFields).toContain('phone');
      expect(metadata.changedFields).not.toContain('email'); // not changed

      // No PII in metadata
      expect(metadata.name).toBeUndefined();
      expect(metadata.email).toBeUndefined();
      expect(metadata.phone).toBeUndefined();
    });

    it('should be a no-op on same-value update (updatedAt unchanged, no new audit)', async () => {
      const payload = { ...basePayload, name: 'Same Value Client' };
      const client = await ClientsService.createClient(actorUserId, payload, {
        ...auditContext,
        requestId: 'req-db-3',
      });
      createdClientIds.push(client.id);

      const dbClientBefore = await prisma.client.findUnique({ where: { id: client.id } });

      // Execute update with same exact payload
      await ClientsService.updateClient(actorUserId, client.id, payload, {
        ...auditContext,
        requestId: 'req-db-3u',
      });

      const dbClientAfter = await prisma.client.findUnique({ where: { id: client.id } });

      // updatedAt should not change
      expect(dbClientAfter!.updatedAt.getTime()).toBe(dbClientBefore!.updatedAt.getTime());

      // No CLIENT_UPDATED audit should exist
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: client.id, action: 'CLIENT_UPDATED' },
      });
      expect(audit).toBeNull();
    });

    it('should allow duplicate emails and GSTINs', async () => {
      const payload = {
        ...basePayload,
        name: 'Dup 1',
        email: 'dup@example.com',
        gstin: '27AADCB2230M1Z2',
        pan: 'AADCB2230M',
      };

      const c1 = await ClientsService.createClient(actorUserId, payload, {
        ...auditContext,
        requestId: 'req-db-4a',
      });
      createdClientIds.push(c1.id);

      const payload2 = { ...payload, name: 'Dup 2' };
      const c2 = await ClientsService.createClient(actorUserId, payload2, {
        ...auditContext,
        requestId: 'req-db-4b',
      });
      createdClientIds.push(c2.id);

      expect(c1.id).toBeDefined();
      expect(c2.id).toBeDefined();
      expect(c1.id).not.toBe(c2.id);
    });

    it('should allow updating an archived client profile (without changing archive state)', async () => {
      // Seed an archived client directly (with archivedAt to satisfy check constraint)
      const archivedClient = await prisma.client.create({
        data: {
          ...basePayload,
          name: 'Archived Client',
          createdByUserId: actorUserId,
          isArchived: true,
          archivedAt: new Date(),
        },
      });
      createdClientIds.push(archivedClient.id);

      const updatePayload = { ...basePayload, name: 'Archived Client Updated' };

      const updated = await ClientsService.updateClient(
        actorUserId,
        archivedClient.id,
        updatePayload,
        { ...auditContext, requestId: 'req-db-arch' },
      );

      expect(updated.name).toBe('Archived Client Updated');
      // Archive state must remain unchanged
      const dbCheck = await prisma.client.findUnique({ where: { id: archivedClient.id } });
      expect(dbCheck!.isArchived).toBe(true);
    });

    it('rolls back completely if CLIENT_UPDATED audit insertion fails due to FK violation', async () => {
      const payload = { ...basePayload, name: 'Rollback Client', email: 'rollback@example.com' };
      const client = await ClientsService.createClient(actorUserId, payload, {
        ...auditContext,
        requestId: 'req-db-rb-1',
      });
      createdClientIds.push(client.id);

      const dbClientBefore = await prisma.client.findUnique({ where: { id: client.id } });
      expect(dbClientBefore).not.toBeNull();

      // Use a nonexistent actor to force FK failure on audit log
      const nonexistentActorId = '00000000-0000-0000-0000-000000000000';
      const updatedPayload = { ...payload, name: 'SHOULD NOT SAVE' };

      await expect(
        ClientsService.updateClient(nonexistentActorId, client.id, updatedPayload, {
          ...auditContext,
          requestId: 'req-db-rb-2',
        }),
      ).rejects.toThrow();

      // Refetch
      const dbClientAfter = await prisma.client.findUnique({ where: { id: client.id } });
      expect(dbClientAfter!.name).toBe('Rollback Client'); // profile remains unchanged

      const audit = await prisma.auditLog.findFirst({
        where: { entityId: client.id, action: 'CLIENT_UPDATED' },
      });
      expect(audit).toBeNull();
    });
  });

  describe('Search, Filter and Pagination', () => {
    const createdClientIds: string[] = [];

    beforeAll(async () => {
      // Seed clients for search test
      const baseClient = {
        createdByUserId: actorUserId,
        addressLine1: 'Line 1',
        city: 'City',
        state: 'Maharashtra',
        stateCode: '27',
        postalCode: '400000',
      };

      const data = [
        {
          ...baseClient,
          name: 'Alpha Tech',
          email: 'alpha@test.com',
          phone: '1000',
          pan: 'AAAAA1111A',
        },
        {
          ...baseClient,
          name: 'Beta Corp',
          email: 'beta@test.com',
          phone: '2000',
          pan: 'BBBBB2222B',
        },
        {
          ...baseClient,
          name: 'Gamma Ltd',
          email: 'gamma@test.com',
          phone: '3000',
          pan: 'CCCCC3333C',
          stateCode: '29',
          state: 'Karnataka',
        },
        {
          ...baseClient,
          name: 'Delta Inc',
          email: 'delta@test.com',
          phone: '4000',
          isArchived: true,
          archivedAt: new Date(),
        },
      ];

      for (const d of data) {
        const c = await prisma.client.create({ data: d });
        createdClientIds.push(c.id);
      }
    });

    afterAll(async () => {
      await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
    });

    it('should list active clients by default', async () => {
      const result = await ClientsService.listClients({ page: 1, limit: 10, status: 'active' });
      expect(result.data.length).toBeGreaterThanOrEqual(3); // Alpha, Beta, Gamma
      const foundArchived = result.data.some((c) => c.name === 'Delta Inc');
      expect(foundArchived).toBe(false);
    });

    it('should list archived clients', async () => {
      const result = await ClientsService.listClients({ page: 1, limit: 10, status: 'archived' });
      const foundDelta = result.data.some((c) => c.name === 'Delta Inc');
      expect(foundDelta).toBe(true);
      const foundAlpha = result.data.some((c) => c.name === 'Alpha Tech');
      expect(foundAlpha).toBe(false);
    });

    it('should search by name', async () => {
      const result = await ClientsService.listClients({
        page: 1,
        limit: 10,
        status: 'active',
        search: 'alpha',
      });
      expect(result.data.length).toBe(1);
      expect(result.data[0].name).toBe('Alpha Tech');
    });

    it('should search by PAN', async () => {
      const result = await ClientsService.listClients({
        page: 1,
        limit: 10,
        status: 'active',
        search: 'BBBBB2222B',
      });
      expect(result.data.length).toBe(1);
      expect(result.data[0].name).toBe('Beta Corp');
    });

    it('should filter by stateCode', async () => {
      const result = await ClientsService.listClients({
        page: 1,
        limit: 10,
        status: 'active',
        stateCode: '29',
      });
      expect(result.data.length).toBe(1);
      expect(result.data[0].name).toBe('Gamma Ltd');
    });

    it('should paginate correctly', async () => {
      const result1 = await ClientsService.listClients({ page: 1, limit: 2, status: 'active' });
      expect(result1.data.length).toBe(2);
      expect(result1.pagination.total).toBeGreaterThanOrEqual(3);
      expect(result1.pagination.hasNextPage).toBe(true);

      const result2 = await ClientsService.listClients({ page: 2, limit: 2, status: 'active' });
      expect(result2.data.length).toBeGreaterThanOrEqual(1);
      expect(result2.pagination.hasPreviousPage).toBe(true);

      // Ensure stable ordering (no overlap)
      const idsPage1 = result1.data.map((c) => c.id);
      const idsPage2 = result2.data.map((c) => c.id);
      expect(idsPage1.some((id) => idsPage2.includes(id))).toBe(false);
    });
  });

  describe('Archive and Restore Flow', () => {
    let clientId: string;

    beforeAll(async () => {
      const client = await ClientsService.createClient(
        actorUserId,
        {
          name: 'Lifecycle Test Client',
          email: 'lifecycle@example.com',
          phone: '9999999999',
          gstin: null,
          pan: null,
          addressLine1: 'L1',
          addressLine2: null,
          city: 'Pune',
          state: 'Maharashtra',
          stateCode: '27',
          postalCode: '411001',
          country: 'India',
          notes: null,
        },
        { requestId: 'req-lifecycle', ipAddress: '127.0.0.1', userAgent: 'test' },
      );
      clientId = client.id;
    });

    afterAll(async () => {
      await prisma.client.deleteMany({ where: { id: clientId } });
    });

    it('concurrent archive requests => exactly one CLIENT_ARCHIVED audit', async () => {
      const initialClient = await prisma.client.findUnique({ where: { id: clientId } });
      expect(initialClient?.isArchived).toBe(false);

      const auditCountBefore = await prisma.auditLog.count({
        where: { action: 'CLIENT_ARCHIVED', entityId: clientId },
      });
      expect(auditCountBefore).toBe(0);

      const promises = Array.from({ length: 5 }).map((_, i) =>
        ClientsService.archiveClient(actorUserId, clientId, {
          requestId: `req-archive-${i}`,
          ipAddress: '127.0.0.1',
          userAgent: 'concurrent-test',
        }),
      );

      await Promise.all(promises);

      const archivedClient = await prisma.client.findUnique({ where: { id: clientId } });
      expect(archivedClient?.isArchived).toBe(true);
      expect(archivedClient?.archivedAt).not.toBeNull();

      const auditCountAfter = await prisma.auditLog.count({
        where: { action: 'CLIENT_ARCHIVED', entityId: clientId },
      });
      expect(auditCountAfter).toBe(1); // Only one audit log because of lock + same-state check
    });

    it('repeated archive keeps updatedAt and archivedAt unchanged', async () => {
      const client1 = await prisma.client.findUnique({ where: { id: clientId } });

      await ClientsService.archiveClient(actorUserId, clientId, {
        requestId: 'req-archive-repeat',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
      });

      const client2 = await prisma.client.findUnique({ where: { id: clientId } });
      expect(client2?.updatedAt).toEqual(client1?.updatedAt);
      expect(client2?.archivedAt).toEqual(client1?.archivedAt);

      const auditCount = await prisma.auditLog.count({
        where: { action: 'CLIENT_ARCHIVED', entityId: clientId },
      });
      expect(auditCount).toBe(1); // Still 1
    });

    it('archived Client remains readable and profile-editable under P4.3', async () => {
      const result = await ClientsService.getClientById(clientId);
      expect(result.id).toBe(clientId);

      const updated = await ClientsService.updateClient(
        actorUserId,
        clientId,
        {
          name: 'Lifecycle Test Client Updated',
          email: 'lifecycle@example.com',
          phone: '9999999999',
          gstin: null,
          pan: null,
          addressLine1: 'L1',
          addressLine2: null,
          city: 'Pune',
          state: 'Maharashtra',
          stateCode: '27',
          postalCode: '411001',
          country: 'India',
          notes: 'Archived edit',
        },
        { requestId: 'req-archived-edit', ipAddress: '127.0.0.1', userAgent: 'test' },
      );
      expect(updated.name).toBe('Lifecycle Test Client Updated');
    });

    it('concurrent restore requests => exactly one CLIENT_RESTORED audit', async () => {
      const promises = Array.from({ length: 5 }).map((_, i) =>
        ClientsService.restoreClient(actorUserId, clientId, {
          requestId: `req-restore-${i}`,
          ipAddress: '127.0.0.1',
          userAgent: 'concurrent-test',
        }),
      );

      await Promise.all(promises);

      const restoredClient = await prisma.client.findUnique({ where: { id: clientId } });
      expect(restoredClient?.isArchived).toBe(false);
      expect(restoredClient?.archivedAt).toBeNull();

      const auditCountAfter = await prisma.auditLog.count({
        where: { action: 'CLIENT_RESTORED', entityId: clientId },
      });
      expect(auditCountAfter).toBe(1);
    });

    it('repeated restore keeps updatedAt unchanged', async () => {
      const client1 = await prisma.client.findUnique({ where: { id: clientId } });

      await ClientsService.restoreClient(actorUserId, clientId, {
        requestId: 'req-restore-repeat',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
      });

      const client2 = await prisma.client.findUnique({ where: { id: clientId } });
      expect(client2?.updatedAt).toEqual(client1?.updatedAt);

      const auditCount = await prisma.auditLog.count({
        where: { action: 'CLIENT_RESTORED', entityId: clientId },
      });
      expect(auditCount).toBe(1); // Still 1
    });

    it('audit metadata contains no PII', async () => {
      const auditLog = await prisma.auditLog.findFirst({
        where: { entityId: clientId, action: 'CLIENT_ARCHIVED' },
      });
      expect(auditLog?.metadata).toEqual({});
    });

    it('rolls back completely if CLIENT_ARCHIVED audit insertion fails due to FK violation', async () => {
      // Create a fresh active client
      const freshClient = await ClientsService.createClient(
        actorUserId,
        {
          name: 'Rollback Archive Client',
          email: 'rb-archive@example.com',
          phone: null,
          gstin: null,
          pan: null,
          addressLine1: 'L1',
          addressLine2: null,
          city: 'Pune',
          state: 'Maharashtra',
          stateCode: '27',
          postalCode: '411001',
          country: 'India',
          notes: null,
        },
        { requestId: 'req-archive-rb-1', ipAddress: '127.0.0.1', userAgent: 'test' },
      );

      const nonexistentActorId = '00000000-0000-0000-0000-000000000000';

      await expect(
        ClientsService.archiveClient(nonexistentActorId, freshClient.id, {
          requestId: 'req-archive-rb-2',
          ipAddress: '127.0.0.1',
          userAgent: 'test',
        }),
      ).rejects.toThrow();

      // Refetch
      const dbClientAfter = await prisma.client.findUnique({ where: { id: freshClient.id } });
      expect(dbClientAfter!.isArchived).toBe(false);
      expect(dbClientAfter!.archivedAt).toBeNull();

      const audit = await prisma.auditLog.findFirst({
        where: { entityId: freshClient.id, action: 'CLIENT_ARCHIVED' },
      });
      expect(audit).toBeNull();
    });
  });
});
