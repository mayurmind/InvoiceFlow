import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ForcePasswordChange } from './ForcePasswordChange';
import { useAuth } from '../hooks/useAuth';
import type { User } from '../types/auth.types';
import { authApi } from '../api/auth.api';

vi.mock('../hooks/useAuth');
vi.mock('../api/auth.api');

const mockUser: User = {
  id: 'user-1',
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: 'User',
  role: 'SUPER_ADMIN',
  mustChangePassword: true,
  lastLoginAt: null,
};

describe('ForcePasswordChange', () => {
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

  it('renders correctly', () => {
    render(<ForcePasswordChange />);
    expect(screen.getByText('Action Required')).toBeInTheDocument();
    expect(screen.getByText('You must change your password before continuing.')).toBeInTheDocument();
  });

  it('handles success and reloads user', async () => {
    const mockReloadUser = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      status: 'authenticated',
      login: vi.fn(),
      logout: vi.fn(),
      logoutAll: vi.fn(),
      reloadUser: mockReloadUser,
    });
    vi.mocked(authApi.changePassword).mockResolvedValue(undefined);

    render(<ForcePasswordChange />);

    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newpassword123' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'newpassword123' } });

    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    await waitFor(() => {
      expect(authApi.changePassword).toHaveBeenCalledWith({
        currentPassword: undefined,
        newPassword: 'newpassword123'
      });
    });

    await waitFor(() => {
      expect(mockReloadUser).toHaveBeenCalled();
    });
  });

  it('can logout', async () => {
    const mockLogout = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      status: 'authenticated',
      login: vi.fn(),
      logout: mockLogout,
      logoutAll: vi.fn(),
      reloadUser: vi.fn(),
    });

    render(<ForcePasswordChange />);

    fireEvent.click(screen.getByRole('button', { name: /cancel and logout/i }));
    
    expect(mockLogout).toHaveBeenCalled();
  });
});
