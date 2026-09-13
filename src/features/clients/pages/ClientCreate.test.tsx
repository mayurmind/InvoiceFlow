import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ClientCreate } from './ClientCreate';
import { apiClient } from '../../../lib/api/client';
import { useAuth } from '../../auth/hooks/useAuth';
import type { User } from '../../auth/types/auth.types';

vi.mock('../../../lib/api/client', () => ({
  apiClient: {
    post: vi.fn(),
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

describe('ClientCreate', () => {
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
      <MemoryRouter initialEntries={['/clients/new']}>
        <Routes>
          <Route path="/clients/new" element={<ClientCreate />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('renders the form correctly', () => {
    renderComponent();
    expect(screen.getByText('Add New Client')).toBeDefined();
    expect(screen.getByLabelText(/Client Name/i)).toBeDefined();
    expect(screen.getByLabelText(/Email/i)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Create Client' })).toBeDefined();
  });

  it('shows validation errors for required fields', async () => {
    renderComponent();
    
    fireEvent.submit(screen.getByRole('button', { name: 'Create Client' }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeDefined();
    });
  });

  it('validates GSTIN structure and state code match', async () => {
    renderComponent();

    // Fill basic fields
    fireEvent.change(screen.getByLabelText(/Client Name/i), { target: { value: 'Acme Corp' } });
    fireEvent.change(screen.getByLabelText(/Address Line 1/i), { target: { value: '123 Acme St' } });
    fireEvent.change(screen.getByLabelText(/City/i), { target: { value: 'Mumbai' } });
    fireEvent.change(screen.getByLabelText(/State\/UT/i), { target: { value: '27' } }); // Maharashtra
    fireEvent.change(screen.getByLabelText(/PIN Code/i), { target: { value: '400001' } });
    
    // Invalid GSTIN length
    fireEvent.change(screen.getByLabelText(/GSTIN/i), { target: { value: '123' } });
    
    fireEvent.click(screen.getByRole('button', { name: 'Create Client' }));

    await waitFor(() => {
      expect(screen.getByText('GSTIN must be exactly 15 characters')).toBeDefined();
    });

    // Valid length, invalid format
    fireEvent.change(screen.getByLabelText(/GSTIN/i), { target: { value: '27AAAAA0000A1Z-' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Client' }));

    await waitFor(() => {
      expect(screen.getByText('GSTIN must be 15 alphanumeric characters')).toBeDefined();
    });

    // Valid format, mismatched state code (state is 27, GSTIN starts with 29)
    fireEvent.change(screen.getByLabelText(/GSTIN/i), { target: { value: '29AAAAA0000A1Z5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Client' }));

    await waitFor(() => {
      expect(screen.getByText('GSTIN state prefix does not match the selected state')).toBeDefined();
    });
  });

  it('submits successfully when form is valid', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ csrfToken: 'fake-token' });
    vi.mocked(apiClient.post).mockResolvedValue({ id: 'client-99' });
    
    renderComponent();

    fireEvent.change(screen.getByLabelText(/Client Name/i), { target: { value: 'Acme Corp' } });
    fireEvent.change(screen.getByLabelText(/Address Line 1/i), { target: { value: '123 Acme St' } });
    fireEvent.change(screen.getByLabelText(/City/i), { target: { value: 'Mumbai' } });
    fireEvent.change(screen.getByLabelText(/State\/UT/i), { target: { value: '27' } }); // Maharashtra
    fireEvent.change(screen.getByLabelText(/PIN Code/i), { target: { value: '400001' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create Client' }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/clients',
        {
          body: expect.objectContaining({
            name: 'Acme Corp',
            city: 'Mumbai',
            state: 'Maharashtra',
            stateCode: '27',
            postalCode: '400001',
            addressLine1: '123 Acme St',
            country: 'India',
          }),
          headers: { 'x-csrf-token': 'fake-token' },
        }
      );
    });
  });
});
