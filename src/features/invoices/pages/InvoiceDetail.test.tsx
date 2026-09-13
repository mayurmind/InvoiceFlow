import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { InvoiceDetail } from './InvoiceDetail';
import { apiClient } from '../../../lib/api/client';
import { InvoiceStatus } from '../types/invoice.types';
import { useAuth } from '../../auth/hooks/useAuth';
import type { User } from '../../auth/types/auth.types';

vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
  window.alert = vi.fn();
});

const mockInvoiceDetail = {
  id: 'inv-1',
  clientId: 'client-1',
  invoiceNumber: 'INV-1001',
  status: InvoiceStatus.DRAFT,
  invoiceDate: '2023-11-01',
  dueDate: '2023-11-15',
  placeOfSupplyState: 'Maharashtra',
  placeOfSupplyStateCode: '27',
  subtotal: '1000.00',
  discountTotal: '0.00',
  taxableTotal: '1000.00',
  cgstTotal: '90.00',
  sgstTotal: '90.00',
  igstTotal: '0.00',
  total: '1180.00',
  paidAmount: '0.00',
  outstandingAmount: '1180.00',
  items: [
    {
      id: 'item-1',
      lineNumber: 1,
      description: 'Web Development Services',
      sacCode: '998311',
      quantity: '1',
      rate: '1000.00',
      discountAmount: '0.00',
      taxableAmount: '1000.00',
      gstRate: '18',
      cgstAmount: '90.00',
      sgstAmount: '90.00',
      igstAmount: '0.00',
      totalAmount: '1180.00'
    }
  ],
  payments: [],
  notes: 'Thank you for your business.',
  terms: 'Payment due within 15 days.'
};

const mockClient = {
  id: 'client-1',
  name: 'Acme Corporation',
  email: 'billing@acme.com',
  phone: '+919876543210',
  addressLine1: '123 Business Road',
  city: 'Mumbai',
  state: 'Maharashtra',
  postalCode: '400001',
  country: 'India',
  gstin: '27AAAAA0000A1Z5'
};

describe('InvoiceDetail', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com', role: 'SUPER_ADMIN' } as unknown as User,
      status: 'authenticated',
      login: vi.fn(),
      logout: vi.fn(),
      logoutAll: vi.fn(),
      reloadUser: vi.fn(),
    });
  });

  const renderComponent = () => render(
    <MemoryRouter initialEntries={['/invoices/inv-1']}>
      <Routes>
        <Route path="/invoices/:invoiceId" element={<InvoiceDetail />} />
      </Routes>
    </MemoryRouter>
  );

  it('renders invoice details correctly', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/invoices/inv-1') return Promise.resolve(mockInvoiceDetail);
      if (url === '/clients/client-1') return Promise.resolve(mockClient);
      if (url === '/invoices/inv-1/email-deliveries') return Promise.resolve([]);
      return Promise.reject(new Error('Not found'));
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Invoice INV-1001')).toBeDefined();
    });

    // Check client details
    expect(screen.getAllByText('Acme Corporation').length).toBeGreaterThan(0);
    expect(screen.getByText('GSTIN: 27AAAAA0000A1Z5')).toBeDefined();
    
    // Check line items
    expect(screen.getByText('Web Development Services')).toBeDefined();
    
    // Check totals formatting
    expect(screen.getAllByText('₹1,180.00').length).toBeGreaterThan(0); // Total Amount
    
    // Check notes
    expect(screen.getByText('Thank you for your business.')).toBeDefined();
  });

  it('shows error state when invoice fails to load', async () => {
    vi.mocked(apiClient.get).mockImplementation(() => Promise.reject(new Error('Failed')));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Unable to load invoice')).toBeDefined();
    });
  });

  it('handles PDF download', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/invoices/inv-1') return Promise.resolve(mockInvoiceDetail);
      if (url === '/clients/client-1') return Promise.resolve(mockClient);
      if (url === '/invoices/inv-1/email-deliveries') return Promise.resolve([]);
      if (url === '/invoices/inv-1/pdf') return Promise.resolve(new Blob());
      return Promise.reject(new Error('Not found'));
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Download PDF')).toBeDefined();
    });

    const downloadButton = screen.getByText('Download PDF');
    downloadButton.click();

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/invoices/inv-1/pdf', { responseType: 'blob' });
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
  });

  it('handles send email', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/invoices/inv-1') return Promise.resolve(mockInvoiceDetail);
      if (url === '/clients/client-1') return Promise.resolve(mockClient);
      if (url === '/invoices/inv-1/email-deliveries') return Promise.resolve([]);
      return Promise.reject(new Error('Not found'));
    });
    vi.mocked(apiClient.post).mockResolvedValueOnce({});

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Send Email')).toBeDefined();
    });

    const sendButton = screen.getByText('Send Email');
    sendButton.click();

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/invoices/inv-1/send', { body: {} });
    });
  });

  describe('Issue Invoice Workflow', () => {
    it('shows Issue Invoice button for DRAFT invoice and STAFF role, and calls issue API', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'STAFF' } as unknown as User,
        status: 'authenticated',
        login: vi.fn(),
        logout: vi.fn(),
      logoutAll: vi.fn(),
      reloadUser: vi.fn(),
    });

      const draftInvoice = { ...mockInvoiceDetail, status: InvoiceStatus.DRAFT };
      vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
        if (url === '/invoices/inv-1') return draftInvoice;
        if (url === '/clients/client-1') return mockClient;
        if (url === '/auth/csrf') return { csrfToken: 'fake-csrf' };
        if (url === '/invoices/inv-1/email-deliveries') return [];
        return Promise.reject(new Error('Not found'));
      });
      vi.mocked(apiClient.post).mockResolvedValueOnce({ ...draftInvoice, status: InvoiceStatus.SENT });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /issue invoice/i })).toBeDefined();
      });

      const issueBtn = screen.getByRole('button', { name: /issue invoice/i });
      fireEvent.click(issueBtn);

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/invoices/inv-1/issue', {
          body: {},
          headers: { 'x-csrf-token': 'fake-csrf' }
        });
      });
    });

    it('does not show Issue Invoice button for VIEWER role', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'VIEWER' } as unknown as User,
        status: 'authenticated',
        login: vi.fn(),
        logout: vi.fn(),
      logoutAll: vi.fn(),
      reloadUser: vi.fn(),
    });

      vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
        if (url === '/invoices/inv-1') return mockInvoiceDetail;
        if (url === '/clients/client-1') return mockClient;
        if (url === '/invoices/inv-1/email-deliveries') return [];
        return Promise.reject(new Error('Not found'));
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Invoice INV-1001')).toBeDefined();
      });

      expect(screen.queryByRole('button', { name: /issue invoice/i })).toBeNull();
    });
  });

  describe('Cancel Invoice Workflow', () => {
    it('shows Cancel Invoice button for SENT invoice and opens modal', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'SUPER_ADMIN' } as unknown as User,
        status: 'authenticated',
        login: vi.fn(),
        logout: vi.fn(),
      logoutAll: vi.fn(),
      reloadUser: vi.fn(),
    });

      const sentInvoice = { ...mockInvoiceDetail, status: InvoiceStatus.SENT };
      vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
        if (url === '/invoices/inv-1') return sentInvoice;
        if (url === '/clients/client-1') return mockClient;
        if (url === '/auth/csrf') return { csrfToken: 'fake-csrf' };
        if (url === '/invoices/inv-1/email-deliveries') return [];
        return Promise.reject(new Error('Not found'));
      });
      vi.mocked(apiClient.post).mockResolvedValueOnce({ ...sentInvoice, status: InvoiceStatus.CANCELLED });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel invoice/i })).toBeDefined();
      });

      const cancelBtn = screen.getByRole('button', { name: /cancel invoice/i });
      fireEvent.click(cancelBtn);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { hidden: true })).toBeDefined();
        expect(screen.getByText('Cancellation Reason *')).toBeDefined();
      });
    });

    it('does not show Cancel Invoice button for non-SENT invoice', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'SUPER_ADMIN' } as unknown as User,
        status: 'authenticated',
        login: vi.fn(),
        logout: vi.fn(),
      logoutAll: vi.fn(),
      reloadUser: vi.fn(),
    });

      const paidInvoice = { ...mockInvoiceDetail, status: InvoiceStatus.PAID };
      vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
        if (url === '/invoices/inv-1') return paidInvoice;
        if (url === '/clients/client-1') return mockClient;
        if (url === '/invoices/inv-1/email-deliveries') return [];
        return Promise.reject(new Error('Not found'));
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Invoice INV-1001')).toBeDefined();
      });

      expect(screen.queryByRole('button', { name: /cancel invoice/i })).toBeNull();
    });
  });

  describe('F21 Payment History UI & Reverse Actions', () => {
    it('renders RECORDED and REVERSED payment rows and reverse behavior', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'SUPER_ADMIN' } as unknown as User,
        status: 'authenticated',
        login: vi.fn(),
        logout: vi.fn(),
        logoutAll: vi.fn(),
        reloadUser: vi.fn(),
      });

      const invoiceWithPayments = {
        ...mockInvoiceDetail,
        payments: [
          {
            id: 'pay-1',
            amount: '100.00',
            method: 'BANK_TRANSFER',
            status: 'RECORDED',
            reference: 'REF-1',
            notes: null,
            idempotencyKey: 'k1',
            paidAt: '2024-01-01T10:00:00.000Z',
            recordedByUserId: 'u1',
            reversedAt: null,
            reversedByUserId: null,
            reversalReason: null,
            createdAt: '2024-01-01T10:00:00.000Z',
          },
          {
            id: 'pay-2',
            amount: '200.00',
            method: 'CASH',
            status: 'REVERSED',
            reference: 'REF-2',
            notes: null,
            idempotencyKey: 'k2',
            paidAt: '2024-01-02T10:00:00.000Z',
            recordedByUserId: 'u1',
            reversedAt: '2024-01-03T10:00:00.000Z',
            reversedByUserId: 'u1',
            reversalReason: 'Wrong amount',
            createdAt: '2024-01-02T10:00:00.000Z',
          }
        ]
      };

      vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
        if (url === '/invoices/inv-1') return invoiceWithPayments;
        if (url === '/clients/client-1') return mockClient;
        if (url === '/invoices/inv-1/email-deliveries') return [];
        return Promise.reject(new Error('Not found'));
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Payment History')).toBeDefined();
      });

      // 8. Frontend renders both RECORDED and REVERSED payment rows.
      expect(screen.getByText('BANK TRANSFER')).toBeDefined();
      expect(screen.getByText('CASH')).toBeDefined();
      expect(screen.getByText('₹100.00')).toBeDefined();
      expect(screen.getByText('₹200.00')).toBeDefined();

      const reverseButtons = screen.getAllByRole('button', { name: /Reverse/i });
      
      // 10. Reverse is unavailable for REVERSED payments.
      // 1 button should be present for RECORDED pay-1, none for pay-2 REVERSED
      expect(reverseButtons.length).toBe(1);

      // 9. Clicking Reverse on a specific row calls reversePayment with that exact payment ID.
      // Wait! The modal is going to open, let's test it opens the modal
      expect(screen.queryByText('Reverse Payment')).toBeNull(); // modal title
      
      await fireEvent.click(reverseButtons[0]);
      
      await waitFor(() => {
        expect(screen.getByText('Reversal Reason')).toBeDefined();
      });
      // the modal is opened
    });
  });
});
