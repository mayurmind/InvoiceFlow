import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InvoicesList } from './InvoicesList';
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
  },
}));

const mockInvoicesResponse = {
  data: [
    {
      id: 'inv-1',
      clientId: 'client-1',
      invoiceNumber: 'INV-1001',
      status: InvoiceStatus.PAID,
      invoiceDate: '2023-11-01',
      dueDate: '2023-11-15',
      total: '1000.50',
    }
  ],
  pagination: {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  }
};

const mockClientsResponse = {
  data: [
    {
      id: 'client-1',
      name: 'Acme Corporation',
    }
  ],
  pagination: {
    page: 1,
    limit: 1000,
    total: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  }
};

describe('InvoicesList', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com', role: 'STAFF' } as unknown as User,
      status: 'authenticated',
      login: vi.fn(),
      logout: vi.fn(),
      logoutAll: vi.fn(),
      reloadUser: vi.fn(),
    });
  });

  it('renders loading state initially', () => {
    vi.mocked(apiClient.get).mockImplementation(() => new Promise(() => {}));
    render(
      <MemoryRouter>
        <InvoicesList />
      </MemoryRouter>
    );
    expect(screen.getByText('Invoices')).toBeDefined();
  });

  it('renders invoice data and maps client name correctly', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes('/invoices')) return Promise.resolve(mockInvoicesResponse);
      if (url.includes('/clients')) return Promise.resolve(mockClientsResponse.data[0]);
      return Promise.reject(new Error('Not found'));
    });

    render(
      <MemoryRouter>
        <InvoicesList />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('INV-1001')).toBeDefined();
    });

    expect(screen.getAllByText('Acme Corporation').length).toBeGreaterThan(0);
    expect(screen.getByText('₹1,000.50')).toBeDefined();
  });

  it('shows empty state when no invoices exist', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes('/invoices')) return Promise.resolve({ ...mockInvoicesResponse, data: [] });
      if (url.includes('/clients')) return Promise.resolve(mockClientsResponse.data[0]);
      return Promise.reject(new Error('Not found'));
    });

    render(
      <MemoryRouter>
        <InvoicesList />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No invoices found')).toBeDefined();
    });
  });

  it('shows error state on failure', async () => {
    vi.mocked(apiClient.get).mockImplementation(() => Promise.reject(new Error('API Error')));

    render(
      <MemoryRouter>
        <InvoicesList />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Unable to load invoices')).toBeDefined();
    });
  });

  it('passes the search query parameter to the API', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes('/invoices')) return Promise.resolve(mockInvoicesResponse);
      if (url.includes('/clients')) return Promise.resolve(mockClientsResponse.data[0]);
      return Promise.reject(new Error('Not found'));
    });

    render(
      <MemoryRouter initialEntries={['/invoices?search=Acme']}>
        <InvoicesList />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('search=Acme'));
    });
  });
});
