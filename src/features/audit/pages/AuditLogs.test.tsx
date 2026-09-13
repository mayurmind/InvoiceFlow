import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuditLogs } from './AuditLogs';
import { apiClient } from '../../../lib/api/client';
import { AuthProvider } from '../../auth/hooks/useAuth';
import type { ManagedUser } from '../../users/types/user.types';
import type { AuditLogResponse } from '../types/audit.types';

// Mock the API client
vi.mock('../../../lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
  },
  apiEvents: {
    onError: vi.fn(() => vi.fn()),
  }
}));

// Mock current user
const mockSuperAdmin: ManagedUser = {
  id: 'admin-1',
  email: 'admin@test.com',
  firstName: 'Admin',
  lastName: 'User',
  role: 'SUPER_ADMIN',
  isActive: true,
  mustChangePassword: false,
  lastLoginAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockStaff: ManagedUser = {
  ...mockSuperAdmin,
  id: 'staff-1',
  role: 'STAFF',
};

const mockUsersData: { data: ManagedUser[] } = {
  data: [
    { ...mockSuperAdmin },
    { ...mockStaff },
  ]
};

const mockAuditLogsData: AuditLogResponse = {
  total: 2,
  page: 1,
  limit: 20,
  totalPages: 1,
  data: [
    {
      id: 'log-1',
      createdAt: '2023-01-01T10:00:00Z',
      actorUserId: 'admin-1',
      actorUser: mockSuperAdmin,
      action: 'INVOICE_ISSUED',
      entityType: 'INVOICE',
      entityId: 'inv-1',
    },
    {
      id: 'log-2',
      createdAt: '2023-01-02T10:00:00Z',
      actorUserId: null,
      action: 'USER_DEACTIVATED',
      entityType: 'USER',
      entityId: 'user-2',
    }
  ]
};

describe('AuditLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithProviders = (initialEntries = ['/settings/audit'], user = mockSuperAdmin) => {
    // Override the token retrieval inside AuthProvider using localStorage for test
    localStorage.setItem('auth_token', 'fake-token');
    localStorage.setItem('auth_user', JSON.stringify(user));
    
    return render(
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/settings/audit" element={<AuditLogs />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );
  };

  it('renders loading state initially', () => {
    vi.mocked(apiClient.get).mockImplementation(() => new Promise(() => {}));
    renderWithProviders();
    expect(screen.getByRole('heading', { name: /Audit Logs/i })).toBeInTheDocument();
  });

  it('renders error state on API failure', async () => {
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url.includes('/audit')) return Promise.reject(new Error('API Error'));
      return Promise.resolve(mockUsersData);
    });
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Unable to load audit logs')).toBeInTheDocument();
    });
  });

  it('renders 403 error specifically', async () => {
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url.includes('/audit')) {
        const error = new Error('Forbidden') as Error & { response?: { status: number } };
        error.response = { status: 403 };
        return Promise.reject(error);
      }
      return Promise.resolve(mockUsersData);
    });
    
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('You do not have permission to view audit logs.')).toBeInTheDocument();
    });
  });

  it('renders audit logs successfully', async () => {
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url.includes('/users')) return Promise.resolve(mockUsersData);
      if (url.includes('/audit')) return Promise.resolve(mockAuditLogsData);
      return Promise.reject(new Error('Not found'));
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getAllByText('INVOICE_ISSUED')[0]).toBeInTheDocument();
    });

    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getAllByText('USER_DEACTIVATED')[0]).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('applies filters to URL and re-fetches', async () => {
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url.includes('/users')) return Promise.resolve(mockUsersData);
      if (url.includes('/audit')) return Promise.resolve(mockAuditLogsData);
      return Promise.reject(new Error('Not found'));
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getAllByText('INVOICE_ISSUED')[0]).toBeInTheDocument();
    });

    const actionSelect = screen.getByLabelText(/Filter by Action/i);
    fireEvent.change(actionSelect, { target: { value: 'INVOICE_CREATED', name: 'action' } });
    
    const submitBtn = screen.getByRole('button', { name: /Apply Filters/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('action=INVOICE_CREATED'));
    });
  });

  it('handles empty state', async () => {
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url.includes('/users')) return Promise.resolve(mockUsersData);
      if (url.includes('/audit')) return Promise.resolve({ ...mockAuditLogsData, data: [], total: 0 });
      return Promise.reject(new Error('Not found'));
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('No audit logs found')).toBeInTheDocument();
    });
  });
});
