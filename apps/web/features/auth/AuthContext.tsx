'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { UserProfile, LoginPayload, loginApi, getMeApi, logoutApi } from '@/lib/api/auth';
import { clearCsrfTokenCache } from '@/lib/api/client';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  role: 'SUPER_ADMIN' | 'STAFF' | 'VIEWER' | null;
  requiresPasswordChange: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = useCallback(async () => {
    try {
      const { user: profile } = await getMeApi();
      setUser(profile);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Handle route protection and password change redirection
  useEffect(() => {
    if (isLoading) return;

    const isAuthPage = pathname === '/login';
    const isChangePasswordPage = pathname === '/change-password';

    if (!user && !isAuthPage) {
      router.replace('/login');
    } else if (user) {
      if (user.mustChangePassword && !isChangePasswordPage) {
        router.replace('/change-password');
      } else if (!user.mustChangePassword && (isAuthPage || isChangePasswordPage)) {
        router.replace('/dashboard');
      }
    }
  }, [user, isLoading, pathname, router]);

  const login = async (payload: LoginPayload) => {
    setIsLoading(true);
    try {
      const { user: loggedInUser } = await loginApi(payload);
      setUser(loggedInUser);
      if (loggedInUser.mustChangePassword) {
        router.push('/change-password');
      } else {
        router.push('/dashboard');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await logoutApi();
    } catch {
      // Ignore logout errors
    } finally {
      setUser(null);
      clearCsrfTokenCache();
      router.push('/login');
    }
  };

  const role = user?.role || null;
  const isAuthenticated = !!user;
  const requiresPasswordChange = !!user?.mustChangePassword;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        role,
        requiresPasswordChange,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
