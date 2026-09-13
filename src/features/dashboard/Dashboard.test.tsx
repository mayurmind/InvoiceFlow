/* eslint-disable @typescript-eslint/no-explicit-any */
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPlaceholder } from './Dashboard';
import { apiClient } from '../../lib/api/client';
import { ApiError } from '../../lib/api/errors';
import { InvoiceStatus, PaymentMethod, PaymentStatus } from './types/dashboard.types';
import { useAuth } from '../auth/hooks/useAuth';
import type { User } from '../auth/types/auth.types';

vi.mock('../auth/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

vi.mock('../../components/layout/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <div data-testid="page-header">{title}</div>,
}));

const mockSummary = {
  outstandingAmount: '5000.50',
  paidAmount: '12000.00',
  invoiceStatusCounts: {
    [InvoiceStatus.DRAFT]: 1,
    [InvoiceStatus.SENT]: 2,
    [InvoiceStatus.PARTIALLY_PAID]: 0,
    [InvoiceStatus.PAID]: 3,
    [InvoiceStatus.CANCELLED]: 0,
  },
  recentInvoices: [
    {
      id: 'inv-1',
      invoiceNumber: 'INV-001',
      status: InvoiceStatus.PAID,
      dueDate: '2023-12-01T00:00:00Z',
      clientName: 'Acme Corp',
      total: '1000.00',
    },
  ],
  recentPayments: [
    {
      id: 'pay-1',
      invoiceId: 'inv-1',
      amount: '1000.00',
      method: PaymentMethod.BANK_TRANSFER,
      status: PaymentStatus.COMPLETED,
      paidAt: '2023-11-20T00:00:00Z',
    },
  ],
};

const mockClientsList = {
  data: [],
  pagination: {
    page: 1,
    limit: 1,
    total: 42,
    totalPages: 42,
    hasNextPage: true,
    hasPreviousPage: false,
  },
};

describe('DashboardPlaceholder', () => {
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

  it('renders loading state initially', async () => {
    (apiClient.get as any).mockImplementation(() => new Promise(() => {}));
    
    render(<MemoryRouter><DashboardPlaceholder /></MemoryRouter>);
    expect(screen.getByTestId('page-header').textContent).toContain('Dashboard');
    expect(screen.queryByText(/Total Invoices/i)).toBeNull();
  });

  it('renders successfully with data', async () => {
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url === '/dashboard/summary') return Promise.resolve(mockSummary);
      if (url === '/clients?limit=1') return Promise.resolve(mockClientsList);
      return Promise.reject(new Error('Not found'));
    });

    render(<MemoryRouter><DashboardPlaceholder /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText('Total Invoices')).toBeDefined();
    });

    // Verify derived values and formats
    expect(screen.getByText('6')).toBeDefined(); // Total Invoices (1+2+3)
    expect(screen.getByText('42')).toBeDefined(); // Total Clients
    expect(screen.getByText('₹12,000.00')).toBeDefined(); // Paid
    expect(screen.getByText('₹5,000.50')).toBeDefined(); // Outstanding

    // Verify recent invoices rendering
    expect(screen.getByText('Acme Corp')).toBeDefined();
    expect(screen.getByText('INV-001')).toBeDefined();

    // Verify recent payments rendering
    expect(screen.getByText('BANK TRANSFER')).toBeDefined();
  });

  it('renders successfully even if clients API fails', async () => {
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url === '/dashboard/summary') return Promise.resolve(mockSummary);
      if (url === '/clients?limit=1') return Promise.reject(new Error('Failed'));
      return Promise.reject(new Error('Not found'));
    });

    render(<MemoryRouter><DashboardPlaceholder /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText('Total Invoices')).toBeDefined();
    });

    // Client total should render as '-'
    expect(screen.getByText('-')).toBeDefined();
  });

  it('shows error state when dashboard API fails with 403', async () => {
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url === '/dashboard/summary') return Promise.reject(new ApiError(403, 'Forbidden'));
      return Promise.resolve(mockClientsList);
    });

    render(<MemoryRouter><DashboardPlaceholder /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText(/You do not have permission/i)).toBeDefined();
    });
  });

  it('shows error state when dashboard API fails generically', async () => {
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url === '/dashboard/summary') return Promise.reject(new Error('Network Error'));
      return Promise.resolve(mockClientsList);
    });

    render(<MemoryRouter><DashboardPlaceholder /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load dashboard data/i)).toBeDefined();
    });
  });
});
