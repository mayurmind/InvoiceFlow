import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ClientDetail } from './ClientDetail';
import { apiClient } from '../../../lib/api/client';
import { useAuth } from '../../auth/hooks/useAuth';
import type { User } from '../../auth/types/auth.types';

vi.mock('../../../lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

const mockUser: User = {
  id: 'user-1',
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: 'User',
  role: 'SUPER_ADMIN',
  mustChangePassword: false,
  lastLoginAt: null,
};

const mockClient = {
  id: 'client-1',
  name: 'Acme Corporation',
  email: 'contact@acme.corp',
  phone: '+919876543210',
  gstin: '27AAAAA0000A1Z5',
  pan: 'AAAAA0000A',
  addressLine1: '123 Acme Street',
  addressLine2: 'Suite 100',
  city: 'Mumbai',
  state: 'Maharashtra',
  stateCode: '27',
  postalCode: '400001',
  country: 'India',
  notes: 'Important client',
  isArchived: false,
  archivedAt: null,
  createdAt: '2026-09-12T10:00:00Z',
  updatedAt: '2026-09-12T10:00:00Z',
};

const mockInvoicesResponse = {
  data: [
    {
      id: 'inv-1',
      invoiceNumber: 'INV-001',
      clientId: 'client-1',
      invoiceDate: '2026-09-12',
      dueDate: '2026-09-26',
      status: 'SENT',
      total: '1000.00',
    }
  ],
  pagination: {
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  }
};

describe('ClientDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      status: 'authenticated',
      login: vi.fn(),
      logout: vi.fn(),
      logoutAll: vi.fn(),
      reloadUser: vi.fn(),
    });

    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url.includes('/auth/csrf')) return { csrfToken: 'fake-token' };
      if (url.includes('/invoices')) return mockInvoicesResponse;
      if (url.includes('/clients/')) return mockClient;
      return null;
    });
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter initialEntries={['/clients/client-1']}>
        <Routes>
          <Route path="/clients/:clientId" element={<ClientDetail />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('renders client details correctly', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeDefined();
    });

    expect(screen.getByText('contact@acme.corp')).toBeDefined();
    expect(screen.getByText('+919876543210')).toBeDefined();
    expect(screen.getByText('27AAAAA0000A1Z5')).toBeDefined();
    expect(screen.getByText('AAAAA0000A')).toBeDefined();
    expect(screen.getByText('123 Acme Street')).toBeDefined();
    expect(screen.getByText('Suite 100')).toBeDefined();
    expect(screen.getByText('Mumbai, Maharashtra 400001')).toBeDefined();
    expect(screen.getByText('Important client')).toBeDefined();
  });

  it('renders client invoice ledger', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('INV-001')).toBeDefined();
    });

    expect(screen.getAllByText('Acme Corporation').length).toBeGreaterThan(1); // One in header, one in table
    expect(screen.getByText('₹1,000.00')).toBeDefined(); // Formatted amount
  });

  it('shows error on 404', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url.includes('/clients/')) throw { status: 404 };
      if (url.includes('/invoices')) return mockInvoicesResponse;
      return null;
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Client not found.')).toBeDefined();
    });
  });

  it('handles archive action', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ ...mockClient, isArchived: true });
    
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Archive')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Archive'));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/clients/client-1/archive',
        { headers: { 'x-csrf-token': 'fake-token' } }
      );
    });
  });
});
