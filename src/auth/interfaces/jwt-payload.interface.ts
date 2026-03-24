// src/auth/interfaces/jwt-payload.interface.ts

import { Role } from '../../common/enums/app.enums';

export interface JwtPayload {
  sub: string;       // User ID
  username: string;
  role: Role;
  iat?: number;
  exp?: number;
}
