export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

export type AuthState = 'initializing' | 'authenticated' | 'unauthenticated';

export interface AuthContextType {
  user: User | null;
  status: AuthState;
  login: (user: User) => void;
  logout: () => void;
  logoutAll: () => Promise<void>;
  reloadUser: () => Promise<void>;
}

export interface ChangePasswordPayload {
  currentPassword?: string;
  newPassword: string;
}
