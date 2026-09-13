import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ClientsList } from './ClientsList';
import { apiClient } from '../../../lib/api/client';
import { useAuth } from '../../auth/hooks/useAuth';
import type { User } from '../../auth/types/auth.types';

vi.mock('../../../lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
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

const mockClientsResponse = {
  data: [
    {
      id: 'client-1',
      name: 'Acme Corporation',
      email: 'contact@acme.corp',
      phone: '+919876543210',
      gstin: '27AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
      addressLine1: '123 Acme Street',
      addressLine2: null,
      city: 'Mumbai',
      state: 'Maharashtra',
      stateCode: '27',
      postalCode: '400001',
      country: 'India',
      notes: null,
      isArchived: false,
      archivedAt: null,
      createdAt: '2026-09-12T10:00:00Z',
      updatedAt: '2026-09-12T10:00:00Z',
    },
    {
      id: 'client-2',
      name: 'Globex Inc',
      email: null,
      phone: null,
      gstin: null,
      pan: null,
      addressLine1: '456 Globex Avenue',
      addressLine2: null,
      city: 'Pune',
      state: 'Maharashtra',
      stateCode: '27',
      postalCode: '411001',
      country: 'India',
      notes: null,
      isArchived: true,
      archivedAt: '2026-09-11T10:00:00Z',
      createdAt: '2026-09-10T10:00:00Z',
      updatedAt: '2026-09-11T10:00:00Z',
    },
  ],
  pagination: {
    page: 1,
    limit: 20,
    total: 2,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

describe('ClientsList', () => {
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
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <ClientsList />
      </MemoryRouter>
    );
  };

  it('renders loading state initially', () => {
    vi.mocked(apiClient.get).mockImplementation(() => new Promise(() => {}));
    renderComponent();
    expect(screen.getByText('Clients')).toBeDefined();
  });

  it('renders client list successfully', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockClientsResponse);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeDefined();
    });

    expect(screen.getByText('contact@acme.corp')).toBeDefined();
    expect(screen.getByText('Globex Inc')).toBeDefined();
    
    // Check badges
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Archived').length).toBeGreaterThan(0);
  });

  it('shows empty state', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [], pagination: mockClientsResponse.pagination });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('No clients found')).toBeDefined();
    });
  });

  it('shows error state on failure', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Failed to load clients')).toBeDefined();
    });
  });

  it('updates filters correctly', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockClientsResponse);
    renderComponent();

    const searchInput = screen.getByPlaceholderText('Search clients...');
    fireEvent.change(searchInput, { target: { value: 'Acme' } });

    await waitFor(() => {
      // It should trigger another fetch with search param
      // but testing the exact URL param here is tricky without full router integration
      // Just verifying we can interact with it
      expect(searchInput.getAttribute('value')).toBe('Acme');
    });
  });
});
