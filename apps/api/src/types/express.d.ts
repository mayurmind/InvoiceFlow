import 'express-serve-static-core';

import { AuthContext } from '../features/auth/auth.types';

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
    auth?: AuthContext;
  }
}
