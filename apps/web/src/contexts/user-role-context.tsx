'use client';

/**
 * Mock user role context for F1.4 application shell.
 *
 * IMPORTANT: This context provides UI-only role information for display purposes.
 * It is NOT an authentication or authorization mechanism.
 * Real user authentication and role-based access control will be implemented
 * in the future authentication/authorization phase.
 *
 * The mock role is hardcoded to SUPER_ADMIN so all navigation items are visible
 * during development/foundation phases.
 */
import * as React from 'react';
import type { UserRole } from '@/types/navigation';

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  initials: string;
}

/**
 * Static mock user — used only until real auth is implemented.
 * Replace this with real user data from the auth context in P8.
 */
export const MOCK_USER: MockUser = {
  id: 'mock-00000000-0000-0000-0000-000000000001',
  name: 'Admin User',
  email: 'admin@invoiceflow.local',
  role: 'SUPER_ADMIN',
  initials: 'AU',
};

interface MockUserContextValue {
  user: MockUser;
}

const MockUserContext = React.createContext<MockUserContextValue>({
  user: MOCK_USER,
});

/**
 * Provides the mock user to all descendants.
 * Wrap the application shell layout with this provider.
 */
export function MockUserProvider({ children }: { children: React.ReactNode }) {
  return (
    <MockUserContext.Provider value={{ user: MOCK_USER }}>{children}</MockUserContext.Provider>
  );
}

/**
 * Hook to access the current mock user.
 * Returns MOCK_USER (SUPER_ADMIN) until real auth is wired.
 */
export function useMockUser(): MockUser {
  return React.useContext(MockUserContext).user;
}
