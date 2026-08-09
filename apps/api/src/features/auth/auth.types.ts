export interface AccessTokenPayload {
  sub: string;
  sid: string;
  role: string;
  type: 'access';
  iss?: string;
  aud?: string | string[];
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
