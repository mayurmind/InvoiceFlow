import * as React from 'react';
import type { User, AuthState, AuthContextType } from '../types/auth.types';
import { apiClient, apiEvents } from '../../../lib/api/client';

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [status, setStatus] = React.useState<AuthState>('initializing');

  React.useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const data = await apiClient.get<{ user: User }>('/auth/me');
        if (mounted) {
          setUser(data.user);
          setStatus('authenticated');
        }
      } catch {
        if (mounted) {
          setUser(null);
          setStatus('unauthenticated');
        }
      }
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    // Listen for 401 Unauthorized errors from anywhere in the app
    const unsubscribe = apiEvents.onError((error) => {
      if (error.status === 401 && status === 'authenticated') {
        setUser(null);
        setStatus('unauthenticated');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [status]);

  const login = React.useCallback((newUser: User) => {
    setUser(newUser);
    setStatus('authenticated');
  }, []);

  const logout = React.useCallback(async () => {
    try {
      // To logout, we need a CSRF token first according to backend contract
      const { csrfToken } = await apiClient.get<{ csrfToken: string }>('/auth/csrf');
      await apiClient.post('/auth/logout', {
        headers: {
          'x-csrf-token': csrfToken
        }
      });
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const logoutAll = React.useCallback(async () => {
    try {
      const { csrfToken } = await apiClient.get<{ csrfToken: string }>('/auth/csrf');
      await apiClient.post('/auth/logout-all', {
        headers: {
          'x-csrf-token': csrfToken
        }
      });
    } catch (error) {
      console.error('Logout all failed', error);
    } finally {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const reloadUser = React.useCallback(async () => {
    try {
      const data = await apiClient.get<{ user: User }>('/auth/me');
      setUser(data.user);
    } catch (error) {
      console.error('Reload user failed', error);
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const value = React.useMemo(
    () => ({ user, status, login, logout, logoutAll, reloadUser }),
    [user, status, login, logout, logoutAll, reloadUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
