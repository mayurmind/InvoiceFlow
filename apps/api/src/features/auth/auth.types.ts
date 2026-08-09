export interface AccessTokenPayload {
  sub: string;
  sid: string;
  role: string;
  type: 'access';
}

export interface RefreshCredential {
  raw: string;
  hash: string;
}

export interface CookieOptions {
  name: string;
  value: string;
  options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    path: string;
    maxAge: number;
  };
}

import type { UserRole } from '../../generated/prisma/client';

export interface SanitizedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
}

export interface AuthContext {
  sessionId: string;
  user: SanitizedUser;
}
