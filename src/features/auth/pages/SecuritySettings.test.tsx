import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SecuritySettings } from './SecuritySettings';
import { useAuth } from '../hooks/useAuth';
import type { User } from '../types/auth.types';

vi.mock('../hooks/useAuth');
vi.mock('../api/auth.api');

const mockUser: User = {
  id: 'user-1',
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: 'User',
  role: 'SUPER_ADMIN',
  mustChangePassword: false,
  lastLoginAt: null,
};

describe('SecuritySettings', () => {
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
    // mock window.confirm
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders correctly', () => {
    render(<SecuritySettings />);
    expect(screen.getByText('Security Settings')).toBeInTheDocument();
    expect(screen.getAllByText('Change Password')[0]).toBeInTheDocument();
    expect(screen.getByText('Active Sessions')).toBeInTheDocument();
  });

  it('can logout all', async () => {
    const mockLogoutAll = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      status: 'authenticated',
      login: vi.fn(),
      logout: vi.fn(),
      logoutAll: mockLogoutAll,
      reloadUser: vi.fn(),
    });

    render(<SecuritySettings />);

    fireEvent.click(screen.getByRole('button', { name: /log out of all sessions/i }));
    
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockLogoutAll).toHaveBeenCalled();
    });
  });
});
