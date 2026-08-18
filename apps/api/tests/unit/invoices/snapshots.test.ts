import {
  createBusinessSnapshotV1,
  createClientSnapshotV1,
} from '../../../src/features/invoices/domain/snapshots';

describe('snapshots', () => {
  describe('createBusinessSnapshotV1', () => {
    it('creates exact snapshot with null preservation', () => {
      const mockSettings = {
        id: 'uuid-1',
        singletonKey: 'DEFAULT',
        legalName: 'Test Business',
        displayName: 'Test',
        gstin: null,
        pan: null,
        addressLine1: 'Line 1',
        addressLine2: null,
        city: 'City',
        state: 'State',
        stateCode: '01',
        postalCode: '100000',
        country: 'India',
        email: null,
        phone: null,
        logoStorageKey: null,
        invoicePrefix: 'INV',
        defaultDueDays: 15,
        bankAccountName: null,
        bankAccountNumber: null,
        bankName: null,
        bankIfsc: null,
        upiId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = createBusinessSnapshotV1(mockSettings);

      expect(result).toStrictEqual({
        version: 1,
        legalName: 'Test Business',
        displayName: 'Test',
        gstin: null,
        pan: null,
        addressLine1: 'Line 1',
        addressLine2: null,
        city: 'City',
        state: 'State',
        stateCode: '01',
        postalCode: '100000',
        country: 'India',
        email: null,
        phone: null,
        logoStorageKey: null,
        bankAccountName: null,
        bankAccountNumber: null,
        bankName: null,
        bankIfsc: null,
        upiId: null,
      });

      // Verify omitted fields
      expect(Object.keys(result)).not.toContain('invoicePrefix');
      expect(Object.keys(result)).not.toContain('defaultDueDays');
    });
  });

  describe('createClientSnapshotV1', () => {
    it('creates exact snapshot with null preservation', () => {
      const mockClient = {
        id: 'client-1',
        name: 'Client A',
        email: 'client@example.com',
        phone: null,
        gstin: null,
        pan: null,
        addressLine1: 'Add 1',
        addressLine2: null,
        city: 'City',
        state: 'State',
        stateCode: '02',
        postalCode: '200000',
        country: 'India',
        notes: 'Some notes',
        isArchived: false,
        archivedAt: null,
        createdByUserId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = createClientSnapshotV1(mockClient);

      expect(result).toStrictEqual({
        version: 1,
        clientId: 'client-1',
        name: 'Client A',
        email: 'client@example.com',
        phone: null,
        gstin: null,
        pan: null,
        addressLine1: 'Add 1',
        addressLine2: null,
        city: 'City',
        state: 'State',
        stateCode: '02',
        postalCode: '200000',
        country: 'India',
      });

      // Verify omitted fields
      expect(Object.keys(result)).not.toContain('notes');
    });
  });
});
